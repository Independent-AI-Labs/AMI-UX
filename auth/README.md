# AMI UX Auth Module

UX Auth is the single source of truth for how AMI experiences authenticate users. By wrapping NextAuth.js conventions in shared helpers, it lets every UI surface ship secure sign-in flows without duplicating logic.

The module now bootstraps **credentials plus catalogue-driven OAuth providers** (Google Workspace, GitHub, Microsoft Entra ID, and custom OAuth2) from the DataOps auth service or local configuration. Consumers no longer need to hand-wire provider config—NextAuth picks up whatever the backend exposes and keeps the UI in sync.

## What You Get

The module centralises the NextAuth.js configuration and shared helpers that the UX surfaces (CMS, browser extension, future panels) rely on. It exposes:

- A catalogue-aware `AuthConfig` (`src/config.ts`) that combines AMI credential auth with OAuth providers served by DataOps (and can fall back to local `.env` definitions for Google, GitHub, Azure AD, or generic OAuth2).
- A reusable server harness (`src/server.ts`) exporting `auth`, `signIn`, `signOut`, and route handlers even when `next-auth` packages are missing (local stub mode).
- Middleware helpers (`src/middleware.ts`) for protecting static shells and API routes.
- Client utilities (`src/client.ts`) so legacy fetch callers include cookies and handle 401 redirects.
- A DataOps-facing bridge (`src/dataops-client.ts`) that talks to either the central auth service (`DATAOPS_AUTH_URL`) or local catalog files (`AUTH_PROVIDER_CATALOG_FILE`, `AUTH_CREDENTIALS_FILE`).

The module is intentionally framework-agnostic: `ux/cms`, other Next.js surfaces, and the highlight browser extension can all consume the same primitives without duplicating credentials logic.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Secret used by NextAuth for JWT encryption/signatures. Must be at least 32 characters. |
| `AUTH_TRUST_HOST` | Set to `true` when running behind a trusted reverse proxy. |
| `DATAOPS_AUTH_URL` | Optional URL for the Python DataOps auth gateway. Enables remote credential lookups and user synchronisation. |
| `DATAOPS_INTERNAL_TOKEN` | Bearer token presented to the DataOps gateway when `DATAOPS_AUTH_URL` is configured. |
| `AUTH_CREDENTIALS_FILE` | Local JSON file containing credential records for offline development. |
| `AUTH_ALLOWED_EMAILS` | Comma separated allow list enforced when using the local credentials file. |
| `AUTH_PROVIDER_CATALOG_FILE` | Optional JSON catalogue describing OAuth providers (mirrors the DataOps `/auth/providers/catalog` response). Used when `DATAOPS_AUTH_URL` is unavailable. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional direct Google OAuth credentials. Used only when no remote/catalogue entry exists. `GOOGLE_SCOPES` can override scopes, comma or space separated. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth credentials; respects `GITHUB_SCOPES`. |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` | Optional Microsoft Entra credentials. Set `AZURE_AD_TENANT_ID`, `AZURE_AD_SCOPES`, and `AZURE_AD_AUTHORITY` as needed. |

Other provider-specific toggles (for example `*_ALLOW_DANGEROUS_EMAIL_LINKING`) accept truthy strings (`true`, `1`, `yes`) to enable email linking in NextAuth.

See `docs/NextAuth-Integration.md` for project-wide rollout details.
