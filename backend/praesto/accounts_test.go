package praesto

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lejianwen/rustdesk-api/v2/config"
	"github.com/lejianwen/rustdesk-api/v2/global"
	"github.com/lejianwen/rustdesk-api/v2/model"
	"github.com/lejianwen/rustdesk-api/v2/service"
	"github.com/lejianwen/rustdesk-api/v2/utils"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/sirupsen/logrus"
	"golang.org/x/text/language"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type testServer struct {
	router        *gin.Engine
	admin, member model.User
	mail          []string
	dbPath        string
}

func setup(t *testing.T) *testServer {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	t.Setenv("PRAESTO_DATA_DIR", dir)
	dbPath := filepath.Join(dir, "test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sql, _ := db.DB()
	sql.SetMaxOpenConns(1)
	t.Cleanup(func() { sql.Close() })
	if err = db.AutoMigrate(&model.User{}, &model.UserToken{}); err != nil {
		t.Fatal(err)
	}
	global.DB = db
	global.Config = config.Config{}
	global.Logger = logrus.New()
	bundle := i18n.NewBundle(language.English)
	global.Localizer = func(lang string) *i18n.Localizer { return i18n.NewLocalizer(bundle, lang) }
	service.New(&global.Config, db, global.Logger, nil, nil)
	ts := &testServer{dbPath: dbPath}
	hash, _ := utils.EncryptPassword("original-password")
	yes, no := true, false
	ts.admin = model.User{Username: "admin", Email: "admin@example.test", Password: hash, IsAdmin: &yes, Status: model.COMMON_STATUS_ENABLE}
	ts.member = model.User{Username: "member", Email: "member@example.test", Password: hash, IsAdmin: &no, Status: model.COMMON_STATUS_ENABLE}
	db.Create(&ts.admin)
	db.Create(&ts.member)
	db.Create(&model.UserToken{UserId: ts.admin.Id, Token: "admin-token", ExpiredAt: time.Now().Add(48 * time.Hour).Unix()})
	db.Create(&model.UserToken{UserId: ts.member.Id, Token: "member-token", ExpiredAt: time.Now().Add(48 * time.Hour).Unix()})
	ts.router = gin.New()
	Register(ts.router)
	oldEnqueue := enqueueReset
	enqueueReset = sendReset
	t.Cleanup(func() { enqueueReset = oldEnqueue })
	old := deliverMail
	deliverMail = func(s Settings, to, subject, body string) error {
		ts.mail = append(ts.mail, to+"\n"+subject+"\n"+body)
		return nil
	}
	t.Cleanup(func() { deliverMail = old })
	return ts
}
func (ts *testServer) call(t *testing.T, method, path, auth string, body any) map[string]any {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-token", auth)
	req.RemoteAddr = "192.0.2.1:12345"
	w := httptest.NewRecorder()
	ts.router.ServeHTTP(w, req)
	var res map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(w.Body.String(), err)
	}
	return res
}
func requireCode(t *testing.T, r map[string]any, code float64) {
	t.Helper()
	if r["code"] != code {
		t.Fatalf("wanted code %v, got %v", code, r)
	}
}
func configured(t *testing.T) Settings {
	t.Helper()
	s, err := saveSettings(settingsForm{Settings: Settings{Message: "Hello {{username}}", PublicURL: "https://remote.praesto.pro/_admin", SMTPEnabled: true, SMTPHost: "smtp.example.test", SMTPPort: 587, SMTPMode: "starttls", SMTPFrom: "support@example.test", SMTPUsername: "sender", ResetEnabled: true, InviteEnabled: true}, Password: "smtp-secret"})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func tokenFrom(body string) string {
	i := strings.Index(body, "&token=")
	if i < 0 {
		return ""
	}
	return strings.Fields(body[i+7:])[0]
}

func TestSettingsRequireAdministrator(t *testing.T) {
	s := setup(t)
	requireCode(t, s.call(t, "GET", "/api/admin/settings", "", nil), 403)
	requireCode(t, s.call(t, "GET", "/api/admin/settings", "member-token", nil), 403)
	requireCode(t, s.call(t, "POST", "/api/admin/settings", "member-token", map[string]any{"message": "unauthorized"}), 403)
	requireCode(t, s.call(t, "POST", "/api/admin/settings/invite", "member-token", map[string]any{"email": "new@example.test", "username": "new-user"}), 403)
	requireCode(t, s.call(t, "GET", "/api/admin/settings", "admin-token", nil), 0)
}
func TestSettingsPersistAndDoNotExposePassword(t *testing.T) {
	s := setup(t)
	saved := configured(t)
	if saved.SMTPPassword == "smtp-secret" || saved.SMTPPassword == "" {
		t.Fatal("password not encrypted")
	}
	res := s.call(t, "GET", "/api/admin/settings", "admin-token", nil)
	encoded, _ := json.Marshal(res)
	if strings.Contains(string(encoded), "smtp-secret") || strings.Contains(string(encoded), saved.SMTPPassword) {
		t.Fatal("credential leaked")
	}
	form := settingsForm{Settings: saved}
	form.Message = ""
	newer, err := saveSettings(form)
	if err != nil {
		t.Fatal(err)
	}
	if newer.SMTPPassword != saved.SMTPPassword {
		t.Fatal("blank password replaced saved password")
	}
	db, err := gorm.Open(sqlite.Open(s.dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sql, _ := db.DB()
	defer sql.Close()
	var persisted Settings
	if err = db.First(&persisted, 1).Error; err != nil {
		t.Fatal(err)
	}
	if persisted.Message != "" || persisted.SMTPPassword != saved.SMTPPassword {
		t.Fatal("settings did not persist")
	}
	password, err := cryptPassword(persisted.SMTPPassword, false)
	if err != nil || password != "smtp-secret" {
		t.Fatal("saved password cannot be decrypted")
	}
	info, _ := os.Stat(filepath.Join(os.Getenv("PRAESTO_DATA_DIR"), "praesto-mail.key"))
	if info.Mode().Perm() != 0600 {
		t.Fatal("key must be private")
	}
	if Message("legacy message") != "" {
		t.Fatal("empty message must hide panel")
	}
}
func TestSettingsRejectUnsafeValues(t *testing.T) {
	setup(t)
	s := configured(t)
	for _, base := range []string{"http://remote.example.test", "https://user:pass@example.test", "https://remote.example.test/#/login", "javascript:alert(1)"} {
		bad := s
		bad.PublicURL = base
		if validateSettings(bad) == nil {
			t.Fatal("accepted unsafe public URL", base)
		}
	}
	bad := s
	bad.SMTPMode = "none"
	if validateSettings(bad) == nil {
		t.Fatal("accepted plaintext SMTP")
	}
	bad = s
	bad.SMTPFrom = "mail@example.test\r\nBcc: attacker@example.test"
	if validateSettings(bad) == nil {
		t.Fatal("accepted header injection")
	}
	bad = s
	bad.SMTPEnabled = false
	if validateSettings(bad) == nil {
		t.Fatal("enabled reset without mail")
	}
}
func TestDefaultWelcomeMessage(t *testing.T) {
	setup(t)
	if Message("legacy Chinese message") != defaultMessage {
		t.Fatal("default message must be English")
	}
}
func TestInviteCreatesStandardAccountAndCannotReplay(t *testing.T) {
	s := setup(t)
	configured(t)
	r := s.call(t, "POST", "/api/admin/settings/invite", "admin-token", map[string]any{"username": "new-user", "email": "new@example.test"})
	requireCode(t, r, 0)
	if len(s.mail) != 1 {
		t.Fatal("invitation was not delivered")
	}
	token := tokenFrom(s.mail[0])
	if len(token) != 64 {
		t.Fatal("missing token")
	}
	var count int64
	global.DB.Model(&model.User{}).Where("username = ?", "new-user").Count(&count)
	if count != 0 {
		t.Fatal("account created before acceptance")
	}
	data := map[string]any{"token": token, "action": "invite", "password": "chosen-password-123"}
	requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", data), 0)
	var u model.User
	global.DB.Where("username = ?", "new-user").First(&u)
	if u.Id == 0 || u.IsAdmin == nil || *u.IsAdmin || u.Email != "new@example.test" {
		t.Fatal("wrong account permissions")
	}
	ok, _, _ := utils.VerifyPassword(u.Password, "chosen-password-123")
	if !ok {
		t.Fatal("password not hashed correctly")
	}
	requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", data), 101)
}
func TestResetRevokesSessionsAndAllResetLinks(t *testing.T) {
	s := setup(t)
	configured(t)
	sendReset(s.member.Email)
	if len(s.mail) != 1 {
		t.Fatal("reset was not delivered")
	}
	token := tokenFrom(s.mail[0])
	other, err := issueToken("reset", s.member.Id, "", s.member.Email, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", map[string]any{"token": token, "action": "reset", "password": "new-password-123"}), 0)
	var count int64
	global.DB.Model(&model.UserToken{}).Where("user_id = ?", s.member.Id).Count(&count)
	if count != 0 {
		t.Fatal("sessions were not revoked")
	}
	requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", map[string]any{"token": other, "action": "reset", "password": "another-password"}), 101)
	var u model.User
	global.DB.First(&u, s.member.Id)
	ok, _, _ := utils.VerifyPassword(u.Password, "new-password-123")
	if !ok {
		t.Fatal("reset password not saved")
	}
}
func TestExpiredTamperedAndWrongPurposeLinksFail(t *testing.T) {
	s := setup(t)
	configured(t)
	expired, _ := issueToken("reset", s.member.Id, "", s.member.Email, -time.Minute)
	active, _ := issueToken("reset", s.member.Id, "", s.member.Email, time.Hour)
	for _, data := range []map[string]any{{"token": expired, "action": "reset"}, {"token": strings.Repeat("a", 64), "action": "reset"}, {"token": active, "action": "invite"}} {
		data["password"] = "new-password-123"
		requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", data), 101)
	}
}
func TestDisabledAndChangedEmailAccountsCannotReset(t *testing.T) {
	s := setup(t)
	configured(t)
	token, _ := issueToken("reset", s.member.Id, "", s.member.Email, time.Hour)
	global.DB.Model(&s.member).Update("status", model.COMMON_STATUS_DISABLED)
	requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", map[string]any{"token": token, "action": "reset", "password": "new-password-123"}), 101)
	global.DB.Model(&s.member).Updates(map[string]any{"status": model.COMMON_STATUS_ENABLE, "email": "changed@example.test"})
	requireCode(t, s.call(t, "POST", "/api/admin/account/complete", "", map[string]any{"token": token, "action": "reset", "password": "new-password-123"}), 101)
}
func TestUnknownAndDuplicateEmailsDoNotSendReset(t *testing.T) {
	s := setup(t)
	configured(t)
	sendReset("unknown@example.test")
	no := false
	global.DB.Create(&model.User{Username: "duplicate", Email: s.member.Email, Password: s.member.Password, Status: model.COMMON_STATUS_ENABLE, IsAdmin: &no})
	sendReset(s.member.Email)
	if len(s.mail) != 0 {
		t.Fatal("sent reset for unknown or ambiguous email")
	}
	r := s.call(t, "POST", "/api/admin/account/request-reset", "", map[string]any{"email": "unknown@example.test"})
	requireCode(t, r, 0)
	if r["data"].(map[string]any)["message"] != resetResponse {
		t.Fatal("account enumeration response")
	}
}
func TestMailFailureDoesNotLeaveUsableInvitation(t *testing.T) {
	s := setup(t)
	configured(t)
	deliverMail = func(Settings, string, string, string) error { return errors.New("SMTP failure") }
	requireCode(t, s.call(t, "POST", "/api/admin/settings/invite", "admin-token", map[string]any{"username": "new-user", "email": "new@example.test"}), 101)
	var count int64
	global.DB.Model(&EmailToken{}).Count(&count)
	if count != 0 {
		t.Fatal("failed email left active token")
	}
}
func TestRateLimitAndFeatureFlags(t *testing.T) {
	s := setup(t)
	configured(t)
	for i := 0; i < 3; i++ {
		if !allowRate("email", 3, time.Hour) {
			t.Fatal("premature rate limit")
		}
	}
	if allowRate("email", 3, time.Hour) {
		t.Fatal("rate limit not enforced")
	}
	global.DB.Model(&Settings{}).Where("id = ?", 1).Update("invite_enabled", false)
	requireCode(t, s.call(t, "POST", "/api/admin/settings/invite", "admin-token", map[string]any{"username": "new-user", "email": "new@example.test"}), 101)
}
func TestMissingEncryptionKeyFailsClosed(t *testing.T) {
	setup(t)
	s := configured(t)
	os.Remove(filepath.Join(os.Getenv("PRAESTO_DATA_DIR"), "praesto-mail.key"))
	if _, err := cryptPassword(s.SMTPPassword, false); err == nil {
		t.Fatal("lost encryption key was silently replaced")
	}
}

func TestBrowserSettingsRequireLoginAndUsePublicWSS(t *testing.T) {
	s := setup(t)
	configured(t)
	requireCode(t, s.call(t, "GET", "/api/admin/account/browser-config", "", nil), 403)
	r := s.call(t, "GET", "/api/admin/account/browser-config", "member-token", nil)
	requireCode(t, r, 0)
	d := r["data"].(map[string]any)
	if d["client_url"] != "https://rustdesk.com/web/" || d["id_server"] != "wss://remote.praesto.pro/ws/id" || d["relay_server"] != "wss://remote.praesto.pro/ws/relay" {
		t.Fatal("incorrect hosted browser settings", d)
	}
	for _, value := range []Settings{{BrowserClientURL: "javascript:alert(1)"}, {BrowserIDServer: "ws://remote.example.test/ws/id"}, {BrowserRelayServer: "wss://user:password@remote.example.test/ws/relay"}} {
		if validateSettings(value) == nil {
			t.Fatal("unsafe browser URL accepted")
		}
	}
}
