# Frontend modernization review

## Scope and baseline

Product: **Praesto Remote Control**  
Repository: `Praesto-Pro/rustdesk-api-web`  
Baseline: `3998c2a9213fcd047252776d0f0db33e6717026c`

This change modernizes the existing Vue 3 / Element Plus frontend. It does not migrate frameworks, upgrade runtime dependencies, modify the backend, or introduce new API endpoints. Existing backend configuration, route identities, access permissions, and connection mechanisms remain authoritative.

## Evaluation and response

| Finding in the baseline | Change |
| --- | --- |
| Navigation is concentrated in two large My/System submenus. | Group authorized destinations by Workspace, Fleet, Activity, Administration, and Account, with visible labels and active-page cues. |
| Operators must browse menus to find less common functions. | Add permission-aware page search with Ctrl/Command+K and keyboard selection. |
| The shell assumes a permanent desktop sidebar. | Use a responsive navigation drawer for tablet and phone; retain account, language, and theme access. |
| Menus capture the route store once, and recent-page links discard query state. | Derive navigation reactively; recent pages retain their full paths. |
| Backend configuration can restore the old product name. | Keep the Praesto product name in the frontend while continuing to load the existing server content and connection settings. |
| Unsupported regional language values such as en-US leak raw translation keys. | Normalize supported locales and fall back to English when a translation is missing. |
| The settings UI removes focus outlines and uses non-button click targets. | Use semantic controls, accessible names, visible focus, and a skip link. |
| Authentication lacks robust busy/failure states. | Improve form submission, loading, CAPTCHA retry, provider options, and error presentation while preserving existing API calls. |
| Device tables reserve excessive width for many competing actions. | Keep Connect visible and move secondary actions into a compact menu; preserve existing operations. |
| Account forms and dialogs use fixed widths. | Constrain dialogs to the viewport and make account/form layouts responsive. |

## Design decisions

The primary question is **which device or saved connection does this technician need to reach?** Devices and saved connections lead the navigation; administration and account work remain explicit destinations.

The design applies Taste's **app-screen** guidance. A neutral frame surrounds a white working sheet, with a restrained Praesto blue accent, compact typography, quiet table rules, and one consistent icon family. The dark theme uses neutral dark surfaces. This preserves the existing system font and component library.

Praesto identity appears in the product wordmark, connection mark, document title, authentication screens, and favicon. Technical identifiers retain their existing names where compatibility requires them.

The interface contains no invented operational figures, client records, or synthetic status indicators. Fixtures used by browser verification exist only in the test runner.

## Route and permission compatibility

The route configuration is unchanged. All page links use the existing named routes rather than constructing paths from parent groups. This matters because several administrative routes use absolute paths.

The presentation layer consumes `useRouteStore().routes` after the existing backend permission filtering. Hidden routes and empty groups are excluded from navigation and search. Parameterized user-edit routes remain accessible through their existing workflows and highlight the Users destination.

The legacy root route remains the account page, preserving bookmarks. Explicit authorized sign-in return destinations retain their query strings. Accounts without access to the account page land on an available permitted page. The Praesto wordmark links to an available device destination when the account has one.

## Contracts preserved

- All files under `src/api/`.
- Request transport, API headers, token storage, and OIDC code storage.
- Native RustDesk connection and browser-client connection helpers.
- Backend route permission identifiers and route URLs.
- Existing deployment environment files and Vite base/proxy/output settings.
- Existing runtime and development dependency versions.

Only the frontend product title, language normalization, and browser layout preference handling change in the application settings store. Backend-supplied welcome content and server connection settings continue to be loaded.

## Validation approach

The provided interactive execution environment was unavailable. The review branch therefore includes a GitHub Actions build and browser verification path.

The browser runner serves only the built static frontend and intercepts API calls with explicit fixtures. External requests are blocked. It checks navigation, restricted permissions, deep links, keyboard search, responsive drawer behavior, theme persistence, authentication options, CAPTCHA submission, and device data states. It also produces before/after screenshots for visual review.

The baseline production build uses the original commit and the same locked dependency tree. The modernization build uses the proposed changes. Build and browser results are reported on the pull request; screenshots are retained as workflow artifacts.

The first verification run passed the production build, contract comparison, and all 14 browser scenarios. Visual review compared the original desktop device view with the new desktop workspace, mobile drawer, and sign-in screen. Follow-up verification additionally covers the hash-router skip link, existing translated navigation labels, restricted-account landing pages, registration payloads, and automatic SSO independent of password CAPTCHA.

These checks exercise frontend behavior against known contracts. They do not establish live backend availability, a successful real OIDC provider round trip, or an actual remote-control session.

## Follow-up observations outside this UI change

The original user store logs the login response; the account view renders server-provided Markdown as HTML; logout clears application state through a full reload. These deserve a separate authentication/content-hardening review. They were not expanded into a backend or authentication redesign here.

The locked application install reports 25 dependency advisories (1 low, 6 moderate, 16 high, 2 critical), and the production build retains an existing large-chunk warning. These are observed baseline findings, not a determination that each advisory is exploitable in production. Dependency upgrades and bundle splitting should be reviewed separately; retaining the lockfile isolates this UI change from dependency migration risk. Browser verification tools are installed in a separate temporary directory so they cannot alter the application dependency tree.
