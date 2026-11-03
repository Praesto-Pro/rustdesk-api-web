# Combined RustDesk API and Praesto frontend

This image extends `lejianwen/rustdesk-api:latest`, replacing its bundled admin
frontend with the modernized Praesto interface. It retains the upstream API
binary, startup command, configuration, browser clients, and data layout. API
updates come from the upstream image; this repository does not maintain an API
source fork. The publishing workflow pulls current base images on each build.
Trigger the workflow manually to refresh the API between frontend changes.

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

For a reproducible API baseline, pass
`--build-arg API_IMAGE=lejianwen/rustdesk-api@sha256:<digest>`.
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
