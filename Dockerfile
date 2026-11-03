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

FROM nginx:1.28-alpine
LABEL org.opencontainers.image.source="https://github.com/Praesto-Pro/rustdesk-api-web"
ENV RUSTDESK_API_URL=http://127.0.0.1:21114
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -Y off -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
