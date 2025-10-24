import { HighlightManager } from './core/manager.js'
import { createHighlightSettingsUI } from './ui/panel.js'
import { observeMutations } from './runtime/mutations.js'
import { setupMessageBridge } from './runtime/message-bridge.js'
import { shouldExcludeNode, isPluginNode } from './core/dom-utils.js'
import { debugLog, setDebugEnabled } from './core/debug.js'

const INIT_FLAG = '__amiHighlightPlugin'
const ACTIVE_ATTR = 'data-ami-highlight-active'
const ACTIVE_OWNER_ATTR = 'data-ami-highlight-owner'

function getDocumentRoot(doc) {
  if (!doc) return null
  return doc.documentElement || doc.body || null
}

function markDocumentActive(doc, ownerId) {
  const root = getDocumentRoot(doc)
  if (!root) return
  try {
    root.setAttribute(ACTIVE_ATTR, '1')
    if (ownerId) root.setAttribute(ACTIVE_OWNER_ATTR, ownerId)
  } catch {}
}

function clearDocumentActive(doc, ownerId) {
  const root = getDocumentRoot(doc)
  if (!root) return
  try {
    const currentOwner = root.getAttribute(ACTIVE_OWNER_ATTR)
    if (!ownerId || !currentOwner || currentOwner === ownerId) {
      root.removeAttribute(ACTIVE_ATTR)
      root.removeAttribute(ACTIVE_OWNER_ATTR)
    }
  } catch {}
}

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

function watchInitialTargets(doc, manager, options = {}) {
  const ElementRef = doc?.defaultView?.Element || (typeof Element !== 'undefined' ? Element : null)
  const NodeRef = doc?.defaultView?.Node || (typeof Node !== 'undefined' ? Node : null)
  const cleanup = []
  let observer = null
  let activated = false

  const stop = () => {
    try {
      observer?.disconnect()
    } catch {}
    observer = null
    while (cleanup.length) {
      const fn = cleanup.pop()
      try {
        fn()
      } catch {}
    }
    activated = true
  }

  const trigger = (reason) => {
    if (activated || !doc.body) return
    activated = true
    debugLog('bootstrap:initial:activate', { reason })
    try {
      manager.refreshAll({ rebuild: true })
    } catch (err) {
      debugLog('refresh-error', { error: err?.message || String(err) })
    }
    stop()
  }

  const readyStates = ['interactive', 'complete']
  if (readyStates.includes(doc.readyState) && doc.body) {
    trigger('ready-state')
    return stop
  }

  const onReady = () => trigger('dom-content-loaded')
  try {
    doc.addEventListener('DOMContentLoaded', onReady, { once: true })
    cleanup.push(() => doc.removeEventListener('DOMContentLoaded', onReady))
  } catch {}

  if (typeof MutationObserver === 'undefined') return stop

  const root = options.root || doc
  observer = new MutationObserver((records) => {
    if (activated) return
    if (doc.body) {
      trigger('body-present')
      return
    }
    for (const record of records) {
      const added = record?.addedNodes ? Array.from(record.addedNodes) : []
      for (const node of added) {
        if (activated) return
        if (ElementRef && node instanceof ElementRef) {
          if (shouldExcludeNode(node) || isPluginNode(node)) continue
          trigger('element-added')
          return
        }
        if (NodeRef && node?.nodeType === NodeRef.DOCUMENT_FRAGMENT_NODE) {
          const fragmentChildren = Array.from(node.childNodes || [])
          for (const child of fragmentChildren) {
            if (
              ElementRef &&
              child instanceof ElementRef &&
              !shouldExcludeNode(child) &&
              !isPluginNode(child)
            ) {
              trigger('fragment-child')
              return
            }
          }
        }
      }
    }
  })

  try {
    observer.observe(root, { childList: true, subtree: true })
    debugLog('bootstrap:initial:observe', { root: root === doc ? 'document' : 'custom-root' })
  } catch (err) {
    debugLog('bootstrap:initial:observe-error', { error: err?.message || String(err) })
    stop()
  }

  return stop
}

export function bootstrapHighlightPlugin(config = {}) {
  const globalRef = resolveGlobal(config)
  if (globalRef[INIT_FLAG]) {
    debugLog('bootstrap:reuse')
    return globalRef[INIT_FLAG]
  }

  const doc = config.document || (typeof document !== 'undefined' ? document : null)
  if (!doc) throw new Error('Highlight plugin requires a document context')

  const root = getDocumentRoot(doc)
  const hasActiveFlag = root ? root.hasAttribute(ACTIVE_ATTR) : false
  if (hasActiveFlag && !config.forceStart) {
    const activeOwner = root ? root.getAttribute(ACTIVE_OWNER_ATTR) : null
    const existingApi = (() => {
      if (globalRef[INIT_FLAG]) return globalRef[INIT_FLAG]
      try {
        return doc?.defaultView?.__AMI_HIGHLIGHT_PLUGIN__ || null
      } catch {
        return null
      }
    })()
    if (existingApi) {
      debugLog('bootstrap:skipped', { reason: 'document-active', owner: activeOwner || null })
      return existingApi
    }
    debugLog('bootstrap:skipped', { reason: 'document-active-no-api', owner: activeOwner || null })
    return null
  }

  const instanceId = `ami-highlight-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  let markedActive = false
  try {
    markDocumentActive(doc, instanceId)
    markedActive = true
  } catch {}

  if (Object.prototype.hasOwnProperty.call(config, 'debug')) {
    setDebugEnabled(config.debug)
  }
  const debugEnabled = config.debug !== false
  debugLog('bootstrap:start', {
    scopeSelector: config.scopeSelector,
    overlayFollow: config.overlayFollow,
    hasDocument: !!doc,
  })

  const selectors = mergeSelectors(
    DEFAULT_SELECTORS,
    config.selectors && typeof config.selectors === 'object' ? config.selectors : null,
  )

  const providedHandlers = config.handlers && typeof config.handlers === 'object' ? config.handlers : {}

  let manager
  try {
    manager = new HighlightManager({
      document: doc,
      storageKey: config.storageKey || 'amiHighlightPluginSettings',
      settings: config.settings,
      debug: debugEnabled,
      automation: config.automation,
    })
  } catch (err) {
    if (markedActive) clearDocumentActive(doc, instanceId)
    throw err
  }
  let stopInitialMonitor = () => {}
  let teardownBridge = () => {}
  let contextHandle
  let ui
  let completed = false
  let contextListener = null
  try {
    debugLog('manager:created', { contextCount: manager.contexts?.size || 0 })

    contextHandle = manager.registerContext({
      id: config.contextId || 'ami-highlight-default',
      document: doc,
      scopeSelector: config.scopeSelector || 'body',
      selectors,
      overlayFollow: config.overlayFollow || ['block', 'inline', 'heading'],
      handlers: providedHandlers,
    })
    debugLog('context:registered', {
      id: contextHandle.id,
      scopeSelector: config.scopeSelector || 'body',
      overlayFollow: Array.isArray(config.overlayFollow) ? config.overlayFollow : undefined,
    })

    const toggle = resolveToggleButton(doc, config.toggleButton)
    const view = doc.defaultView || null
    const isTopWindow = (() => {
      if (!view) return true
      try {
        return view.top === view
      } catch {
        return true
      }
    })()
    const allowFloatingToggle = (() => {
      if (config.createDefaultToggle === true) return true
      if (config.createDefaultToggle === false) return false
      const body = doc.body || null
      const isShellHost = isTopWindow && !!(body && body.classList && body.classList.contains('shell-app'))
      if (isShellHost) return false
      return !isTopWindow
    })()

    ui = createHighlightSettingsUI({
      document: doc,
      manager,
      toggleButton: toggle || null,
      createDefaultToggle: allowFloatingToggle,
      renderImmediately: config.renderImmediately === true,
      ownerId: instanceId,
    })

    if (manager && typeof manager.setDocumentContext === 'function') {
      contextListener = (event) => {
        try {
          manager.setDocumentContext(event?.detail || null)
        } catch (error) {
          debugLog('context:apply-error', { error: error?.message || String(error) })
        }
      }
      try {
        doc.addEventListener('ami:doc-context', contextListener)
      } catch (error) {
        debugLog('context:listener-error', { error: error?.message || String(error) })
      }
      const initialPath = doc.documentElement?.getAttribute('data-ami-doc-path') || ''
      const initialRoot = doc.documentElement?.getAttribute('data-ami-doc-root') || 'contentRoot'
      if (initialPath) {
        manager
          .setDocumentContext({ path: initialPath, root: initialRoot })
          .catch((error) => debugLog('context:initial-error', { error: error?.message || String(error) }))
      }
    }

    if (ui && contextHandle && typeof contextHandle.update === 'function') {
      const patchHandlers = {}
      if (typeof providedHandlers.onTrigger !== 'function') {
        patchHandlers.onTrigger = (element) => {
          if (element && typeof ui.editAutomationTriggerForElement === 'function') {
            ui.editAutomationTriggerForElement(element)
          } else if (element && typeof ui.createAutomationTriggerForElement === 'function') {
            ui.createAutomationTriggerForElement(element)
          }
        }
      }
      if (typeof providedHandlers.onAsk !== 'function') {
        patchHandlers.onAsk = (element) => {
          try {
            window.dispatchEvent(
              new CustomEvent('ami:highlight-ask', {
                detail: { element },
              }),
            )
          } catch {}
        }
      }
      if (Object.keys(patchHandlers).length) {
        contextHandle.update({ handlers: patchHandlers })
      }
    }

    const disconnectMutations = observeMutations(manager, contextHandle.id, {
      document: doc,
      root: config.mutationRoot || doc.body || doc.documentElement,
    })
    debugLog('mutations:observing', {
      root: config.mutationRoot ? 'custom' : 'document',
    })

    stopInitialMonitor = doc.body ? () => {} : watchInitialTargets(doc, manager, {
      root: config.mutationRoot || doc,
    })

    teardownBridge = setupMessageBridge({
      targetWindow: config.window || (typeof window !== 'undefined' ? window : null),
      ui,
      manager,
      notifyInitialState: true,
    })
    debugLog('bridge:ready', { hasUI: !!ui })

    const api = {
      manager,
      ui,
      context: contextHandle,
      refresh(options = {}) {
        debugLog('api:refresh', options)
        manager.refreshAll(options)
      },
      destroy() {
        debugLog('api:destroy')
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
        try {
          stopInitialMonitor?.()
        } catch {}
        delete globalRef[INIT_FLAG]
        try {
          if (globalRef.__AMI_HIGHLIGHT_PLUGIN__ === api) {
            delete globalRef.__AMI_HIGHLIGHT_PLUGIN__
          }
        } catch {}
        clearDocumentActive(doc, instanceId)
      },
    }

    globalRef[INIT_FLAG] = api
    try {
      globalRef.__AMI_HIGHLIGHT_PLUGIN__ = api
    } catch {}
    debugLog('bootstrap:complete', { contextId: contextHandle.id })
    completed = true
    return api
  } catch (err) {
    if (contextHandle && typeof contextHandle.destroy === 'function') {
      try {
        contextHandle.destroy()
      } catch {}
    }
    if (ui && typeof ui.destroy === 'function') {
      try {
        ui.destroy()
      } catch {}
    }
    throw err
  } finally {
    if (!completed) {
      try {
        teardownBridge?.()
      } catch {}
      try {
        stopInitialMonitor?.()
      } catch {}
      if (contextListener) {
        try {
          doc.removeEventListener('ami:doc-context', contextListener)
        } catch {}
      }
      if (markedActive) clearDocumentActive(doc, instanceId)
    }
  }
}

function autoStart() {
  if (typeof window === 'undefined') return
  const config = window.__AMI_HIGHLIGHT_CONFIG__ || {}
  if (config.autoStart === false) {
    debugLog('autostart:skipped', { reason: 'config-autoStart-false' })
    return
  }
  debugLog('autostart', { scopeSelector: config.scopeSelector })
  try {
    bootstrapHighlightPlugin(config)
  } catch (err) {
    console.warn('Failed to bootstrap highlight plugin', err)
    debugLog('autostart-error', { error: err?.message || String(err) })
  }
}

autoStart()
