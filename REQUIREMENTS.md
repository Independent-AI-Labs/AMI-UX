# UX Module Overview

The UX workspace contains the user-facing surfaces that ship with AMI-ORCHESTRATOR today. It is organised as two independent Next.js applications plus shared tooling.

## Repository Layout

- `cms/` - documentation shell exposed to operators (evolving into AMI Data Portal; see `cms/README.md` and `cms/SPEC-PORTAL.md`). Static HTML/JS front-end backed by Next.js route-handlers for file access, uploads, and library metadata.
- `ui-concept/` - experimental control panel used for rapid prototyping. Large Next.js app kept separate from the shipped CMS to avoid destabilising production workflows.
- `scripts/` - helper utilities reused by both apps (server runners, health checks, PID management). Note: `cms/` has its own `scripts/` directory for app-specific tooling.
- `module_setup.py` / `uv.lock` - standard orchestrator bootstrap (uv-managed Python env) for agents interacting with this module.

## Docs Shell (`ux/cms`)

Goal: provide a minimal, secure docs browser that can index large Markdown collections stored on disk.

Key characteristics:
- Next.js `15.5.x`, React `19.1.x`, TypeScript route handlers located under `app/api/**`.
- Static UI lives in `public/` (`index.html` for the shell, `doc.html` for the iframe view). Vanilla JS modules handle tabs, persistence, uploads, and viewer rendering.
- Persistent state stored as JSON in `data/config.json`; uploaded files mirrored under `files/uploads/<timestamp>/`.
- Runner scripts (`npm run serve -- <cmd>`) wrap the Next CLI to start/stop background dev instances and capture logs.

Developer workflow:
1. `npm install`
2. `npm run dev &` (or use `npm run serve -- start --dev --wait 10` to background the server)
3. Hit `http://localhost:3000/index.html`
4. Run `npm run lint` / `npm run build` before shipping.

Refer to `cms/README.md` and `cms/docs/spec.md` for API and UI details.

## UI Concept (`ux/ui-concept`)

Goal: sandbox for experimenting with richer operator UX. Not wired into production flows yet.

Highlights:
- Next.js `15.x` app located under `src/app/` with a large component catalogue (`components/`, `hooks/`, `data/`).
- Custom background runner scripts (`start-server.js`, `stop-server.js`) used to manage long-running dev instances without blocking the shell.
- Reliance on heavy visual effects (video backdrops, draggable grids, hex visualisations); expect large files and higher resource usage.
- Development commands: `npm run dev &`, `npm run build`, `npm run lint`. Use the runner scripts for managed background processes when testing repeatedly.

Status: exploratory. Treat breaking changes as acceptable once prototypes are archived. Align long-term work with architected requirements in `CLAUDE.md` and the shared orchestration contracts.

## Shared Expectations

- Stay on `main` for both git worktrees (root repo and the `ux` submodule).
- Prefer uv-managed tooling for Python helpers; Node tooling is local (`npm` based) per application.
- Document new scripts or workflows directly inside the app directories to keep operators unblocked.
- When adding new user-facing features, update both the high-level overview here and the app-specific README/spec files.
