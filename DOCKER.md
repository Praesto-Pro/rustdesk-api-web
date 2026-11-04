# Combined RustDesk API and Praesto frontend

This image extends `lejianwen/rustdesk-api:latest`, replacing its bundled admin
frontend with the modernized Praesto interface. It retains the upstream startup command, configuration, bundled legacy browser
client resources, and data layout. The API binary is now built from a pinned
upstream commit plus the Praesto account/email extension. See
[backend setup and email administration](backend/README.md) for the source pin,
SMTP settings, password resets, invitations, key backups, and verification.
Updating the runtime base image alone does not update the pinned API source.

The API and frontend share port **21114**. `/` redirects to `/_admin/`.
There is no separate Nginx service, port 8080, or `RUSTDESK_API_URL` setting.

## Replace the existing API service

In your existing Compose project, change only the API image to:

```yaml
services:
  rustdesk-api:
    container_name: rustdesk-api
    image: ghcr.io/praesto-pro/rustdesk-api-web:latest
    ports:
      - "21114:21114"
    volumes:
      - rustdesk_api_data:/app/data
      - rustdesk_data:/app/conf/data:ro
    restart: unless-stopped
```

Retain your existing top-level volume declarations, project name, environment,
networks, and other configuration. Keep any `RUSTDESK_API_*` values, including
the key-file path matching your read-only mount.

Before upgrading, stop the existing API and back up its database volume and
configuration. Upstream can run database migrations at startup. A `latest` tag
does not identify your previously installed version, so compatibility with an
existing database must be checked on a backup copy before production rollout.
Do not delete volumes or run `docker compose down -v`.

```sh
docker compose pull rustdesk-api
docker compose up -d --no-deps rustdesk-api
```

Private packages require GHCR authentication. The earlier frontend-only package
used this same `latest` tag: check that the combined-image workflow succeeded
before pulling, and deploy its `sha-<full-commit>` tag for an unambiguous version.

## Build

```sh
docker build --pull -t praesto-rustdesk-api:local .
```

For reproducible runtime resources, pin the base image with
`--build-arg API_IMAGE=lejianwen/rustdesk-api@sha256:<digest>`.
The API source version is pinned separately by `UPSTREAM_API_REF` in Dockerfile.
Managed cloud builds need the session CA for npm:

```sh
docker build --pull --secret id=proxy_ca,src="$CODEX_PROXY_CERT" \
  -t praesto-rustdesk-api:local .
```

The CA stays out of image layers. Application dependencies use the npm lockfile.

Run `python3 scripts/verify-container.py` after building. It creates disposable
volumes and containers, registers an account on the upstream image, replaces it
with the combined image using the same test data, and verifies frontend assets,
API login, the read-only key mount, browser-client resources, and restart
persistence. It removes only its own test containers and volumes. It does not
test migrations from an unidentified older production image.

## Publication

The **Publish container image** GitHub Actions workflow publishes relevant
`master` pushes and manual runs to `ghcr.io/praesto-pro/rustdesk-api-web`, with
`latest` on the default branch and `sha-<full-commit>` tags. It uses the workflow's
`GITHUB_TOKEN` with `packages: write` and links the package to this repository.
Organization policy must allow Actions and package creation.
Publication runs the disposable integration test before pushing the tested image.

## Traefik and browser connections

For `remote.praesto.pro`, see [the Traefik deployment configuration](deploy/traefik/README.md).
It preserves host networking and existing RustDesk data, adds WSS routing on port
443 and hosted-client CORS, and documents enabling WebRTC on compatible clients.
The old bundled `/webclient/` does not establish that `/webclient2/` exists:
upstream v2.7 removed the v2 assets. Use the official hosted client for the
new browser workflow; direct WebRTC requires compatible server signaling too.
