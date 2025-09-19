# CMS TODO

## Critical Fixes

- [ ] Restore upload → open flow
  - Update `public/js/modal.js` to record uploaded items using absolute disk paths returned by `/api/upload`.
  - Normalize path comparisons in `public/js/shell.js` (prefer `path.resolve` or `path.relative`) so newly uploaded folders match library entries.
  - Add a regression test that exercises the upload workflow: run `scripts/validate-ui.mjs` or a new Jest test to assert the uploaded directory is immediately openable.
  - Run `npm run lint` and targeted tests before committing.

- [ ] Harden `/api/config` for multi-user scenarios
  - Design a session-safe persistence model (per-client state file or backing store).
  - Implement optimistic locking or move to SQLite/Postgres so concurrent POST/PATCH calls do not clobber config.
  - Update the shell to scope doc root, open tabs, and recents appropriately when per-user state is introduced.
  - Backfill migration logic for existing `data/config.json`.

- [ ] Streamline `/api/upload`
  - Enforce size/type limits before reading into memory; reject unsupported content.
  - Swap `arrayBuffer()` calls for chunked streaming writes to avoid blocking the event loop on large folders.
  - Add logging + surfaced errors when sanitization strips paths.
  - Cover with integration tests uploading large nested folders.

- [ ] Protect JSON persistence (`data/library.json`, `data/served.json`)
  - Introduce file locking or refactor storage to ACID database to stop concurrent writes from truncating state.
  - Validate JSON before overwriting disk; keep journal/backup copy for rollback.
  - Extend store helpers with schema validation to detect corruption early.

## Architectural Improvements

- [ ] Module ownership cleanup
  - Break `public/js/modal.js` into focused modules (library list, uploader, context menu).
  - Unify shared path utilities (`sanitizeRel`, upload root detection) in a dedicated helper module.
  - Replace broad `catch {}` blocks with scoped error reporters surfaced to the UI console/toast system.

- [ ] Frontend build modernization
  - Evaluate bundling the shell + modal with Vite or Next static assets so React-on-CDN is no longer required.
  - Establish shared state hooks/stores instead of manually syncing React state with vanilla modules.

- [ ] Message bus abstraction
  - Wrap `postMessage` usage between shell and docs iframe in a typed event bus.
  - Provide reconnection/backoff logic so theme/docRoot sync survives iframe reloads.

- [ ] Serving UX realignment
  - Decide whether `/api/serve` should manage actual processes or be rebranded as a tagging mechanism.
  - If true serving is desired, implement per-entry runners, status polling, and log surfacing.

## Testing & Tooling

- [ ] Expand automated coverage
  - Promote `scripts/validate-ui.mjs` into CI and extend it to cover the upload auto-open regression.
  - Add API integration suites (Jest/Vitest) for `/api/upload`, `/api/library`, `/api/config`, verifying normalization and concurrency behavior.
  - Introduce Playwright smoke tests for the main UX flows (open content directory, upload folder, reload tabs).
  - Document new test commands in `README.md` and enforce via pre-commit or CI.

## Tracking & Follow-Up

- [ ] Prioritize the critical fixes above and align resourcing.
- [ ] Create follow-up design docs for persistence changes and bundler migration before implementation.
- [ ] Keep this TODO updated as tasks land; include links to PRs and tickets when available.
