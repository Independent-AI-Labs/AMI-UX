import { HighlightManager } from './core/manager.js'
import { createHighlightSettingsUI } from './ui/panel.js'
import { observeMutations } from './runtime/mutations.js'
import { setupMessageBridge } from './runtime/message-bridge.js'

const INIT_FLAG = '__amiHighlightPlugin'

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
    'label',
    '[role="button"]',
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
    'summary',
    '[role="treeitem"]',
    '[role="row"]',
    '[data-highlight-tree="1"]',
  ],
}

function resolveGlobal(config) {
  if (config?.globalThis && typeof config.globalThis === 'object') return config.globalThis
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof window !== 'undefined') return window
  return {}
}

function mergeSelectors(defaults, overrides) {
  if (!overrides) return defaults
  const merged = { ...defaults }
  for (const [key, value] of Object.entries(overrides)) {
    const list = []
    if (defaults[key]) list.push(...defaults[key])
    if (Array.isArray(value)) list.push(...value)
    else if (value) list.push(value)
    merged[key] = Array.from(new Set(list.filter(Boolean).map((entry) => String(entry))))
  }
  return merged
}

function resolveToggleButton(doc, toggle) {
  if (!toggle) {
    try {
      return doc.querySelector('[data-ami-highlight-toggle="1"]')
    } catch {
      return null
    }
  }
  if (toggle instanceof HTMLElement) return toggle
  if (typeof toggle === 'string') {
    const selector = toggle.startsWith('#') ? toggle : `#${toggle}`
    try {
      return doc.querySelector(selector)
    } catch {
      return null
    }
  }
  return null
}

export function bootstrapHighlightPlugin(config = {}) {
  const globalRef = resolveGlobal(config)
  if (globalRef[INIT_FLAG]) return globalRef[INIT_FLAG]

  const doc = config.document || (typeof document !== 'undefined' ? document : null)
  if (!doc) throw new Error('Highlight plugin requires a document context')

  const selectors = mergeSelectors(
    DEFAULT_SELECTORS,
    config.selectors && typeof config.selectors === 'object' ? config.selectors : null,
  )

  const manager = new HighlightManager({
    document: doc,
    storageKey: config.storageKey || 'amiHighlightPluginSettings',
    settings: config.settings,
  })

  const contextHandle = manager.registerContext({
    id: config.contextId || 'ami-highlight-default',
    document: doc,
    scopeSelector: config.scopeSelector || 'body',
    selectors,
    overlayFollow: config.overlayFollow || ['block', 'inline', 'heading'],
    handlers: config.handlers || {},
  })

  const toggle = resolveToggleButton(doc, config.toggleButton)
  const ui = createHighlightSettingsUI({
    document: doc,
    manager,
    toggleButton: toggle || null,
    createFallbackToggle: config.createFallbackToggle !== false,
    renderImmediately: config.renderImmediately === true,
  })

  const disconnectMutations = observeMutations(manager, contextHandle.id, {
    document: doc,
    root: config.mutationRoot || doc.body || doc.documentElement,
  })

  const teardownBridge = setupMessageBridge({
    targetWindow: config.window || (typeof window !== 'undefined' ? window : null),
    ui,
    manager,
    notifyInitialState: true,
  })

  const api = {
    manager,
    ui,
    context: contextHandle,
    refresh(options = {}) {
      manager.refreshAll(options)
    },
    destroy() {
      try {
        teardownBridge?.()
      } catch {}
      try {
        disconnectMutations?.()
      } catch {}
      try {
        contextHandle?.destroy()
      } catch {}
      try {
        ui?.destroy()
      } catch {}
      delete globalRef[INIT_FLAG]
      try {
        if (globalRef.__AMI_HIGHLIGHT_PLUGIN__ === api) {
          delete globalRef.__AMI_HIGHLIGHT_PLUGIN__
        }
      } catch {}
    },
  }

  globalRef[INIT_FLAG] = api
  try {
    globalRef.__AMI_HIGHLIGHT_PLUGIN__ = api
  } catch {}
  return api
}

function autoStart() {
  if (typeof window === 'undefined') return
  const config = window.__AMI_HIGHLIGHT_CONFIG__ || {}
  try {
    bootstrapHighlightPlugin(config)
  } catch (err) {
    console.warn('Failed to bootstrap highlight plugin', err)
  }
}

autoStart()
