# Minimal Docs Wrapper (Next.js + Vanilla JS)

A minimalist HTML/CSS/vanilla-JS client served by a minimal Next.js backend that exposes the documentation tree and file contents. All rendering logic (Markdown, Mermaid, KaTeX, TOC, collapsibles) runs in the browser.

## Run

1) Ensure the `social/` docs directory exists at the repo root (already present).
2) From `docs-web/`:

```
npm install
npm run dev
```

Open http://localhost:46241/

## Config

Environment (`.env.local`):

- `DOC_ROOT=../social` — root dir for docs (relative to `docs-web/`).
- `ALLOWED_EXTENSIONS=.md,.csv,.txt` — files to serve.
- `APP_TITLE=Independent AI Labs — Docs` — page title.

## Features

- Collapsible sections per file/dir; indentation by depth
- Auto-generated global Table of Contents
- Markdown rendering (Marked) with sanitization (DOMPurify)
- Mermaid diagrams and LaTeX (KaTeX auto-render)
- Search on filenames/headings; deep links; theme toggle; print styles

## Notes

- API:
  - `GET /api/tree` — JSON tree of `DOC_ROOT`.
  - `GET /api/file?path=...` — raw text for a file.
- Security: path traversal protected; Markdown sanitized client-side.
