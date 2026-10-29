# Praesto Remote Control

A Vue 3 and Element Plus interface for the existing [RustDesk API](https://github.com/lejianwen/rustdesk-api).

Manage devices, saved connections, sharing, activity, and account access from a responsive workspace. The interface retains the existing backend API, permissions, and native/browser connection behavior.

## Development

Use Node.js 22 and the checked-in npm lockfile.

```sh
npm ci
npm run dev
```

The existing development environment and Vite proxy configuration continue to select the backend. No new backend configuration is required.

## Production build

```sh
npm ci
npm run build
```

The output remains `dist/`. Deploy it using the existing frontend hosting process. Hash-based routes and Vite's relative base remain unchanged.

## Navigation

| Section | Pages, subject to the signed-in user's permissions |
| --- | --- |
| Workspace | My devices, my connections, my address books, my tags, my shared links |
| Fleet | All devices, device groups, all connections, all address books, all tags |
| Activity | Connection history, file transfers, sign-in history, shared links, my sign-ins |
| Administration | Users, user groups, sign-in providers, access tokens, server settings |
| Account | My account |

Use **Find a page**, **Ctrl+K** on Windows/Linux, or **Command+K** on macOS to search the pages available to your account. Arrow keys select a result, Enter opens it, and Escape closes the search.

Navigation folds into a drawer on screens up to 1100 px wide. Theme, language, and account controls remain available inside that drawer. Desktop navigation can be collapsed; the preference is saved in the browser.

## Branding and appearance

- Product identity: `src/brand.js`, `src/components/BrandMark.vue`, and the Praesto SVG marks.
- Shared design tokens and responsive component styles: `src/styles/style.scss`.
- Navigation labels/grouping: `src/utils/navigation.js`.
- Authentication layouts: `src/styles/auth.scss`.

The product name is owned by the frontend. The existing server configuration is still fetched, including its welcome content and connection settings; a legacy server title does not replace the Praesto name.

## Backend compatibility

The redesign preserves:

- API endpoint paths, methods, request and response formats, and authentication transport.
- Existing route names, paths, and backend-provided `route_names` permissions.
- Existing token and RustDesk web-client storage keys.
- Native `rustdesk://` links and configured browser-client URLs.
- Password, CAPTCHA, registration, OIDC, and web-client availability settings.

New navigation derives from the already-filtered permitted route tree. Reorganizing the menu does not grant additional access.

## Verification

The frontend verification workflow builds the production app and runs browser checks with synthetic API fixtures. All API traffic is intercepted; these checks do not contact a live backend, sign in to a real account, or start remote sessions. Screenshots cover desktop, tablet, phone, dark theme, authentication, and data states.

See [the modernization review](docs/frontend-modernization.md) for the evaluation, implementation decisions, and validation scope.

## Attribution

Based on the original RustDesk API Web project by lejianwen. The existing MIT license and attribution are retained. UI direction follows the app-screen guidance in [Taste](https://github.com/Leonxlnx/taste-skill).
