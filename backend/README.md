# Praesto account/email API extension

The frontend needs real server support for editable messages, SMTP, invitations,
and email password resets. The combined Docker image builds the API source
checked in here, including `praesto/`. `upstream.patch` records the changes
already applied to register the new routes and select the persisted
administrator message. See the [upstream provenance](../docker/PROVENANCE.md)
for the source commit and licensing details.

`go.mod` and `go.sum` lock the upstream dependencies (upstream does not check in a
go.sum). Checksums were generated with Go's checksum database and are verified in
the image build. The extension adds no external Go dependencies. To refresh the
upstream source, update the checked-in snapshot and provenance, reapply the
patch, regenerate the locks, and rerun the tests and container smoke check.

## Deployment and use

Build/publish the combined image and replace only the existing rustdesk-api
container, preserving `/app/data` and the read-only RustDesk public-key mount.
Back up the database and configuration before upgrading. Merely deploying `dist/`
or changing Traefik labels does not install these API features.

1. As an administrator, open **Server settings → Account and email settings**.
2. Edit **Message from your administrator**. It supports sanitized Markdown and
   `{{username}}`; leaving it empty hides the panel. The initial default is English
   rather than the upstream Chinese welcome template.
3. Set **Public admin URL** to `https://remote.praesto.pro/_admin` for the current
   deployment. Include the admin app's actual path, omit its `#` route. Links use
   this trusted configured address, never an incoming Host header.
4. Enable outgoing email and set the SMTP host, port, STARTTLS (normally 587) or
   implicit TLS (normally 465), username, password, and sender email. Blank
   password preserves the saved credential; the checkbox explicitly clears it.
   Certificates and hostnames are verified; there is no insecure TLS option.
5. Enable password resets and/or invitations, save, then **Send test email** to a
   mailbox you control. Save before testing: the test uses persisted settings.
   SMTP requires outbound network access from rustdesk-api to your SMTP server;
   Traefik is only the inbound HTTP/WebSocket proxy and needs no SMTP routes.
6. **Forgot your password?** appears on sign-in when email resets are enabled.
   **Users → Invite by email** invites a standard user without an admin-selected
   password. Existing admin-created accounts remain supported. Email invitations
   do not grant administrator privileges or a user group; these can be assigned
   through the existing user administration after activation.

Tests use captured delivery and a local TLS SMTP fixture, including rejection of
untrusted certificates. No real email is sent by development tests. Delivery/inbox placement must be
verified using your actual SMTP configuration. A successful test API response
means the SMTP server accepted the message, not proof of inbox delivery.

## Persistence and security

- Settings and hashed email tokens are stored in the existing API database using
  additive `praesto_*` tables. Disabling mail does not erase the saved credentials.
- SMTP passwords use AES-GCM. `/app/data/praesto-mail.key` is generated with mode
  0600 and is never returned through the API. **Back up that key with the database**;
  encrypted credentials cannot be decrypted after losing it. The server refuses
  to silently replace a missing key when encrypted credentials already exist.
- Reset tokens expire in 30 minutes; invitations in 48 hours. They use 32 random
  bytes, are stored only as SHA-256 hashes, and are claimed transactionally once.
  Successful resets invalidate other reset links and all existing user sessions.
- Accounts must still be enabled and keep the same email when resetting. Unknown,
  duplicate, disabled, rate-limited, and delivery-failure reset requests receive
  the same generic response. SMTP sending happens asynchronously after the
  request so delivery timing does not reveal account existence.
- Reset requests have persistent per-IP/per-email rate limits. Completion and
  administrator email actions are also rate-limited. Configure the upstream
  API's trusted proxies to match the actual deployment rather than trusting
  arbitrary forwarded client-IP headers.
- Passwords must be 12–72 UTF-8 bytes, matching the upstream bcrypt limit. Email
  links put tokens in the URL fragment; they are not sent in proxy request paths.
  The form removes the token from visible browser history and keeps it in memory
  while open. If reloading the form loses the token, reopen the email link.
- Password-reset/invite operations are disabled when upstream password login is
  disabled. LDAP/SSO-only accounts without a local password are not eligible for
  local email password resets.

## Development validation

Run `bash backend/test.sh` with Go 1.26.10 and a C compiler. It verifies
dependency checksums, runs the race and integration tests, and builds the
checked-in API. The Account API verification workflow runs the same command.

Backend integration tests use temporary SQLite databases and captured delivery.
They cover admin authorization, durable encrypted settings, missing key handling,
validation, account creation on invite acceptance, token expiry/replay/purpose,
reset session revocation, disabled accounts, ambiguous emails, mail failures, and
rate limits. Browser tests exercise empty/error provider states, message editing,
SMTP settings/test, generic reset requests, invitation acceptance, and invitation
creation using synthetic API fixtures.

## Browser launch settings

Server settings also provides the browser client URL (default
`https://rustdesk.com/web/`) and separate WSS ID/relay addresses. With the public
admin URL saved, blank browser addresses derive `wss://remote.praesto.pro/ws/id`
and `/ws/relay`. The launch dialog exposes only the server public key, never
SMTP credentials or API/session tokens. All device and connection buttons use
this same dialog and the official client's `#/connect/<id>` deep link. Users
must save the custom server and key in the hosted client's settings once per
browser before launching a connection. Its separate origin prevents this admin
app from configuring those preferences automatically.

The old bundled client's `rs-sg.rustdesk.com:21118` connection error means it was
still using the public rendezvous default, not this deployment. Replacing the
path with `/webclient/` does not configure a private server or enable WebRTC.
