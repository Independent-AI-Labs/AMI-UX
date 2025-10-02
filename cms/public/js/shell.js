import './auth-fetch.js'

import {
  registerVisualizer,
  detectVisualizer,
  VisualizerA,
  VisualizerB,
  VisualizerD,
} from './visualizers.js'
import { openSelectMediaModal } from './modal.js'
import { deriveMetaDirectory, openMetadataSettingsDialog } from './metadata-settings.js?v=20250306'
import { showToast } from './toast-manager.js?v=20250306'
import { applyHint, humanizeName, normalizeFsPath } from './utils.js'
import { ensureDocumentHintLayer } from './hints/manager.js'
import { createDocMessenger } from './message-channel.js?v=20250310'
import { openAccountDrawer } from './account-drawer.js?v=20250316'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'
import { createTabStrip } from './tab-strip.js?v=20250321'
import { initShellConsole } from './shell-console.js?v=20250321'
import { initContextMenu } from './context-menu.js'

window.addEventListener('ami:unauthorized', () => {
  window.dispatchEvent(new Event('ami:navigate-signin'))
})

ensureDocumentHintLayer(document)

// Initialize custom context menu
initContextMenu()

// Prevent the highlight plugin from auto-starting in the shell document itself.
;(() => {
  try {
    const existing = window.__AMI_HIGHLIGHT_CONFIG__
    const cfg = existing && typeof existing === 'object' ? { ...existing } : {}
    cfg.autoStart = false
    window.__AMI_HIGHLIGHT_CONFIG__ = cfg
  } catch {}
})()

// Visualizer C: iframe to doc.html embed
const VisualizerC = {
  id: 'C',
  label: 'Docs Directory',
  canHandle: (info) => !info || info.type === 'dir' || !info.type,
  mount: async (container, opts = {}) => {
    const sel = opts?.pathInfo || opts?.selected || {}
    const path = sel.path || ''
    loadFrame('/doc.html?embed=1', { intent: 'doc', force: true, frame: getActiveFrame() })
    return { unmount: () => {} }
  },
}

registerVisualizer(VisualizerC)
registerVisualizer(VisualizerA)
registerVisualizer(VisualizerB)
registerVisualizer(VisualizerD)

const HIGHLIGHT_PLUGIN_SRC = '/js/highlight-plugin/bootstrap.js?v=20250310'
const HIGHLIGHT_BOOTSTRAP_ID = 'amiHighlightBootstrapScript'
const HIGHLIGHT_MAX_ATTEMPTS = 5
const HIGHLIGHT_RETRY_BASE = 140
const HIGHLIGHT_ACTIVE_ATTR = 'data-ami-highlight-active'
const HIGHLIGHT_PROXY_ATTR = 'data-ami-highlight-proxy'

const frameRegistry = new Map()
let activeFrameId = null

function getFrameHost() {
  return document.getElementById('vizFrameHost')
}

function getActiveFrame() {
  return activeFrameId ? frameRegistry.get(activeFrameId) || null : null
}

function isShellFrameElement(frame) {
  if (!frame) return false
  for (const value of frameRegistry.values()) {
    if (value === frame) return true
  }
  return false
}

function getShellFrameFor(frame) {
  if (!frame) return null
  if (isShellFrameElement(frame)) return frame
  try {
    let current = frame
    const visited = new Set()
    while (current && !visited.has(current)) {
      visited.add(current)
      const ownerDoc = current.ownerDocument || null
      const parentFrame = ownerDoc?.defaultView?.frameElement || null
      if (!parentFrame) break
      if (isShellFrameElement(parentFrame)) return parentFrame
      current = parentFrame
    }
  } catch {}
  return null
}

function getVisibleFrames() {
  const frames = []
  const active = getActiveFrame()
  frameRegistry.forEach((frame) => {
    if (frame?.dataset?.frameVisible === '1') frames.push(frame)
  })
  if (active && !frames.includes(active)) frames.push(active)
  return frames
}

function ensureFrameForTab(tabId) {
  if (!tabId) return null
  let frame = frameRegistry.get(tabId)
  if (frame && frame.isConnected) return frame
  const host = getFrameHost()
  if (!host) return null
  frame = document.createElement('iframe')
  frame.className = 'viz-frame'
  frame.dataset.tabId = tabId
  frame.dataset.currentSrc = 'about:blank'
  frame.dataset.frameVisible = ''
  frame.setAttribute('title', 'Visualizer')
  frame.setAttribute('loading', 'lazy')
  frame.setAttribute('allow', 'clipboard-read; clipboard-write')
  frame.addEventListener('load', () => {
    if (frame.dataset.tabId === activeFrameId) hideFrameLoading()
    if (frame.dataset.frameVisible === '1' || frame === getActiveFrame()) ensureHighlightPluginInFrame(frame)
  })
  host.appendChild(frame)
  frameRegistry.set(tabId, frame)
  return frame
}

function setActiveTabFrame(tabId) {
  const host = getFrameHost()
  if (!host) return null
  const frame = tabId ? ensureFrameForTab(tabId) : null
  frameRegistry.forEach((entry, id) => {
    const isActive = !!frame && id === tabId
    entry.classList.toggle('is-active', isActive)
    if (isActive) entry.dataset.frameVisible = '1'
    else {
      delete entry.dataset.frameVisible
      teardownHighlightPlugin(entry)
    }
  })
  activeFrameId = frame ? tabId : null
  host.dataset.activeTab = frame ? String(tabId) : ''
  return frame
}

function removeFrameForTab(tabId) {
  const frame = frameRegistry.get(tabId)
  if (!frame) return
  try {
    teardownHighlightPlugin(frame)
  } catch {}
  if (frame.parentNode) frame.parentNode.removeChild(frame)
  frameRegistry.delete(tabId)
  if (activeFrameId === tabId) activeFrameId = null
}

function logHighlightShell(event, payload = {}) {
  try {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[highlight-shell]', event, payload)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[highlight-shell]', event, payload)
    }
  } catch {}
}

function isAboutBlankWindow(win) {
  if (!win) return true
  try {
    const href = win.location && typeof win.location.href === 'string' ? win.location.href : ''
    if (!href) return true
    return href === 'about:blank'
  } catch {
    return true
  }
}

function resetHighlightState(frame, state) {
  if (!frame) return
  const current = state || getHighlightBootstrapState(frame)
  if (!current) return
  current.ready = false
  current.attempts = 0
  current.warned = false
  current.polls = 0
  if (current.retryHandle) {
    clearTimeout(current.retryHandle)
    current.retryHandle = null
  }
}

function collectSameOriginFrames(win) {
  if (!win) return []
  let doc
  try {
    doc = win.document || null
  } catch {
    return []
  }
  if (!doc) return []
  let frames = []
  try {
    frames = Array.from(doc.querySelectorAll('iframe'))
  } catch {
    frames = []
  }
  return frames.filter((iframe) => {
    if (!iframe) return false
    try {
      return !!iframe.contentWindow && !!iframe.contentWindow.document
    } catch {
      return false
    }
  })
}

function ensureHighlightPluginInWindowFrames(win) {
  const frames = collectSameOriginFrames(win)
  if (!frames.length) return
  frames.forEach((iframe) => {
    try {
      ensureHighlightPluginInFrame(iframe)
    } catch {}
  })
}

function ensureHighlightPluginConfig(win) {
  if (!win) return
  const existing = win.__AMI_HIGHLIGHT_CONFIG__
  const cfg = existing && typeof existing === 'object' ? existing : {}

  if (!cfg.storageKey) {
    let storageSuffix = ''
    try {
      const frame = findFrameForWindow(win)
      if (frame && frame.dataset && frame.dataset.tabId) storageSuffix = frame.dataset.tabId
    } catch {}
    if (!storageSuffix) {
      try {
        const doc = win.document
        const docPath = doc?.documentElement?.getAttribute('data-ami-doc-path') || ''
        const docRoot = doc?.documentElement?.getAttribute('data-ami-doc-root') || ''
        if (docRoot || docPath) storageSuffix = `${docRoot}::${docPath}`
      } catch {}
    }
    if (!storageSuffix) {
      try {
        const url = win.location ? `${win.location.pathname || ''}${win.location.search || ''}` : ''
        if (url) storageSuffix = url
      } catch {}
    }
    if (!storageSuffix) storageSuffix = 'global'
    storageSuffix = storageSuffix.replace(/[^a-z0-9:_-]+/gi, '_')
    cfg.storageKey = `amiHighlightPluginSettings::${storageSuffix}`
  }

  if (!Array.isArray(cfg.overlayFollow) || cfg.overlayFollow.length === 0) {
    cfg.overlayFollow = ['block', 'inline', 'heading']
  }
  const isTopWindow = (() => {
    try {
      return win.top === win
    } catch {
      return true
    }
  })()
  cfg.createDefaultToggle = !isTopWindow
  cfg.renderImmediately = true
  cfg.scopeSelector = typeof cfg.scopeSelector === 'string' && cfg.scopeSelector.trim()
    ? cfg.scopeSelector
    : 'body'
  if (cfg.autoStart === undefined) cfg.autoStart = !isTopWindow
  if (!cfg.assetBase) {
    try {
      const explicitRoot = (() => {
        try {
          return typeof win.__AMI_HIGHLIGHT_ASSET_ROOT__ === 'string'
            ? win.__AMI_HIGHLIGHT_ASSET_ROOT__
            : null
        } catch {
          return null
        }
      })()
      if (explicitRoot) {
        cfg.assetBase = explicitRoot
      } else {
        const href = win.location ? win.location.href : window.location?.href
        if (href) {
          try {
            const baseUrl = new URL('.', href)
            cfg.assetBase = baseUrl.toString()
          } catch {
            cfg.assetBase = '/'
          }
        }
      }
    } catch {}
  }
  cfg.debug = true
  logHighlightShell('config', {
    overlayFollow: cfg.overlayFollow,
    scopeSelector: cfg.scopeSelector,
  })

  try {
    win.__AMI_HIGHLIGHT_CONFIG__ = cfg
  } catch {}
  return cfg
}

function isHighlightProxyDocument(doc) {
  if (!doc) return false
  try {
    if (doc.defaultView && doc.defaultView.__AMI_HIGHLIGHT_PROXY__) return true
  } catch {}
  try {
    const root = doc.documentElement
    if (root && root.getAttribute && root.getAttribute(HIGHLIGHT_PROXY_ATTR) === '1') return true
  } catch {}
  try {
    const body = doc.body
    if (body && body.getAttribute && body.getAttribute(HIGHLIGHT_PROXY_ATTR) === '1') return true
  } catch {}
  return false
}

function findProxyTargetFrame(doc) {
  if (!doc) return null
  try {
    return doc.getElementById('d') || null
  } catch {
    return null
  }
}

function getHighlightBootstrapState(frame, win) {
  if (!frame) return null
  const state =
    frame.__amiHighlightBootstrap ||
    (frame.__amiHighlightBootstrap = {
      attempts: 0,
      ready: false,
      window: null,
      retryHandle: null,
      warned: false,
      polls: 0,
    })
  if (win && state.window !== win) {
    state.window = win
    state.attempts = 0
    state.ready = false
    state.warned = false
    state.polls = 0
    if (state.retryHandle) {
      clearTimeout(state.retryHandle)
      state.retryHandle = null
    }
  }
  return state
}

function scheduleHighlightRetry(frame, delay = HIGHLIGHT_RETRY_BASE) {
  if (!frame) return
  const state = getHighlightBootstrapState(frame)
  if (!state || state.ready) return
  if (state.retryHandle) clearTimeout(state.retryHandle)
  logHighlightShell('retry-scheduled', { delay })
  state.retryHandle = setTimeout(() => {
    state.retryHandle = null
    ensureHighlightPluginInFrame(frame)
  }, Math.max(delay, 60))
}

// Loads highlight plugin ONCE in parent window
function ensureHighlightPluginInParent() {
  try {
    // Destroy any existing plugin from old architecture
    const existingApi = window.__AMI_HIGHLIGHT_PLUGIN__
    if (existingApi) {
      logHighlightShell('parent-plugin-destroy-old')
      try {
        if (typeof existingApi.destroy === 'function') {
          existingApi.destroy()
        }
      } catch (err) {
        console.warn('Failed to destroy old highlight plugin', err)
      }
      delete window.__AMI_HIGHLIGHT_PLUGIN__
      delete window.__amiHighlightPlugin
    }

    // Clear any active flags
    const root = document.documentElement || document.body
    if (root) {
      try {
        root.removeAttribute(HIGHLIGHT_ACTIVE_ATTR)
        root.removeAttribute(HIGHLIGHT_ACTIVE_OWNER_ATTR)
      } catch {}
    }

    // Remove any existing scripts
    const existingScript = document.getElementById(HIGHLIGHT_BOOTSTRAP_ID)
    if (existingScript) {
      logHighlightShell('parent-script-remove-old')
      try {
        existingScript.remove()
      } catch {}
    }

    // Load script in parent window with cache buster
    const script = document.createElement('script')
    script.type = 'module'
    script.id = HIGHLIGHT_BOOTSTRAP_ID
    const cacheBuster = `t=${Date.now()}`
    script.src = HIGHLIGHT_PLUGIN_SRC.includes('?')
      ? `${HIGHLIGHT_PLUGIN_SRC}&${cacheBuster}`
      : `${HIGHLIGHT_PLUGIN_SRC}?${cacheBuster}`
    script.crossOrigin = 'anonymous'

    // Configure to use parent document for everything
    window.__AMI_HIGHLIGHT_CONFIG__ = {
      document: document,
      scopeSelector: 'body',
      autoStart: true,
      debug: true,
      forceStart: true,
      createDefaultToggle: true,
    }

    script.addEventListener('load', () => {
      logHighlightShell('parent-script-load')
      // Check if config is visible to module
      console.log('[highlight-shell] Config set:', window.__AMI_HIGHLIGHT_CONFIG__)
      // Check after a delay if API was created
      setTimeout(() => {
        const api = window.__AMI_HIGHLIGHT_PLUGIN__
        console.log('[highlight-shell] Plugin API after load:', api ? 'exists' : 'missing')
        if (!api) {
          console.error('[highlight-shell] Bootstrap did not create API - check for errors above')
        }
      }, 500)
    })
    script.addEventListener('error', (event) => {
      console.error('Highlight plugin script failed to load', event?.error || event)
      logHighlightShell('parent-script-error', { error: event?.error || String(event) })
      try {
        script.remove()
      } catch {}
    })

    const target = document.head || document.documentElement || document.body
    target.appendChild(script)
    logHighlightShell('parent-script-appended')
    return true
  } catch (err) {
    console.error('Failed to inject highlight plugin in parent', err)
    logHighlightShell('parent-ensure-error', { error: err?.message || String(err) })
    return false
  }
}

function ensureHighlightPluginInFrame(frame) {
  try {
    if (!frame) return false
    const shellFrame = getShellFrameFor(frame)
    if (shellFrame) {
      const active = getActiveFrame()
      const isVisible = shellFrame.dataset?.frameVisible === '1' || shellFrame === active
      if (!isVisible) {
        logHighlightShell('ensure-skip-hidden', { tabId: shellFrame.dataset.tabId || null })
        return false
      }
    }

    // Get iframe's document
    const iframeDoc = frame.contentDocument || frame.contentWindow?.document
    if (!iframeDoc) {
      logHighlightShell('ensure-no-iframe-doc')
      return false
    }

    // Check if plugin already exists in iframe
    const iframeApi = frame.contentWindow?.__AMI_HIGHLIGHT_PLUGIN__
    if (iframeApi && typeof iframeApi.refresh === 'function') {
      logHighlightShell('ensure-iframe-refresh')
      try {
        iframeApi.refresh({ rebuild: true })
      } catch (err) {
        console.warn('Iframe highlight plugin refresh failed', err)
        logHighlightShell('ensure-iframe-refresh-error', { error: err?.message || String(err) })
      }
      return true
    }

    // Check if iframe already has the bootstrap script
    const existingScript = iframeDoc.getElementById(HIGHLIGHT_BOOTSTRAP_ID)
    if (existingScript) {
      logHighlightShell('ensure-iframe-script-exists')
      return true
    }

    // Inject plugin into iframe
    logHighlightShell('ensure-iframe-inject')
    const script = iframeDoc.createElement('script')
    script.type = 'module'
    script.id = HIGHLIGHT_BOOTSTRAP_ID
    const cacheBuster = `t=${Date.now()}`
    script.src = HIGHLIGHT_PLUGIN_SRC.includes('?')
      ? `${HIGHLIGHT_PLUGIN_SRC}&${cacheBuster}`
      : `${HIGHLIGHT_PLUGIN_SRC}?${cacheBuster}`
    script.crossOrigin = 'anonymous'

    // Configure plugin for iframe
    frame.contentWindow.__AMI_HIGHLIGHT_CONFIG__ = {
      document: iframeDoc,
      scopeSelector: 'body',
      autoStart: true,
      debug: true,
      forceStart: true,
      createDefaultToggle: false,
    }

    script.addEventListener('load', () => {
      logHighlightShell('ensure-iframe-script-loaded')
    })

    script.addEventListener('error', (event) => {
      console.error('Iframe highlight plugin script failed', event?.error || event)
      logHighlightShell('ensure-iframe-script-error', { error: event?.error || String(event) })
      try {
        script.remove()
      } catch {}
    })

    const target = iframeDoc.head || iframeDoc.documentElement || iframeDoc.body
    if (target) {
      target.appendChild(script)
      logHighlightShell('ensure-iframe-script-appended')
      return true
    }

    return false
  } catch (err) {
    console.warn('Failed to ensure highlight plugin in iframe', err)
    logHighlightShell('ensure-error', { error: err?.message || String(err) })
    return false
  }
}

function ensureHighlightPluginForActiveDoc() {
  const frame = getActiveFrame()
  if (!frame) return false
  logHighlightShell('ensure-active-doc')
  const result = ensureHighlightPluginInFrame(frame)
  try {
    ensureHighlightPluginInWindowFrames(frame.contentWindow)
  } catch {}
  return result
}

function teardownHighlightPlugin(frame) {
  if (!frame) return
  try {
    const api = frame.contentWindow?.__AMI_HIGHLIGHT_PLUGIN__
    if (api && typeof api.destroy === 'function') {
      logHighlightShell('teardown-destroy')
      api.destroy()
    }
  } catch (err) {
    console.warn('Highlight plugin destroy during teardown failed', err)
    logHighlightShell('teardown-error', { error: err?.message || String(err) })
  }
  try {
    const win = frame.contentWindow || null
    if (win) {
      collectSameOriginFrames(win).forEach((child) => teardownHighlightPlugin(child))
    }
  } catch {}
  resetHighlightState(frame)
  try {
    const doc = frame.contentWindow?.document
    const existingScript = doc?.getElementById(HIGHLIGHT_BOOTSTRAP_ID)
    if (existingScript && existingScript.parentNode) existingScript.parentNode.removeChild(existingScript)
  } catch {}
}

function setThemeIcon(theme) {
  const icon = document.getElementById('iconTheme')
  if (!icon) return
  icon.classList.remove('ri-sun-line', 'ri-moon-clear-line')
  icon.classList.add(theme === 'light' ? 'ri-sun-line' : 'ri-moon-clear-line')
  icon.setAttribute('aria-hidden', 'true')
}

function setLabels(_vizId, _info) {
  // Intentionally blank: no noisy mode/path in header
  const modeLabel = document.getElementById('modeLabel')
  const pathLabel = document.getElementById('pathLabel')
  if (modeLabel) modeLabel.textContent = ''
  if (pathLabel) pathLabel.textContent = ''
}

async function updateStatusPillForTab(tab) {
  const pill = document.getElementById('statusPill')
  if (!pill) return
  try {
    if (!tab) {
      pill.textContent = ''
      applyHint(pill, '', { clearAriaLabel: true })
      return
    }
    if (tab.kind === 'app') {
      if (tab.path) {
        const r = await fetch(`/api/app/status?path=${encodeURIComponent(tab.path)}`)
        if (r.ok) {
          const s = await r.json()
          pill.textContent = s.running ? 'App: Running' : 'App: Not running'
          applyHint(pill, s.message || '', { replaceAriaLabel: true })
          return
        }
      }
      pill.textContent = 'App: Unknown'
      applyHint(pill, '', { clearAriaLabel: true })
      return
    }
    if (tab.kind === 'file') {
      const mode = tab.mode || 'A'
      pill.textContent = `Mode ${mode}`
      applyHint(pill, tab.path || '', { replaceAriaLabel: true })
      return
    }
    if (tab.kind === 'dir') {
      pill.textContent = ''
      applyHint(pill, tab.path || '', { replaceAriaLabel: true })
      return
    }
  } catch {
    // noop
  }
}

function updateWelcomeVisibility() {
  const host = getFrameHost()
  const welcome = document.getElementById('welcomeScreen')
  const hasActive = !!(tabsState.active && tabsState.tabs.find((t) => t.id === tabsState.active))
  if (host) host.classList.toggle('is-hidden', !hasActive)
  if (!hasActive) {
    frameRegistry.forEach((frame) => {
      frame.classList.remove('is-active')
      delete frame.dataset.frameVisible
      try {
        teardownHighlightPlugin(frame)
        frame.src = 'about:blank'
        frame.dataset.currentSrc = 'about:blank'
      } catch {}
    })
    hideFrameLoading({ immediate: true })
  }
  if (welcome) welcome.classList.toggle('is-hidden', !!hasActive)
  if (!hasActive) {
    updateStatusPillForTab(null)
    try {
      document.body.classList.remove('mode-dir', 'mode-file', 'mode-app')
    } catch {}
  }
}

let cachedConfig = null
let lastDocMessage = null

async function loadConfig(force = false) {
  if (!force && cachedConfig) return cachedConfig
  try {
    const r = await fetch('/api/config')
    if (r.ok) {
      cachedConfig = await r.json()
      return cachedConfig
    }
  } catch {}
  return cachedConfig
}

const tabsState = { tabs: [], active: null }
const servedMap = { instances: [] }
const appRunning = new Map()

let shellTabStrip = null

const frameLoadingState = {
  overlay: null,
  visibleAt: 0,
  hideTimer: null,
  maxWaitTimer: null,
}

const frameLoadingMessages = {
  doc: 'Preparing document…',
  file: 'Rendering file…',
  app: 'Launching application…',
  served: 'Connecting service…',
  loading: 'Loading…',
}

function getMetadataContextForPath(path) {
  const metaPath = deriveMetaDirectory(path || '')
  const normalized = normalizeFsPath(path || '')
  const context = {
    metaPath,
    rootKey: '',
    rootLabel: '',
    relativePath: '',
  }
  if (!normalized) return context

  const uploadsMarker = '/files/uploads'
  const uploadsIndex = normalized.indexOf(uploadsMarker)
  if (uploadsIndex !== -1) {
    const relative = normalized.slice(uploadsIndex + uploadsMarker.length).replace(/^\/+/, '')
    context.rootKey = 'uploads'
    context.rootLabel = 'Uploads'
    context.relativePath = relative
    return context
  }

  const docRootAbs = cachedConfig?.docRootAbsolute ? normalizeFsPath(cachedConfig.docRootAbsolute) : ''
  if (docRootAbs) {
    if (normalized === docRootAbs || normalized.startsWith(`${docRootAbs}/`)) {
      context.rootKey = 'docRoot'
      context.rootLabel = cachedConfig?.docRootLabel || 'Docs'
      context.relativePath = normalized === docRootAbs ? '' : normalized.slice(docRootAbs.length + 1)
      return context
    }
  }

  return context
}

const TAB_STORAGE_KEY = 'ami.shell.tabs.v1'

function normalizePersistedTab(entry) {
  if (!entry || typeof entry !== 'object') return null
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null
  if (!id) return null
  const kind = entry.kind === 'dir' || entry.kind === 'file' || entry.kind === 'app' ? entry.kind : 'file'
  const normalized = {
    id,
    entryId: typeof entry.entryId === 'string' && entry.entryId ? entry.entryId : null,
    kind,
    path: typeof entry.path === 'string' ? entry.path : '',
    label: typeof entry.label === 'string' && entry.label ? entry.label : null,
    servedId: typeof entry.servedId === 'string' && entry.servedId ? entry.servedId : null,
  }
  if (typeof entry.mode === 'string' && entry.mode) normalized.mode = entry.mode
  return normalized
}

function normalizePersistedTabList(list) {
  if (!Array.isArray(list)) return []
  return list.map((item) => normalizePersistedTab(item)).filter(Boolean)
}

function deriveActiveTabId(tabs, candidate) {
  if (!Array.isArray(tabs) || !tabs.length) return null
  if (candidate && typeof candidate === 'string' && tabs.some((tab) => tab.id === candidate)) {
    return candidate
  }
  return tabs[0]?.id || null
}

function readStoredTabState() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return { tabs: [], activeId: null }
  } catch {
    return { tabs: [], activeId: null }
  }
  try {
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY)
    if (!raw) return { tabs: [], activeId: null }
    const parsed = JSON.parse(raw)
    const tabs = normalizePersistedTabList(
      Array.isArray(parsed?.tabs) ? parsed.tabs : Array.isArray(parsed?.openTabs) ? parsed.openTabs : [],
    )
    const activeIdCandidate =
      typeof parsed?.activeId === 'string'
        ? parsed.activeId
        : typeof parsed?.activeTabId === 'string'
          ? parsed.activeTabId
          : null
    const activeId = deriveActiveTabId(tabs, activeIdCandidate)
    return { tabs, activeId }
  } catch {
    return { tabs: [], activeId: null }
  }
}

function writeStoredTabState(state) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
  } catch {
    return
  }
  try {
    const tabs = normalizePersistedTabList(state?.tabs)
    const activeId = deriveActiveTabId(tabs, state?.activeId)
    const payload = { version: 1, tabs, activeId }
    if (!tabs.length && activeId === null) {
      window.localStorage.removeItem(TAB_STORAGE_KEY)
    } else {
      window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(payload))
    }
  } catch {}
}

function serializeTabForPersistence(tab) {
  const serialized = normalizePersistedTab(tab)
  if (!serialized) return null
  return serialized
}

const tabPersistence = {
  mode: 'unknown',
  checking: null,
  remoteAllowed: false,
}

async function ensureTabPersistenceMode() {
  if (tabPersistence.mode !== 'unknown') return tabPersistence.mode
  if (tabPersistence.checking) return tabPersistence.checking
  const probe = (async () => {
    let mode = 'local-only'
    try {
      const res = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const user = data && typeof data === 'object' ? data.user || null : null
        const roles = Array.isArray(user?.roles) ? user.roles : []
        const isGuest = roles.includes('guest')
        if (user && !isGuest) mode = 'remote-enabled'
      }
    } catch {}
    tabPersistence.mode = mode
    return mode
  })()
  tabPersistence.checking = probe
  try {
    const result = await probe
    return result
  } finally {
    tabPersistence.checking = null
  }
}

function ensureFrameLoadingOverlay() {
  if (!frameLoadingState.overlay) {
    frameLoadingState.overlay = document.getElementById('frameLoadingOverlay') || null
  }
  return frameLoadingState.overlay
}

function showFrameLoading(intent = 'loading') {
  const overlay = ensureFrameLoadingOverlay()
  if (!overlay) return
  if (frameLoadingState.hideTimer) {
    clearTimeout(frameLoadingState.hideTimer)
    frameLoadingState.hideTimer = null
  }
  if (frameLoadingState.maxWaitTimer) {
    clearTimeout(frameLoadingState.maxWaitTimer)
    frameLoadingState.maxWaitTimer = null
  }
  const labelNode = overlay.querySelector('.frame-loading__label')
  if (labelNode) labelNode.textContent = frameLoadingMessages[intent] || frameLoadingMessages.loading
  overlay.setAttribute('aria-hidden', 'false')
  overlay.classList.add('frame-loading--active')
  frameLoadingState.visibleAt = performance.now()
  frameLoadingState.maxWaitTimer = setTimeout(() => hideFrameLoading({ immediate: true }), 1600)
}

function hideFrameLoading(options = {}) {
  const overlay = ensureFrameLoadingOverlay()
  if (!overlay) return
  const { immediate = false } = options
  if (frameLoadingState.hideTimer) {
    clearTimeout(frameLoadingState.hideTimer)
    frameLoadingState.hideTimer = null
  }
  if (frameLoadingState.maxWaitTimer) {
    clearTimeout(frameLoadingState.maxWaitTimer)
    frameLoadingState.maxWaitTimer = null
  }
  const minVisible = immediate ? 0 : 160
  const elapsed = performance.now() - (frameLoadingState.visibleAt || 0)
  const wait = Math.max(0, minVisible - elapsed)
  const commit = () => {
    overlay.classList.remove('frame-loading--active')
    overlay.setAttribute('aria-hidden', 'true')
  }
  if (wait > 0) {
    frameLoadingState.hideTimer = setTimeout(commit, wait)
  } else {
    commit()
  }
}

function loadFrame(src, { intent = 'loading', force = false, frame: targetFrame = null } = {}) {
  const iframe = targetFrame || getActiveFrame()
  if (!iframe) return false
  const normalized = String(src || '')
  const prev = iframe.dataset.currentSrc || ''
  if (!force && prev === normalized) return false
  if (iframe.dataset.frameVisible === '1') showFrameLoading(intent)
  iframe.dataset.currentSrc = normalized
  try {
    iframe.src = normalized
  } catch {
    iframe.setAttribute('src', normalized)
  }
  return true
}

async function saveTabs() {
  const openTabs = tabsState.tabs
    .map((tab) => serializeTabForPersistence(tab))
    .filter((tab) => tab && typeof tab.id === 'string')
  const activeTabId = deriveActiveTabId(openTabs, tabsState.active)

  try {
    writeStoredTabState({ tabs: openTabs, activeId: activeTabId })
  } catch {}

  if (!tabPersistence.remoteAllowed || tabPersistence.mode === 'local-only') return

  try {
    const payload = { openTabs, activeTabId }
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res && res.status >= 400) {
      if (res.status === 401 || res.status === 403) {
        tabPersistence.remoteAllowed = false
        tabPersistence.mode = 'local-only'
      }
    }
  } catch {}
}

function collectDocContexts() {
  const contexts = []
  const seen = new Set()
  const gather = (iframe) => {
    if (!iframe || seen.has(iframe)) return
    seen.add(iframe)
    let win
    try {
      win = iframe.contentWindow || null
    } catch {
      win = null
    }
    if (!win) return
    let doc = null
    try {
      doc = win.document || null
    } catch {}
    contexts.push({ frame: iframe, win, doc })
    const innerFrames = collectSameOriginFrames(win)
    if (innerFrames.length) innerFrames.forEach((inner) => gather(inner))
  }
  try {
    const frames = getVisibleFrames()
    frames.forEach((frame) => gather(frame))
  } catch {}
  return contexts
}

function findFrameForWindow(win) {
  if (!win) return null
  const ctx = collectDocContexts().find((entry) => entry.win === win)
  return ctx ? ctx.frame : null
}

function markHighlightPluginReady(win) {
  if (!win) return
  const contexts = collectDocContexts()
  const ctx = contexts.find((entry) => entry.win === win)
  if (!ctx || !ctx.frame) return
  const frame = ctx.frame
  const state = getHighlightBootstrapState(frame, frame.contentWindow)
  if (!state) return
  state.ready = true
  state.attempts = 0
  state.warned = false
  state.polls = 0
  logHighlightShell('ready', { matched: true })
  if (state.retryHandle) {
    clearTimeout(state.retryHandle)
    state.retryHandle = null
  }
  try {
    const api = frame.contentWindow?.__AMI_HIGHLIGHT_PLUGIN__
    if (api && typeof api.refresh === 'function') {
      api.refresh({ rebuild: true })
    }
  } catch {}
  ensureHighlightPluginInWindowFrames(win)
}

const docMessenger = createDocMessenger({
  getTargets: () => collectDocContexts().map((ctx) => ctx.win)
    .filter((win, index, arr) => win && arr.indexOf(win) === index),
  onTimeout: ({ message }) => {
    if (message && message.type) {
      console.warn('Doc message timed out', message.type)
    } else {
      console.warn('Doc message timed out')
    }
  },
})

function postToDoc(msg, options = {}) {
  const promise = docMessenger.send(msg, options)
  if (options.waitForAck) return promise
  promise.catch((err) => {
    if (!options.silent) {
      console.warn('Doc message failed', msg?.type || 'unknown', err)
    }
  })
  return promise
}

let docIsReady = false
const pendingDocMessages = []

function resetDocMessagingState() {
  docIsReady = false
  pendingDocMessages.length = 0
}

function flushPendingDocMessages() {
  while (pendingDocMessages.length) {
    const entry = pendingDocMessages.shift()
    try {
      postToDoc(entry.msg, entry.options)
    } catch (err) {
      console.warn('Failed to deliver pending doc message', err)
    }
  }
}

function queueDocMessage(msg, options = {}) {
  if (docIsReady) {
    postToDoc(msg, options)
  } else {
    pendingDocMessages.push({ msg, options })
  }
}

try {
  window.addEventListener('unload', () => {
    try {
      docMessenger.dispose()
    } catch {}
  })
} catch {}

function relativeNormalized(baseNormalized, targetNormalized) {
  const base = baseNormalized.replace(/\/+$/g, '')
  const target = targetNormalized
  if (!base) return ''
  if (target === base) return ''
  const prefix = base + '/'
  if (target.startsWith(prefix)) return target.slice(prefix.length)
  return ''
}

function uploadsBaseFromPath(originalPath) {
  const normalized = normalizeFsPath(originalPath)
  const marker = '/files/uploads'
  const idx = normalized.indexOf(marker)
  if (idx === -1) return { baseOriginal: '', baseNormalized: '' }
  const baseEnd = idx + marker.length
  const baseOriginal = originalPath.slice(0, baseEnd)
  const baseNormalized = normalized.slice(0, baseEnd)
  return { baseOriginal, baseNormalized }
}

function buildDocMessageForDir(tab, cfg) {
  if (!tab) return null
  const originalPath = tab.path || ''
  const normalizedPath = normalizeFsPath(originalPath)
  if (!normalizedPath) return null

  const { baseOriginal: uploadsOriginal, baseNormalized: uploadsNormalized } =
    uploadsBaseFromPath(originalPath)
  if (uploadsOriginal && uploadsNormalized) {
    const focus = relativeNormalized(uploadsNormalized, normalizedPath)
    const msg = { type: 'setDocRoot', rootKey: 'uploads', path: uploadsOriginal, label: 'Uploads' }
    if (focus) msg.focus = focus
    return msg
  }

  const docRootOriginal = cfg?.docRootAbsolute || cfg?.docRoot || ''
  const docRootNormalized = normalizeFsPath(docRootOriginal).replace(/\/+$/, '')
  if (
    docRootNormalized &&
    (normalizedPath === docRootNormalized || normalizedPath.startsWith(docRootNormalized + '/'))
  ) {
    const focus = relativeNormalized(docRootNormalized, normalizedPath)
    const msg = { type: 'setDocRoot', rootKey: 'docRoot', path: docRootOriginal }
    if (focus) msg.focus = focus
    if (cfg && typeof cfg.docRootLabel === 'string' && cfg.docRootLabel.trim()) {
      msg.label = cfg.docRootLabel.trim()
    }
    return msg
  }

  const defaultLabel =
    tab.label || humanizeName(normalizedPath.split('/').pop() || normalizedPath, 'dir')
  const msg = { type: 'setDocRoot', rootKey: 'docRoot', path: originalPath }
  if (defaultLabel) msg.label = defaultLabel
  return msg
}

function iconForTab(kind) {
  if (kind === 'dir') return iconMarkup('folder-3-line')
  if (kind === 'app') return iconMarkup('window-2-line')
  return iconMarkup('file-3-line')
}

function getShellTabStrip() {
  if (shellTabStrip) return shellTabStrip
  const bar = document.getElementById('tabsBar')
  if (!bar) return null
  shellTabStrip = createTabStrip(bar, {
    showAddButton: true,
    addButtonLabel: '+',
    addButtonTitle: 'Open content directory',
    onAdd: () => {
      try {
        openContentDirectory()
      } catch (err) {
        console.error('Failed to open content directory from tab strip', err)
      }
    },
    onSelect: (id) => {
      if (!id || tabsState.active === id) return
      activateTab(id)
    },
    onClose: (id) => {
      closeTab(id)
    },
    onContextMenu: (event, id) => {
      const tab = tabsState.tabs.find((t) => t.id === id)
      if (!tab) return
      try {
        event.preventDefault()
      } catch {}
      openTabContextMenu(event.clientX, event.clientY, tab)
    },
    onReorder: (order) => {
      applyTabOrder(Array.isArray(order) ? order : [])
    },
    onRename: (id, label) => {
      const tab = tabsState.tabs.find((t) => t.id === id)
      if (!tab) return
      tab.label = label
      renderTabs()
      saveTabs().catch(() => {})
    },
    allowRename: true,
  })
  return shellTabStrip
}

function applyTabOrder(order) {
  if (!Array.isArray(order) || order.length === 0) return
  const currentIds = tabsState.tabs.map((t) => t.id)
  const currentKey = currentIds.join('|')
  const normalized = order.filter(Boolean)
  if (!normalized.length) return
  const map = new Map()
  tabsState.tabs.forEach((tab) => map.set(tab.id, tab))
  const reordered = []
  normalized.forEach((id) => {
    const tab = map.get(id)
    if (!tab) return
    reordered.push(tab)
    map.delete(id)
  })
  map.forEach((tab) => reordered.push(tab))
  const nextKey = reordered.map((t) => t.id).join('|')
  if (currentKey === nextKey) return
  tabsState.tabs = reordered
  if (!tabsState.tabs.some((tab) => tab.id === tabsState.active)) {
    tabsState.active = tabsState.tabs[0]?.id || null
  }
  try {
    saveTabs()
  } catch {}
  renderTabs()
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTabs() {
  const strip = getShellTabStrip()
  if (!strip) return
  const tabDescriptors = tabsState.tabs.map((t) => {
    const isRunningApp = t.kind === 'app' && !!appRunning.get(t.path)
    const showPill = !!t.servedId || isRunningApp
    const baseName = t.path.split('/').pop() || t.path
    const tabLabel = t.label || (t.kind === 'file' ? humanizeName(baseName, 'file') : baseName)
    const pillTitle =
      t.kind === 'app' ? (isRunningApp ? 'App running' : '') : t.servedId ? 'Served' : ''
    const indicatorHint = escapeHTML(pillTitle)
    const indicatorAttrs = indicatorHint
      ? ` data-hint="${indicatorHint}" aria-label="${indicatorHint}"`
      : ''
    const indicatorHTML = showPill
      ? `<span class="status-indicator serve-dot status-indicator--positive"${indicatorAttrs}></span>`
      : ''
    const classes = ['tab--' + (t.kind || 'unknown')]
    if (showPill) classes.push('served')
    const metaContext = getMetadataContextForPath(t.path)
    const metaPath = metaContext.metaPath
    const tooltipValue = metaPath || t.path || ''
    const dataset = { tabKind: t.kind || '' }
    if (metaPath) {
      dataset.metaPath = metaPath
      dataset.hintTone = 'info'
    }
    return {
      id: t.id,
      label: tabLabel,
      leadingHTML: `<span class="icon" aria-hidden="true">${iconForTab(t.kind)}</span>${indicatorHTML}`,
      trailingHTML: '',
      tooltip: tooltipValue,
      classes,
      closable: true,
      dataset,
    }
  })
  strip.setState({ tabs: tabDescriptors, activeId: tabsState.active })
  updateWelcomeVisibility()
}

function openTabContextMenu(x, y, tab) {
  closeContextMenus()
  const menu = document.createElement('div')
  menu.dataset.ctx = '1'
  Object.assign(menu.style, {
    position: 'fixed',
    left: x + 'px',
    top: y + 'px',
    zIndex: 1000,
    background: 'var(--panel)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    minWidth: '11.25rem',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  })
  function addItem(label, handler, disabled = false) {
    const it = document.createElement('div')
    it.textContent = label
    Object.assign(it.style, {
      padding: '0.5rem 0.625rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? '0.5' : '1',
    })
    if (!disabled)
      it.addEventListener('click', async () => {
        try {
          await handler()
        } finally {
          closeContextMenus()
        }
      })
    menu.appendChild(it)
  }
  const canStart = !!tab.entryId
  const canStop = !!tab.servedId
  addItem('Open', () => activateTab(tab.id))
  addItem('Start Serving', () => startServingTab(tab, 'tab-menu'), !canStart)
  addItem('Stop Serving', () => stopServingTab(tab, 'tab-menu'), !canStop)
  addItem('Metadata Settings…', () => openMetadataSettingsForTab(tab), !tab.path)
  addItem('Close Tab', () => closeTab(tab.id))
  document.body.appendChild(menu)
  setTimeout(() => {
    document.addEventListener('click', closeContextMenus, { once: true })
  }, 0)
}

async function openMetadataSettingsForTab(tab) {
  if (!tab || !tab.path) return
  const context = getMetadataContextForPath(tab.path)
  const label = tab.label || tab.path.split(/[\\/]/).pop() || tab.path

  // Fetch actual metadata path from automation API
  let actualMetaPath = context.metaPath
  if (context.rootKey && context.relativePath) {
    try {
      const params = new URLSearchParams({
        path: context.relativePath,
        root: context.rootKey
      })
      const response = await fetch(`/api/automation?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.metaPath) {
          actualMetaPath = data.metaPath
        }
      }
    } catch (err) {
      console.error('Failed to fetch automation metadata:', err)
    }
  }

  openMetadataSettingsDialog({
    label,
    path: tab.path,
    metaPath: actualMetaPath,
    rootKey: context.rootKey,
    rootLabel: context.rootLabel,
    relativePath: context.relativePath,
  })
}

function closeContextMenus() {
  document.querySelectorAll('div[data-ctx="1"]').forEach((n) => n.remove())
}

function closeTab(id) {
  const idx = tabsState.tabs.findIndex((x) => x.id === id)
  if (idx === -1) return
  const wasActive = tabsState.active === id
  tabsState.tabs.splice(idx, 1)
  removeFrameForTab(id)
  if (wasActive) tabsState.active = tabsState.tabs[0]?.id || null
  renderTabs()
  if (tabsState.active) activateTab(tabsState.active)
  else updateWelcomeVisibility()
  saveTabs()
}

async function activateTab(id) {
  const tab = tabsState.tabs.find((x) => x.id === id)
  if (!tab) return
  tabsState.active = id
  renderTabs()
  const frame = setActiveTabFrame(tab.id)
  updateWelcomeVisibility()
  const cfg = await loadConfig()
  const baseIntent =
    tab.kind === 'dir' ? 'doc' : tab.kind === 'file' ? 'file' : tab.kind === 'app' ? 'app' : 'loading'
  showFrameLoading(tab.servedId ? 'served' : baseIntent)
  let triggeredLoad = false
  const requestFrame = (src, intent, options = {}) => {
    const target = options.frame || frame || getActiveFrame()
    if (!target) return false
    const changed = loadFrame(src, { intent, frame: target, ...options })
    if (changed) triggeredLoad = true
    return changed
  }
  let usedServed = false
  if (tab.servedId) {
    try {
      const r = await fetch(`/api/serve/${tab.servedId}`)
      if (r.ok) {
        const inst = await r.json()
        if (inst?.status === 'running') {
          if (frame) teardownHighlightPlugin(frame)
          requestFrame(`/api/served/${tab.servedId}/`, 'served', { force: true, frame })
          usedServed = true
        }
      }
    } catch {}
  }
  try {
    document.body.classList.remove('mode-dir', 'mode-file', 'mode-app')
    if (tab.kind === 'dir') document.body.classList.add('mode-dir')
    else if (tab.kind === 'file') document.body.classList.add('mode-file')
    else if (tab.kind === 'app') document.body.classList.add('mode-app')
  } catch {}
  if (!usedServed) {
    if (tab.servedId) {
      tab.servedId = null
      renderTabs()
    }
    if (tab.kind === 'dir') {
      resetDocMessagingState()
      const docMessage = buildDocMessageForDir(tab, cfg)
      lastDocMessage = docMessage
      if (docMessage) queueDocMessage(docMessage)
      if (frame) teardownHighlightPlugin(frame)
      requestFrame('/doc.html?embed=1', 'doc', { force: true, frame })
      if (frame) {
        frame.addEventListener(
          'load',
          () => {
            logHighlightShell('iframe-load-event')
            if (frame.dataset.frameVisible === '1') {
              ensureHighlightPluginInFrame(frame)
              const curTheme = document.documentElement.getAttribute('data-theme') || 'dark'
              queueDocMessage({ type: 'applyTheme', theme: curTheme })
            }
          },
          { once: true },
        )
      }
      setTimeout(() => {
        const current = getActiveFrame()
        if (!current || current.dataset.tabId !== tab.id) return
        logHighlightShell('iframe-load-timeout-retry')
        ensureHighlightPluginInFrame(current)
        const curTheme = document.documentElement.getAttribute('data-theme') || 'dark'
        queueDocMessage({ type: 'applyTheme', theme: curTheme })
      }, 60)
    } else if (tab.kind === 'file') {
      if (frame) teardownHighlightPlugin(frame)
      const mode = tab.mode || 'A'
      let rel = tab.path || ''
      let root = 'docRoot'
      const normalizedPath = normalizeFsPath(rel)
      const uploadsMarker = '/files/uploads/'
      const uploadsIdx = normalizedPath.indexOf(uploadsMarker)
      if (uploadsIdx !== -1) {
        rel = normalizedPath.slice(uploadsIdx + uploadsMarker.length)
        root = 'uploads'
      } else if (cfg) {
        const docRootNormalized = normalizeFsPath(cfg.docRootAbsolute || cfg.docRoot || '').replace(
          /\/+$/,
          '',
        )
        if (docRootNormalized) {
          if (normalizedPath === docRootNormalized) {
            rel = ''
          } else if (normalizedPath.startsWith(docRootNormalized + '/')) {
            rel = normalizedPath.slice(docRootNormalized.length + 1)
          } else {
            rel = normalizedPath
          }
        }
      }
      const qp = new URLSearchParams({ path: rel, mode, root })
      requestFrame(`/api/media?${qp.toString()}`, 'file', { force: true, frame })
    } else if (tab.kind === 'app') {
      if (frame) teardownHighlightPlugin(frame)
      requestFrame('about:blank', 'app', { force: true, frame })
    }
  }
  if (tab.kind === 'dir') {
    const themeNow = document.documentElement.getAttribute('data-theme') || 'dark'
    const active = getActiveFrame()
    if (active && active.dataset.tabId === tab.id) ensureHighlightPluginInFrame(active)
    setTimeout(() => {
      const current = getActiveFrame()
      if (current && current.dataset.tabId === tab.id) queueDocMessage({ type: 'applyTheme', theme: themeNow })
    }, 80)
  }
  try {
    const vizId = usedServed
      ? tab.kind === 'dir'
        ? 'C'
        : tab.kind === 'app'
          ? 'D'
          : tab.mode || ''
      : tab.kind === 'dir'
        ? 'C'
        : tab.kind === 'app'
          ? 'D'
          : tab.mode || ''
    setLabels(vizId, { path: tab.path })
  } catch {}
  updateStatusPillForTab(tab)
  saveTabs()
  if (!triggeredLoad) hideFrameLoading({ immediate: true })
}

function describeServingTarget(tab) {
  if (!tab) return 'selection'
  if (typeof tab.label === 'string' && tab.label.trim()) return tab.label.trim()
  if (typeof tab.path === 'string' && tab.path.trim()) {
    const parts = tab.path.split(/[\\/]/).filter(Boolean)
    const leaf = parts[parts.length - 1] || tab.path
    return humanizeName(leaf)
  }
  return 'selection'
}

async function mutateServingState(tab, intent = 'start', origin = 'shell') {
  if (!tab) return false
  const label = describeServingTarget(tab)
  const activeId = tabsState.active

  if (intent === 'start') {
    if (!tab.entryId) {
      showToast('Add to Library first to serve.', { tone: 'warning' })
      return false
    }
    try {
      const r = await fetch('/api/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: tab.entryId }),
      })
      if (!r.ok) {
        const msg = await r.text().catch(() => '')
        showToast(`Failed to start serving "${label}". ${msg || ''}`.trim(), {
          tone: 'danger',
        })
        return false
      }
      const j = await r.json().catch(() => null)
      if (!j || !j.id) {
        showToast(`Failed to start serving "${label}".`, { tone: 'danger' })
        return false
      }
      tab.servedId = j.id
      renderTabs()
      if (activeId === tab.id) activateTab(tab.id)
      saveTabs()
      showToast(`Serving started for "${label}".`, { tone: 'success' })
      return true
    } catch (err) {
      showToast(`Failed to start serving "${label}".`, { tone: 'danger' })
      console.error('serve:start failed', { origin, tab, err })
      return false
    }
  }

  if (!tab.servedId) return false
  const servedId = tab.servedId
  try {
    const r = await fetch(`/api/serve/${servedId}`, { method: 'DELETE' })
    if (!r.ok) {
      const msg = await r.text().catch(() => '')
      showToast(`Failed to stop serving "${label}". ${msg || ''}`.trim(), {
        tone: 'danger',
      })
      return false
    }
    tab.servedId = null
    renderTabs()
    if (activeId === tab.id) activateTab(tab.id)
    saveTabs()
    showToast(`Serving stopped for "${label}".`, { tone: 'info' })
    return true
  } catch (err) {
    showToast(`Failed to stop serving "${label}".`, { tone: 'danger' })
    console.error('serve:stop failed', { origin, tab, err })
    return false
  }
}

async function startServingTab(tab, origin = 'shell') {
  return mutateServingState(tab, 'start', origin)
}

async function stopServingTab(tab, origin = 'shell') {
  return mutateServingState(tab, 'stop', origin)
}

async function ensureModeForFile(p) {
  try {
    const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(p)}`)
    if (r.ok) {
      const j = await r.json()
      return j.hasJs ? 'B' : 'A'
    }
  } catch {}
  return 'A'
}

async function openEntry(entry) {
  // Check if already served
  let servedId = null
  try {
    const r = await fetch('/api/serve')
    if (r.ok) {
      const data = await r.json()
      const inst = (data.instances || []).find(
        (i) => i.entryId === entry.id && i.status === 'running',
      )
      if (inst) servedId = inst.id
    }
  } catch {}
  const tabId = `${entry.id}-${Date.now()}`
  const tab = {
    id: tabId,
    entryId: entry.id,
    kind: entry.kind,
    path: entry.path,
    label: entry.label || null,
    servedId,
    mode: null,
  }
  if (entry.kind === 'file') tab.mode = await ensureModeForFile(entry.path)
  tabsState.tabs.push(tab)
  activateTab(tabId)
  saveTabs()
  // Append to recents
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recentsAdd: {
          type: entry.kind,
          path: entry.path,
          mode: tab.mode || (entry.kind === 'dir' ? 'C' : entry.kind === 'app' ? 'D' : undefined),
        },
      }),
    })
  } catch {}
}

async function handleEntrySelection(entry) {
  if (entry && entry.id) {
    await openEntry(entry)
    return
  }
  if (entry && entry.path) {
    let createdId = entry.id && entry.id.length ? entry.id : null
    try {
      const payload = { path: entry.path }
      if (entry.kind) payload.kind = entry.kind
      if (entry.label) payload.label = entry.label
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const posted = await res.json().catch(() => null)
        if (posted?.id) createdId = posted.id
      }
    } catch {}
    try {
      const r = await fetch('/api/library')
      if (r.ok) {
        const j = await r.json()
        const targetPath = normalizeFsPath(entry.path)
        const found = (j.entries || []).find((e) => {
          if (createdId && e.id === createdId) return true
          return normalizeFsPath(e.path) === targetPath
        })
        if (found) await openEntry(found)
      }
    } catch {}
  }
}

function openContentDirectory() {
  openSelectMediaModal({ onSelect: (entry) => handleEntrySelection(entry) })
}

async function boot() {
  // Theme init
  try {
    const saved = localStorage.getItem('theme')
    const theme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    setThemeIcon(theme)
  } catch {}

  // Initialize highlight plugin in parent window
  ensureHighlightPluginInParent()

  const cfg = await loadConfig()
  let pathInfo = null
  if (cfg?.selected && cfg.selected.path) {
    pathInfo = { ...cfg.selected }
    try {
      const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(cfg.selected.path)}`)
      if (r.ok) pathInfo.meta = await r.json()
    } catch {}
  } else {
    pathInfo = { type: 'dir', path: cfg?.docRoot || '' }
  }
  let viz = null
  if (pathInfo?.mode)
    viz =
      [VisualizerA, VisualizerB, VisualizerC, VisualizerD].find((v) => v.id === pathInfo.mode) ||
      null
  if (!viz) viz = detectVisualizer(pathInfo) || VisualizerC
  // Defer iframe initialization to tabs restoration/seed logic below

  // Search wiring to embedded doc viewer
  const search = document.getElementById('globalSearch')
  if (search) {
    search.addEventListener('input', () => {
      queueDocMessage({ type: 'search', q: search.value })
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== search) {
        e.preventDefault()
        search.focus()
      }
    })
  }

  // Header buttons: expand/collapse/theme
  function applyThemeIntoIframe(theme) {
    try {
      collectDocContexts().forEach(({ doc }) => {
        if (doc && doc.documentElement) doc.documentElement.setAttribute('data-theme', theme)
      })
    } catch {}
    // Also message the iframe (with retries)
    queueDocMessage({ type: 'applyTheme', theme })
  }
  // Ensure we re-send theme and docRoot as soon as the embedded doc signals readiness
  window.addEventListener('message', (ev) => {
    try {
      const msg = ev && ev.data
      if (!msg || typeof msg !== 'object') return
      const sourceWin = ev?.source || null
      const ownerFrame = sourceWin ? findFrameForWindow(sourceWin) : null
      const activeFrame = getActiveFrame()
      const shellFrame = ownerFrame ? getShellFrameFor(ownerFrame) : getShellFrameFor(activeFrame)
      let sourceVisible = true
      if (shellFrame) {
        sourceVisible = shellFrame.dataset?.frameVisible === '1' || shellFrame === activeFrame
      }
      if (!ownerFrame && sourceWin && activeFrame && activeFrame.contentWindow === sourceWin) {
        sourceVisible = true
      }
      if (msg.type === 'highlightPluginReady' || msg.type === 'highlightSettingsState') {
        markHighlightPluginReady(ev?.source || null)
        return
      }
      if (msg.type === 'docReady') {
        if (!sourceVisible) return
        docIsReady = true
        if (sourceWin && ownerFrame) {
          ensureHighlightPluginInFrame(ownerFrame)
          ensureHighlightPluginInWindowFrames(sourceWin)
        } else {
          ensureHighlightPluginForActiveDoc()
        }
        if (!pendingDocMessages.length) {
          const active = tabsState.tabs.find((t) => t.id === tabsState.active)
          if (active && active.kind === 'dir') {
            ;(async () => {
              const cfgNow = await loadConfig()
              const docMessage = buildDocMessageForDir(active, cfgNow)
              lastDocMessage = docMessage
              if (docMessage) queueDocMessage(docMessage)
              queueDocMessage({
                type: 'applyTheme',
                theme: document.documentElement.getAttribute('data-theme') || 'dark',
              })
            })()
          } else if (lastDocMessage) {
            queueDocMessage(lastDocMessage)
          }
        }
        flushPendingDocMessages()
        return
      }
      if (msg.type === 'docConfig') {
        if (!sourceVisible) return
        if (!cachedConfig) cachedConfig = {}
        if (typeof msg.docRoot === 'string') cachedConfig.docRoot = msg.docRoot
        if (typeof msg.docRootLabel === 'string' || msg.docRootLabel === null)
          cachedConfig.docRootLabel = msg.docRootLabel
        if (typeof msg.docRootAbsolute === 'string')
          cachedConfig.docRootAbsolute = msg.docRootAbsolute
        return
      }
    } catch {}
  })
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    try {
      const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
      const next = cur === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
      // swap icon
      setThemeIcon(next)
      applyThemeIntoIframe(next)
    } catch {}
  })

  // Glow effect is always on; no UI toggle.

  const [cfgTabs, persistenceMode] = await Promise.all([loadConfig(), ensureTabPersistenceMode()])

  const remoteAllowed = persistenceMode === 'remote-enabled' && !!cfgTabs
  tabPersistence.remoteAllowed = remoteAllowed

  const localState = readStoredTabState()
  const remoteTabs = remoteAllowed && Array.isArray(cfgTabs?.openTabs) ? normalizePersistedTabList(cfgTabs.openTabs) : []
  const remoteActive = remoteAllowed ? deriveActiveTabId(remoteTabs, typeof cfgTabs?.activeTabId === 'string' ? cfgTabs.activeTabId : null) : null

  let initialTabs = Array.isArray(localState.tabs) ? localState.tabs : []
  let initialActive = localState.activeId || null

  if (!initialTabs.length && remoteTabs.length) {
    initialTabs = remoteTabs
    initialActive = remoteActive
  }

  tabsState.tabs = Array.isArray(initialTabs) ? initialTabs : []
  tabsState.active = deriveActiveTabId(tabsState.tabs, initialActive)

  try {
    writeStoredTabState({ tabs: tabsState.tabs, activeId: tabsState.active })
  } catch {}

  renderTabs()
  if (tabsState.active) activateTab(tabsState.active)
  else updateWelcomeVisibility()

  // Background refresh of served instances and app statuses
  setInterval(refreshServed, 5000)
  setInterval(refreshAppStatuses, 8000)
}

document.addEventListener('DOMContentLoaded', () => {
  initShellConsole()
  boot().catch((err) => console.error('boot failed', err))
  const btn = document.getElementById('selectMediaBtn')
  if (btn)
    btn.addEventListener('click', () => {
      openContentDirectory()
    })
  const welcomeBtn = document.getElementById('welcomeOpenBtn')
  if (welcomeBtn)
    welcomeBtn.addEventListener('click', () => {
      openContentDirectory()
    })
  const accountBtn = document.getElementById('accountDrawerBtn')
  if (accountBtn) {
    if (!accountBtn.hasAttribute('aria-expanded')) accountBtn.setAttribute('aria-expanded', 'false')
    accountBtn.addEventListener('click', (event) => {
      event.preventDefault()
      openAccountDrawer({ trigger: accountBtn }).catch((err) => {
        console.error('Failed to open account drawer', err)
      })
    })
  }
})

async function refreshServed() {
  try {
    const r = await fetch('/api/serve')
    if (!r.ok) return
    const data = await r.json()
    const list = Array.isArray(data.instances) ? data.instances : []
    servedMap.instances = list
    let changed = false
    for (const t of tabsState.tabs) {
      if (!t.entryId) continue
      const inst = list.find((i) => i.entryId === t.entryId)
      const runningId = inst && inst.status === 'running' ? inst.id : null
      if ((t.servedId || null) !== (runningId || null)) {
        t.servedId = runningId
        changed = true
      }
    }
    if (changed) {
      renderTabs()
      if (tabsState.active)
        updateStatusPillForTab(tabsState.tabs.find((x) => x.id === tabsState.active))
    }
  } catch {}
}

async function refreshAppStatuses() {
  const appTabs = tabsState.tabs.filter((t) => t.kind === 'app')
  for (const t of appTabs) {
    try {
      const r = await fetch(`/api/app/status?path=${encodeURIComponent(t.path)}`)
      if (!r.ok) continue
      const s = await r.json()
      const prev = appRunning.get(t.path)
      const cur = !!s.running
      if (prev !== cur) {
        appRunning.set(t.path, cur)
        renderTabs()
        if (tabsState.active === t.id) updateStatusPillForTab(t)
      }
    } catch {}
  }
}
