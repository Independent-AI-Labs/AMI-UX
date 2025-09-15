# CMS Shell Specification

## 1. Purpose and Scope
- Capture the current behaviour of the Next.js-based docs shell that lives under `ux/cms/`.
- Provide a shared vocabulary for discussing future enhancements across API, persistence, and UI layers.
- Highlight integration points and guardrails (path handling, security posture, tooling expectations).

## 2. System Overview
- **Runtime**: Next.js 14 (app router disabled aside from root layout) running serverless-style handlers at `app/api/**`.
- **Client**: Static shell in `public/index.html` controlling an iframe-based docs viewer (`public/doc.html`). Vanilla JS modules in `public/js/` coordinate tabs, state restore, library CRUD, and modal flows.
- **State**: JSON files under `data/` persist doc-root config, library entries, and served instances. Uploads live under `files/uploads/` with timestamped directories.
- **Theme/Branding**: Shared palette and "laser" hover effects defined in `public/styles/shared.css`; theme toggled via localStorage across shell + iframe.

## 3. Server Capabilities
### 3.1 Configuration & Persistence
- `GET/POST/PATCH /api/config` (`app/api/config/route.ts`) reads/writes `data/config.json`. Fields: `docRoot`, `openTabs`, `activeTabId`, `selected`, `preferredMode`, `recents`, `allowed`.
- Store helpers in `app/lib/store.ts` wrap JSON read/write with `fs.promises` and ensure the `data/` directory exists.

### 3.2 Content Discovery and Delivery
- `/api/tree` traverses the configured doc root, ignoring dotfiles/common build directories and filtering by `allowed` extensions.
- `/api/file` reads Markdown/text files relative to the doc root, enforcing extension allowlists and returning strong ETags for cache negotiation.
- `/api/media` serves static assets (HTML/CSS/JS/images) from the doc root, uploads, or other configured roots with CSP headers and HTML transformations (BOM stripping, Cocoa snippet fix, `<base>` injection).
- `/api/media/asset/[root]/[[...path]]` exposes raw assets (used by `<base href>` rewrites).
- `/api/pathinfo` classifies a path as `file`, `dir`, or `app` and detects companion JS for mode selection.

### 3.3 Library & Serving
- `/api/library` CRUD persists saved entries with deterministic SHA1 ids. Directory entries represent docs roots; file entries can be toggled between Mode A/B. Apps are detected but not actively served.
- `/api/serve` maintains the list of "served" entries. For `file`/`dir` entries the status is purely book-keeping; `app` start is explicitly disabled (501).
- `/api/served/[id]/[[...path]]` proxies either to stored files or to a running app (if we ever enable ports for mode D).
- `/api/library/[id]/delete` allows best-effort disk deletion for uploads-only paths.

### 3.4 Uploads & Events
- `/api/upload` accepts multi-part file uploads (incl. directory uploads via `webkitRelativePath`), normalises paths to avoid traversal, and mirrors folder structure under `files/uploads/<timestamp>`.
- `/api/events` exposes a long-lived SSE endpoint that currently emits heartbeat pings. Hook ready for tree/file change broadcasting.
- `/api/app/status` inspects the host process list to report whether a Next.js app appears to be running for a given path.

## 4. Client Behaviour
### 4.1 Shell (`public/index.html`, `public/js/shell.js`)
- Maintains tab state (open/active tabs, served status) in memory and syncs to `/api/config`.
- Renders tabs with context menus (start/stop serving, close) and status pill for mode/app state.
- Acts as mediator to the docs iframe via `postMessage` (`setDocRoot`, `search`, `expand/collapse`, `applyTheme`).
- Library modal (`public/js/modal.js`) loads React/ReactDOM at runtime via CDN to present library, uploads, recents, and explicit path entry flows.
- Polls `/api/serve` and `/api/app/status` to refresh served/app indicators every few seconds.

### 4.2 Docs Viewer (`public/doc.html`, `public/js/main.js`, `public/js/ui.js`)
- Renders tree structure for the doc root with cached file contents.
- Markdown rendering uses Marked + DOMPurify + KaTeX, plus Mermaid diagrams with theme reapply logic.
- CSV renderer builds simple HTML tables. Any other allowed extension goes to `<pre>`.
- Maintains localStorage-backed open-state and auto-expands root-level README/Introduction.
- SSE hook (`public/js/sse.js`) listens for backend change events (currently heartbeats) for live refresh.

## 5. Tooling & Ops
- `npm run dev` runs Next.js dev server. `npm run build` & `npm run start` for production.
- `scripts/server.mjs` & `scripts/runner.mjs` manage long-lived dev instances via PID files, logs, and readiness polling.
- `scripts/health.mjs` performs quick HTTP checks against key endpoints; `scripts/validate-ui.mjs` is a headless integration test that exercises config persistence, library flows, serving, and uploads.

## 6. Security & Constraints
- Path operations funnel through `path.resolve` with explicit checks to keep requests within the configured roots (`withinRoot`).
- CSP headers on media responses restrict script/style origins; HTML responses add `<base>` tags to maintain relative asset resolution.
- `/api/upload` scrubs `..` segments and normalises separators; disk deletion endpoint is limited to the uploads directory.
- App serving is deliberately disabled to avoid arbitrary Next dev servers being launched from the CMS.

## 7. Known Limitations / Risk Areas
- JSON file storage is simple but lacks concurrency control; simultaneous edits could clobber state.
- SSE feed does not currently emit file watcher events—hot updates rely on manual refresh/polling.
- Modal relies on CDN-hosted React/ReactDOM; offline or CSP-restricted environments would fail open.
- App detection uses `ps`/`lsof` which may not be cross-platform friendly on locked-down systems.
- `files/uploads/` can grow unbounded; no retention or quota enforcement.

## 8. Extension Opportunities
### 8.1 Near-Term (Low Effort)
- Broadcast filesystem changes via chokidar watcher to enrich `/api/events` messages (refresh tree/file caches automatically).
- Persist additional UI state (panel widths, search filters) in `config.json` for better session continuity.
- Replace CDN React modal with locally bundled preact/react-lite to remove external dependency.
- Add CLI command to prune stale upload directories and corresponding library entries.

### 8.2 Mid-Term (Moderate Effort)
- Swap JSON persistence for SQLite (via `better-sqlite3` or Prisma) to support multi-user access and atomic updates.
- Introduce role-based auth / API tokens for serving endpoints to protect deployments beyond localhost.
- Expand Mode B to support multi-file HTML packages (zip extraction, dependency tracking) with UI cues.
- Build comment/annotation system leveraging existing `postMessage({ type: 'addComment' })` hook.

### 8.3 Long-Term (High Impact)
- Multi-root explorer: allow multiple doc roots with per-tab configuration, including remote Git fetch support.
- Full "App Mode" orchestration: define runners for Next apps or other frameworks, manage lifecycle (start/stop, logs) directly from CMS.
- Collaborative editing layer with CRDT-backed document editing and presence indicators inside viewer.
- Extensible plugin system for new visualizers (e.g., data dashboards, notebook renderers) with sandboxed runtimes.

## 9. Open Questions
- Should uploads remain on local disk or transition to object storage for multi-instance deployments?
- What auth model is required when exposing CMS beyond trusted networks?
- How do we version/publish library entries (e.g., snapshot release vs. live doc root)?
- Do we need analytics/telemetry on content usage to inform pruning or caching strategies?

