# Docs Shell (Next.js + Vanilla JS)

A Next.js 15.5 service that hosts the docs shell UI and JSON-backed APIs. Rendering (Markdown, Mermaid, KaTeX) runs client-side via vanilla modules under `public/js/`; the Next runtime provides file/tree/media APIs, config persistence, and upload endpoints.

## Tech Stack

- Next.js `15.5.x` with app-router route handlers only (no React pages)
- React `19.1.x` runtime loaded via CDN for the library modal
- TypeScript API handlers compiled by Next (see `app/api/**`)
- File-system helpers in `app/lib/store.ts`
- Optional long-lived runner managed by `scripts/server.mjs`

## Run

From `ux/cms/`:

```
npm install
npm run dev   # defaults to http://localhost:3000; run in background or separate terminal
```

> Tip: Use `npm run dev &` (or a dedicated terminal) so the watcher doesn't block your current shell; stop it when finished.

- Scripts:
  - `npm run lint` — ESLint 9 against the entire repo
  - `npm run build` — Next production build (ensures API routes compile)
  - `npm run start` — serve the production build

- Runner (non-blocking, cross‑platform):
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

Data directories checked into git:

- `data/` — persisted config (`config.json` created on first run)
- `files/uploads/` — uploaded assets bucketed by timestamp
- `public/res/` — static assets bundled with the shell

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
