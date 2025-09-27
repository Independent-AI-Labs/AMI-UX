import './auth-fetch.js'

import {
  registerVisualizer,
  detectVisualizer,
  VisualizerA,
  VisualizerB,
  VisualizerD,
} from './visualizers.js'
import { openSelectMediaModal } from './modal.js'
import { humanizeName, normalizeFsPath } from './utils.js'
import { createDocMessenger } from './message-channel.js?v=20250310'
import { openAccountDrawer } from './account-drawer.js?v=20250316'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'

window.addEventListener('ami:unauthorized', () => {
  window.dispatchEvent(new Event('ami:navigate-signin'))
})

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
    const iframe = document.getElementById('vizFrame')
    if (iframe) iframe.src = '/doc.html?embed=1'
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

  if (!Array.isArray(cfg.overlayFollow) || cfg.overlayFollow.length === 0) {
    cfg.overlayFollow = ['block', 'inline', 'heading']
  }
  cfg.createFallbackToggle = true
  cfg.renderImmediately = true
  cfg.scopeSelector = typeof cfg.scopeSelector === 'string' && cfg.scopeSelector.trim()
    ? cfg.scopeSelector
    : 'body'
  if (cfg.autoStart === undefined) cfg.autoStart = true
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

function ensureHighlightPluginInFrame(frame) {
  try {
    if (!frame) return false
    const win = frame.contentWindow
    const doc = win?.document
    if (!win || !doc) return false
    const state = getHighlightBootstrapState(frame, win)
    if (!state) return false
    logHighlightShell('ensure', {
      attempts: state.attempts,
      polls: state.polls,
      ready: state.ready,
    })
    if (isAboutBlankWindow(win)) {
      logHighlightShell('ensure-about-blank')
      scheduleHighlightRetry(frame, HIGHLIGHT_RETRY_BASE * Math.max(state.attempts || 1, 1))
      return false
    }
    ensureHighlightPluginConfig(win)
    ensureHighlightPluginInWindowFrames(win)
    if (doc.readyState === 'loading' || !doc.body) {
      logHighlightShell('ensure-wait-dom', { readyState: doc.readyState })
      doc.addEventListener(
        'DOMContentLoaded',
        () => {
          ensureHighlightPluginInFrame(frame)
        },
        { once: true },
      )
      scheduleHighlightRetry(frame, HIGHLIGHT_RETRY_BASE * Math.max(state.attempts || 1, 1))
      return false
    }
    const existingApi = (() => {
      try {
        return win.__AMI_HIGHLIGHT_PLUGIN__
      } catch {
        return null
      }
    })()
    if (existingApi && existingApi.manager && existingApi.manager.document && existingApi.manager.document !== doc) {
      try {
        existingApi.destroy?.()
      } catch (err) {
        console.warn('Highlight plugin teardown before rebootstrap failed', err)
      }
      resetHighlightState(frame, state)
    }
    const pluginApi = (() => {
      try {
        return win.__AMI_HIGHLIGHT_PLUGIN__
      } catch {
        return null
      }
    })()
    if (pluginApi && typeof pluginApi.refresh === 'function') {
      state.ready = true
      state.attempts = 0
      state.polls = 0
      if (state.retryHandle) {
        clearTimeout(state.retryHandle)
        state.retryHandle = null
      }
      logHighlightShell('ensure-refresh-existing')
      try {
        pluginApi.refresh({ rebuild: true })
      } catch (err) {
        console.warn('Highlight plugin refresh failed', err)
        logHighlightShell('ensure-refresh-error', { error: err?.message || String(err) })
      }
      return true
    }
    if (state.attempts >= HIGHLIGHT_MAX_ATTEMPTS) {
      if (!state.warned) {
        state.warned = true
        console.warn('Highlight plugin bootstrap exceeded retry limit')
        logHighlightShell('retry-limit-exceeded')
      }
      state.polls = 0
      return false
    }
    const existingScript = doc.getElementById(HIGHLIGHT_BOOTSTRAP_ID)
    if (existingScript) {
      state.polls = (state.polls || 0) + 1
      if (state.polls >= HIGHLIGHT_MAX_ATTEMPTS) {
        try {
          existingScript.remove()
        } catch {}
        state.polls = 0
        logHighlightShell('stale-script-removed')
      } else {
        scheduleHighlightRetry(frame, HIGHLIGHT_RETRY_BASE * (state.attempts + 1))
        return true
      }
    }
    state.attempts += 1
    state.polls = 0
    const script = doc.createElement('script')
    script.type = 'module'
    script.id = HIGHLIGHT_BOOTSTRAP_ID
    script.src = HIGHLIGHT_PLUGIN_SRC
    script.crossOrigin = 'anonymous'
    script.addEventListener('load', () => {
      logHighlightShell('script-load')
      scheduleHighlightRetry(frame, HIGHLIGHT_RETRY_BASE)
    })
    script.addEventListener('error', (event) => {
      console.warn('Highlight plugin script failed to load', event?.error || event)
      logHighlightShell('script-error', { error: event?.error || event })
      try {
        script.remove()
      } catch {}
      scheduleHighlightRetry(frame, HIGHLIGHT_RETRY_BASE * (state.attempts + 1))
    })
    const target = doc.head || doc.documentElement || doc.body
    target.appendChild(script)
    logHighlightShell('script-appended')
    ensureHighlightPluginInWindowFrames(win)
    return true
  } catch (err) {
    console.warn('Failed to inject highlight plugin', err)
    logHighlightShell('ensure-error', { error: err?.message || String(err) })
    return false
  }
}

function ensureHighlightPluginForActiveDoc() {
  const frame = document.getElementById('vizFrame')
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
      pill.title = ''
      return
    }
    if (tab.kind === 'app') {
      if (tab.path) {
        const r = await fetch(`/api/app/status?path=${encodeURIComponent(tab.path)}`)
        if (r.ok) {
          const s = await r.json()
          pill.textContent = s.running ? 'App: Running' : 'App: Not running'
          pill.title = s.message || ''
          return
        }
      }
      pill.textContent = 'App: Unknown'
      pill.title = ''
      return
    }
    if (tab.kind === 'file') {
      const mode = tab.mode || 'A'
      pill.textContent = `Mode ${mode}`
      pill.title = tab.path || ''
      return
    }
    if (tab.kind === 'dir') {
      pill.textContent = ''
      pill.title = tab.path || ''
      return
    }
  } catch {
    // noop
  }
}

function updateWelcomeVisibility() {
  const frame = document.getElementById('vizFrame')
  const welcome = document.getElementById('welcomeScreen')
  const hasActive = !!(tabsState.active && tabsState.tabs.find((t) => t.id === tabsState.active))
  if (frame) {
    frame.classList.toggle('is-hidden', !hasActive)
    if (!hasActive) {
      try {
        teardownHighlightPlugin(frame)
        frame.src = 'about:blank'
      } catch {}
    }
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

async function saveTabs() {
  try {
    const payload = {
      openTabs: tabsState.tabs.map(({ id, entryId, kind, path, label, servedId, mode }) => ({
        id,
        entryId: entryId || null,
        kind,
        path,
        label: label || null,
        servedId: servedId || null,
        mode: mode || undefined,
      })),
      activeTabId: tabsState.active,
    }
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
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
    const frames = Array.from(document.querySelectorAll('iframe'))
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

  const fallbackLabel =
    tab.label || humanizeName(normalizedPath.split('/').pop() || normalizedPath, 'dir')
  const msg = { type: 'setDocRoot', rootKey: 'docRoot', path: originalPath }
  if (fallbackLabel) msg.label = fallbackLabel
  return msg
}

function iconForTab(kind) {
  if (kind === 'dir') return iconMarkup('folder-3-line')
  if (kind === 'app') return iconMarkup('window-2-line')
  return iconMarkup('file-3-line')
}

function renderTabs() {
  const bar = document.getElementById('tabsBar')
  if (!bar) return
  bar.innerHTML = ''
  tabsState.tabs.forEach((t) => {
    const el = document.createElement('button')
    const isRunningApp = t.kind === 'app' && !!appRunning.get(t.path)
    const showPill = !!t.servedId || isRunningApp
    const isServed = showPill
    el.className =
      'tab' + (tabsState.active === t.id ? ' active' : '') + (isServed ? ' served' : '')
    const pillTitle =
      t.kind === 'app' ? (isRunningApp ? 'App running' : '') : t.servedId ? 'Served' : ''
    const baseName = t.path.split('/').pop() || t.path
    const tabLabel = t.label || (t.kind === 'file' ? humanizeName(baseName, 'file') : baseName)
    const statusNode = showPill
      ? `<span class="status-indicator serve-dot status-indicator--positive" title="${pillTitle}"></span>`
      : ''
    const leadingIcon = `<span class="icon" aria-hidden="true">${iconForTab(t.kind)}</span>`
    el.innerHTML = `${leadingIcon}${statusNode}<span>${tabLabel}</span><span class="close" title="Close">×</span>`
    el.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('close')) {
        closeTab(t.id)
      } else {
        activateTab(t.id)
      }
    })
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      openTabContextMenu(e.clientX, e.clientY, t)
    })
    bar.appendChild(el)
  })
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
    minWidth: '180px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  })
  function addItem(label, handler, disabled = false) {
    const it = document.createElement('div')
    it.textContent = label
    Object.assign(it.style, {
      padding: '8px 10px',
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
  addItem('Start Serving', () => startServingTab(tab), !canStart)
  addItem('Stop Serving', () => stopServingTab(tab), !canStop)
  addItem('Close Tab', () => closeTab(tab.id))
  document.body.appendChild(menu)
  setTimeout(() => {
    document.addEventListener('click', closeContextMenus, { once: true })
  }, 0)
}

function closeContextMenus() {
  document.querySelectorAll('div[data-ctx="1"]').forEach((n) => n.remove())
}

function closeTab(id) {
  const idx = tabsState.tabs.findIndex((x) => x.id === id)
  if (idx === -1) return
  tabsState.tabs.splice(idx, 1)
  if (tabsState.active === id) tabsState.active = tabsState.tabs[0]?.id || null
  renderTabs()
  if (tabsState.active) activateTab(tabsState.active)
  saveTabs()
}

async function activateTab(id) {
  const tab = tabsState.tabs.find((x) => x.id === id)
  if (!tab) return
  tabsState.active = id
  renderTabs()
  // apply iframe source
  const cfg = await loadConfig()
  const iframe = document.getElementById('vizFrame')
  let usedServed = false
  if (tab.servedId) {
    try {
      const r = await fetch(`/api/serve/${tab.servedId}`)
      if (r.ok) {
        const inst = await r.json()
        if (inst?.status === 'running') {
          teardownHighlightPlugin(iframe)
          iframe.src = `/api/served/${tab.servedId}/`
          usedServed = true
        }
      }
    } catch {}
  }
  // Always set a mode class so background styling applies, even when served
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
      teardownHighlightPlugin(iframe)
      iframe.src = '/doc.html?embed=1'
      try {
        iframe.addEventListener(
          'load',
          () => {
            logHighlightShell('iframe-load-event')
            ensureHighlightPluginInFrame(iframe)
            const curTheme = document.documentElement.getAttribute('data-theme') || 'dark'
            queueDocMessage({ type: 'applyTheme', theme: curTheme })
          },
          { once: true },
        )
      } catch {}
      setTimeout(() => {
        logHighlightShell('iframe-load-timeout-retry')
        ensureHighlightPluginInFrame(iframe)
        const curTheme = document.documentElement.getAttribute('data-theme') || 'dark'
        queueDocMessage({ type: 'applyTheme', theme: curTheme })
      }, 60)
    } else if (tab.kind === 'file') {
      teardownHighlightPlugin(iframe)
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
      iframe.src = `/api/media?${qp.toString()}`
    } else if (tab.kind === 'app') {
      teardownHighlightPlugin(iframe)
      iframe.src = 'about:blank'
    }
  }
  if (tab.kind === 'dir') {
    const themeNow = document.documentElement.getAttribute('data-theme') || 'dark'
    ensureHighlightPluginInFrame(document.getElementById('vizFrame'))
    setTimeout(() => queueDocMessage({ type: 'applyTheme', theme: themeNow }), 80)
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
}

async function startServingTab(tab) {
  if (!tab.entryId) {
    alert('Add to Library first to serve.')
    return
  }
  try {
    const r = await fetch('/api/serve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: tab.entryId }),
    })
    if (!r.ok) {
      const msg = await r.text().catch(() => '')
      alert('Failed to start: ' + (msg || r.status))
      return
    }
    const j = await r.json().catch(() => null)
    if (j && j.id) {
      tab.servedId = j.id
      renderTabs()
      if (tabsState.active === tab.id) activateTab(tab.id)
      saveTabs()
    }
  } catch {}
}

async function stopServingTab(tab) {
  if (!tab.servedId) return
  try {
    await fetch(`/api/serve/${tab.servedId}`, { method: 'DELETE' })
    tab.servedId = null
    renderTabs()
    if (tabsState.active === tab.id) activateTab(tab.id)
    saveTabs()
  } catch {}
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
      if (msg.type === 'highlightPluginReady' || msg.type === 'highlightSettingsState') {
        markHighlightPluginReady(ev?.source || null)
        return
      }
      if (msg.type === 'docReady') {
        docIsReady = true
        const sourceWin = ev?.source || null
        if (sourceWin) {
          const ownerFrame = findFrameForWindow(sourceWin)
          if (ownerFrame) ensureHighlightPluginInFrame(ownerFrame)
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

  // Restore tabs if present, else seed from config/docRoot
  const cfgTabs = await loadConfig()
  if (cfgTabs?.openTabs && Array.isArray(cfgTabs.openTabs) && cfgTabs.openTabs.length) {
    tabsState.tabs = cfgTabs.openTabs.map((t) => ({
      id: t.id,
      entryId: t.entryId || null,
      kind: t.kind,
      path: t.path,
      label: t.label || null,
      servedId: t.servedId || null,
      mode: t.mode,
    }))
    tabsState.active = cfgTabs.activeTabId || tabsState.tabs[0]?.id || null
    renderTabs()
    if (tabsState.active) activateTab(tabsState.active)
  } else {
    tabsState.tabs = []
    tabsState.active = null
    renderTabs()
  }

  // Background refresh of served instances and app statuses
  setInterval(refreshServed, 5000)
  setInterval(refreshAppStatuses, 8000)
}

document.addEventListener('DOMContentLoaded', () => {
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
