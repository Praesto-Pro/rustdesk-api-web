package praesto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/http/middleware"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/utils"
	"gorm.io/gorm"
)

type EmailToken struct {
	Hash      string `gorm:"primaryKey;size:64"`
	Purpose   string `gorm:"index"`
	UserID    uint
	Username  string
	Email     string `gorm:"index"`
	ExpiresAt int64  `gorm:"index"`
}

func (EmailToken) TableName() string { return "praesto_email_tokens" }

type RateEvent struct {
	ID     uint   `gorm:"primaryKey"`
	Bucket string `gorm:"index"`
	At     int64  `gorm:"index"`
}

func (RateEvent) TableName() string { return "praesto_email_rate_events" }

var rateMu sync.Mutex

func digest(value string) string { h := sha256.Sum256([]byte(value)); return hex.EncodeToString(h[:]) }
func allowRate(key string, max int64, window time.Duration) bool {
	rateMu.Lock()
	defer rateMu.Unlock()
	now := time.Now().Unix()
	global.DB.Where("at < ?", now-86400).Delete(&RateEvent{})
	var count int64
	key = digest(key)
	if err := global.DB.Model(&RateEvent{}).Where("bucket = ? AND at > ?", key, now-int64(window.Seconds())).Count(&count).Error; err != nil || count >= max {
		return false
	}
	return global.DB.Create(&RateEvent{Bucket: key, At: now}).Error == nil
}
func issueToken(purpose string, userID uint, username, email string, ttl time.Duration) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	raw := hex.EncodeToString(b)
	global.DB.Where("expires_at < ?", time.Now().Unix()).Delete(&EmailToken{})
	err := global.DB.Create(&EmailToken{Hash: digest(raw), Purpose: purpose, UserID: userID, Username: username, Email: email, ExpiresAt: time.Now().Add(ttl).Unix()}).Error
	return raw, err
}
func accountLink(s Settings, purpose, token string) string {
	// Tokens stay in the URL fragment, never in reverse-proxy request logs.
	return s.PublicURL + "/#/email?action=" + url.QueryEscape(purpose) + "&token=" + url.QueryEscape(token)
}
func reply(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": data, "message": ""})
}
func fail(c *gin.Context, message string) {
	c.JSON(http.StatusOK, gin.H{"code": 101, "data": nil, "message": message})
}
func bind(c *gin.Context, target any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 65536)
	if c.ShouldBindJSON(target) != nil {
		fail(c, "Enter valid form values.")
		return false
	}
	return true
}
func Register(g *gin.Engine) {
	if err := global.DB.AutoMigrate(&Settings{}, &EmailToken{}, &RateEvent{}); err != nil {
		panic("Praesto email schema migration failed")
	}
	public := g.Group("/api/admin/account")
	public.GET("/options", func(c *gin.Context) {
		s, err := loadSettings()
		if err != nil {
			fail(c, "Account options could not load.")
			return
		}
		reply(c, gin.H{"reset_enabled": s.SMTPEnabled && s.ResetEnabled && !global.Config.App.DisablePwdLogin, "invite_enabled": s.SMTPEnabled && s.InviteEnabled && !global.Config.App.DisablePwdLogin})
	})
	public.POST("/request-reset", requestReset)
	public.POST("/complete", complete)
	browser := g.Group("/api/admin/account", middleware.BackendUserAuth())
	browser.GET("/browser-config", func(c *gin.Context) {
		s, err := loadSettings()
		if err != nil {
			fail(c, "Browser connection settings could not load.")
			return
		}
		id, relay := s.BrowserIDServer, s.BrowserRelayServer
		if s.PublicURL != "" {
			u, _ := url.Parse(s.PublicURL)
			if id == "" {
				id = "wss://" + u.Host + "/ws/id"
			}
			if relay == "" {
				relay = "wss://" + u.Host + "/ws/relay"
			}
		}
		reply(c, gin.H{"client_url": s.BrowserClientURL, "id_server": id, "relay_server": relay, "key": global.Config.Rustdesk.Key})
	})
	admin := g.Group("/api/admin/settings", middleware.BackendUserAuth(), middleware.AdminPrivilege())
	admin.GET("", func(c *gin.Context) {
		s, err := loadSettings()
		if err != nil {
			fail(c, "Settings could not load.")
			return
		}
		reply(c, gin.H{"settings": s, "smtp_password_set": s.SMTPPassword != ""})
	})
	admin.POST("", func(c *gin.Context) {
		var f settingsForm
		if !bind(c, &f) {
			return
		}
		s, err := saveSettings(f)
		if err != nil {
			fail(c, err.Error())
			return
		}
		reply(c, gin.H{"settings": s, "smtp_password_set": s.SMTPPassword != ""})
	})
	admin.POST("/test-mail", func(c *gin.Context) {
		var f struct {
			Email string `json:"email"`
		}
		if !bind(c, &f) {
			return
		}
		if !validEmail(f.Email) {
			fail(c, "Enter a valid recipient email.")
			return
		}
		if !allowRate("test:"+c.ClientIP(), 10, time.Hour) {
			fail(c, "Too many test messages. Try again later.")
			return
		}
		s, err := loadSettings()
		if err != nil || deliverMail(s, f.Email, "Praesto email test", "Your Praesto mail settings are working.") != nil {
			fail(c, "Test email could not be sent. Check the SMTP settings, credentials, and server connectivity.")
			return
		}
		reply(c, nil)
	})
	admin.POST("/invite", invite)
}

var enqueueReset = func(email string) { go sendReset(email) }

const resetResponse = "If an eligible account matches that email, a password-reset link will be sent."

func requestReset(c *gin.Context) {
	var f struct {
		Email string `json:"email"`
	}
	if !bind(c, &f) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(f.Email))
	// Always use the same response for unknown, duplicate, disabled, rate-limited,
	// and SMTP-failure cases. Account lookup and delivery run after the response.
	if validEmail(email) && allowRate("reset-ip:"+c.ClientIP(), 10, time.Hour) && allowRate("reset-email:"+email, 3, time.Hour) {
		enqueueReset(email)
	}
	reply(c, gin.H{"message": resetResponse})
}
func sendReset(email string) {
	s, err := loadSettings()
	if err != nil || !s.SMTPEnabled || !s.ResetEnabled || global.Config.App.DisablePwdLogin {
		return
	}
	var users []model.User
	if global.DB.Where("LOWER(email) = ?", email).Limit(2).Find(&users).Error != nil || len(users) != 1 {
		return
	}
	u := users[0]
	if u.Status != model.COMMON_STATUS_ENABLE || u.Password == "" {
		return
	}
	raw, err := issueToken("reset", u.Id, "", email, 30*time.Minute)
	if err != nil {
		return
	}
	body := "A password reset was requested for your Praesto account.\n\n" + accountLink(s, "reset", raw) + "\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this message."
	if deliverMail(s, email, "Reset your Praesto password", body) != nil {
		global.DB.Where("hash = ?", digest(raw)).Delete(&EmailToken{})
		global.Logger.Warn("Praesto password-reset email delivery failed")
	}
}

var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.@+\-]{2,63}$`)

func invite(c *gin.Context) {
	var f struct {
		Username string `json:"username"`
		Email    string `json:"email"`
	}
	if !bind(c, &f) {
		return
	}
	f.Username = strings.ToLower(strings.TrimSpace(f.Username))
	f.Email = strings.ToLower(strings.TrimSpace(f.Email))
	if !usernamePattern.MatchString(f.Username) || !validEmail(f.Email) {
		fail(c, "Enter a username of 3–64 letters, digits, or . _ @ + - and a valid email.")
		return
	}
	s, err := loadSettings()
	if err != nil || !s.SMTPEnabled || !s.InviteEnabled || global.Config.App.DisablePwdLogin {
		fail(c, "Email invitations are not enabled.")
		return
	}
	var count int64
	if err = global.DB.Model(&model.User{}).Where("username = ? OR LOWER(email) = ?", f.Username, f.Email).Count(&count).Error; err != nil {
		fail(c, "Could not check existing accounts.")
		return
	}
	if count > 0 {
		fail(c, "An account already uses that username or email. Use password reset for an existing account.")
		return
	}
	if !allowRate("invite-email:"+f.Email, 3, time.Hour) || !allowRate("invite-ip:"+c.ClientIP(), 30, time.Hour) {
		fail(c, "Too many invitations. Try again later.")
		return
	}
	raw, err := issueToken("invite", 0, f.Username, f.Email, 48*time.Hour)
	if err != nil {
		fail(c, "Could not create invitation.")
		return
	}
	body := fmt.Sprintf("You have been invited to Praesto Remote Control as %s.\n\nChoose your own password to set up your account:\n%s\n\nThis link expires in 48 hours and can be used once.", f.Username, accountLink(s, "invite", raw))
	if deliverMail(s, f.Email, "Your Praesto account invitation", body) != nil {
		global.DB.Where("hash = ?", digest(raw)).Delete(&EmailToken{})
		fail(c, "Invitation could not be sent. Check SMTP settings and try again.")
		return
	}
	reply(c, gin.H{"message": "Invitation sent. The account will be created when the recipient sets a password."})
}
func complete(c *gin.Context) {
	var f struct {
		Token    string `json:"token"`
		Action   string `json:"action"`
		Password string `json:"password"`
	}
	if !bind(c, &f) {
		return
	}
	if !allowRate("complete:"+c.ClientIP(), 20, time.Minute) {
		fail(c, "Too many attempts. Try again shortly.")
		return
	}
	if len(f.Token) != 64 || (f.Action != "reset" && f.Action != "invite") {
		fail(c, "This link is invalid or has expired.")
		return
	}
	if len(f.Password) < 12 || len(f.Password) > 72 {
		fail(c, "Use a password of 12–72 bytes.")
		return
	}
	s, err := loadSettings()
	if err != nil || !s.SMTPEnabled || global.Config.App.DisablePwdLogin || (f.Action == "reset" && !s.ResetEnabled) || (f.Action == "invite" && !s.InviteEnabled) {
		fail(c, "This account action is no longer enabled. Contact your administrator.")
		return
	}
	hash, err := utils.EncryptPassword(f.Password)
	if err != nil {
		fail(c, "Password could not be saved.")
		return
	}
	err = global.DB.Transaction(func(tx *gorm.DB) error {
		var t EmailToken
		if err := tx.Where("hash = ? AND purpose = ? AND expires_at > ?", digest(f.Token), f.Action, time.Now().Unix()).First(&t).Error; err != nil {
			return errors.New("invalid link")
		}
		// A conditional delete claims the link; all user changes roll back with it.
		used := tx.Where("hash = ? AND expires_at > ?", t.Hash, time.Now().Unix()).Delete(&EmailToken{})
		if used.Error != nil || used.RowsAffected != 1 {
			return errors.New("invalid link")
		}
		if f.Action == "reset" {
			var u model.User
			if err := tx.First(&u, t.UserID).Error; err != nil || u.Status != model.COMMON_STATUS_ENABLE || strings.ToLower(u.Email) != t.Email || u.Password == "" {
				return errors.New("invalid account")
			}
			if err := tx.Model(&u).Update("password", hash).Error; err != nil {
				return err
			}
			if err := tx.Where("user_id = ?", u.Id).Delete(&model.UserToken{}).Error; err != nil {
				return err
			}
			return tx.Where("user_id = ? AND purpose = ?", u.Id, "reset").Delete(&EmailToken{}).Error
		}
		var count int64
		if err := tx.Model(&model.User{}).Where("username = ? OR LOWER(email) = ?", t.Username, t.Email).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("account already exists")
		}
		admin := false
		u := model.User{Username: t.Username, Email: t.Email, Password: hash, Status: model.COMMON_STATUS_ENABLE, IsAdmin: &admin}
		if err := tx.Create(&u).Error; err != nil {
			return err
		}
		return tx.Where("email = ? AND purpose = ?", t.Email, "invite").Delete(&EmailToken{}).Error
	})
	if err != nil {
		fail(c, "This link is invalid, expired, already used, or the account is no longer eligible.")
		return
	}
	reply(c, gin.H{"message": "Password saved. You can now sign in."})
}
