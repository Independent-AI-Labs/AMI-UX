# CMS UI Standardization Plan

## Mission & Scope
- Canonicalize the AMI CMS visual language and interaction model across shell, drawers, modals, auth flows, highlight overlays, and extension surfaces.
- Treat `ux/cms/public/styles/shared.css` and shared React primitives as the single source of truth for layout, tokens, transitions, and typography.
- Converge on Remix Icons for every glyph, delivered through the existing `icon-pack` helper so both legacy DOM scripts and new React code share the same asset pipeline.

## Visual Language & Tokens
- **Palette**: Use the CSS custom properties defined in `shared.css` (`ux/cms/public/styles/shared.css:1`). Extend them with any missing neutrals instead of bespoke RGBA literals.
- **Tone**: Flat, minimal, high-contrast panels with subtle inner shadows. No glassmorphism; remove gradients that suggest depth (`ux/cms/app/auth/styles.css:6`).
- **Typography**: Continue system-ui stack (`shared.css:18`); avoid redefining fonts inline.
- **Depth cues**: rely on soft drop shadows using palette blends (`shared.css:350`).
- **Surface blur**: all overlays and drawers must use blur-based transitions to convey ethereal movement.

## Interaction & Animation Blueprint
- **Global Duration Scale**: 120 ms fast, 200 ms medium, 260 ms exit. Store in CSS variables for reuse.
- **Backdrop**: always fade + blur. Implement via `.dialog-backdrop` by enabling `backdrop-filter: blur(8px)` on enter/open and easing to `blur(0)` on close.
- **Drawer Surface**: slide-in from right, with opacity+blur interplay (`transform: translateX()`, `filter: blur()`), per existing account drawer spec (`ux/cms/public/styles/shared.css:368`). Reuse for content drawer and future drawers; no inline style overrides (`ux/cms/public/js/modal.js:2506`).
- **Modal Surface**: fade + vertical shift + blur; reuse shared controller rather than local requestAnimationFrame loops (`ux/cms/public/js/modal.js:95`).
- **List/Item States**: hover focus states share color math; ensure bullet separators and badges derive from shared tokens (`ux/cms/public/styles/shared.css:593`).

## Standard Component Hierarchy
| Tier | Component | Responsibilities | Implementation Notes |
| --- | --- | --- | --- |
| App Shell | `ShellLayout` (doc shell, content shell) | Header, tabs, iframe host, welcome screen | Move inline CSS to tokens; unify header icons (`ux/cms/public/index.html:81`). |
| Overlay | `DialogBackdrop`, `DrawerPortal` | Manage blur backdrop, focus trap | Use `dialogService` for all overlays (`ux/cms/public/js/dialog-service.js:1`). |
| Drawer | `DrawerChrome`, `DrawerListItem`, `DrawerHeader` | Provide structural chrome, badges, actions | Account drawer follows this; content drawer must reuse it (`ux/cms/public/js/account-drawer.js:227`, `ux/cms/public/js/modal.js:2419`). |
| Modal | `ModalDialog` (refactor) | Canonical modal w/ blur transitions | Replace bespoke animation logic (`ux/cms/public/js/modal.js:95`). |
| Navigation | `TreeToolbar`, `TreeRoot`, `RowActions` | Provide tree interactions | Keep using CSS-based skeletons (`ux/cms/public/styles/shared.css:220`). |
| Feedback | `Toast`, `StatusPill`, `LoadingIndicator`, `NoResults` | Consistent messaging | Converge to shared palette, adopt blur entrance (`ux/cms/public/js/modal.js:2491`). |
| Data Entry | `FormField`, `Button`, `IconButton` | Align spacing, focus rings | Move button variants into shared tokens (`ux/cms/public/styles/shared.css:68`, `ux/cms/public/styles/shared.css:1125`). |
| Extension | Highlight settings panel | Should consume same modal primitives (`ux/cms/public/js/highlight/manager.js:480`). |

## Iconography Standard
- Use Remix Icons for every glyph.
- All icon rendering must flow through `icon-pack.js` (React) or `<i class="ri-…">` markup.
- Remove inline SVG icon usage in docs header (`ux/cms/public/doc.html:31`) and Feather-like inline SVGs; replace with Remix equivalents.
- Replace icon font `<i>` tags added manually in HTML with `icon-pack` helper for consistency.

## Current Inconsistencies (Must Fix)
| Area | Issue | Location | Status |
| --- | --- | --- | --- |
| Drawer mechanics | Content drawer mounted its own overlay & transitions, bypassing shared blur/portal logic | `ux/cms/public/js/modal.js:2506`, `ux/cms/public/js/modal.js:2527`, `ux/cms/public/js/modal.js:2756` | Resolved — both drawers now register with `dialogService` (`ux/cms/public/js/account-drawer.js:103`, `ux/cms/public/js/modal.js:2327`). |
| Drawer animation | Account drawer used bespoke stage machine so other drawers diverged from shared transitions | `ux/cms/public/styles/shared.css:368`, `ux/cms/public/styles/shared.css:388` | Resolved — drawers share `drawer-surface` tokens + blur states (`ux/cms/public/styles/shared.css:360`). |
| Modal animations | `ModalDialog` relied on inline requestAnimationFrame without blur | `ux/cms/public/js/modal.js:95` | Resolved — modal flow runs through `dialogService` (`ux/cms/public/js/modal.js:95`). |
| Backdrop styling | `.dialog-backdrop` lacked blur defaults | `ux/cms/public/styles/shared.css:307` | Resolved — backdrop tokens + blur now centralised (`ux/cms/public/styles/shared.css:312`). |
| Inline styling | Shell home injects large inline CSS blocks & gradients that don't match flat spec | `ux/cms/public/index.html:9`, `ux/cms/public/index.html:120` | Open — consolidate into shared tokens + remove gradients. |
| Auth styling | Auth card uses glassmorphism (radial gradients, translucent backgrounds) | `ux/cms/app/auth/styles.css:6` | Resolved — flattened onto shared palette (`ux/cms/app/auth/styles.css:1`). |
| Icon divergence | Docs screen uses inline SVG icons, not Remix | `ux/cms/public/doc.html:31` | Open — migrate to `icon-pack`. |
| Duplicated animations | Upload drawer injects additional `@keyframes spin` outside shared stylesheet | `ux/cms/public/js/modal.js:81` | Open — move keyframes into `shared.css`. |
| Toast palette | Toast backgrounds use hard-coded RGBA values instead of token blends | `ux/cms/public/js/modal.js:2491` | Open — create shared toast component/tokens. |
| Context menu | Inline styles re-specify radius, shadows, colors instead of shared menu component | `ux/cms/public/js/modal.js:594` | Open — extract menu surface component. |
| FX flags | `.fx-glow` forced from multiple HTML files rather than a central toggler | `ux/cms/public/index.html:150`, `ux/cms/public/doc.html:13` | Open — unify under single script/config. |

## Remediation Roadmap
1. **Refactor overlay primitives**
   - Update `dialogService` consumers so content drawer uses `SlidingDrawerPortal` (shared blur states).
   - Promote a new `DrawerPortal` wrapper exported from `drawer-chrome.js` for both drawers.
2. **Centralize animation tokens**
   - Define `--motion-duration-fast`, `--motion-duration-medium`, etc., in `shared.css`.
   - Apply blur filters to `.dialog-backdrop[data-state]` and `.dialog-surface` transitions.
3. **Rebuild `ModalDialog`**
   - Replace local state machine with shared controller.
   - Ensure blur fade, consistent focus trapping, and type-safe props.
4. **Normalize icons**
   - Replace inline SVG icons in docs/auth with Remix markup.
   - Remove manual `<i>` insertions that skip helper; document import pattern.
5. **Flatten auth theme**
   - Swap gradients for solid tokens; align button styling with `.btn` variants.
6. **Extract inline CSS**
   - Relocate shell and doc inline styles into shared utilities to enforce spec.
7. **Consolidate messaging**
   - Create a shared toast component using palette tokens; remove ad-hoc RGBA values.
8. **Document component usage**
   - Update README to reference this spec and enforce reuse in future PR reviews.

## Enforcement
- Add lint rule (stylelint/ESLint custom rule) to flag inline `style` objects containing forbidden properties (e.g., raw `rgba`, `boxShadow`).
- Introduce storybook-like catalog under `ux/cms/docs/examples` for visual regression.
- Require any new UI PR to cite the component or token being reused.

## Next Steps
- Schedule a pairing session to implement drawer consolidation.
- File tasks to replace legacy inline icons with Remix equivalents.
- Kick off design QA checklist referencing this document.

## Baseline Token Catalogue
- **Spacing Scale**: 4 px increments (`4, 6, 8, 10, 12, 16, 20, 24, 32`). Encode as `--space-1` … `--space-8`. Replace hard-coded paddings like `padding: '8px 10px'` (`ux/cms/public/js/modal.js:594`).
- **Border Radius**: `--radius-xs: 6px`, `--radius-sm: 10px`, `--radius-md: 14px`, `--radius-lg: 18px`, `--radius-pill: 999px`. Map current usages (`shared.css:69`, `shared.css:524`) to tokens.
- **Elevation**: `--shadow-soft`, `--shadow-medium`, `--shadow-strong` built from palette combos instead of inline `boxShadow` definitions (`ux/cms/public/js/modal.js:319`).
- **Blur Levels**: `--blur-none: 0`, `--blur-soft: 6px`, `--blur-strong: 16px`. Apply to `.dialog-backdrop`/`.drawer-surface` states.
- **Motion Easing**: adopt cubic-bezier `(0.33, 0, 0.2, 1)` for medium transitions (already used by account drawer) and `(0.4, 0, 0.2, 1)` for fast fades.

## Component Specification (Detailed)
### Drawer System
- **Portal**: All drawers render through `SlidingDrawerPortal` (or successor) to enforce stage-driven blur transitions (`ux/cms/public/js/account-drawer.js:103`).
- **Stages**: `closed`, `enter`, `open`, `closing` controlled via `data-state`. CSS transitions defined once in `shared.css`.
- **Surface**: class `drawer-surface` + variant modifier (`account-drawer-surface`, `content-drawer-surface`). Variants only adjust internal layout, not transitions.
- **Header**: use `DrawerHeader` from `drawer-chrome.js` to guarantee shared icon button spacing (`ux/cms/public/js/drawer-chrome.js:251`).
- **List container**: wrap collections in `drawer-list` and optional modifiers (`drawer-list--droppable`, `content-drawer__list`) so borders/backgrounds stay tokenised (`ux/cms/public/styles/shared.css:600`).
- **List Items**: rely on `DrawerListItem`; add new props rather than cloning markup locally (`ux/cms/public/js/modal.js:2419`).

### Modal Dialog
- Replace bespoke `ModalDialog` with a shared React component bridging to `dialogService`. Provide props: `title`, `subtitle`, `actions`, `initialFocus`, `size`. No inline `style` overrides; width/height via tokens.

### Buttons & Icon Buttons
- Normalize `.btn` & `.icon-button` variants by OR-ing dedicated modifier classes instead of reapplying per context. Remove gradient button definitions from auth page; re-map to `btn--accent`.

### Forms & Inputs
- Wrap form controls in reusable `FormField` structure (label + helper text). Sign-in form currently duplicates spacing (`ux/cms/app/auth/SignInForm.tsx:40`).

### Toasts & Banners
- Build `Toast` component referencing tokens for backgrounds and icons. Replace ad-hoc `setToast` render fragments (`ux/cms/public/js/modal.js:2488`).

### Skeletons & Loaders
- Consolidate skeleton animations under `tree-skeleton` pattern; avoid injecting new keyframes in JavaScript.

### Highlight Settings
- Panel already registers via `dialogService` but still uses bespoke DOM structure. Ensure it imports modal tokens and icon buttons.

## Remix Icon Integration Plan
1. Ensure Remix font is loaded once from layout (currently linked in HTML, `ux/cms/public/index.html:143`). Move to Next document head.
2. Update docs header buttons to use `icon('sun-line')` etc. Replace inline SVG definitions (`ux/cms/public/doc.html:32`).
3. Confirm extension surfaces (highlight overlay) also use `icon-pack` (they already import `icon` in some contexts; audit remaining inline markup).
4. Provide TypeScript types enumerating allowed icon names to avoid typos.

## CSS Architecture Rules
- Keep `shared.css` as centralized token + component layer. Create smaller module files (e.g., `_drawer.css`, `_modal.css`) imported into build to reduce monolith fatigue.
- Ban inline `<style>` tags in HTML shell/doc outputs; move content into dedicated CSS modules referenced by bundler.
- Adopt BEM-like naming already in place (`drawer-shell-header__title`) for any new selectors. Document naming in README.

## Testing & QA
- Add Playwright visual snapshots focused on drawer open/close, modal open/close, toast entry, and hover states once animations are standardized.
- Provide manual QA script covering sign-in form, account drawer, content drawer, highlight settings, and doc shell to confirm blur presence and icon consistency.

## Definition of Done for UI Changes
- PR references this spec and identifies which component/token is reused or extended.
- No inline styles introducing non-token colors/spacing remain.
- Animations use shared duration/easing variables.
- Icons verified to come from Remix (`icon-pack`).
- Accessibility: focus trapping confirmed via `dialogService` for drawers & modals; screen readers see `aria-modal` and `aria-hidden` transitions.

## Implementation Log — 2025-09-26
- **Overlay tokens**: Introduced duration/easing/blur vars in `ux/cms/public/styles/shared.css:1` and rewired `.dialog-backdrop`, `.dialog-surface`, and drawer surfaces to drive blur transitions off the shared scales. Account/content drawers now inherit the same backdrop mix without bespoke RGBA literals.
- **Modal host**: Replaced the `ModalDialog` stage machine with a `dialogService` registration (`ux/cms/public/js/modal.js:95`), so open/close flows reuse the canonical controller, escape handling, and focus trap.
- **Content drawer**: Removed the hand-rolled overlay (`ux/cms/public/js/modal.js:2520`) in favor of a `dialog-backdrop` + `drawer-surface` pair registered with the service. Inline transforms/pointer toggles are gone; state changes ride on the CSS data-state hooks and the new `content-drawer-surface` tokens in `shared.css`.
- **Auth shell**: Flattened the sign-in experience (`ux/cms/app/auth/styles.css:1`) by importing shared tokens, dropping gradients/glass, and aligning inputs/buttons/error cards with the canonical palette.
- **Follow-ups**: Generate visual/interaction smoke tests once Playwright harness is ready; extract shared toast/context menu components to eliminate inline styling; migrate docs shell icons to `icon-pack`.

## Implementation Log — 2025-09-27
- **Account drawer portal**: Replaced the bespoke stage machine with a `dialogService` registration so account and content drawers share the same blur timings (`ux/cms/public/js/account-drawer.js:94`). The close delay now tracks the shared 260 ms token.
- **Drawer list tokens**: Centralised list backgrounds/borders behind `--drawer-list-*` variables and introduced `drawer-list--droppable` + `content-drawer__list` modifiers to keep account/content drawers visually aligned (`ux/cms/public/styles/shared.css:600`).
- **Content drop target**: Converted the content drawer dropzone to reuse the shared list classes instead of inline borders/backgrounds (`ux/cms/public/js/modal.js:2342`).
- **Modal overlays**: Wired highlight settings and add-account flows into the shared blur contract with explicit close delays and backdrop tokens (`ux/cms/public/js/highlight/manager.js:420`, `ux/cms/public/js/account-drawer.js:1155`, `ux/cms/public/styles/shared.css:880`).
- **Follow-ups**: Move remaining inline styles (context menu, toast, “no results” blanks) into reusable components; add interaction tests that assert the blur tokens fire on open/close; align docs-shell drawers with the new `drawer-list` variables.

## Implementation Log — 2025-09-28
- **Shell viewport**: Introduced the `shell-app` body class and flex column layout so the SPA shell owns overflow internally, eliminating the phantom outer scrollbar without regressing drawer/modal positioning (`ux/cms/public/index.html:8`).
- **Docs nav alignment**: Rebuilt the docs grid to drive layout via CSS variables and per-depth indent styling, ensuring the structure nav and TOC line up across nesting levels (`ux/cms/public/doc.html:21`, `ux/cms/public/js/ui.js:449`).
- **Header metrics**: Added runtime measurement of the docs header height (with embed overrides) to keep the sticky TOC pinned without hard-coded offsets (`ux/cms/public/js/doc.js:1`).

## Implementation Log — 2025-09-29
- **Highlight runtime isolation**: Added shared DOM utilities for the plugin to tag owned surfaces and skip them during glow decoration so the effect targets document content instead of the settings UI (`ux/cms/public/js/highlight-plugin/core/dom-utils.js:1`, `ux/cms/public/js/highlight-plugin/core/effects.js:1`).
- **Mutation guardrails**: Updated the highlight observer to ignore plugin-owned mutations and issue lightweight refreshes, preventing the iframe messaging loop and keeping settings toggles stable (`ux/cms/public/js/highlight-plugin/runtime/mutations.js:1`).
- **Shell integration**: The shell now recognises the plugin via either global flag, avoiding duplicate injections when the browser extension is active (`ux/cms/public/js/shell.js:39`).

## Implementation Log — 2025-09-29
- **Highlight isolation**: Removed the in-app highlight manager bundle so the browser extension becomes the sole owner of glow logic, leaving only the shell header button wired to cross-window messages (`ux/cms/public/js/main.js:20`, `ux/cms/public/js/ui.js:556`, `ux/cms/public/js/highlight/*` removed).
- **Viewport cleanup**: Reworked the docs content pane so the scroll container lives on `tree-root`, eliminating the redundant wrapper scrollbar while preserving skeleton overlays (`ux/cms/public/doc.html:45`, `ux/cms/public/styles/shared.css:194`, `ux/cms/public/styles/shared.css:203`).
- **Legacy CSS purge**: Dropped highlight panel selectors from the shared stylesheet to keep plugin styling self-contained (`ux/cms/public/styles/shared.css:1120`).

## Implementation Log — 2025-09-30
- **Highlight plugin runtime**: Rebuilt the glow tooling as a standalone runtime under `ux/cms/public/js/highlight-plugin/` (see `bootstrap.js:1`, `core/manager.js:1`) so the same module powers both extension and embedded CMS flows.
- **Shell injection**: Added guarded helpers in `ux/cms/public/js/shell.js:40` to configure and inject the plugin into the docs iframe, mirroring how the browser extension executes while keeping the iframe source clean.
- **Extension sync**: Updated `ux/cms/scripts/sync-highlight-extension.mjs:1` to publish the runtime into `ux/cms/extension/highlight-plugin/pkg`, and pointed the extension entry (`ux/cms/extension/highlight-plugin/content-script.js:1`) at the shared bootstrap module.
- **Message bridge hardening**: Centralised the `highlightSettings` ACK/dispatch loop in `ux/cms/public/js/highlight-plugin/runtime/message-bridge.js:1` to guarantee shell ↔ plugin communication even when loaded late, avoiding the postMessage timeouts we were seeing.

## Implementation Log — 2025-10-01
- **Shell button removal**: Dropped the legacy header toggle so the CMS shell no longer hosts highlight controls (`ux/cms/public/index.html:183`, `ux/cms/public/js/shell.js:803`). This keeps the iframe contract clean and defers all UI affordances to the plugin runtime.
- **Auto injection**: Hardened `ensureHighlightPluginConfig` to mandate fallback toggle creation and early panel render on every iframe boot (`ux/cms/public/js/shell.js:32`). The shell now guarantees the plugin loads whenever a docs tab comes online without any manual click path.
- **Toggle isolation**: Marked all plugin toggle buttons as owned/ignored nodes so the floating settings affordance never registers as a highlight target (`ux/cms/public/js/highlight-plugin/ui/panel.js:103`).
- **Follow-ups**: Re-run the extension sync script after validating in-browser to keep the packaged runtime aligned; add Playwright coverage that asserts the fallback toggle renders on docs activation and remains excluded from highlight overlays.

## Implementation Log — 2025-10-02
- **Deterministic bootstrap**: The shell always pushes the highlight runtime into the docs iframe by attaching a `type="module"` script tag (guarded by a fixed id) and refreshing any existing plugin instance rather than relying on DOM heuristics (`ux/cms/public/js/shell.js:39`). This ensures every tab load reuses or spins up the shared runtime without double-mounting.
- **Floating toggle default**: The highlight settings UI always mints its own floating control and tracks ownership so repeated boots clean up the previous button before rendering the new one (`ux/cms/public/js/highlight-plugin/ui/panel.js:83`). The bootstrap helper only reuses an existing control if it was explicitly provided.
- **Legacy header removal**: Dropped the dormant header toggle from the docs shell so the iframe no longer depends on hidden DOM to surface highlight controls (`ux/cms/public/doc.html:185`). This keeps all settings entry points plugin-owned and guarantees visibility in embed mode.

## Architectural Assessment — 2025-09-27
- **Overlay system**: All first-party drawers/modals now enter through `dialogService`, but extensions like the docs quick-search still instantiate ad-hoc overlays—migrate them before they diverge (`ux/cms/public/doc.html:58`).
- **Inline fragments**: Content drawer context menu and toast render paths still in-line styles for radius/palette (`ux/cms/public/js/modal.js:2398`, `ux/cms/public/js/modal.js:2488`). Extract tokenised components to keep parity with the ethereal spec.
- **Iconography**: Docs shell and various HTML entry points continue to embed raw SVG; hook them into `icon-pack` so Remix updates propagate automatically (`ux/cms/public/doc.html:31`).
- **Animation reuse**: Upload helpers still inject bespoke `@keyframes` (`ux/cms/public/js/modal.js:81`). Relocate to `shared.css` to avoid conflicting easing curves.
- **Process hygiene**: No automated regression coverage validates the new transitions. Add Playwright smoke tests that assert `data-state` sequencing and blur via screenshots before landing the next UI refactor.
