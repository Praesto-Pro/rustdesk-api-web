# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Optional session CA for builds behind an intercepting HTTPS proxy.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY . .
RUN npm run build

# Build the checked-in API snapshot with the Praesto account extension.
FROM golang:1.26.10-bookworm AS api-build
WORKDIR /src
COPY backend/ ./
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

FROM alpine:3.22.1@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1
LABEL org.opencontainers.image.source="https://github.com/Praesto-Pro/rustdesk-api-web"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
ADD docker/tzdata-2025b-r0.tar.gz /
COPY docker/runtime/ /app/
RUN mkdir -p /app/data /app/runtime /app/resources/public/upload
COPY --from=build /app/dist /app/resources/admin
COPY --from=api-build /out/apimain /app/apimain
COPY LICENSE /app/LICENSE
COPY backend/LICENSE /app/LICENSE.rustdesk-api
COPY docker/PROVENANCE.md /app/UPSTREAM.md
# SMTP TLS verification needs trusted system roots in the minimal runtime image.
COPY --from=api-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
VOLUME /app/data
EXPOSE 21114
CMD ["./apimain"]
