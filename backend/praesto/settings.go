// Package praesto extends the upstream API with persisted administrator settings
// and email-based account lifecycle flows. It uses the upstream DB and auth.
package praesto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/mail"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/lejianwen/rustdesk-api/v2/global"
	"gorm.io/gorm"
)

const defaultMessage = "Welcome, {{username}}. Contact your administrator if you need help with your account."

type Settings struct {
	BrowserClientURL   string `json:"browser_client_url"`
	BrowserIDServer    string `json:"browser_id_server"`
	BrowserRelayServer string `json:"browser_relay_server"`
	ID                 uint   `json:"-" gorm:"primaryKey"`
	Message            string `json:"message"`
	PublicURL          string `json:"public_url"`
	SMTPEnabled        bool   `json:"smtp_enabled"`
	SMTPHost           string `json:"smtp_host"`
	SMTPPort           int    `json:"smtp_port"`
	SMTPMode           string `json:"smtp_mode"`
	SMTPUsername       string `json:"smtp_username"`
	SMTPFrom           string `json:"smtp_from"`
	SMTPPassword       string `json:"-"`
	ResetEnabled       bool   `json:"reset_enabled"`
	InviteEnabled      bool   `json:"invite_enabled"`
}

func (Settings) TableName() string { return "praesto_settings" }

type settingsForm struct {
	Settings
	Password      string `json:"smtp_password"`
	ClearPassword bool   `json:"clear_smtp_password"`
}

var keyMu sync.Mutex

// The encryption key is private, persisted beside the API database, and must be
// backed up with it. SMTP credentials are never returned through the API.
func encryptionKey() ([]byte, error) {
	keyMu.Lock()
	defer keyMu.Unlock()
	dir := os.Getenv("PRAESTO_DATA_DIR")
	if dir == "" {
		dir = "/app/data"
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "praesto-mail.key")
	key, err := os.ReadFile(path)
	if err == nil {
		if len(key) != 32 {
			return nil, errors.New("invalid mail encryption key")
		}
		return key, nil
	}
	if !os.IsNotExist(err) {
		return nil, err
	}
	// Never silently replace a missing key when encrypted credentials exist.
	var count int64
	if err := global.DB.Model(&Settings{}).Where("smtp_password <> ?", "").Count(&count).Error; err != nil {
		return nil, err
	}
	if count != 0 {
		return nil, errors.New("restore the mail encryption key from backup")
	}
	key = make([]byte, 32)
	if _, err = rand.Read(key); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return nil, err
	}
	if _, err = f.Write(key); err != nil {
		f.Close()
		os.Remove(path)
		return nil, err
	}
	if err = f.Close(); err != nil {
		return nil, err
	}
	return key, nil
}
func cryptPassword(value string, encrypt bool) (string, error) {
	if value == "" {
		return "", nil
	}
	key, err := encryptionKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if encrypt {
		nonce := make([]byte, gcm.NonceSize())
		if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(value), nil)), nil
	}
	data, err := base64.StdEncoding.DecodeString(value)
	if err != nil || len(data) < gcm.NonceSize() {
		return "", errors.New("invalid encrypted password")
	}
	plain, err := gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
	return string(plain), err
}
func loadSettings() (Settings, error) {
	s := Settings{}
	err := global.DB.First(&s, 1).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Settings{ID: 1, Message: defaultMessage, SMTPPort: 587, SMTPMode: "starttls", BrowserClientURL: "https://rustdesk.com/web/"}, nil
	}
	if s.BrowserClientURL == "" {
		s.BrowserClientURL = "https://rustdesk.com/web/"
	}
	return s, err
}
func Message(fallback string) string {
	s, err := loadSettings()
	if err != nil {
		return defaultMessage
	}
	// A saved empty message intentionally hides the message panel.
	return s.Message
}
func validEmail(value string) bool {
	a, err := mail.ParseAddress(value)
	return err == nil && a.Address == value && !strings.ContainsAny(value, "\r\n")
}
func validateSettings(s Settings) error {
	for _, entry := range []struct{ value, scheme, label string }{
		{s.BrowserClientURL, "https", "browser client URL"},
		{s.BrowserIDServer, "wss", "browser ID server"},
		{s.BrowserRelayServer, "wss", "browser relay server"},
	} {
		if entry.value == "" {
			continue
		}
		u, err := url.Parse(entry.value)
		if err != nil || u.Scheme != entry.scheme || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return fmt.Errorf("enter a valid %s URL for the %s without credentials, query, or fragment", entry.scheme, entry.label)
		}
	}
	if len(s.Message) > 20000 {
		return errors.New("administrator message is too long")
	}
	if s.PublicURL != "" {
		u, err := url.Parse(s.PublicURL)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return errors.New("public URL must be an HTTPS admin URL without query parameters or a fragment")
		}
	}
	if (s.ResetEnabled || s.InviteEnabled) && (!s.SMTPEnabled || s.PublicURL == "") {
		return errors.New("configure SMTP and the public admin URL before enabling email flows")
	}
	if s.SMTPEnabled {
		if strings.TrimSpace(s.SMTPHost) == "" || strings.ContainsAny(s.SMTPHost, "/\r\n\t ") || s.SMTPPort < 1 || s.SMTPPort > 65535 {
			return errors.New("enter a valid SMTP hostname and port")
		}
		// Accept hostnames and IPv4/IPv6, but never a URL or host:port pair.
		if strings.Contains(s.SMTPHost, ":") && net.ParseIP(s.SMTPHost) == nil {
			return errors.New("SMTP host must not contain a port")
		}
		if s.SMTPMode != "starttls" && s.SMTPMode != "tls" {
			return errors.New("SMTP requires STARTTLS or implicit TLS")
		}
		if !validEmail(s.SMTPFrom) {
			return errors.New("enter a valid sender email address")
		}
	}
	return nil
}
func saveSettings(f settingsForm) (Settings, error) {
	old, err := loadSettings()
	if err != nil {
		return Settings{}, err
	}
	s := f.Settings
	s.ID = 1
	if s.BrowserClientURL == "" {
		s.BrowserClientURL = "https://rustdesk.com/web/"
	}
	s.PublicURL = strings.TrimRight(strings.TrimSpace(s.PublicURL), "/")
	s.SMTPHost = strings.TrimSpace(s.SMTPHost)
	s.SMTPFrom = strings.TrimSpace(s.SMTPFrom)
	s.SMTPPassword = old.SMTPPassword
	if f.ClearPassword {
		s.SMTPPassword = ""
	}
	if f.Password != "" {
		s.SMTPPassword, err = cryptPassword(f.Password, true)
		if err != nil {
			return Settings{}, fmt.Errorf("could not protect SMTP password")
		}
	}
	if err = validateSettings(s); err != nil {
		return Settings{}, err
	}
	if err = global.DB.Save(&s).Error; err != nil {
		return Settings{}, errors.New("could not save settings")
	}
	return s, nil
}
