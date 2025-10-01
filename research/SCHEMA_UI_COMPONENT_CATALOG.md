# Schema UI Component Catalog

**STATUS: ARCHITECTURAL RESEARCH - NOT IMPLEMENTED**
This document catalogs UI components for a planned schema-driven interface system. No implementation exists as of 2025-10-01.

## Purpose
To refactor the CMS and future AMI consoles into schema-driven interfaces, we need an exhaustive catalogue of UI elements, the primitives they rely on, and the metadata required to describe them declaratively. This document inventories current components and anticipates future needs so the schema runtime can render every surface from model definitions alone.

## Schema Building Blocks
We base all UI descriptions on a small set of primitives, expressed through JSON Schema (data) plus an `x-ami` namespace (presentation):

- **Containers** — structural elements that arrange children. Variants: `stack`, `grid`, `split`, `drawer`, `modal`, `panel`, `tabset`, `stepper`, `overlay`, `surface`.
- **Collections** — repeaters driven by a data source (`list`, `table`, `tree`, `gallery`, `timeline`). Each references an `itemSchema` describing row layout and interactive affordances.
- **Inputs** — data capture controls. Core types: `text`, `textarea`, `secret`, `email`, `number`, `select`, `autocomplete`, `toggle`, `radio`, `checkbox`, `chip-group`, `file`, `json`, `code`, `date`, `time`, `datetime`, `password-reset` (workflow), `oauth`. Each input exposes validators, placeholders, help text, adornments, icons.
- **Actions** — buttons, links, icon-only triggers. Metadata includes `actionId`, `intent` (`primary`, `secondary`, `danger`, `ghost`, `icon`), icon reference, keyboard shortcut, confirmation requirements.
- **Feedback** — `toast`, `hint`, `tooltip`, `popover`, `banner`, `inline-status`, `badge`, `pill`.
- **Visualization** — charts (`line`, `bar`, `pie`, `donut`), progress (`radial`, `linear`), status maps. These require data-binding metadata (series, axes, legends) but share container semantics.
- **System Surfaces** — specialized shells (`appHeader`, `workspaceChrome`, `floatingToolbar`, `commandPalette`, `contextMenu`). Schema expresses slot content + actions.

Every component defined below decomposes into these primitives so backends can emit compact descriptors that UIs interpret consistently.

## Current Component Inventory & Schema Mapping
| Component / Surface | Location (Today) | Schema Representation |
| --- | --- | --- |
| Application shell/header (logo, status, account menu) | `ux/cms/public/js/shell.js`, `drawer-chrome.js` | `container(type="appHeader")` with `slots` (`left`, `center`, `right`) housing `actions`, `statusIndicator`, `breadcrumbs` primitives. |
| Global tab bar (Content / Accounts / Logs, etc.) | `drawer-chrome.js` | `container(type="tabset")` referencing `tabSchema` entries (title, icon, badge, status). |
| Drawer chrome + main content area | `drawer-chrome.js`, `account-drawer.js` | `container(type="split", orientation="horizontal")` with `paneMeta` (width, collapsible) and child `collection`/`container`. |
| Account drawer list | `account-drawer.js` | `collection(type="list")` bound to `dataSource=accounts` with `itemSchema` (avatar, title, subtitle, status badge, actions). |
| Content drawer list / document list | `modal.js`, `file-tree.js` | `collection(type="tree" or "list")` with `itemSchema` (icon, title, meta, hover actions) and `interaction` (select, multi-select, context menu). |
| Drawer toolbar (search, filters, sort) | `account-drawer.js`, `file-tree.js` | `container(type="toolbar")` with `inputs` (search field) and `actions` (filter toggle, add button). |
| Floating row actions (comment, search) | `highlight/effects.js`, `ui.js` | `container(type="floatingToolbar")` anchored to selection, holding `actions` (icon buttons). |
| Add Account modal | `account-drawer.js` | `container(type="modal")` -> `form` built from provider schema, `actionBar` from `actions`. |
| Generic confirmation dialog | `modal.js`, `dialog-controller.js` | `container(type="modal", variant="confirm")` with `message`, `actions` mapped to `primary`/`secondary`. |
| Toast / message system | `dialog-service.js` | `collection(type="toastStack")` with `itemSchema` (tone, message, timeout, dismiss action). |
| Hint tooltip (status indicator) | `account-drawer.js` | `feedback(type="hint")` attached via schema `x-ami.hint`. |
| Tree/file explorer | `file-tree.js` | `collection(type="tree")` with `itemSchema` capturing node icon, label, badges, lazy loader action. |
| Document viewer (content area) | `doc.js`, `code-view.js` | `container(type="documentPanel")` with `slots` for `toolbar`, `content`, `sidebar`. Content uses `visualizer` primitive (markdown, code, html). |
| Editor toolbar (Play, Serve, etc.) | `doc.js` | `container(type="toolbar", orientation="horizontal")` mapping to `actions` with `intent` and `icon`. |
| Status indicators (green/red dot, error icon) | `shared.css`, `account-drawer.js` | `feedback(type="status", shape="dot"|"icon")` referencing severity + hints. |
| Loading spinners (per-row, global) | multiple | `feedback(type="loading", scope="inline"|"overlay")`. |
| Search overlay / command palette (future) | not yet | `container(type="commandPalette")` with `collection(results)` and `input` search field. |
| Pagination controls | partial | `container(type="pagination")` with `actions` (prev/next), `badge` for counts. |
| Metrics cards (future dashboard) | planned | `collection(type="grid")` with `itemSchema` referencing `visualization(type="stat")`. |
| Activity timeline/log | `modal.js` planned | `collection(type="timeline")` with `itemSchema` (timestamp, title, detail, icon). |
| Upload manager (future) | planned | `collection(type="list")` + `progress` primitives. |
| Form wizard / onboarding flow | planned | `container(type="stepper")` with `steps` referencing form schemas, `actions` controlling navigation. |
| Context menu | existent via `ui.js` | `container(type="contextMenu")` with `actions` and optional nested menus. |
| Breadcrumbs | shell | `collection(type="breadcrumb")` with `itemSchema` (label, href, icon). |
| Empty state surfaces | drawers/modals | `feedback(type="emptyState")` with `title`, `description`, `illustration`, `actions`. |
| Tag/label chips | multiple | `feedback(type="chip")` with color + removable action. |
| Badge counters | tab bar etc. | `feedback(type="badge")` with numeric/string content. |

## Future Components & Extensions
- **Analytics charts** — require `visualization` schema with data binding metadata. Future dashboards can declare `series`, `dimensions`, `legends` to render `lineChart`, `barChart`, `donutChart`, `heatmap`.
- **Automation builder** — node-graph UI described via schema: `container(type="graphEditor")` with `nodes`, `edges`, `palette`. Nodes reference underlying models (triggers, actions).
- **Task queue monitor** — `collection(type="table")` with sortable columns, row selection, bulk actions, and per-row detail drawers (`container(type="drawer", mode="inline")`).
- **Audit trail viewer** — `collection(type="timeline" or "table")` with filters, export action.
- **Secrets vault browser** — `collection(type="table")` + `feedback(type="secretBadge")`, `actions` for reveal/copy gated by permissions.
- **Notification center** — `collection(type="list")` with grouping by severity or channel, `actions` for mark-read.
- **Workflow orchestrator (future)** — `container(type="kanban")` representing columns + cards.
- **Device management (future)** — `collection(type="grid")` with card layout, status overlays, context actions.

## Mapping Components to Data Models
To keep schemas concise, we define abstract data models the backend emits alongside UI descriptors:

- **Entity Collection** — generic list/table source referencing `entityType`, query params, sort/filter definitions. Forms reference entity fields for inline editing.
- **Action Descriptor** — backend-defined action with id, method (`GET`/`POST`), payload schema, optimistic update hints.
- **Attachment / Media** — references to file metadata used by gallery, document viewer, avatar components.
- **Validation Rule** — name, severity, message. Mapped to UI as inline messages or blocking errors.
- **Capability Flags** — booleans/enum describing available operations (e.g., provider supports `testConnection`, `rotateSecret`). UI reads these to show/hide actions.
- **Navigation Node** — used for tree, breadcrumbs, command palette; includes parent/child relationships and optional action descriptors.

## Implementation Notes
- Containers and collections compose recursively; e.g., a drawer is a `container(type="drawer")` whose body contains a `collection(type="list")` referencing item schema.
- Item schemas themselves reuse primitives: an account row is a `container(type="listItem")` containing `avatar`, `text`, `badge`, `actions`.
- Actions reference backend functions by id. The schema runtime resolves ids to event handlers that perform API calls and update state according to backend-provided diff instructions.
- Future interactive widgets (charts, graph editors) require data-binding hints. Keep these optional until those surfaces roll out.


## Meta-Platform Considerations
- Components must declare capability flags so host environments (web, desktop shell, partner portal) can opt-in or provide alternatives.
- Item schemas should reference behaviour adapters (state machines, action modules) via IDs resolved through the schema registry for richer experiences.
- Container hierarchies map naturally onto BPMN user-task views; ensure each schema segment is tagged with `processRef` so orchestration layers can route tasks accurately.
- Support composition by allowing schema authors to extend base components with overrides (`extends` semantics) rather than duplicating definitions.
- Include observability metadata (event names, counters) on components so telemetry stays consistent across meta-platform deployments.

## Next Steps
1. Formalise primitive definitions (`ContainerSchema`, `CollectionSchema`, `ActionSchema`, etc.) in TypeScript + Python.
2. Audit each existing UI file and map to the above to ensure no gaps.
3. Extend schema concept doc with examples per primitive and start converting Add Account drawer as pilot.
