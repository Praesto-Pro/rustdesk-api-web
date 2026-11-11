# Upstream provenance

The API source in `backend/` comes from [RustDesk API](https://github.com/lejianwen/rustdesk-api) by Lejianwen and contributors at commit [`c5687e150615bfb00d9d105f0883a2802750a8ad`](https://github.com/lejianwen/rustdesk-api/commit/c5687e150615bfb00d9d105f0883a2802750a8ad). Its MIT license is in `backend/LICENSE`. The checked-in source includes the changes recorded in `backend/upstream.patch`, the Praesto account extension, and Praesto's Go dependency versions. The patch documents the modifications and is already applied.

The files in `docker/runtime/` come from the Linux amd64 RustDesk API v2.7 image, `lejianwen/rustdesk-api@sha256:27d61ca245943cc00a7cc392531b3979a36073ef6ea3f216cfaa5c183ab54c04`. The snapshot includes the configuration, resources, and documentation. The combined image supplies its own API executable and admin UI. The legacy browser client's notices are in `docker/runtime/resources/web/assets/NOTICES`. The runtime version file retains the image's `2.7` value.

`docker/tzdata-2025b-r0.tar.gz` contains the installed `/usr/share/zoneinfo` tree from the same image, originally built from [IANA tzdata 2025b](https://data.iana.org/time-zones/releases/tzdata2025b.tar.gz) and packaged by Alpine. IANA's timezone data is in the public domain. The runtime uses the same Alpine 3.22.1 base layer as the reference image.

The Praesto UI builds on [RustDesk API Web](https://github.com/lejianwen/rustdesk-api-web) by lejianwen. Its MIT license is at the repository root.
