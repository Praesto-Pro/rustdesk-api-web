# Docker deployment

The repository's **Publish container image** Actions workflow publishes to
`ghcr.io/praesto-pro/rustdesk-api-web` on relevant pushes to `master`, or manually
through `workflow_dispatch`. It creates `latest` on the default branch and a
`sha-<full-commit>` tag, and links the package to this repository. It uses the
workflow's `GITHUB_TOKEN` with `packages: write`; no additional registry secret
is needed. Organization policy must allow Actions and package creation.

```sh
docker pull ghcr.io/praesto-pro/rustdesk-api-web:latest
```

Private packages require GitHub Container Registry authentication to pull.

Build the production Vue frontend and serve it with Nginx:

```sh
docker build -t praesto-remote-control:local .
```

The image listens on port 8080 and proxies `/api/` to the existing RustDesk API.
Set `RUSTDESK_API_URL` to its reachable HTTP(S) origin, without a trailing slash
or path. The default is `http://127.0.0.1:21114`, usable when sharing the backend's
network namespace. An ordinary separate container needs an explicit backend URL.
For example, with the backend named `rustdesk-api` on a shared Docker network:

```sh
docker run -d --name praesto-remote-control \
  --network rustdesk -p 8080:8080 \
  -e RUSTDESK_API_URL=http://rustdesk-api:21114 \
  praesto-remote-control:local
```

Create the network and attach your existing backend before this command. For a
backend running on a Linux Docker host, use
`--add-host=host.docker.internal:host-gateway` and
`-e RUSTDESK_API_URL=http://host.docker.internal:21114`; the backend must listen
on a host interface reachable by Docker. No backend or credentials are bundled.
Place the frontend behind your existing HTTPS ingress for deployment.
Routes use the existing hash router. `/healthz` checks the frontend server only.

Builds in the managed cloud environment use its proxy defaults and public CA:

```sh
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" \
  -t praesto-remote-control:local .
```

The CA is mounted only during dependency installation and is not stored in the
image. Build tools and dependencies stay in the build stage. No registry push
is performed by these commands.
