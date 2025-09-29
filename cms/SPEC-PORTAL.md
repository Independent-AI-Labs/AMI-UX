# SPEC-PORTAL: AMI Data Portal – Live Data Directory CMS

## 0. Purpose of This Document
This spec captures how the Live Data Directory CMS inside `ux/cms` delivers the AMI Data Portal experience today, what work is in flight, and how the system fits into the broader orchestrator. Treat it as the authoritative reference for product value, architecture, and integration points when planning follow-on features or aligning partner teams.

## 1. Vision & Value Proposition
- **Unified operational surface**: Give DataOps, compliance, and agent builders a common workspace for browsing live documentation, data feeds, and service dashboards.
- **From observation to automation**: Convert DOM selections straight into automation triggers so analysts and operators can go from “I see something” to “ship a safe automation” in minutes.
- **Low-friction collaboration**: Persist comments, translations, and agent-driven actions next to the assets they describe so context travels across repos and reviews.
- **Launchpad for AI-enabled workflows**: The CMS provides guardrails, auth, and storage so upcoming AI/autonomy features (auto-translation, terminal control, scheduled triggers) have a safe execution lane.

## 2. Personas & Core Workflows
| Persona | Goals | High-value CMS Capabilities |
| --- | --- | --- |
| DataOps engineer | Validate live directory contents, keep data apps running, instrument automation triggers | Tabbed workspace, automation scenarios, terminal/log console, Infra drawer (WIP) |
| Agent developer | Prototype DOM triggers, integrate MCP/REST endpoints, manage agent hand-offs | Highlight overlay, trigger composer, Agents/API drawers (WIP) |
| Compliance / CX reviewer | Audit documentation, leave structured feedback, request translations | Docs viewer modes, comment meta-files (WIP), auto-translate action |
| Support / Field operator | Launch guided tasks, monitor events, reference live knowledge | Library presets, scheduled triggers (WIP), chat/message thread UI (WIP) |

## 3. System Overview
- **Client shell (`public/index.html`, `public/js/**`)**: Vanilla JS controls layout, tab management, and cross-frame messaging. React is loaded lazily for rich surfaces (library drawer, automation composer).
- **Docs viewer (`public/doc.html`)**: Tree + document renderer supports Markdown, CSV, Mermaid, KaTeX, and media streaming.
- **Server (`app/api/**`)**: Next.js 15 route handlers deliver filesystem APIs, automation metadata, uploads, account management, and LaTeX rendering.
- **Automation runtime (`packages/highlight-core`)**: Shared with the highlight browser extension. Handles DOM overlays, comment/trigger actions, scenario persistence, and code execution in response to DOM events.
- **Storage**: JSON configs live in `data/`; uploads in `files/uploads/`; every asset carries a dedicated meta directory (`<name>.meta/`) that houses automation state, comments, translations, logs, and other feature data (for example `reports/usage.md.meta/automation/`, `usage.md.meta/comments/<id>.json`, `usage.md.meta/translations/<locale>.json`).

## 4. Current Capabilities (Detailed)
### 4.1 Live Directory Workspace
- Tab strip (`public/js/shell.js`) maintains multiple directories/files/apps with persisted layout (`/api/config`).
- Modes A/B/C/D let users view inline HTML, packaged bundles, docs trees, or Next apps (`public/js/visualizers.js`).
- Status pills, context menus, and seed tabs keep critical assets always reachable.

### 4.2 Library, Uploads, and Serving
- Library drawer (`public/js/modal.js`) is React-based; handles path validation, uploads, bookmarking, and integrate-with-serving flows.
- Upload endpoint (`app/api/upload/route.ts`) sanitises paths, preserves folder structure, emits meta entries, and coordinates with automation storage for later use.
- Serving APIs (`app/api/serve/**`) track running assets, ready for future integration with orchestrator-managed runners.

### 4.3 Automation Authoring
- Highlight overlay (`packages/highlight-core/src/highlight-plugin/core/effects.js`) exposes “Add Automation Trigger” actions.
- Scenario manager + trigger composer (`packages/highlight-core/src/highlight-plugin/ui/scenario-manager.js`, `trigger-composer.js`, `trigger-dialog.js`) load and persist scenarios through `/api/automation`.
- Trigger execution pipeline (`packages/highlight-core/src/highlight-plugin/core/automation.js`) compiles target/condition/action scripts, resolves elements, and runs in response to DOM events.

### 4.4 Security & Identity
- `middleware.ts` wraps all routes with `@ami/auth`, redirecting unauthenticated visitors to `/auth/signin`.
- API handlers enforce within-root checks, capability flags, and JSON schema normalisation (`app/lib/store.ts`, `app/lib/doc-root.ts`, `app/lib/media-roots.ts`).
- Optional DataOps gateway support via `DATAOPS_AUTH_URL` and `DATAOPS_INTERNAL_TOKEN` for centralised credential validation.

### 4.5 Tooling & Ops
- Runner scripts (`scripts/server.mjs`, `scripts/runner.mjs`) start/stop dev services without blocking the current shell.
- `scripts/validate-ui.mjs` performs integration smoke tests covering uploads, library flows, and automation bootstrapping.
- Integration/unit tests under `tests/` cover LaTeX rendering, upload sanitisation, and data format helpers.

## 5. In-Development Features & Design Notes
### 5.1 Full Log & SSH Terminal / `~` Console
- `public/js/shell-console.js` already mounts multi-tab terminals with history/prompt support.
- Upcoming work: stream orchestrator logs, attach SSH relay sessions, honour per-node credentials (`AMI_HOST`, `SSH_DEFAULT_*`).
- UX: default to collapsed state, toggle via backtick; integrate with Infra drawer for context switching.

### 5.2 Auto-Translate File Action
- Triggered from library drawer and highlight overlay; pipes file contents through AMI translation MCP or REST endpoints.
- Stores translated artefacts under `<asset>.meta/translations/<locale>.json` with provenance metadata.
- Needs API surface to dispatch translation jobs and poll status; reuse automation scenarios for post-translation actions.

### 5.3 Event Type Coverage & Label Update
- Current datalist: `click`, `input`, `change`, `submit`, `focus`, `blur`, `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, `keydown`, `keyup` (`trigger-dialog.js`).
- Planned: expose full DOM event taxonomy (pointer, drag/drop, custom agent events) via curated groups, rename UI label to **Event Type**, and document mapping in automation spec.

### 5.4 Scheduled Triggers
- Extend `/api/automation` storage schema with `schedule` metadata (cron/string and timezone).
- Runtime change: background scheduler in Next/worker process to fire triggers independently of DOM events—will call automation manager with synthetic events.
- UI: scenario composer gains “Schedule” tab with preview of next runs.

### 5.5 Rich Text Edit
- Embed editor (ProseMirror/TipTap) into docs viewer, writing changes back via `/api/file` (new endpoint) and logging diffs to `.meta/change-log/*.json`.
- Introduce review workflow: pending edits stored in meta until approved/deployed.

### 5.6 Agents Drawer
- Drawer lists orchestrator agents, capabilities, last run metadata; launching an agent seeds context with current tab path, selected DOM nodes, or uploaded assets.
- Requires service registry API (under `backend/agents/`) and secure invocation channel.

### 5.7 Data Sources Drawer
- Surfaces data catalog entries, allowing operators to mount them as doc roots or upload targets.
- Integrates with `/api/media/list` via dynamic additions and extends automation triggers with data-source-specific context.

### 5.8 API Drawer (MCP, REST)
- Presents ready-to-run requests for MCP servers and REST APIs used in automation scripts.
- Couples credentials, sample payloads, and generated code snippets for the trigger composer.

### 5.9 Infra Drawer
- Mirrors orchestrator infra topology (clusters, services, instance health) so operators correlate docs with runtime state.
- Hooks into Node setup automation (`nodes/config/setup-service.yaml`) and Docker stacks described in repository-level docs.

### 5.10 Chat / Message Thread UI
- Inline side panel for discussions tied to tabs/files; persists to one JSON document per comment within each asset’s meta directory (for example `directory_x.meta/comments/<id>.json`) and optionally notifies orchestrator messaging services.
- Aligns with highlight overlay “Add Comment” action.

### 5.11 Meta-File Comment System
- Formalises comment schema (author, timestamp, selection, text, status) stored as individual files inside each asset’s meta directory.
- Viewers show comment badges; automation triggers can react to comment status (e.g., escalate unresolved items).

### 5.12 Video Streams
- Allows tabs to pin live observability feeds; metadata stored per asset with auth tokens.
- Requires secure media proxying via new API route and CSP exceptions.

## 6. Architecture Deep Dive
1. **Client Shell**
   - Modules: `shell.js`, `tab-strip.js`, `modal.js`, `account-drawer.js`, `dialog-service.js`, `visualizers.js`.
   - Communication: `message-channel.js` standardises postMessage events between shell and docs iframe.
   - Accessibility: Dialog/drawer portals manage focus traps and blur states (`public/js/dialog-service.js`).

2. **Server APIs**
   - `app/api/tree`, `file`, `media`, `media/list`, `pathinfo` – read-only filesystem access respecting allowlists.
   - `app/api/upload`, `library`, `serve`, `automation`, `latex` – mutating endpoints with JSON persistence.
   - `app/api/app/status` – host process probing for Next apps.
   - `app/api/account-manager/**`, `app/api/auth/**` – account CRUD and auth session management shared with `ux/auth`.

3. **Automation Engine**
   - Manager (`core/manager.js`) coordinates context, settings, and persistence.
   - Store (`core/automation-store.js`) handles HTTP interactions with `/api/automation`.
   - Runtime compilers (`core/automation.js`) sandbox and execute trigger scripts, caching compiled functions per trigger version.

4. **Storage Layout**
   - `data/config.json`, `data/library.json`, `data/served.json` – workspace state.
   - `files/uploads/<timestamp>/` – uploaded assets preserved by timestamp bucket.
   - `<asset>.meta/automation/` – scenarios (`scenario.json`) and triggers (`*.json`).
   - Planned: `<asset>.meta/comments/<id>.json`, `<asset>.meta/translations/<locale>.json`, `<asset>.meta/logs/*.txt`.

## 7. Data & Schemas
- **Automation Config (`automation.json`)**: `{ enabled: boolean, activeScenario: string, capabilities: { network, plugins, ... } }`.
- **Scenario (`scenario.json`)**: `{ slug, name, createdAt }`.
- **Trigger (`*.json`)**: `{ id, name, selector, eventType, dataPath, targetCode, conditionCode, actionCode, updatedAt, enabled }` + custom fields.
- **Library Entry**: persisted via `/api/library` with deterministic IDs based on absolute path.
- **Comment (planned)**: `{ id, author, role, createdAt, updatedAt, selection, body, status }` stored as standalone files under `<asset>.meta/comments/`.
- **Translation (planned)**: `{ locale, sourceHash, translatedAt, author, body, notes }` persisted as `<asset>.meta/translations/<locale>.json` so language variants stay version-controlled alongside the source.

## 8. API Surface Reference
| Route | Purpose | Notes |
| --- | --- | --- |
| `GET /api/tree` | Directory listing | honours `DOC_ROOT`, filters `.meta` |
| `GET /api/file` | Read text/markdown files | ETag + extension allowlist |
| `GET /api/media` | Serve static assets with CSP | modes A/B with `<base>` rewrites |
| `GET /api/media/list` | Enumerate roots | includes uploads + `MEDIA_ROOTS` |
| `GET /api/pathinfo` | Classify path | returns `{ type, meta }` for visualizer hints |
| `POST /api/upload` | Multipart upload | returns saved files + meta directory info |
| `GET/POST/PATCH /api/config` | Persist workspace state | used by shell tabs |
| `GET/POST /api/library` | Manage saved entries | rename/ delete via `PATCH/DELETE /api/library/[id]` |
| `GET/POST /api/serve` | Track running tabs | `DELETE /api/serve/[id]` stops |
| `GET /api/app/status` | Check Next app process | used by Mode D |
| `GET/POST /api/automation` | Load/update scenarios | actions: create-scenario, save-trigger, delete-trigger, set-config |
| `GET /api/served/[id]/...` | Proxy served assets | placeholder until real process management |
| `GET/POST /api/latex` | Render LaTeX assets | stores artefacts under `.meta` |

## 9. Automation Event Model
- **Current default events**: `click`, `input`, `change`, `submit`, `focus`, `blur`, `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, `keydown`, `keyup`.
- **Planned expansion**: pointer/drag suite (`pointerdown`, `pointerup`, `dragstart`, `drop`), visibility (`intersect`, `visibilitychange`), timers (`interval`, `timeout`), custom agent events (`ami:ready`, `ami:error`).
- **Label update**: UI label will change from `Event type` to `Event Type` in the trigger dialog and composer to match design guidance.
- **Scheduled triggers**: new `schedule` payload enables time-based execution without DOM events.

## 10. Integration Touchpoints
- **Orchestrator auth**: depends on `@ami/auth` package and `.env` values such as `AMI_HOST`, `AUTH_SECRET`.
- **Nodes / Setup**: Infra drawer and terminal rely on `nodes/scripts/setup_service.py` outputs and orchestrator-managed processes.
- **Agents & MCP**: API drawer will reference `cli-agents/*` tooling and orchestrator MCP endpoints.
- **Docker stacks**: Video streams and infra status reference services managed by repository-level compose files.

## 11. Tooling, Testing, and QA Expectations
- Developers run `npm run lint && npm run test` before committing.
- `scripts/validate-ui.mjs` should be extended alongside new UI flows (e.g., translation, comments) to avoid regressions.
- For automation features, add fixtures under `tests/` mirroring new schema fields.
- UX prototypes live under `ux/ui-concept`; do not block CMS releases on prototype parity.

## 12. Risks & Mitigations
- **JSON store contention**: Multiple writes risk clobbering state—plan migration to SQLite or per-user state as concurrency grows.
- **Auth stub leakage**: Local stub sessions must never ship to production; ensure `DATAOPS_AUTH_URL` and hosted NextAuth are configured in staging/prod.
- **Large uploads**: Current buffering strategy loads files into memory; future streaming implementation required for >100MB assets.
- **Terminal security**: SSH/log streaming must respect RBAC and audit logging before release.
- **Video stream licensing**: Ensure CSP and license requirements are met when embedding vendor feeds.

## 13. Open Questions
- Who owns long-term storage for translated/commented assets—does it live in repo meta or external object storage?
- Should scheduled triggers execute inside Next (potential cold-start) or via dedicated worker/workerless solution?
- How do we expose analytics/usage metrics for docs and automations without violating privacy requirements?
- What guardrails are required before exposing API drawer credentials to non-admin users?

## 14. Next Steps Checklist
- Finalise UI copy & taxonomy for event types, drawers, and console labels.
- Design storage schema for comments, translations, and logs; align with compliance retention policy.
- Prototype SSH/log streaming against a staging node; document security requirements.
- Scope API endpoints required for drawers (Agents, Data Sources, API, Infra) and align with backend owners.
- Extend automated tests (UI + API) as new features land to keep pre-push hooks green.
