# Docs Shell (Next.js + Vanilla JS)

A minimal Next.js app that serves a fast docs shell with iframed visualizers. Rendering (Markdown, Mermaid, KaTeX) runs client-side; the server provides a small API for tree/file access, library management, and media serving.

## Run

From `ux/cms/`:

```
npm install
npm run dev   # defaults to http://localhost:3000
```

Runners

- Bash helper (detached):
  - `scripts/server.sh start --dev [port] [--anyport] [--wait SECS]`
  - `scripts/server.sh status|logs|stop|kill-orphans`

- JS launcher (non-blocking):
  - `npm run serve -- start --dev --port 3000 --wait 10` — start and wait until ready
  - `npm run serve -- status --port 3000` — print readiness and PID
  - `npm run serve -- stop --port 3000` — stop by PID and listener
  - `npm run serve -- logs --port 3000` — print recent log
  - `npm run serve -- kill-orphans` — kill stray Next processes bound to this app dir

## Configuration

Environment (`.env.local`) or process env:

- `DOC_ROOT` — docs directory to index (default: `../../../AMI-REACH/social` relative to app cwd)
- `ALLOWED_EXTENSIONS` — served text file extensions (default: `.md,.csv,.txt`)
- `MEDIA_ROOTS` — optional extra media roots in `/api/media/list` as a comma-separated list; supports `Label::/abs/path` or `/abs/path`

Config persistence lives under `ux/cms/data/` as JSON files. The `/api/config` endpoint reads/writes:

- `docRoot`, `selected`, `openTabs`, `activeTabId`, `preferredMode`, `recents`, `allowed`

## UI Overview

- Shell + tabs
  - Tabs represent opened entries: directories (Docs viewer), files (A/B), or apps (D)
  - Right‑click a tab for: Open, Start Serving, Stop Serving, Close Tab
  - A ● badge shows when a tab is served (file/dir) or when an app is detected running
  - “Seed tabs” are created automatically at startup from `selected` or `docRoot` if there are no saved tabs; seed tabs are not in the Library and cannot be served until added

- Visualizers (modes)
  - A: Single HTML file via `/api/media?mode=A` (inline script allowed, CSP limited)
  - B: HTML + JS/CSS set via `/api/media?mode=B` (no inline; prefers `hasJs` from `/api/pathinfo`)
  - C: Directory docs viewer (this app’s doc.html embed)
  - D: Next.js app (serving disabled by default; status checked via `/api/app/status`)

- Select Media… modal (Library)
  - Library drawer lists saved entries and supports context actions (open, serve start/stop, delete)
  - Upload tab preserves folder structure under `files/uploads/<timestamp>/`
  - Enter Path tab validates a path and proposes mode based on `/api/pathinfo`
  - Recents are appended automatically when tabs open/seed

- Status pill
  - Shows Mode A/B for files, “Docs” for directories, and “App: Running/Not running” for apps
  - Updated on tab change and via periodic polling

- Laser glow hover (CSS‑only)
  - Always on; centralized in `public/styles/shared.css` behind `.fx-glow`
  - Uses underline lasers for headings and rows; softer drop‑shadow glow for text blocks
  - Ancestor trace via `:has(:hover)` for details/li where supported; degrades gracefully

## API Summary

- Tree/file
  - `GET /api/tree` — docs tree of `DOC_ROOT`
  - `GET /api/file?path=...` — text file content from `DOC_ROOT` (extensions filtered by `ALLOWED_EXTENSIONS`)

- Media and path info
  - `GET /api/media?path=...&mode=A|B` — serve static assets with CSP
  - `GET /api/media/list` — list of candidate roots: `docRoot`, `uploads`, optional repo `files/`, and `MEDIA_ROOTS`
  - `GET /api/pathinfo?path=...` — classify as `file|dir|app`, detect `hasJs`

- Library and serving
  - `GET/POST /api/library` — list/add entries; id derived from absolute path
  - `PATCH/DELETE /api/library/[id]` — rename label / remove from library
  - `GET/POST /api/serve` — list served instances / start serving
  - `GET/DELETE /api/serve/[id]` — instance status / stop serving
  - `GET /api/served/[id]/...` — proxy/mapped access for served entries
  - `GET /api/app/status?path=...` — check if a Next app is running (ps grep)

- Uploads
  - `POST /api/upload` — multipart files; preserves `webkitRelativePath`; optional `prefix` folder

- Config
  - `GET/POST/PATCH /api/config` — persisted UI state; supports `recentsAdd`

## Security Notes

- Path traversal protections on all file-serving endpoints; CSP applied to media routes
- Client-side Markdown sanitized using DOMPurify; Mermaid/KaTeX loaded from CDN
- App serving (mode D) is intentionally disabled server‑side by default (501)
