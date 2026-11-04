# syntax=docker/dockerfile:1
ARG API_IMAGE=lejianwen/rustdesk-api:latest
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Optional session CA for builds behind an intercepting HTTPS proxy.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY . .
RUN npm run build

# Build the upstream API at a reviewed commit with the Praesto account extension.
FROM golang:1.26.10-bookworm AS api-build
ARG UPSTREAM_API_REF=c5687e150615bfb00d9d105f0883a2802750a8ad
WORKDIR /src
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/proxy_ca > /tmp/build-ca.pem; \
      export SSL_CERT_FILE=/tmp/build-ca.pem GIT_SSL_CAINFO=/tmp/build-ca.pem; \
    fi; \
    git init .; \
    git remote add origin https://github.com/lejianwen/rustdesk-api.git; \
    git fetch --depth=1 origin "$UPSTREAM_API_REF"; \
    git checkout --detach FETCH_HEAD; \
    test "$(git rev-parse HEAD)" = "$UPSTREAM_API_REF"; \
    rm -f /tmp/build-ca.pem
COPY backend/go.mod backend/go.sum ./
COPY backend/upstream.patch /tmp/upstream.patch
RUN git apply /tmp/upstream.patch
COPY backend/praesto ./praesto
RUN --mount=type=secret,id=proxy_ca \
    --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/proxy_ca > /tmp/build-ca.pem; \
      export SSL_CERT_FILE=/tmp/build-ca.pem; \
    fi; \
    export GOTOOLCHAIN=local; \
    go mod download; \
    go mod verify; \
    go test -mod=readonly -p 3 ./praesto; \
    CGO_ENABLED=1 go build -mod=readonly -p 3 -tags 'netgo osusergo' \
      -ldflags "-s -w -linkmode external -extldflags '-static'" -o /out/apimain ./cmd/apimain.go; \
    rm -f /tmp/build-ca.pem

FROM ${API_IMAGE}
LABEL org.opencontainers.image.source="https://github.com/Praesto-Pro/rustdesk-api-web"
# Keep upstream resources, configuration, data layout, and startup command.
# Replace the API binary with the pinned upstream + account extension build.
# Replace the bundled admin UI completely, including obsolete assets.
RUN rm -rf /app/resources/admin
COPY --from=build /app/dist /app/resources/admin
COPY --from=api-build /out/apimain /app/apimain
# SMTP TLS verification needs trusted system roots in the minimal runtime image.
COPY --from=api-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
EXPOSE 21114
