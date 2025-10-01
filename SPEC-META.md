# SPEC: Decouple CMS Meta Assets from the Repository

## Background
- Highlight automations, LaTeX renders, and planned comments/translations store artefacts in `<asset>.meta/` folders that sit beside the source asset (see `ux/cms/app/api/automation/route.ts:220` and `ux/cms/app/api/latex/route.ts:78`).
- `/api/media` serves cached PDFs by reading `${relPath}.meta/render.pdf`, and `packages/highlight-core` expects `metaPath` responses that mirror the on-disk `.meta` layout (`ux/cms/packages/highlight-core/src/highlight-plugin/core/manager.js:612`).
- `ux/cms/app/api/tree/route.ts:53` explicitly hides `.meta` directories from the explorer because they clutter the repository tree, and resumable upload bookkeeping writes companion JSON into `.upload-meta`/`data/upload-meta` (`ux/cms/app/api/upload/route.ts:43`).
- The TODO mandate (`ux/TODO-META.md`) requires relocating these artefacts into swappable destinations so the canonical repo stays clean and CI diffs stop being polluted by generated data.

## Goals
- Keep all runtime-generated meta artefacts outside the tracked repo while preserving feature parity for automation, LaTeX caching, and future meta-backed features (comments, translations, change logs).
- Allow operators to swap the meta store (different git worktree, mounted volume, or bucket) via config without code changes.
- Minimise disruption to existing clients (keep `/api/automation`, `/api/latex`, highlight runtime, and `/api/media` contracts stable).
- Provide a deterministic migration path for existing `.meta` folders and upload metadata.

## Non-Goals
- Reworking the meta file schemas (automation JSON, LaTeX manifest/log formats, etc.).
- Changing the authentication/authorisation model for the CMS APIs.
- Implementing cloud blob providers in this phase (design must allow plugging one in later).

## Current State Summary
- **Automation**: `resolveMediaRoot` returns the content root path; `/api/automation` writes to `<root>/<relPath>.meta/automation/**` and exposes the relative `.meta` path in responses.
- **LaTeX renders**: `/api/latex` writes `render.pdf`, `manifest.json`, and `compile.log` into `<root>/<relPath>.meta/` and publishes the same relative paths to the UI, which then downloads via `/api/media`.
- **Media streaming**: `/api/media` only understands assets that live within the content roots; `.meta` access works today because those folders sit beside the source file inside the root.
- **Tree explorer**: filters `*.meta` directories so they do not appear in the content tree.
- **Upload bookkeeping**: stores resumable upload JSON under `files/uploads/.upload-meta/**` (uploads root) or `data/upload-meta/docRoot/**` (docRoot).
- **Documentation/tests**: Multiple specs/tests assert the current on-disk layout, so relocation needs coordinated fixture updates.

## Proposed Architecture

### 1. Meta Storage Abstraction
- Introduce a `MetaStore` helper in `ux/cms/app/lib/meta-store.ts` that encapsulates:
  - `resolveAssetDir(rootKey, relPath)` → absolute path to a directory that backs the meta for a given asset.
  - `resolveFile(rootKey, relPath, relativeFile)` → absolute path for artefact reads/writes.
  - `ensureDir`, `readJson`, `writeJson`, `list`, `rm` wrappers that delegate to the active provider.
- Default provider: local filesystem rooted at `META_ROOT/<rootKey>/` (configurable path).
- Provider contract allows future drivers (git worktree, s3, etc.) without changing higher-level code.

### 2. Configuration & Boot
- Extend CMS config with meta mappings:
  - New optional `metaRoots` object in `data/config.json` keyed by `MediaRoot.key` (e.g. `{ "docRoot": "../ami-meta/docRoot", "uploads": "../ami-meta/uploads" }`).
  - Environment overrides: `CMS_META_ROOT` (global base) and `CMS_META_ROOT_<KEY>` (per-root).
  - Fallback when nothing configured: `path.join(appRoot, 'data/meta/<key>')` to keep dev ergonomics.
- Update `ux/cms/app/lib/media-roots.ts` to return `{ key, label, path, writable, metaPath }`, where `metaPath` is the resolved absolute meta base for that root.

### 3. Server-Side Updates
- **Automation API** (`ux/cms/app/api/automation/route.ts`):
  - Swap direct `path.join(root.path, rel + '.meta')` with `MetaStore.resolveAssetDir(root.key, relPath)`.
  - Use `MetaStore` helpers for scenario directories, config JSON, trigger CRUD.
  - Continue returning the *virtual* meta path string (`${relPath}.meta/automation`) so the highlight runtime keeps the same contract. The server should never expose the physical path.
- **LaTeX API** (`ux/cms/app/api/latex/route.ts`):
  - Derive `metaDir = MetaStore.resolveAssetDir(root.key, relPath)`.
  - Write/read `render.pdf`, `manifest.json`, and `compile.log` through the helper.
  - Attach both `metaPath` (virtual string) and a new `metaRootKey` (so clients can disambiguate if we add multiple stores) in responses for future-proofing.
- **Media API** (`ux/cms/app/api/media/route.ts`):
  - When a requested `path` contains `.meta/`, resolve the physical file via `MetaStore.resolveFile(rootKey, relPathWithoutMeta, remainder)` instead of `path.resolve(root, rel)`.
  - Preserve existing CSP/ETag behaviour; only the lookup path changes.
  - Optionally accept `scope=meta` to short-circuit the `.meta/` detection for non-standard layouts.
- **Tree API** (`ux/cms/app/api/tree/route.ts`):
  - Keep filtering `.meta`, but also remove the redundant filesystem check once meta dirs disappear from the root.
  - Expose a `hasMeta` flag per node by probing the meta store (useful for UI badges).
- **Upload API** (`ux/cms/app/api/upload/route.ts`):
  - Point resumable JSON writes to `MetaStore.resolveUploadRecord(root.key, relPath)` (a helper built into the store; for uploads we need a namespaced record store instead of `.meta` folders).
  - Preserve JSON shape so existing clients/tests remain valid.

### 4. Client Updates
- **Highlight runtime** (`ux/cms/packages/highlight-core`):
  - No contract change; it keeps consuming `payload.metaPath` as today.
  - Add support for a future `metaRootKey` if returned (store it so native bridges can fetch artefacts from alternate providers).
- **LaTeX renderer** (`ux/cms/public/js/renderers.js`):
  - When downloading a PDF, pass through any new `metaRootKey` or `scope` query param so `/api/media` knows which store to hit (e.g. append `scope=meta` if provided).
- **Docs/UI**: Update content explorer to surface the new `hasMeta` flag once available.

### 5. Migration Strategy
- Provide a CLI script (`scripts/migrate-meta.mjs`) that:
  - Scans configured media roots for legacy `<asset>.meta/` directories.
  - Moves each directory into the resolved meta store location.
  - Leaves a `.meta-placeholder` file or gitignore entry (optional) to warn developers if stale folders linger.
- Document manual steps in `ux/TODO-META.md` (link to the spec, outline one-time migration and how to configure new meta roots).
- Update integration tests to set `CMS_META_ROOT` to a temp directory and assert files land there instead of beside the source asset (`ux/cms/tests/latex.integration.test.ts`, `ux/cms/tests/upload.integration.test.ts`).

### 6. Operational Considerations
- Meta store paths must be writable by the CMS process; add health checks in `/api/automation` and `/api/latex` that detect permission errors and return actionable messages.
- Add a new `scripts/check-meta-store.mjs` that verifies configured paths exist and have read/write access (hook into CI).
- Ensure `.gitignore` covers the default fallback directory (`data/meta/`).

## Testing & Validation
- Update existing integration tests to seed `CMS_META_ROOT` and assert relocation:
  - LaTeX tests should expect PDFs/manifests under the temp meta directory.
  - Upload tests should inspect the new upload record path via `MetaStore`.
- Add unit tests for `MetaStore` (path sanitisation, env/config precedence, provider selection).
- Smoke-test `/api/media` by requesting a PDF after LaTeX POST and confirming it is served from the external store.
- Add regression test ensuring `.meta` directories are *not* created under the doc root during automation or LaTeX flows.

## Open Questions
- Should we reserve a dedicated virtual prefix (e.g. `@meta/docRoot/...`) for UI links instead of reusing `.meta/`? Keeping the current shape eases compatibility but may be confusing once physical folders disappear.
- Do we need to support mixed providers per root (e.g. local for LaTeX, S3 for automation), or is one provider per root sufficient for now?
- Should upload metadata share the same `MetaStore` base as other artefacts or keep a dedicated namespace to simplify cleanup policies?

