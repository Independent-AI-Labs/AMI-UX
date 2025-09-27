import { markPluginNode } from '../core/dom-utils.js'

const STYLE_ID = 'ami-highlight-ui-style'

const STYLE_TEXT = `
.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
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
  padding: 28px 32px 32px;
}
.dialog-surface {
  min-width: 320px;
  max-width: 420px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 22px 20px;
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
  gap: 12px;
}
.dialog-header__titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.dialog-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.dialog-subtitle {
  margin: 0;
  font-size: 12px;
  color: rgba(154, 163, 178, 0.95);
}
.highlight-settings-panel {
  gap: 12px;
}
.highlight-settings__section {
  border-top: 1px solid rgba(36, 40, 50, 0.55);
  padding-top: 10px;
  margin-top: 10px;
}
.highlight-settings__section:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}
.highlight-settings__section h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(154, 163, 178, 0.95);
}
.highlight-settings__item {
  display: flex;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 10px;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.2s ease;
}
.highlight-settings__item:hover {
  background: rgba(122, 162, 247, 0.12);
}
.highlight-settings__item span {
  font-size: 13px;
  font-weight: 600;
}
.highlight-settings__item p {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: rgba(154, 163, 178, 0.95);
}
.highlight-settings__item--select {
  justify-content: space-between;
  align-items: center;
}
.highlight-settings__item--select select {
  min-width: 120px;
  padding: 6px 8px;
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
  width: 44px;
  height: 44px;
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
`

export function ensureUIStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  markPluginNode(style)
  doc.head.appendChild(style)
}
