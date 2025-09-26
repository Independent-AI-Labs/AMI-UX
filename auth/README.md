# AMI UX Auth Module

This module centralises the NextAuth.js configuration and shared helpers that the UX surfaces (CMS, browser extension, future panels) rely on. It exposes:

- A credentials-first `AuthConfig` (`src/config.ts`) with JWT sessions and role metadata.
- A reusable server harness (`src/server.ts`) exporting `auth`, `signIn`, `signOut`, and route handlers.
- Middleware helpers (`src/middleware.ts`) for protecting static shells and API routes.
- Client utilities (`src/client.ts`) so legacy fetch callers include cookies and handle 401 redirects.
- A DataOps-facing bridge (`src/dataops-client.ts`) that talks to either the central auth service (`DATAOPS_AUTH_URL`) or a local credential file (`AUTH_CREDENTIALS_FILE`).

The module is intentionally framework-agnostic: `ux/cms`, other Next.js surfaces, and the highlight browser extension can all consume the same primitives without duplicating credentials logic.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Secret used by NextAuth for JWT encryption/signatures. Must be at least 32 characters. |
| `AUTH_TRUST_HOST` | Set to `true` when running behind a trusted reverse proxy. |
| `DATAOPS_AUTH_URL` | Optional URL for the Python DataOps auth gateway. Enables remote credential lookups and user synchronisation. |
| `DATAOPS_INTERNAL_TOKEN` | Bearer token presented to the DataOps gateway when `DATAOPS_AUTH_URL` is configured. |
| `AUTH_CREDENTIALS_FILE` | Local JSON file containing fallback credential records; useful for offline development. |
| `AUTH_ALLOWED_EMAILS` | Comma separated allow list enforced when using the local credentials file. |

See `docs/NextAuth-Integration.md` for project-wide rollout details.
