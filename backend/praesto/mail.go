package praesto

import (
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

// Replaced only by integration tests; production always verifies TLS.
var deliverMail = smtpDelivery

func smtpDelivery(s Settings, recipient, subject, body string) error {
	if !s.SMTPEnabled || !validEmail(recipient) {
		return errors.New("mail is not configured")
	}
	password, err := cryptPassword(s.SMTPPassword, false)
	if err != nil {
		return err
	}
	address := net.JoinHostPort(s.SMTPHost, strconv.Itoa(s.SMTPPort))
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	var conn net.Conn
	tlsConfig := &tls.Config{ServerName: s.SMTPHost, MinVersion: tls.VersionTLS12}
	if s.SMTPMode == "tls" {
		conn, err = tls.DialWithDialer(dialer, "tcp", address, tlsConfig)
	} else {
		conn, err = dialer.Dial("tcp", address)
	}
	if err != nil {
		return err
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(20 * time.Second))
	client, err := smtp.NewClient(conn, s.SMTPHost)
	if err != nil {
		return err
	}
	defer client.Close()
	if s.SMTPMode == "starttls" {
		if err = client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}
	if s.SMTPUsername != "" {
		if err = client.Auth(smtp.PlainAuth("", s.SMTPUsername, password, s.SMTPHost)); err != nil {
			return err
		}
	}
	if err = client.Mail(s.SMTPFrom); err != nil {
		return err
	}
	if err = client.Rcpt(recipient); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	// Only constant subjects and validated addresses are placed in headers.
	message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", s.SMTPFrom, recipient, subject, time.Now().Format(time.RFC1123Z), strings.ReplaceAll(body, "\n", "\r\n"))
	if _, err = writer.Write([]byte(message)); err != nil {
		return err
	}
	if err = writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}
