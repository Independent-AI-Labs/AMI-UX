import { HighlightManager } from './core/manager.js'
import { createHighlightSettingsUI } from './ui/panel.js'
import { observeMutations } from './runtime/mutations.js'
import { setupMessageBridge } from './runtime/message-bridge.js'
import { shouldIgnoreNode } from './core/dom-utils.js'
import { debugLog, setDebugEnabled } from './core/debug.js'

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

function watchInitialTargets(doc, manager, options = {}) {
  const root = options.root || doc.body || doc.documentElement || doc
  const fallbackDelay = Math.max(Number(options.fallbackDelay) || 1500, 250)
  const minInterval = Math.max(Number(options.minInterval) || 160, 60)
  const ElementRef = doc?.defaultView?.Element || (typeof Element !== 'undefined' ? Element : null)
  const NodeFilterRef = doc?.defaultView?.NodeFilter || (typeof NodeFilter !== 'undefined' ? NodeFilter : null)
  const NodeRef = doc?.defaultView?.Node || (typeof Node !== 'undefined' ? Node : null)

  let observer = null
  let fallbackHandle = null
  let stopped = false
  let lastRefreshTs = 0

  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      observer?.disconnect()
    } catch {}
    observer = null
    if (fallbackHandle) {
      clearTimeout(fallbackHandle)
      fallbackHandle = null
    }
  }

  const findFirstHighlightable = () => {
    const scope = doc.body || doc.documentElement || doc
    if (!scope) return null

    if (doc.createTreeWalker && NodeFilterRef) {
      try {
        const walker = doc.createTreeWalker(scope, NodeFilterRef.SHOW_ELEMENT, {
          acceptNode(node) {
            if (!node || node === scope) return NodeFilterRef.FILTER_SKIP
            if (shouldIgnoreNode(node)) return NodeFilterRef.FILTER_SKIP
            return NodeFilterRef.FILTER_ACCEPT
          },
        })
        const next = walker.nextNode()
        if (next && next !== scope) return next
      } catch (err) {
        debugLog('bootstrap:initial:walker-error', { error: err?.message || String(err) })
      }
    }

    if (ElementRef && scope instanceof ElementRef) {
      const queue = Array.from(scope.children || [])
      while (queue.length) {
        const candidate = queue.shift()
        if (!candidate) continue
        if (shouldIgnoreNode(candidate)) {
          if (candidate.children && candidate.children.length) {
            queue.unshift(...Array.from(candidate.children))
          }
          continue
        }
        return candidate
      }
    }
    return null
  }

  const attemptRefresh = (reason, hint) => {
    const scope = doc.body || doc.documentElement || doc
    debugLog('bootstrap:initial:body-info', {
      reason,
      hasBody: !!doc.body,
      childCount: scope && scope.children ? scope.children.length : undefined,
      readyState: doc.readyState,
    })

    const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
    if (lastRefreshTs && now - lastRefreshTs < minInterval) return false

    let candidate = hint && ElementRef && hint instanceof ElementRef ? hint : null
    if (candidate && shouldIgnoreNode(candidate)) candidate = null
    if (!candidate) candidate = findFirstHighlightable()

    debugLog('bootstrap:initial:probe', {
      reason,
      matched: !!candidate,
      tag: candidate?.tagName,
      classList: candidate?.className,
    })
    if (!candidate) return false

    lastRefreshTs = now
    try {
      manager.refreshAll({ rebuild: true })
    } catch (err) {
      debugLog('refresh-error', { error: err?.message || String(err) })
    }
    return true
  }

  const scheduleFallback = () => {
    if (stopped) return
    fallbackHandle = setTimeout(() => {
      fallbackHandle = null
      if (stopped) return
      attemptRefresh('fallback')
      scheduleFallback()
    }, fallbackDelay)
  }

  attemptRefresh('initial')

  if (root && typeof MutationObserver !== 'undefined') {
    const handleAdded = (node) => {
      if (stopped || !node) return false
      if (ElementRef && node instanceof ElementRef) {
        if (shouldIgnoreNode(node)) return false
        return attemptRefresh('mutation', node)
      }
      if (NodeRef && node.nodeType === NodeRef.DOCUMENT_FRAGMENT_NODE) {
        let triggered = false
        const children = Array.from(node.childNodes || [])
        for (const child of children) {
          if (handleAdded(child)) triggered = true
        }
        return triggered
      }
      return false
    }

    observer = new MutationObserver((records) => {
      if (stopped) return
      for (const record of records) {
        if (!record || record.type !== 'childList') continue
        const added = record.addedNodes || []
        for (const node of added) handleAdded(node)
      }
    })
    try {
      observer.observe(root, { childList: true, subtree: true })
      debugLog('bootstrap:initial:observe', { root: root === doc.body ? 'body' : 'custom' })
    } catch (err) {
      debugLog('bootstrap:initial:observe-error', { error: err?.message || String(err) })
    }
  }

  scheduleFallback()

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

  const debugEnabled = config.debug !== false
  setDebugEnabled(debugEnabled)
  debugLog('bootstrap:start', {
    scopeSelector: config.scopeSelector,
    overlayFollow: config.overlayFollow,
    hasDocument: !!doc,
  })

  const selectors = mergeSelectors(
    DEFAULT_SELECTORS,
    config.selectors && typeof config.selectors === 'object' ? config.selectors : null,
  )

  const manager = new HighlightManager({
    document: doc,
    storageKey: config.storageKey || 'amiHighlightPluginSettings',
    settings: config.settings,
    debug: debugEnabled,
  })
  debugLog('manager:created', { contextCount: manager.contexts?.size || 0 })

  const contextHandle = manager.registerContext({
    id: config.contextId || 'ami-highlight-default',
    document: doc,
    scopeSelector: config.scopeSelector || 'body',
    selectors,
    overlayFollow: config.overlayFollow || ['block', 'inline', 'heading'],
    handlers: config.handlers || {},
  })
  debugLog('context:registered', {
    id: contextHandle.id,
    scopeSelector: config.scopeSelector || 'body',
    overlayFollow: Array.isArray(config.overlayFollow) ? config.overlayFollow : undefined,
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
  debugLog('mutations:observing', {
    root: config.mutationRoot ? 'custom' : 'document',
  })

  const stopInitialMonitor = watchInitialTargets(doc, manager)

  const teardownBridge = setupMessageBridge({
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
    },
  }

  globalRef[INIT_FLAG] = api
  try {
    globalRef.__AMI_HIGHLIGHT_PLUGIN__ = api
  } catch {}
  debugLog('bootstrap:complete', { contextId: contextHandle.id })
  return api
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
