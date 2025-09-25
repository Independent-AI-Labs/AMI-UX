import { createHighlightManager } from './highlight/manager.js'

const INIT_FLAG = '__amiHighlightPlugin'
const CONTEXT_ID = 'ami-highlight-global'
const STYLE_ID = 'ami-highlight-plugin-styles'
const BUTTON_ID = 'amiHighlightToggleButton'

const DEFAULT_SELECTORS = {
  block: [
    'article p',
    'article li',
    'article pre',
    'article code',
    'main p',
    'main li',
    'main pre',
    'main code',
    'section p',
    'section li',
    'section pre',
    'section code',
    'p',
    'li',
    'pre',
    'code',
    'table',
    '[data-highlight-block="1"]',
  ],
  inline: [
    'a[href]',
    'button',
    'summary',
    '[data-highlight-inline="1"]',
  ],
  heading: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    '[role="heading"]',
    '[data-highlight-heading="1"]',
  ],
  tree: [
    'nav a',
    'nav summary',
    '[role="treeitem"]',
    '[role="row"]',
    '[data-highlight-tree="1"]',
  ],
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
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
      transition: opacity 210ms cubic-bezier(0.33, 0, 0.2, 1),
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
    .dialog-close {
      border: none;
      background: transparent;
      color: rgba(154, 163, 178, 0.95);
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 10px;
      font-size: 22px;
      font-weight: 600;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease;
    }
    .dialog-close:hover {
      color: #e6e9ef;
      background: rgba(122, 162, 247, 0.18);
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
      top: 18px;
      right: 18px;
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
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
      transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    }
    .ami-highlight-toggle:hover {
      transform: translateY(-1px);
      border-color: rgba(122, 162, 247, 0.6);
      box-shadow: 0 18px 56px rgba(0, 0, 0, 0.4);
    }
    .ami-highlight-toggle:focus {
      outline: 2px solid rgba(122, 162, 247, 0.9);
      outline-offset: 2px;
    }
    .ami-highlight-toggle svg {
      width: 20px;
      height: 20px;
    }
  `
  document.head.appendChild(style)
}

function ensureToggleButton() {
  let button = document.getElementById(BUTTON_ID)
  if (button) return button
  button = document.createElement('button')
  button.id = BUTTON_ID
  button.type = 'button'
  button.className = 'ami-highlight-toggle'
  button.title = 'Toggle highlight settings'
  button.setAttribute('aria-label', 'Toggle highlight settings')
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.37 1.05V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-.37-1.05 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.05-1 1.65 1.65 0 0 0-1.05-.37H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.05-.37 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .37-1.05V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 .37 1.05 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.05.37H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.05.37 1.65 1.65 0 0 0-.46.66z" />
    </svg>
  `
  document.body.appendChild(button)
  return button
}

function registerDefaultContext(manager) {
  return manager.registerContext({
    id: CONTEXT_ID,
    scopeSelector: 'body',
    selectors: DEFAULT_SELECTORS,
    overlayFollow: ['block', 'inline', 'heading'],
  })
}

function refreshOnMutations(manager) {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      manager.refreshContext(CONTEXT_ID, { rebuild: true })
    })
  })
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  })
  return () => observer.disconnect()
}

function initHighlightPlugin() {
  if (window[INIT_FLAG]) return
  window[INIT_FLAG] = true

  if (!document.body) {
    window.addEventListener('DOMContentLoaded', initHighlightPlugin, { once: true })
    return
  }

  injectStyles()

  const manager = createHighlightManager({
    document,
    storageKey: 'amiHighlightPluginSettings',
  })

  registerDefaultContext(manager)

  const button = ensureToggleButton()
  manager.attachToggleButton(button)
  manager.refreshContext(CONTEXT_ID, { rebuild: true })
  const disconnect = refreshOnMutations(manager)

  window.__AMI_HIGHLIGHT_PLUGIN__ = {
    manager,
    refresh: () => manager.refreshContext(CONTEXT_ID, { rebuild: true }),
    disconnect,
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initHighlightPlugin(), { once: true })
} else {
  initHighlightPlugin()
}
