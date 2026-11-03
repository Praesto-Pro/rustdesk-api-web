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

FROM ${API_IMAGE}
LABEL org.opencontainers.image.source="https://github.com/Praesto-Pro/rustdesk-api-web"
# Keep upstream's API binary, configuration, resources, data volume and startup.
# Replace the bundled admin UI completely, including obsolete assets.
RUN rm -rf /app/resources/admin
COPY --from=build /app/dist /app/resources/admin
EXPOSE 21114
