# Dependency, security, and performance review

Reviewed 2026-10-30 against merged master `4ead17d8a2aecbaa2d8f8d6fd9f1fe35754ff462`.

## Scope

This PR updates the frontend dependency tree and hardens existing workflows without changing API adapters, request headers, backend endpoints, route identities, deployment environment values, or generated RustDesk protocol implementations. No backend or hosting changes are deployed by this PR.

The earlier chat described prepared changes, but no hardening branch, stash, or working-tree patch was available in this checkout or the published branches. The changes were reconstructed against current master. The supplied Google Drive checkout contained invalid Git refs created by Windows `desktop.ini` files; verification used a clean local clone.

## Dependency findings and production reachability

The baseline npm audit reports 25 affected package entries: 2 critical, 16 high, 6 moderate, and 1 low. These are package entries, not 25 independent remotely exploitable defects. Updated full and production-only audits report zero known vulnerabilities. Audit results reflect the registry advisory database at verification time.

| Baseline finding | Reachability assessment | Change |
| --- | --- | --- |
| Critical `form-data` boundary advisory, plus Axios HTTP/proxy/redirect findings | The critical boundary path uses Node's HTTP adapter; this application builds static browser assets using browser networking and native FormData. No Node request handler exists in this repository. Other Axios findings depend on specific configuration or prototype pollution; absence of a demonstrated attack is not proof that every advisory is unreachable. | Upgrade Axios and its transitive dependencies. |
| Critical protobuf.js code generation and schema findings | Checked-in generated code imports `protobufjs/minimal`. No runtime parsing or compilation of attacker-supplied schemas was found. The optional WebSocket helper still processes remote protocol messages, so message-decoding risks require separate live-session testing. | Declare the patched runtime directly; remove the unused ts-proto generator dependency and defer protocol imports. |
| Vue server-renderer XSS | This is a client-rendered Vue application; no SSR entry point or rendering server was found. | Upgrade Vue and its matching packages. |
| Vite development server and editor integration issues | These affect development tooling, not a deployment serving only `dist/`. Actual production hosting was not inspected. The dev command still binds to the network as before; it must not be used as a public production server. | Patch Vite within major version 6. |
| Webpack, serialize-javascript, terser-webpack-plugin, schema-utils, ajv | Arrived through sass-loader even though builds use Vite and Sass directly. Build-time exposure still matters for untrusted source and CI inputs. | Remove unused sass-loader and its webpack tree. |
| Remaining parser, source map, CSS, and utility advisories | Build tooling and browser dependencies have different preconditions. Package placement alone does not establish reachability. | Refresh the lockfile to patched versions; both audits gate CI. |

Primary advisory references: [form-data boundary prediction](https://github.com/advisories/GHSA-fjxv-7rqg-78g4), [protobuf.js code execution](https://github.com/advisories/GHSA-xq3m-2v4x-88gg), [Vue SSR attribute escaping](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6), [Axios advisories](https://github.com/axios/axios/security/advisories), and [Vite advisories](https://github.com/vitejs/vite/security/advisories). Reachability assessments above are repository-based inferences, not a penetration test of the deployed service.

## Frontend hardening

- Sanitize administrator-provided Markdown with DOMPurify while retaining ordinary HTML formatting. Malicious server content could otherwise execute in an authenticated operator's browser.
- Remove login-response logging. Logout clears both existing token keys, OIDC state, cached identity, and user/route state. Existing backend token revocation behavior is unchanged.
- Reject absent, malformed, expired, and implausibly future OIDC expiry values; retain the existing 60-second lifetime and storage keys.
- Accept only HTTP(S) authorization and web-client destinations without embedded credentials. Encode device IDs and share tokens, and open external windows without an opener. Host allowlisting is not imposed because identity providers and web-client hosts are deployment configured.
- Neutralize spreadsheet formula prefixes on CSV export, quote all cells, and handle null and empty data. CSV import uses a real parser and rejects malformed quotes, duplicate/missing headers, inconsistent columns, missing IDs, and invalid group IDs before sending creates. Allowed device fields and create endpoints remain unchanged. Formula-neutralized exported values intentionally retain a leading apostrophe on re-import.
- Resolve upload credentials when headers are read for the request rather than when an uploader mounts.
- Track successful session loading explicitly so an authenticated account with zero permitted pages does not repeatedly fetch its account.

Tokens remain in localStorage for compatibility with the existing web client. This PR does not claim to remove the impact of all same-origin script execution, revoke already issued tokens, or add server-side authorization.

## Performance

Element Plus template components and their styles are resolved on demand. Loading and programmatic message services keep explicit registration/styles. Removing the old forced vendor groups lets Vite preserve page-level splitting. Optional RustDesk protocol helpers load dynamically. Existing locale selection remains in the root config provider.

Measured from two separately installed, locked production builds using fresh Chromium contexts, the same synthetic API fixtures, and actual requested JS/CSS files:

| Cold page | Merged master gzip bytes | Updated gzip bytes | Reduction |
| --- | ---: | ---: | ---: |
| Sign-in | 490,269 | 226,688 | 53.8% |
| My devices | 503,807 | 335,816 | 33.3% |

Values sum per-file gzip level 9 and include lazy assets requested by each page. They exclude images/fonts and do not measure real network latency, server response time, or user interaction speed. Run `node scripts/verify-ui.mjs --measure-only --dist=PATH` to repeat measurements; results are written to `ui-artifacts/route-assets.json`. The remaining entry chunk is approximately 538 KB minified and still triggers Vite's 500 KB warning. Global icon registration and shared shell dependencies remain optimization opportunities.

## Verification

The production build, API/transport/environment/route contract checks, focused security regressions, and full browser suite are run before publication. Browser scenarios cover navigation, permissions, desktop/mobile layouts, localization, theme, authentication payloads, registration, OIDC, sanitized Markdown, empty permissions, and logout. Machine-readable results are recorded in `security-validation.json`; CI repeats dependency audits, security checks, contracts, build, and browser verification and uploads browser evidence.

The baseline contract script previously prohibited dependency and authentication edits entirely. It now explicitly protects unchanged API adapters, request transport, generated protocol implementations, deployment environment files, and route names/paths. Intentional security changes receive focused regression coverage instead of being described as byte-for-byte unchanged.

## Production follow-ups requiring deployment/backend access

1. Inspect the actual proxy/CDN response headers, TLS settings, framing policy, Referrer-Policy, MIME sniffing protection, and caching. Hashed assets can be cached immutably; the HTML entry should revalidate. Test a deployment-specific CSP in report-only mode before enforcing it: required API, OIDC, image, and WebSocket origins depend on the installation.
2. Test authorization on every backend operation with restricted credentials, token expiration/revocation after logout and password change, rate limits, and session lifecycle. Frontend route filtering is not an authorization boundary.
3. Verify OIDC code one-time use, replay prevention, provider redirect validation, and binding to the initiating session on the backend. Browser expiry is only local cleanup.
4. Run a real identity-provider round trip, native RustDesk launch, browser-client share, and remote-control session against a non-production test device, including patched protobuf runtime compatibility where that optional helper is used.

No live identity provider, backend, deployment headers, or remote device was contacted during the fixture tests. A clean dependency audit and passing local tests do not establish a secure production deployment.
