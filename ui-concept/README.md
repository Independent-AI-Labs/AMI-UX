# UI Concept Workspace

Exploratory Next.js application for experimenting with AMI operator experiences. The project is intentionally separate from the production CMS and is not shipped to end users.

## Stack

- Next.js 15.4 (App Router)
- React 19 with modern, server-compatible components
- Tailwind CSS 4 beta (via the `@tailwindcss/postcss` plugin)
- Lucide icon set for quick UI prototyping

## Run Locally

```bash
npm install
npm run dev &   # run in the background or another terminal; it blocks the shell
```

The custom runner scripts provide convenience commands when iterating repeatedly:

- `node start-server.js` — spawn `npm run dev` in the background, capture logs, and write a PID file
- `node stop-server.js` — stop the managed process and clean PID/log files

Visit `http://localhost:3000` once the server is ready. Tailwind JIT recompiles styles automatically.

## Quality Gates

- `npm run lint` — Next.js + ESLint checks
- `npm run build` — ensure the app compiles before landing large changes

## Project Layout

```
src/app/
├── components/      # Feature modules (chat, dashboards, grids, modals, status bar, etc.)
├── core/            # State machines & managers (animation, app state, conversation flow)
├── hooks/           # Custom React hooks extracted from prototype work
├── data/            # Static configuration/fixtures that drive visualisations
├── page.js          # Main UI storyboard
└── page-demo.js     # Alternate entry point for demo scenarios
```

`public/` contains heavy assets used for ambience (videos, gradients, textures). Expect high bandwidth when running locally.

## Status

This workspace is **experimental**. Breaking changes are acceptable once artefacts are archived. Remember to update this README if you add new runner scripts, top-level commands, or major component directories.
