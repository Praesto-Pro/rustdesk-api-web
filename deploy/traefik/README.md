# Praesto RustDesk: Traefik and browser connections

Prepared for `remote.praesto.pro`, with Traefik, hbbs, hbbr, and rustdesk-api on
the same Linux host using `network_mode: host`. The existing RustDesk Compose
services, commands, volumes, keys, and native ports remain unchanged.

## Apply in the existing Traefik project

1. Keep the existing Traefik Compose project name and directory so the
   `traefik-letsencrypt` volume and certificates are reused. Back up the existing
   Compose file. Merge `compose.yaml` here into that project's Compose file and
   copy the `dynamic/` directory beside it. Preserve any other existing services,
   routes, mounts, entrypoints, and settings.
2. Keep `ACME_EMAIL` in that project's `.env`. DNS for `remote.praesto.pro` must
   point to this host, with inbound TCP 80 and 443 available.
3. Remove or update any previously added Docker-label routers for this same
   hostname and `/ws/id` or `/ws/relay` paths. The supplied file provider owns these
   routes; duplicate routers with the same rule can select the wrong backend.
4. In that existing project directory, run:

   ```sh
   docker compose config --quiet
   docker compose up -d --no-deps traefik
   docker compose logs --tail=100 traefik
   ```

Do not run this example as a new Compose project or delete existing volumes.
Do not add ports 21120/21121: WSS uses the existing HTTPS entrypoint on 443.
Preserve native RustDesk firewall rules (including UDP 21116). There is no need
for browsers to access raw WebSocket ports 21118/21119 publicly when using this
proxy. Existing hbbs/hbbr host listeners still need to run on those local ports.

Traefik automatically handles WebSocket upgrades. The dynamic file routes:

| Public address | Host backend |
| --- | --- |
| `https://remote.praesto.pro/` | `http://127.0.0.1:21114` |
| `wss://remote.praesto.pro/ws/id` | `http://127.0.0.1:21118` |
| `wss://remote.praesto.pro/ws/relay` | `http://127.0.0.1:21119` |

API CORS permits the official hosted client origins `https://rustdesk.com` and
`https://www.rustdesk.com`, with credentials, rather than a wildcard. This does
not make the community API equivalent to Server Pro; hosted-client account/API
features need separate compatibility testing. Do not enter a Praesto API token
into an unverified integration or put tokens/passwords into connection URLs.

## Configure the official browser client

Open https://rustdesk.com/web/ and open its ID/relay server settings. Configure:

- ID server: `wss://remote.praesto.pro/ws/id`
- Relay server: `wss://remote.praesto.pro/ws/relay`
- Key: the existing hbbs **public** key (`id_ed25519.pub`); never the private key.
- If an API server is needed: `https://remote.praesto.pro`. First test direct
  device-ID connections without relying on community API account integration.

These are browser-specific settings. Keep native desktop ID/relay addresses and
ports unchanged. Enter the remote device ID and authenticate with that device's
normal password or approval flow. The hosted client's settings and storage are
on rustdesk.com; the Praesto admin cannot populate them through localStorage.

`/webclient2/` is not installed by these files. Upstream rustdesk-api v2.7 removed
its assets. WSS and WebRTC do not restore that route. The frontend Web Client buttons now show a connection dialog with the selected
device ID and your server settings. Open the hosted client's settings once to
save the custom ID/relay server and public key, then use **Connect to device**.
The supported hosted deep link is `https://rustdesk.com/web/#/connect/<device-id>`.
The admin app cannot set preferences on rustdesk.com's origin automatically.
Sharing buttons have been removed from the address-book screens.

## Enable WebRTC

Use RustDesk **1.5.0 or newer** on the remote endpoints and a current compatible
browser client. On each desktop endpoint, open:

**Settings → General → Other → Enable WebRTC P2P connection**

The corresponding advanced option is:

```text
enable-webrtc=Y
```

Enable the same option in the browser client if it is disabled for the custom
server. This is a **client option**, not a supported hbbs/hbbr Compose environment
variable. Do not add an invented `ENABLE_WEBRTC` or replace an endpoint's entire
configuration file. Existing managed clients can distribute this option through
their normal configuration management.

The official announcement requires support from both peers **and the server**;
it documents Server Pro support from **1.8.7**. This example preserves the existing
OSS server deployment and does not establish that its installed build supports
WebRTC signaling. Check the actual hbbs/hbbr versions and compatibility before
claiming direct WebRTC works. Enabling the client option and WSS alone is not
proof of server support. Do not switch to Server Pro without a separate migration
and licensing decision.

WebRTC can use a direct ICE path when supported and reachable, or a TURN-relayed
path. The WSS relay path remains needed for fallback. Traefik proxies WSS; it is
not a STUN/TURN service. Do not assume every session will be direct or add an
arbitrary TURN service without verifying the clients' supported configuration.

## Verify after deployment

```sh
curl -I https://remote.praesto.pro/_admin/
curl -i -X OPTIONS https://remote.praesto.pro/api/admin/login-options \
  -H 'Origin: https://rustdesk.com' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: content-type'
```

Expect a successful admin response and an OPTIONS response containing
`Access-Control-Allow-Origin: https://rustdesk.com`. A favicon response does not
establish connection readiness.

From the official browser client, check browser developer tools → Network → WS.
The ID connection should upgrade with **101 Switching Protocols** at `/ws/id`;
the relay connection should upgrade at `/ws/relay` when a relay session is used.
A plain HTTP GET to these endpoints may return an error because it is not a
WebSocket handshake. Finally connect to an authorized test endpoint and verify
remote input/video; inspect its connection information to distinguish direct
WebRTC from relay transport. No live session was tested in the development
workspace.

References:
- https://rustdesk.com/blog/rustdesk-1-5-0-webrtc-qos/
- https://rustdesk.com/blog/rustdesk-web-client-v2-preview/
- https://rustdesk.com/docs/en/self-host/client-configuration/advanced-settings/#enable-webrtc
- https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/faq/#8-add-websocket-secure-wss-support-for-the-id-server-and-relay-server-to-enable-secure-communication-for-all-platforms
