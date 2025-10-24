import { markPluginNode } from '../core/dom-utils.js'

const STYLE_ID = 'ami-highlight-ui-style'

const STYLE_TEXT = `
.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: color-mix(in oklab, rgba(11, 12, 15, 0.95) 55%, transparent);
  backdrop-filter: blur(14px);
  z-index: 4800;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms ease;
}
.dialog-backdrop,
.dialog-surface,
.dialog-header,
.highlight-settings__section,
.highlight-settings__item,
.highlight-settings__item select,
.ami-highlight-toggle {
  font-family: 'Montserrat', -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
}
.dialog-backdrop[hidden] { display: none !important; }
.dialog-backdrop[data-state="enter"],
.dialog-backdrop[data-state="open"] {
  opacity: 1;
  pointer-events: auto;
}
.dialog-backdrop[data-state="closing"] {
  opacity: 0;
  pointer-events: none;
}
.dialog-backdrop--right {
  justify-content: flex-end;
  align-items: flex-start;
  padding: 1.75rem 2rem 2rem;
}
.dialog-surface {
  min-width: 20rem;
  max-width: 26.25rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.375rem 1.375rem 1.25rem;
  border-radius: 18px;
  border: 1px solid rgba(36, 40, 50, 0.55);
  background: rgba(20, 24, 32, 0.92);
  color: #e6e9ef;
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(22px);
  opacity: 0;
  transform: translateY(22px) scale(0.95);
  filter: blur(22px);
  transition:
    opacity 210ms cubic-bezier(0.33, 0, 0.2, 1),
    transform 210ms cubic-bezier(0.33, 0, 0.2, 1),
    filter 210ms cubic-bezier(0.33, 0, 0.2, 1);
}
.dialog-backdrop[data-ami-highlight-owned='1'] {
  --dialog-backdrop-background-closed: transparent;
  --dialog-backdrop-background-open: transparent;
  background: transparent !important;
  backdrop-filter: blur(14px);
}
.dialog-surface[data-ami-highlight-owned='1'] {
  background: rgba(20, 24, 32, 0.92);
  color: #e6e9ef;
  border: 1px solid rgba(36, 40, 50, 0.55);
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(22px);
}
.dialog-surface[data-ami-highlight-owned='1'] .dialog-subtitle {
  color: rgba(154, 163, 178, 0.95);
}
.dialog-surface[data-ami-highlight-owned='1'] .dialog-button,
.dialog-surface[data-ami-highlight-owned='1'] button {
  color: inherit;
}
.dialog-surface[data-state="enter"],
.dialog-surface[data-state="open"] {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
.dialog-surface[data-state="closing"] {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
  filter: blur(16px);
}
.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.dialog-close,
.dialog-header button[type='button'] {
  cursor: pointer;
}
.dialog-button {
  cursor: pointer;
}
.dialog-button:disabled {
  cursor: not-allowed;
}
.dialog-header__titles {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}
.dialog-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}
.dialog-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(154, 163, 178, 0.95);
}
.highlight-settings-panel {
  gap: 1rem;
  height: 40rem;
  min-height: 40rem;
  width: min(32.5rem, 92vw);
  max-width: min(32.5rem, 92vw);
}
.highlight-settings__section {
  border-top: 1px solid rgba(36, 40, 50, 0.55);
  padding-top: 0.625rem;
  margin-top: 0.625rem;
}
.highlight-settings__section:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}
.highlight-settings__section h3 {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(154, 163, 178, 0.95);
}
.highlight-settings__item {
  display: flex;
  gap: 0.625rem;
  padding: 0.5rem 0.375rem;
  border-radius: 10px;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.2s ease;
}
.highlight-settings__item:hover {
  background: rgba(122, 162, 247, 0.12);
}
.highlight-settings__item span {
  font-size: 0.8125rem;
  font-weight: 600;
}
.highlight-settings__item p {
  margin: 2px 0 0;
  font-size: 11.0.3125rem;
  color: rgba(154, 163, 178, 0.95);
}
.highlight-settings__item--select {
  justify-content: space-between;
  align-items: center;
}
.highlight-settings__item--select select {
  min-width: 7.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(36, 40, 50, 0.6);
  background: rgba(11, 12, 15, 0.95);
  color: #e6e9ef;
}
.highlight-settings__item--select select:focus {
  outline: 2px solid rgba(122, 162, 247, 0.9);
  outline-offset: 1px;
}
.ami-highlight-toggle {
  position: fixed;
  bottom: 18px;
  left: 18px;
  top: auto;
  right: auto;
  z-index: 5200;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 12px;
  border: 1px solid rgba(36, 40, 50, 0.55);
  background: rgba(11, 12, 15, 0.9);
  color: #e6e9ef;
  cursor: pointer;
  box-shadow: none;
  opacity: 0.62;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease,
    color 0.22s ease,
    opacity 0.22s ease;
}
.ami-highlight-toggle:hover {
  transform: translateY(-1px);
  border-color: rgba(122, 162, 247, 0.6);
  box-shadow: none;
  opacity: 1;
}
.ami-highlight-toggle:focus {
  outline: 2px solid rgba(122, 162, 247, 0.9);
  outline-offset: 2px;
  opacity: 1;
}
.ami-highlight-toggle svg {
  width: 20px;
  height: 20px;
}
.ami-highlight-toggle__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  transition: transform 0.22s ease;
}
.ami-highlight-toggle__icon--close {
  display: none;
}
.ami-highlight-toggle:hover .ami-highlight-toggle__icon,
.ami-highlight-toggle:focus-visible .ami-highlight-toggle__icon {
  transform: scale(1.08);
}
.ami-highlight-toggle.is-active,
.ami-highlight-toggle[aria-expanded="true"] {
  background: #ffffff;
  color: #000000;
  border-color: rgba(36, 40, 50, 0.15);
  box-shadow: none;
  opacity: 1;
}
.ami-highlight-toggle.is-active:hover,
.ami-highlight-toggle[aria-expanded="true"]:hover {
  border-color: rgba(36, 40, 50, 0.25);
}
.ami-highlight-toggle.is-active .ami-highlight-toggle__icon--gear,
.ami-highlight-toggle[aria-expanded="true"] .ami-highlight-toggle__icon--gear {
  display: none;
}
.ami-highlight-toggle.is-active .ami-highlight-toggle__icon--close,
.ami-highlight-toggle[aria-expanded="true"] .ami-highlight-toggle__icon--close {
  display: inline-flex;
}

.highlight-settings__tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0.375rem 0 0.75rem;
}
.highlight-settings__tab {
  border: 1px solid rgba(36, 40, 50, 0.7);
  background: rgba(19, 24, 32, 0.65);
  color: rgba(230, 233, 239, 0.86);
  border-radius: 11px;
  padding: 0.5rem 0.625rem;
  font-size: 11.0.3125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}
.highlight-settings__tab:hover {
  background: rgba(32, 40, 56, 0.82);
}
.highlight-settings__tab.is-active,
.highlight-settings__tab[aria-selected="true"] {
  background: rgba(122, 162, 247, 0.22);
  border-color: rgba(122, 162, 247, 0.6);
  color: #ffffff;
}
.highlight-settings__tab-panels {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.highlight-settings__tab-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.highlight-settings__tab-panel[hidden] {
  display: none;
}

.highlight-automation {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  flex: 1;
}
.highlight-automation__lead {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(154, 163, 178, 0.92);
}
.highlight-automation__capabilities .highlight-settings__item {
  align-items: flex-start;
}
.highlight-automation__capability input[type='checkbox'] {
  margin-top: 0.25rem;
}
.highlight-automation__scenario-select {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0.375rem 0 2px;
}
.highlight-automation__scenario-select label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.highlight-automation__scenario-select select {
  padding: 0.375rem 0.625rem;
  border-radius: 10px;
  border: 1px solid rgba(58, 72, 104, 0.55);
  background: rgba(14, 18, 26, 0.94);
  color: #e6e9ef;
  font-size: 12.0.3125rem;
}
.highlight-automation__scenario-select select:focus {
  outline: 2px solid color-mix(in oklab, var(--accent) 60%, transparent);
  outline-offset: 2px;
}
.highlight-automation__toolbar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin: 0.375rem 0 0.25rem;
}
.highlight-automation__btn {
  flex: 0 0 auto;
  border: 1px solid color-mix(in oklab, var(--accent) 24%, rgba(36, 40, 50, 0.65));
  border-radius: 12px;
  padding: 0.4375rem 1rem;
  font-size: 12.0.3125rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgba(230, 233, 239, 0.94);
  background: rgba(20, 26, 36, 0.78);
  cursor: pointer;
  transition:
    transform 0.22s ease,
    background 0.22s ease,
    border-color 0.22s ease,
    color 0.22s ease,
    box-shadow 0.22s ease;
}
.highlight-automation__btn:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, var(--accent) 28%, rgba(20, 26, 36, 0.88));
  border-color: color-mix(in oklab, var(--accent) 58%, transparent);
  color: #ffffff;
  box-shadow: 0 12px 28px rgba(8, 12, 20, 0.42);
}
.highlight-automation__btn:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 65%, transparent);
  outline-offset: 2px;
}
.highlight-automation__btn--primary {
  color: #ffffff;
  background: color-mix(in oklab, var(--accent) 38%, transparent);
  border-color: color-mix(in oklab, var(--accent) 62%, transparent);
  box-shadow: 0 10px 26px rgba(12, 18, 28, 0.32);
}
.highlight-automation__btn--primary:hover {
  background: color-mix(in oklab, var(--accent) 48%, transparent);
}
.highlight-automation.is-placing .highlight-automation__btn--primary {
  animation: highlightAutomationPulse 1.4s ease-in-out infinite;
}

@keyframes highlightAutomationPulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 40%, transparent);
  }
  60% {
    box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent);
  }
}

.scenario-manager-backdrop {
  align-items: center;
  justify-content: center;
}
.scenario-manager-dialog {
  --scenario-dialog-padding: 1.625rem;
  width: min(40rem, 92vw);
  max-width: min(40rem, 92vw);
  height: min(43.75rem, 88vh);
  min-height: 35rem;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  padding: var(--scenario-dialog-padding);
  border-radius: 18px;
  border: 1px solid rgba(42, 48, 60, 0.6);
  background: rgba(16, 20, 28, 0.96);
  color: #e6e9ef;
  box-shadow: 0 32px 72px rgba(0, 0, 0, 0.46);
  overflow: hidden;
}
.scenario-manager-dialog[data-fullscreen='true'] {
  --scenario-dialog-padding: 2rem;
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  max-height: 100vh;
  border-radius: 0;
  border: none;
  box-shadow: none;
}
.scenario-manager-backdrop[data-fullscreen='true'] {
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
}
@media (max-width: 56.25rem) {
  .scenario-manager-dialog[data-fullscreen='true'] {
    width: 100vw;
  }
}
@media (max-width: 43.75rem) {
  .scenario-manager-dialog {
    width: min(96vw, 35rem);
    height: min(94vh, 47.5rem);
  }
  .scenario-manager-dialog[data-fullscreen='true'] {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    --scenario-dialog-padding: 1.5rem;
  }
}
@media (max-width: 32.5rem) {
  .scenario-manager-dialog {
    width: 96vw;
    height: calc(100vh - 1.875rem);
    max-height: calc(100vh - 1.875rem);
    --scenario-dialog-padding: 1.25rem;
  }
  .scenario-manager-dialog[data-fullscreen='true'] {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    --scenario-dialog-padding: 1.125rem;
  }
}
.scenario-manager__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-height: 0;
}
.scenario-manager__tree {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 0.5rem;
  min-height: 0;
}
.scenario-manager__tree > * {
  flex: 1;
  min-height: 0;
}
.scenario-manager__loading {
  padding: 1.5rem 0;
  font-size: 0.8125rem;
  color: rgba(198, 205, 216, 0.8);
  text-align: center;
}
.scenario-manager__error {
  font-size: 0.75rem;
  color: rgba(239, 68, 68, 0.92);
}
.scenario-manager__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.scenario-manager__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
}
.scenario-manager .btn {
  border: 1px solid rgba(90, 108, 134, 0.55);
  border-radius: 10px;
  padding: 0.375rem 1rem;
  background: rgba(18, 23, 33, 0.78);
  color: #f0f3f9;
  font-size: 12.0.3125rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}
.scenario-manager .btn:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, var(--accent) 32%, rgba(18, 23, 33, 0.86));
  border-color: color-mix(in oklab, var(--accent) 60%, transparent);
  color: #ffffff;
}
.scenario-manager .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.scenario-manager .btn--danger {
  border-color: rgba(239, 68, 68, 0.55);
  background: rgba(139, 41, 41, 0.55);
}
.scenario-manager .btn--danger:hover {
  background: rgba(239, 68, 68, 0.68);
  border-color: rgba(239, 68, 68, 0.82);
}
.trigger-composer {
  border: 1px solid rgba(52, 60, 76, 0.6);
  border-radius: 14px;
  background: rgba(14, 18, 26, 0.92);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 18px 38px rgba(0, 0, 0, 0.38);
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  padding: 1.25rem;
  color: #e6eaf1;
}
.trigger-composer--dialog {
  width: min(32.5rem, 92vw);
}
.trigger-composer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.trigger-composer__header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}
.trigger-composer__header p {
  margin: 0.25rem 0 0;
  font-size: 12.0.3125rem;
  color: rgba(204, 212, 226, 0.7);
}
.trigger-composer__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1 1 auto;
  min-height: 0;
}
.trigger-composer__type-tabs {
  display: inline-flex;
  gap: 0.625rem;
  background: rgba(18, 22, 32, 0.68);
  border-radius: 999px;
  padding: 0.25rem;
  align-self: flex-start;
}
.trigger-composer__type-tabs button {
  border: none;
  background: transparent;
  color: rgba(210, 218, 232, 0.72);
  font-size: 12.0.3125rem;
  font-weight: 600;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}
.trigger-composer__type-tabs button.is-active {
  background: color-mix(in oklab, var(--accent) 22%, transparent);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(18, 102, 241, 0.35);
}
.trigger-composer__type-tabs button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.trigger-composer__intro {
  font-size: 12.0.3125rem;
  color: rgba(204, 212, 226, 0.7);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.trigger-composer__notice {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 189, 89, 0.8);
}
.trigger-composer__name-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.trigger-composer__name-row label {
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.75rem;
}
.trigger-composer__name-row input {
  border: 1px solid rgba(68, 78, 98, 0.75);
  border-radius: 10px;
  padding: 0.5rem 0.625rem;
  background: rgba(12, 16, 24, 0.95);
  color: #f0f4fb;
  font-size: 0.8125rem;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.trigger-composer__name-row input:focus {
  outline: none;
  border-color: color-mix(in oklab, var(--accent) 60%, transparent);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent) 20%, transparent);
}
.trigger-composer__tabs {
  display: inline-flex;
  gap: 0.625rem;
  border-bottom: 1px solid rgba(58, 66, 84, 0.6);
  padding-bottom: 0.25rem;
}
.trigger-composer__tabs button {
  border: none;
  background: transparent;
  color: rgba(198, 206, 219, 0.72);
  font-size: 12.0.3125rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.375rem 0.625rem;
  border-radius: 8px;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}
.trigger-composer__tabs button.is-active {
  background: rgba(32, 42, 58, 0.8);
  color: #f0f4fb;
}
.trigger-composer__panel {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  flex: 1 1 auto;
  min-height: 0;
}
.trigger-composer__panel .syntax-editor {
  flex: 1 1 auto;
  min-height: 0;
  --syntax-editor-height: 100%;
}
.trigger-composer__panel .syntax-editor__surface,
.trigger-composer__panel .syntax-editor__gutter {
  height: 100%;
}
.syntax-editor {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  border: 1px solid rgba(62, 74, 94, 0.78);
  border-radius: 12px;
  background: rgba(10, 13, 20, 0.96);
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  --syntax-editor-min-lines: 12;
  --syntax-editor-height: calc(var(--syntax-editor-min-lines, 12) * 1.55em);
}
.syntax-editor:focus-within {
  border-color: color-mix(in oklab, var(--accent) 60%, rgba(62, 74, 94, 0.78));
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent) 22%, transparent);
}
.syntax-editor[data-disabled='true'] {
  opacity: 0.65;
}
.syntax-editor__surface {
  position: relative;
  overflow: hidden;
  height: var(--syntax-editor-height);
}
.syntax-editor__highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 1rem 1.125rem;
  pointer-events: none;
  font-family: var(--code-font, 'JetBrains Mono', Consolas, monospace);
  font-size: 12.0.3125rem;
  line-height: 1.55;
  color: rgba(240, 244, 251, 0.92);
  overflow: hidden;
  min-height: 100%;
}
.syntax-editor__highlight code {
  display: block;
  min-height: 100%;
  white-space: pre-wrap;
  word-break: break-word;
}
.syntax-editor[data-empty='true'][data-hint]:before {
  content: attr(data-hint);
  position: absolute;
  inset: 16px 18px auto;
  font-family: var(--code-font, 'JetBrains Mono', Consolas, monospace);
  font-size: 12.0.3125rem;
  line-height: 1.55;
  color: rgba(155, 165, 188, 0.65);
  pointer-events: none;
}
.syntax-editor__textarea,
.syntax-editor__textarea-base {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 1rem 1.125rem;
  border: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: color-mix(in oklab, var(--accent) 80%, #f5f7ff);
  font-family: var(--code-font, 'JetBrains Mono', Consolas, monospace);
  font-size: 12.0.3125rem;
  line-height: 1.55;
  resize: none;
  overflow: auto;
  white-space: pre;
  tab-size: 2;
}
.syntax-editor__textarea:focus,
.syntax-editor__textarea-base:focus {
  outline: none;
}
.syntax-editor__textarea::selection,
.syntax-editor__textarea-base::selection {
  background: rgba(122, 162, 247, 0.35);
  color: #0a0d14;
}
.syntax-editor__textarea::-webkit-scrollbar,
.syntax-editor__textarea-base::-webkit-scrollbar {
  width: 12px;
}
.syntax-editor__textarea::-webkit-scrollbar-thumb,
.syntax-editor__textarea-base::-webkit-scrollbar-thumb {
  background: rgba(82, 96, 124, 0.55);
  border-radius: 8px;
}
.syntax-editor__textarea::-webkit-scrollbar-track,
.syntax-editor__textarea-base::-webkit-scrollbar-track {
  background: rgba(17, 20, 28, 0.86);
}
.syntax-editor__gutter {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  padding: 1rem 0.75rem 1rem 1.125rem;
  background: rgba(6, 8, 12, 0.52);
  border-right: 1px solid rgba(48, 56, 70, 0.55);
  font-family: var(--code-font, 'JetBrains Mono', Consolas, monospace);
  font-size: 12.0.3125rem;
  line-height: 1.55;
  color: rgba(128, 139, 162, 0.92);
  user-select: none;
  pointer-events: none;
  height: var(--syntax-editor-height);
  min-width: 2.75rem;
  box-sizing: border-box;
  will-change: transform;
}
.syntax-editor__gutter span {
  display: block;
  width: 100%;
  text-align: right;
}
.syntax-editor__gutter span + span {
  margin-top: 0;
}
.trigger-composer__error {
  font-size: 0.75rem;
  color: rgba(239, 68, 68, 0.9);
}
.trigger-composer__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.trigger-composer__footer button[type='button'] {
  border: 1px solid rgba(90, 108, 134, 0.4);
  border-radius: 10px;
  background: rgba(18, 22, 32, 0.6);
  color: rgba(226, 231, 240, 0.86);
  padding: 0.375rem 0.875rem;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}
.trigger-composer__footer button[type='button']:hover {
  background: rgba(40, 52, 72, 0.5);
  border-color: rgba(122, 162, 247, 0.45);
}
.trigger-composer__footer button[type='submit'] {
  border: none;
  border-radius: 10px;
  padding: 0.4375rem 1rem;
  background: linear-gradient(135deg, rgba(91, 134, 255, 0.88), rgba(126, 161, 255, 0.88));
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(108, 148, 255, 0.35);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}
.trigger-composer__footer button[type='submit']:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(108, 148, 255, 0.4);
}
.trigger-composer__footer button[type='submit']:disabled {
  filter: grayscale(0.4);
  cursor: not-allowed;
  box-shadow: none;
}
.trigger-composer__spacer {
  flex: 1;
}
.scenario-manager .btn--subtle {
  border-color: rgba(90, 108, 134, 0.3);
  background: rgba(18, 22, 30, 0.4);
  color: rgba(226, 231, 240, 0.86);
}
.scenario-manager .btn--subtle:hover {
  background: rgba(40, 52, 72, 0.45);
  border-color: rgba(122, 162, 247, 0.45);
}
.scenario-manager__composer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.scenario-manager__composer-heading {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}
.scenario-manager__back {
  border: none;
  background: transparent;
  color: rgba(226, 231, 240, 0.86);
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  cursor: pointer;
}
.scenario-manager__back:hover {
  color: #ffffff;
}
.scenario-manager__back:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.scenario-manager {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  flex: 1;
  min-height: 0;
}
.scenario-manager__content {
  position: relative;
  flex: 1;
  height: 100%;
  min-height: 0;
}
.scenario-manager__panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(36px);
  transition:
    opacity 0.25s ease,
    transform 0.28s ease;
}
.scenario-manager__panel[data-active='true'] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(0);
}
.scenario-manager__panel--tree {
  transform: translateX(-32px);
}
.scenario-manager__panel--tree[data-active='true'] {
  transform: translateX(0);
}
.scenario-manager__panel--composer .trigger-composer__form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.25rem;
}
.scenario-manager__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  color: rgba(154, 163, 178, 0.72);
}
.scenario-manager__header-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
}
.scenario-manager__control-button {
  background: transparent;
  border: none;
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border-radius: 10px;
  color: rgba(222, 229, 240, 0.78);
  transition:
    color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
  cursor: pointer;
}
.scenario-manager__control-button i {
  font-size: 1.125rem;
  line-height: 1;
}
.scenario-manager__control-button:hover,
.scenario-manager__control-button:focus-visible {
  color: #ffffff;
  background: rgba(122, 162, 247, 0.2);
  transform: translateY(-1px);
}
.scenario-manager__control-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.32);
}
.scenario-manager__control-button[aria-pressed='true'] {
  color: #ffffff;
  background: rgba(122, 162, 247, 0.32);
  box-shadow: 0 8px 22px rgba(122, 162, 247, 0.35);
}
.scenario-manager__control-button--close {
  color: rgba(222, 229, 240, 0.76);
}
.scenario-manager__control-button--close:hover,
.scenario-manager__control-button--close:focus-visible {
  background: rgba(122, 162, 247, 0.18);
  color: #ffffff;
}
.highlight-automation__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 11.25rem;
  overflow: auto;
}
.highlight-automation__item-btn {
  width: 100%;
  border: 1px solid rgba(36, 40, 50, 0.55);
  border-radius: 10px;
  padding: 0.5rem;
  background: rgba(17, 21, 29, 0.75);
  color: #e6e9ef;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}
.highlight-automation__item-btn:hover {
  background: rgba(122, 162, 247, 0.2);
  border-color: rgba(122, 162, 247, 0.58);
}
.highlight-automation__item-btn:focus-visible {
  outline: 2px solid rgba(122, 162, 247, 0.8);
  outline-offset: 2px;
}
.highlight-automation__item-name {
  font-size: 0.8125rem;
  font-weight: 600;
}
.highlight-automation__item-meta {
  font-size: 11.0.3125rem;
  color: rgba(154, 163, 178, 0.9);
}
.highlight-automation__empty {
  margin: 0.25rem 0 0;
  font-size: 11.0.3125rem;
  color: rgba(154, 163, 178, 0.88);
}
.highlight-automation-trigger-pin {
  position: absolute;
  z-index: 4700;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 1px solid rgba(40, 46, 60, 0.6);
  background: rgba(19, 22, 30, 0.92);
  backdrop-filter: blur(10px);
  color: #e6e9ef;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    opacity 0.18s ease;
}
.highlight-automation-trigger-pin svg {
  width: 16px;
  height: 16px;
}
.highlight-automation-trigger-pin:hover {
  transform: translateY(-1px) scale(1.05);
  background: rgba(122, 162, 247, 0.28);
  border-color: rgba(122, 162, 247, 0.65);
}
.highlight-automation-trigger-pin:disabled,
.highlight-automation-trigger-pin[aria-disabled="true"] {
  opacity: 0.4;
  pointer-events: none;
}

.highlight-automation-placement-overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 5200;
  padding: 0.625rem 0.875rem;
  border-radius: 10px;
  background: rgba(11, 12, 15, 0.92);
  border: 1px solid rgba(36, 40, 50, 0.6);
  color: rgba(230, 233, 239, 0.9);
  font-size: 0.75rem;
  pointer-events: none;
  max-width: 15rem;
}

.highlight-automation-placement-hint {
  position: absolute;
  border: 1.5px dashed rgba(122, 162, 247, 0.85);
  border-radius: 12px;
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(122, 162, 247, 0.2);
  background: rgba(122, 162, 247, 0.12);
  opacity: 0;
  transition: opacity 0.12s ease;
  z-index: 4700;
}

.trigger-dialog {
  width: 32.5rem;
}
.trigger-dialog__close {
  border: none;
  background: transparent;
  color: rgba(230, 233, 239, 0.68);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}
.trigger-dialog__close:hover {
  color: rgba(230, 233, 239, 0.92);
}
.trigger-dialog__meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.trigger-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1 1 180px;
  font-size: 0.75rem;
  color: rgba(154, 163, 178, 0.9);
}
.trigger-dialog__field input,
.trigger-dialog__field select {
  border: 1px solid rgba(36, 40, 50, 0.6);
  border-radius: 8px;
  padding: 0.4375rem 0.625rem;
  background: rgba(11, 12, 15, 0.95);
  color: #e6e9ef;
}
.trigger-dialog__tabs {
  display: flex;
  gap: 0.5rem;
  margin: 0.75rem 0 0.5rem;
}
.trigger-dialog__tab {
  flex: 1 1 auto;
  border: 1px solid rgba(36, 40, 50, 0.6);
  border-radius: 9px;
  padding: 0.375rem 0.5rem;
  background: rgba(18, 22, 30, 0.78);
  color: rgba(230, 233, 239, 0.86);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}
.trigger-dialog__tab.is-active,
.trigger-dialog__tab[aria-selected="true"] {
  background: rgba(122, 162, 247, 0.22);
  border-color: rgba(122, 162, 247, 0.6);
  color: #ffffff;
}
.trigger-dialog__panel {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.trigger-dialog__editor {
  position: relative;
}
.trigger-dialog__textarea-basic {
  width: 100%;
  min-height: 10rem;
  border-radius: 12px;
  border: 1px solid rgba(36, 40, 50, 0.6);
  background: rgba(11, 12, 15, 0.95);
  color: #e6e9ef;
  font-family: 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace;
  font-size: 12.0.3125rem;
  line-height: 1.55;
  padding: 0.875rem;
  resize: vertical;
}
.trigger-dialog__hint {
  margin: 0 0 0.375rem;
  font-size: 11.0.3125rem;
  color: rgba(154, 163, 178, 0.88);
}
.trigger-dialog__meta-info {
  margin: 0.375rem 0 0;
  font-size: 0.6875rem;
  color: rgba(154, 163, 178, 0.7);
}
.trigger-dialog__footer {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 1rem;
}
.trigger-dialog__spacer {
  flex: 1 1 auto;
}
.trigger-dialog__delete {
  border: 1px solid rgba(234, 84, 85, 0.65);
  border-radius: 9px;
  background: rgba(80, 14, 14, 0.65);
  color: #f3d1d1;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.trigger-dialog__delete:hover {
  background: rgba(234, 84, 85, 0.32);
}
.trigger-dialog__cancel,
.trigger-dialog__save {
  border: 1px solid rgba(36, 40, 50, 0.6);
  border-radius: 9px;
  background: rgba(18, 22, 30, 0.78);
  color: #e6e9ef;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.trigger-dialog__save {
  background: rgba(122, 162, 247, 0.22);
  border-color: rgba(122, 162, 247, 0.6);
  color: #ffffff;
}
.trigger-dialog__save:hover {
  background: rgba(122, 162, 247, 0.32);
}

@keyframes highlight-hover-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.glow-hover-actions {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 2px 0.375rem;
  border-radius: 8px;
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  background-color: rgba(12, 16, 26, 0.4);
  background-image: var(
      --highlight-shell-gradient,
      var(--chrome-gradient, linear-gradient(110deg, rgba(122, 162, 247, 0.25) 0%, rgba(244, 114, 182, 0.25) 100%))
    );
  background-size: 260% 260%;
  animation: highlight-hover-gradient 24s ease-in-out infinite;
  box-shadow: 0 18px 34px rgba(8, 11, 18, 0.55);
  color: rgba(250, 252, 255, 0.96);
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translateY(6px) scale(0.94);
  transition:
    opacity var(--hover-fade, 0.26s) ease,
    transform var(--hover-fade, 0.26s) ease,
    filter var(--hover-fade, 0.26s) ease;
  z-index: 4700;
}
.glow-hover-actions::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
  mix-blend-mode: screen;
  opacity: 0.6;
  pointer-events: none;
}
.glow-hover-actions .act-trigger,
.glow-hover-actions .act-ask,
.glow-hover-actions .act-comment,
.glow-hover-actions .act-search {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 9px;
  background: transparent;
  color: rgba(250, 252, 255, 0.92);
  pointer-events: auto;
  transition:
    transform 0.18s ease,
    color 0.18s ease,
    background 0.18s ease;
  border: none;
  outline: none;
}
.glow-hover-actions .act-trigger i,
.glow-hover-actions .act-ask i,
.glow-hover-actions .act-comment i,
.glow-hover-actions .act-search i {
  font-size: 1.25rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.35));
}
.glow-hover-actions .act-trigger:hover,
.glow-hover-actions .act-ask:hover,
.glow-hover-actions .act-comment:hover,
.glow-hover-actions .act-search:hover {
  transform: translateY(-3px) scale(1.08);
  color: #ffffff;
  background: rgba(15, 21, 32, 0.36);
}
.glow-hover-actions .act.act-disabled,
.glow-hover-actions .act.act--disabled,
.glow-hover-actions .act:disabled {
  opacity: 0.45;
  pointer-events: none;
}
.glow-hover-actions.show {
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: drop-shadow(0 26px 45px rgba(8, 11, 18, 0.55));
}
.glow-hover-actions.show::before {
  opacity: 0.8;
}
`

export function ensureUIStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  markPluginNode(style)
  doc.head.appendChild(style)
}
