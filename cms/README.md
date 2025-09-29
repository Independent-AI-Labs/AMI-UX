# AMI Data Portal – Live Data Directory CMS

The Live Data Directory CMS gives AMI teams a single pane for observing live data assets, curating documentation, and wiring automation around high-signal events. It fuses the orchestrator’s file roots, upload buckets, and browser automation tooling into a workspace where DataOps, compliance, and agent developers can explore, annotate, and operationalise their content without leaving the portal.

## Why It Matters
- Create a self-serve “AMI Data Portal” surface where operators discover data sources, dashboards, and automation recipes in one place.
- Shorten the loop between observing live DOM changes and shipping automations by letting analysts capture triggers directly from rendered pages.
- Keep compliance and support partners engaged with the same tooling—the CMS honours auth, audit, and serving guardrails from the orchestrator stack.
- Provide runway for AI-powered actions (translation, scheduled triggers, agent launches) while the legacy documentation browser stays usable today.

## What Ships Today
- **Live directory + tabbed workspace**: `public/js/shell.js` lets users pin directories, HTML bundles, and Next apps in tabs, persist layout state (`/api/config`), and seed workspaces from saved selections.
- **Multi-surface rendering**: Modes A/B/C/D switch between inline HTML, packaged front-ends, markdown tree viewer, and app embeddings (`public/js/visualizers.js`, `public/doc.html`). CSP, path sanitation, and MIME inference are enforced server-side (`app/api/media/**`).
- **Uploads, library, and serving book-keeping**: The React-powered library drawer (`public/js/modal.js`) rides on `/api/library`, `/api/upload`, and `/api/serve` to bookmark entries, ingest folders, and memoise running services across restarts.
- **Automation scaffolding**: `packages/highlight-core` exposes the scenario manager + trigger composer used to map DOM events to scripted actions. Triggers live alongside content under `.meta/automation/` and are orchestrated via `/api/automation`.
- **Highlight + commenting chrome**: The highlight plugin (`packages/highlight-core/src/highlight-plugin/core/effects.js`) anchors automation, commenting, and “ask/share” affordances onto selected DOM nodes—future comments will persist as meta files per directory.
- **Authentication + policy guardrails**: `middleware.ts` wraps the app with `@ami/auth`, while APIs perform doc-root confinement, JSON persistence validation (`app/lib/store.ts`), and optional delegation to upstream auth gateways.
- **Operational tooling**: Scripts under `scripts/` manage dev runners, health checks, UI validation, and highlight extension builds. Tests in `tests/` cover uploads, LaTeX rendering, and format utilities; CI hooks reuse `npm run lint`, `npm run test`, and `scripts/validate-ui.mjs`.

## Active Roadmap & In-Development Features
- **Full Log & SSH Terminal / `~` Console**: `public/js/shell-console.js` already mounts multi-tab terminals with keyboard shortcuts; upcoming work wires it to agent logs, SSH relay sessions, and node health streaming so operators can pivot without leaving the CMS.
- **Auto-Translate File Action**: Planned action in the library modal + highlight overlay triggers translation pipelines for selected files, storing localized variants under `.meta/` while surfacing provenance in drawer metadata.
- **Event Type Coverage for DOM Triggers**: `packages/highlight-core/src/highlight-plugin/core/automation.js` normalises listener types; forthcoming updates expose the full event catalogue in the trigger composer UI (label will read `Event Type`) and ship presets for custom events emitted by AMI agents.
- **Scheduled Triggers**: Automation scenarios will gain cron-style configuration persisted through `/api/automation` so DOM or API actions can fire on timers in addition to live events.
- **Rich Text Edit**: The docs viewer is evolving into an inline editor with diff-aware saves back to `files/uploads/**` and `.meta/change-log`. Rich text editing builds on the highlight plugin’s selection plumbing and will reuse the comment system’s persistence format.
- **Agents Drawer**: A new drawer surfaces orchestrator agents, their capabilities, and launch parameters directly inside the CMS so analysts can invoke automations against the viewed directory.
- **Data Sources Drawer**: Connects the portal to upstream catalogues (warehouses, buckets, REST endpoints) and lets users map them into the Live Data Directory via metadata seeds.
- **API Drawer (MCP, REST)**: Centralises API clients for MCP endpoints and REST integrations, pairing credentials with automation triggers and giving users copy/pasteable snippets.
- **Infra Drawer**: Lists deploy targets, live services, and provisioning scripts so on-call staff can correlate content with runtime state.
- **Chat / Message Thread UI**: Adds collaborative threads scoped to directories/files, backed by meta comment files and orchestrator messaging.
- **Meta-File Comment System**: The highlight overlay’s comment action will drop one JSON file per discussion inside the asset’s own meta directory (for example `original_file.png.meta/comments/<id>.json`), keeping the audit trail git-friendly and portable across repos.
- **Video Streams**: Planned surface for live observability feeds—embedding stream URLs per directory and integrating with agent-driven playback controls.

## Architecture Snapshot
- **Next.js 15 service**: API routes under `app/api/**` serve trees, media, uploads, automation metadata, LaTeX rendering, authentication, and account management. Responses rely on `app/lib/*` helpers for persistence, doc-root resolution, and media roots.
- **Vanilla shell + React drawers**: `public/index.html` drives the shell with vanilla modules for speed, loading React on demand for complex drawers (library, scenario manager). Message passing between shell and docs viewer happens through `postMessage` channels (`public/js/message-channel.js`).
- **Highlight automation runtime**: `packages/highlight-core` powers selection overlays, trigger placement, scenario orchestration, and inline code execution. It is shared with the browser automation extension under `extension/highlight-plugin/`.
- **State & storage**: JSON files in `data/`, `files/uploads/`, and per-asset `.meta` directories hold workspace config, library entries, automation scenarios, rendered artefacts, and (soon) comments. `/api/automation` keeps scenario folders in sync.
- **Security layers**: Middleware ensures authenticated sessions; API handlers enforce within-root guards and capability flags (e.g., automation capabilities, writable roots). CSP policies restrict media origins; uploads sanitise names and paths.

## Run the CMS Locally
```sh
npm install
npm run dev   # serves http://localhost:3000 ; run in a separate terminal or background it
```

- `npm run lint` – ESLint 9 across the workspace.
- `npm run test` – Vitest/Jest suites and integration probes.
- `npm run build` / `npm run start` – production bundle + server.
- `npm run serve -- <command>` – portable runner (start/status/stop/logs/kill-orphans).

> Tip: background long-lived commands (`npm run dev &`) or launch them in another terminal so your active shell stays unblocked.

## Configuration Reference
- `DOC_ROOT` – primary live data directory (defaults to `../../../AMI-REACH/social`).
- `ALLOWED_EXTENSIONS` – comma-delimited whitelist for text-serving endpoints.
- `MEDIA_ROOTS` – optional labelled roots (`Label::/abs/path`) merged into `/api/media/list` alongside uploads and repo media.
- `AUTH_SECRET`, `AUTH_TRUST_HOST` – NextAuth session security knobs.
- `DATAOPS_AUTH_URL`, `DATAOPS_INTERNAL_TOKEN` – hook into the DataOps auth gateway instead of local credential files.
- `AUTH_CREDENTIALS_FILE`, `AUTH_ALLOWED_EMAILS` – offline credential configuration for the stubbed auth flow.

Workspace state persists in `data/config.json`; uploads land under `files/uploads/<timestamp>/`; automation metadata lives in `*.meta/automation/` beside the source asset.

## Core Workflows
- **Document & media exploration**: Use the Library drawer to open directories by path, upload folders, or select saved entries. Tabs persist across reloads and can be marked “served” to advertise running data apps.
- **Automation authoring**: Activate the highlight overlay, capture DOM nodes, and launch the scenario manager to script trigger behaviour. Triggers compile down to JavaScript snippets executed by the automation runtime.
- **Observability & upcoming console**: Watch the terminal drawer (currently read-only) for session multiplexing; planned log/SSH integration will bridge CMS session context with orchestrator-managed nodes.
- **Meta-data & comments**: The overlay’s comment button will log structured feedback into `.meta` stores, making it easy to sync annotations into downstream repos and compliance reports.

## Testing & Health
- `npm run lint && npm run test` – baseline quality gate for local development.
- `scripts/validate-ui.mjs` – headless smoke test that exercises uploads, library interactions, serving, and automation bootstrapping.
- `scripts/health.mjs` – lightweight readiness probe for CI/ops.

## Related Documentation
- `SPEC-PORTAL.md` – high-level specification of the AMI Data Portal Live Data Directory CMS (created alongside this README).
- `docs/spec.md` – detailed breakdown of the current Next.js docs shell implementation.
- `docs/CMS-UI-Standardization.md` – design tokens and drawer/overlay guidelines for the CMS UI.
- `TODO.md` – backlog of immediate fixes and architectural follow-ups.
