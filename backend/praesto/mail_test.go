package praesto

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// A subprocess gives each transport check a fresh system certificate pool.
func TestSMTPTransportHelper(t *testing.T) {
	address := os.Getenv("PRAESTO_SMTP_TEST_ADDRESS")
	if address == "" {
		t.Skip("invoked only by the local TLS transport test")
	}
	host, port, _ := net.SplitHostPort(address)
	p, _ := strconv.Atoi(port)
	err := smtpDelivery(Settings{SMTPEnabled: true, SMTPHost: host, SMTPPort: p, SMTPMode: "tls", SMTPFrom: "sender@example.test"}, "recipient@example.test", "Praesto test", "Synthetic local SMTP message.")
	if os.Getenv("PRAESTO_SMTP_EXPECT_SUCCESS") == "1" {
		if err != nil {
			t.Fatal(err)
		}
	} else if err == nil {
		t.Fatal("SMTP accepted an untrusted TLS certificate")
	}
}
func TestSMTPTransportUsesTLSAndRejectsUntrustedCertificates(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Praesto local SMTP fixture"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}}
	der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	ca := filepath.Join(t.TempDir(), "fixture-ca.pem")
	if err = os.WriteFile(ca, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
		t.Fatal(err)
	}
	listener, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}, MinVersion: tls.VersionTLS12})
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	messages := make(chan string, 2)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 2; i++ {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			conn.SetDeadline(time.Now().Add(10 * time.Second))
			func() {
				defer conn.Close()
				r := bufio.NewReader(conn)
				fmt.Fprint(conn, "220 localhost ESMTP\r\n")
				for {
					line, err := r.ReadString('\n')
					if err != nil {
						return
					}
					switch {
					case strings.HasPrefix(line, "EHLO"):
						fmt.Fprint(conn, "250-localhost\r\n250 8BITMIME\r\n")
					case strings.HasPrefix(line, "MAIL FROM:"), strings.HasPrefix(line, "RCPT TO:"):
						fmt.Fprint(conn, "250 OK\r\n")
					case strings.HasPrefix(line, "DATA"):
						fmt.Fprint(conn, "354 End with dot\r\n")
						var body strings.Builder
						for {
							part, err := r.ReadString('\n')
							if err != nil {
								return
							}
							if part == ".\r\n" {
								break
							}
							body.WriteString(part)
						}
						messages <- body.String()
						fmt.Fprint(conn, "250 queued\r\n")
					case strings.HasPrefix(line, "QUIT"):
						fmt.Fprint(conn, "221 goodbye\r\n")
						return
					default:
						fmt.Fprint(conn, "500 unsupported\r\n")
					}
				}
			}()
		}
	}()
	for _, trusted := range []bool{true, false} {
		command := exec.Command(os.Args[0], "-test.run=^TestSMTPTransportHelper$", "-test.v")
		command.Env = append(os.Environ(), "PRAESTO_SMTP_TEST_ADDRESS="+listener.Addr().String(), "PRAESTO_SMTP_EXPECT_SUCCESS=0")
		if trusted {
			command.Env = append(command.Env, "SSL_CERT_FILE="+ca, "PRAESTO_SMTP_EXPECT_SUCCESS=1")
		}
		output, err := command.CombinedOutput()
		if err != nil {
			t.Fatalf("TLS fixture failed: %v\n%s", err, output)
		}
	}
	select {
	case body := <-messages:
		if !strings.Contains(body, "To: recipient@example.test") || !strings.Contains(body, "Synthetic local SMTP message.") {
			t.Fatal("SMTP message was not delivered intact")
		}
	case <-time.After(10 * time.Second):
		t.Fatal("SMTP did not receive a message")
	}
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("SMTP fixture did not finish")
	}
	select {
	case <-messages:
		t.Fatal("untrusted SMTP connection delivered a message")
	default:
	}
}
