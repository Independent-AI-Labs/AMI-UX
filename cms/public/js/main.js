import './auth-fetch.js'

import { humanizeName } from './utils.js'
import { fetchConfig, fetchTree, setDocRoot } from './api.js'
import {
  applyTheme,
  renderTree,
  updateTOC,
  expandCollapseAll,
  restoreState,
  restoreHashTarget,
  attachEvents,
  preloadFileContent,
} from './ui.js'
import { connectSSE } from './sse.js'
import { acknowledgeParentMessage, messageChannel } from './message-channel.js'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'
import { markIgnoredNode } from './highlight-plugin/core/dom-utils.js'

window.addEventListener('ami:unauthorized', () => {
  window.dispatchEvent(new Event('ami:navigate-signin'))
})

const bootOptions =
  typeof window !== 'undefined' && window.__CMS_BOOT_OPTIONS__
    ? window.__CMS_BOOT_OPTIONS__
    : {}

const state = {
  tree: null,
  cache: new Map(),
  open: new Set(),
  activePath: '',
  theme:
    localStorage.getItem('theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  sse: null,
  refreshTimer: null,
  treeContainer: null,
  treeShell: null,
  treeOverlay: null,
  treeOverlayLabel: null,
  treeFilterInput: null,
  treeFilterValue: '',
  rootKey: 'docRoot',
  rootLabelOverride: null,
  pendingFocus: typeof bootOptions.focusPath === 'string' ? bootOptions.focusPath : '',
  docRootAbsolute: '',
  cacheContext: 'docRoot',
  isLoading: false,
  eventsAttached: false,
  docOverlay: null,
  docOverlayLabel: null,
  documentLoadTokens: new Set(),
  bootOptions,
  fileOnly: Boolean(bootOptions.fileOnly),
}

// Theme
applyTheme(state)

// Markdown config
marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false })

function getTreeShell() {
  if (state.treeShell && document.body.contains(state.treeShell)) return state.treeShell
  if (
    state.treeContainer &&
    state.treeContainer.parentElement &&
    document.body.contains(state.treeContainer.parentElement)
  ) {
    state.treeShell = state.treeContainer.parentElement
    return state.treeShell
  }
  return null
}

function createTreeSkeleton(rows = 6) {
  const skeleton = document.createElement('div')
  skeleton.className = 'tree-skeleton'
  const widths = [88, 72, 64, 80, 68, 58, 75, 66]
  for (let i = 0; i < rows; i += 1) {
    const row = document.createElement('div')
    row.className = 'tree-skeleton__row'
    row.style.marginLeft = `${Math.min(i, 3) * 16}px`
    const width = widths[i % widths.length]
    row.style.setProperty('--tree-skeleton-width', `${width}%`)
    skeleton.appendChild(row)
  }
  return skeleton
}

function setTreeStatus(kind, message, options = {}) {
  const { wipe = false, skeleton = false } = options
  const shell = getTreeShell()
  const viewport =
    state.treeContainer && document.body.contains(state.treeContainer) ? state.treeContainer : null
  if (!shell || !viewport) return
  if (!state.treeOverlay || !document.body.contains(state.treeOverlay)) {
    state.treeOverlay = shell.querySelector('.tree-root__overlay')
    state.treeOverlayLabel = state.treeOverlay
      ? state.treeOverlay.querySelector('.tree-root__overlay-label')
      : null
  }
  const overlay = state.treeOverlay
  const label = state.treeOverlayLabel
  if (typeof message === 'string' && label) label.textContent = message
  if (!overlay) return

  if (kind === 'idle') {
    overlay.setAttribute('aria-hidden', 'true')
    overlay.dataset.kind = 'idle'
    shell.classList.remove('tree-root-shell--busy', 'tree-root-shell--error')
    shell.style.removeProperty('minHeight')
    const prevSkeleton = viewport.querySelector('.tree-skeleton')
    if (prevSkeleton) prevSkeleton.remove()
    return
  }

  overlay.setAttribute('aria-hidden', 'false')
  overlay.dataset.kind = kind
  shell.classList.add('tree-root-shell--busy')
  if (kind === 'error') shell.classList.add('tree-root-shell--error')
  else shell.classList.remove('tree-root-shell--error')

  const currentBounds = shell.getBoundingClientRect()
  const viewportHeight = viewport.offsetHeight || currentBounds.height || 0
  const minHeight = Math.max(viewportHeight, 180)
  shell.style.minHeight = `${minHeight}px`

  if (wipe) {
    viewport.innerHTML = ''
    if (skeleton) viewport.appendChild(createTreeSkeleton())
  }
}

function ensureDocOverlay() {
  const shell = getTreeShell()
  if (!shell) return null
  if (!state.docOverlay || !shell.contains(state.docOverlay)) {
    let overlay = shell.querySelector('.doc-viewer__overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'doc-viewer__overlay'
      overlay.setAttribute('aria-hidden', 'true')
      overlay.setAttribute('aria-live', 'polite')
      const spinner = document.createElement('span')
      spinner.className = 'doc-viewer__overlay-spinner'
      spinner.innerHTML = iconMarkup('loader-4-line', {
        spin: true,
        label: 'Loading document',
      })
      const label = document.createElement('span')
      label.className = 'doc-viewer__overlay-label'
      label.textContent = 'Loading…'
      overlay.appendChild(spinner)
      overlay.appendChild(label)
      shell.appendChild(overlay)
      state.docOverlayLabel = label
    } else {
      state.docOverlayLabel = overlay.querySelector('.doc-viewer__overlay-label')
    }
    state.docOverlay = overlay
  } else if (!state.docOverlayLabel) {
    state.docOverlayLabel = state.docOverlay.querySelector('.doc-viewer__overlay-label')
  }
  return state.docOverlay
}

function endDocumentLoading(token) {
  if (!state.documentLoadTokens) state.documentLoadTokens = new Set()
  if (token && state.documentLoadTokens.has(token)) state.documentLoadTokens.delete(token)
  if (state.documentLoadTokens.size === 0 && state.docOverlay) {
    state.docOverlay.classList.remove('doc-viewer__overlay--active')
    state.docOverlay.setAttribute('aria-hidden', 'true')
  }
}

function beginDocumentLoading(message = 'Loading document…') {
  const overlay = ensureDocOverlay()
  if (!overlay) return () => {}
  if (!state.documentLoadTokens) state.documentLoadTokens = new Set()
  if (state.docOverlayLabel && typeof message === 'string') {
    state.docOverlayLabel.textContent = message
  }
  overlay.classList.add('doc-viewer__overlay--active')
  overlay.setAttribute('aria-hidden', 'false')
  const token = Symbol('doc-load')
  state.documentLoadTokens.add(token)
  return () => endDocumentLoading(token)
}

state.beginDocumentLoading = beginDocumentLoading
state.endDocumentLoading = endDocumentLoading

function ensureTreeContainer() {
  if (state.treeContainer && document.body.contains(state.treeContainer)) return state.treeContainer
  const content = document.getElementById('content')
  if (!content) return null
  content.innerHTML = ''

  const toolbar = document.createElement('div')
  toolbar.className = 'drawer-shell-header tree-toolbar'
  toolbar.id = 'treeToolbar'

  const row = document.createElement('div')
  row.className = 'drawer-shell-header__row'

  const titles = document.createElement('div')
  titles.className = 'drawer-shell-header__titles'
  const title = document.createElement('strong')
  title.className = 'drawer-shell-header__title'
  title.textContent = 'Interactive Document Viewer'
  titles.appendChild(title)
  row.appendChild(titles)

  const controls = document.createElement('div')
  controls.className = 'drawer-shell-header__controls tree-toolbar__controls'

  const filterWrap = document.createElement('div')
  filterWrap.className = 'drawer-shell-header__filter tree-toolbar__filter'
  const filterInput = document.createElement('input')
  filterInput.type = 'search'
  filterInput.id = 'treeFilter'
  filterInput.placeholder = 'Filter tree items'
  filterInput.className = 'drawer-shell-header__search-input'
  filterInput.setAttribute('aria-label', 'Filter tree')
  if (state.treeFilterValue) filterInput.value = state.treeFilterValue
  filterWrap.appendChild(filterInput)
  controls.appendChild(filterWrap)

  const actions = document.createElement('div')
  actions.className = 'drawer-shell-header__actions tree-toolbar__actions'
  markIgnoredNode(actions)

  const expandBtn = document.createElement('button')
  expandBtn.className = 'btn btn--ghost'
  expandBtn.id = 'treeExpandAll'
  expandBtn.type = 'button'
  expandBtn.innerHTML = `${iconMarkup('add-box-line', { size: 16 })}<span>Expand All</span>`
  expandBtn.dataset.hint = 'Expand all sections in the tree'
  expandBtn.title = 'Expand all sections in the tree'
  markIgnoredNode(expandBtn)
  expandBtn.addEventListener('click', () => expandCollapseAll(true))

  const collapseBtn = document.createElement('button')
  collapseBtn.className = 'btn btn--ghost'
  collapseBtn.id = 'treeCollapseAll'
  collapseBtn.type = 'button'
  collapseBtn.innerHTML = `${iconMarkup('checkbox-indeterminate-line', { size: 16 })}<span>Collapse All</span>`
  collapseBtn.dataset.hint = 'Collapse all sections in the tree'
  collapseBtn.title = 'Collapse all sections in the tree'
  markIgnoredNode(collapseBtn)
  collapseBtn.addEventListener('click', () => expandCollapseAll(false))

  actions.appendChild(expandBtn)
  actions.appendChild(collapseBtn)
  controls.appendChild(actions)

  row.appendChild(controls)
  toolbar.appendChild(row)

  const subtitle = document.createElement('p')
  subtitle.className = 'drawer-shell-header__subtitle tree-toolbar__subtitle'
  subtitle.id = 'treeToolbarSubtitle'
  subtitle.textContent = 'Explore and inspect structured documentation.'
  markIgnoredNode(subtitle)
  toolbar.appendChild(subtitle)

  const shell = document.createElement('div')
  shell.className = 'tree-root-shell'

  const container = document.createElement('div')
  container.id = 'treeRoot'
  container.className = 'tree-root'

  const overlay = document.createElement('div')
  overlay.className = 'tree-root__overlay'
  overlay.dataset.kind = 'idle'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('aria-live', 'polite')
  const spinner = document.createElement('span')
  spinner.className = 'loading-indicator__spinner'
  spinner.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.className = 'tree-root__overlay-label'
  label.textContent = 'Loading…'
  overlay.appendChild(spinner)
  overlay.appendChild(label)

  shell.appendChild(container)
  shell.appendChild(overlay)

  content.appendChild(toolbar)
  content.appendChild(shell)

  state.treeContainer = container
  state.treeShell = shell
  state.treeOverlay = overlay
  state.treeOverlayLabel = label
  state.treeFilterInput = filterInput
  ensureDocOverlay()
  if (typeof state.registerTreeFilterInput === 'function') {
    state.registerTreeFilterInput(filterInput)
  }
  return container
}

function debounceRefreshTree() {
  if (state.refreshTimer) clearTimeout(state.refreshTimer)
  state.refreshTimer = setTimeout(async () => {
    const root = ensureTreeContainer()
    const hasDetails = root ? root.querySelector('details') : null
    const shouldWipe = !hasDetails
    setTreeStatus('loading', 'Refreshing…', { wipe: shouldWipe, skeleton: shouldWipe })
    let scrollY = window.scrollY
    state.isLoading = true
    try {
      const newTree = await fetchTree(state.rootKey || 'docRoot')
      state.tree = newTree
      if (!root) return
      renderTree(state, root, newTree)
      if (typeof state.applyTreeFilter === 'function') {
        state.applyTreeFilter(state.treeFilterValue || '')
      }
      updateTOC(state)
      window.scrollTo(0, scrollY)
      setTreeStatus('idle')
    } catch (e) {
      const wipe = root ? !root.querySelector('details') : true
      setTreeStatus('error', 'Failed to refresh content', { wipe })
      console.warn('Failed to refresh tree', e)
    } finally {
      state.isLoading = false
    }
  }, 200)
}

function escapePathSelector(value) {
  try {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value)
    }
  } catch {}
  return value.replace(/"/g, '\\"')
}

function focusTreePath(relativePath) {
  if (!relativePath) return
  const parts = String(relativePath)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return
  let agg = ''
  let lastDetails = null
  for (const segment of parts) {
    agg = agg ? `${agg}/${segment}` : segment
    const selector = `details[data-path="${escapePathSelector(agg)}"]`
    const node = document.querySelector(selector)
    if (!node) break
    if (!node.open) {
      try {
        node.open = true
      } catch {}
      try {
        node.dispatchEvent(new Event('toggle'))
      } catch {}
    }
    lastDetails = node
  }
  if (lastDetails) {
    try {
      lastDetails.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch {}
  }
}

async function persistDocRoot(pathStr, options = {}) {
  await setDocRoot(pathStr, options)
  state.rootKey = 'docRoot'
  state.rootLabelOverride = null
}

export async function startCms(fromSelect = false) {
  restoreState(state)
  if (state.fileOnly) {
    state.open = new Set()
  }
  if (!state.eventsAttached) {
    attachEvents(
      state,
      (path) => persistDocRoot(path),
      startCms,
      () => applyTheme(state),
    )
    state.eventsAttached = true
  }
  let cfg = null
  try {
    cfg = await fetchConfig()
  } catch {}
  if (cfg) {
    state.docRootAbsolute = cfg.docRootAbsolute || cfg.docRoot || ''
    try {
      window.parent?.postMessage?.(
        {
          type: 'docConfig',
          docRoot: cfg.docRoot,
          docRootLabel: cfg.docRootLabel,
          docRootAbsolute: state.docRootAbsolute,
        },
        '*',
      )
    } catch {}
  }
  const activeRootKey = state.rootKey || 'docRoot'
  const contextTag = activeRootKey === 'uploads' ? 'uploads' : state.docRootAbsolute || 'docRoot'
  const combinedContext = `${activeRootKey}::${contextTag}`
  if (state.cacheContext !== combinedContext) {
    state.cache.clear()
    state.cacheContext = combinedContext
  }
  const rootLabelEl = document.getElementById('docRootLabel')
  if (rootLabelEl) {
    if (activeRootKey === 'docRoot') {
      const label = cfg ? cfg.docRootLabel || cfg.docRootAbsolute || cfg.docRoot || '' : ''
      rootLabelEl.textContent = label ? '(' + label + ')' : ''
    } else {
      const fallbackLabel =
        state.rootLabelOverride || (activeRootKey === 'uploads' ? 'Uploads' : '')
      rootLabelEl.textContent = fallbackLabel ? '(' + fallbackLabel + ')' : ''
    }
  }
  const treeSubtitleEl = document.getElementById('treeToolbarSubtitle')
  if (treeSubtitleEl) {
    let subtitleText = 'Explore and inspect structured documentation.'
    if (activeRootKey === 'uploads') {
      const label = (state.rootLabelOverride || 'Uploads').trim()
      subtitleText = label ? `Uploads workspace sourced from ${label}` : 'Uploads workspace'
    } else {
      const override = (state.rootLabelOverride || '').trim()
      const cfgLabel = cfg ? (cfg.docRootLabel || cfg.docRoot || '').trim() : ''
      const absolutePath = (cfg ? cfg.docRootAbsolute : state.docRootAbsolute) || ''
      const infoParts = []
      const displayLabel = override || cfgLabel
      if (displayLabel) infoParts.push(displayLabel)
      if (absolutePath && absolutePath !== displayLabel) infoParts.push(absolutePath)
      if (infoParts.length) subtitleText = `Docs sourced from ${infoParts.join(' · ')}`
    }
    treeSubtitleEl.textContent = subtitleText
  }
  const root = ensureTreeContainer()
  if (!root) return
  const hasDetails = root.querySelector('details')
  const shouldWipe = !hasDetails
  setTreeStatus('loading', 'Loading content…', { wipe: shouldWipe, skeleton: true })
  state.isLoading = true
  let tree = null
  try {
    tree = await fetchTree(activeRootKey)
  } catch (err) {
    state.isLoading = false
    setTreeStatus('error', 'Failed to load content', { wipe: shouldWipe })
    console.warn('Failed to load tree', err)
    return
  }
  state.isLoading = false
  state.tree = tree
  const title = document.getElementById('appTitle')
  if (title) {
    const treeName = tree?.name || (activeRootKey === 'uploads' ? 'Uploads' : 'Docs')
    title.textContent = humanizeName(treeName, 'dir')
  }
  renderTree(state, root, tree)
  const rootChildren = Array.isArray(tree.children) ? tree.children.slice() : []
  const findIntroIdx = () =>
    rootChildren.findIndex(
      (c) =>
        c.type === 'file' &&
        ['readme.md', 'introduction.md', 'intro.md'].includes(String(c.name || '').toLowerCase()),
    )
  const introIdx = findIntroIdx()
  const intro = introIdx >= 0 ? rootChildren[introIdx] : null
  const fallbackFile = intro || rootChildren.find((child) => child && child.type === 'file') || null
  const hasPendingFocus = Boolean(state.pendingFocus && state.pendingFocus.trim())
  if (!hasPendingFocus && fallbackFile && fallbackFile.type === 'file') {
    await preloadFileContent(state, {
      name: fallbackFile.name,
      path: fallbackFile.path,
      type: 'file',
    })
  } else if (!hasPendingFocus) {
    state.activePath = ''
  }
  if (typeof state.applyTreeFilter === 'function') {
    state.applyTreeFilter(state.treeFilterValue || '')
  }
  setTreeStatus('idle')
  updateTOC(state)
  restoreHashTarget()
  try {
    if (!hasPendingFocus && intro && intro.type === 'file') {
      const sel = document.querySelector(`details.file[data-path="${CSS.escape(intro.path)}"]`)
      if (sel) {
        sel.setAttribute('open', '')
        const body = sel.querySelector('.body')
        const node = { name: intro.name, path: intro.path, type: 'file' }
        const { loadFileNode } = await import('./ui.js')
        await loadFileNode(state, sel, node, body)
      }
    }
  } catch {}
  if (state.pendingFocus) {
    const pending = state.pendingFocus
    state.pendingFocus = ''
    requestAnimationFrame(() => focusTreePath(pending))
  }
  connectSSE(state, {
    onConfig: () => {
      debounceRefreshTree()
      fetchConfig()
        .then((c) => {
          state.docRootAbsolute = c.docRootAbsolute || c.docRoot || ''
          try {
            window.parent?.postMessage?.(
              {
                type: 'docConfig',
                docRoot: c.docRoot,
                docRootLabel: c.docRootLabel,
                docRootAbsolute: state.docRootAbsolute,
              },
              '*',
            )
          } catch {}
          if (state.rootKey === 'docRoot') {
            const label = c.docRootLabel || c.docRootAbsolute || c.docRoot || ''
            const labelEl = document.getElementById('docRootLabel')
            if (labelEl) labelEl.textContent = label ? '(' + label + ')' : ''
          }
        })
        .catch(() => {})
    },
    onTreeChange: () => debounceRefreshTree(),
    onFileChange: (rel) => {
      state.cache.delete(rel)
      const openFile = document.querySelector(`details.file[data-path="${CSS.escape(rel)}"]`)
      if (openFile && openFile.hasAttribute('open')) {
        const body = openFile.querySelector('.body')
        const node = { name: rel.split('/').pop() || rel, path: rel, type: 'file' }
        import('./ui.js').then(({ loadFileNode }) => loadFileNode(state, openFile, node, body))
      }
      updateTOC(state)
    },
  })
}

// Expose helpers for console debugging
window.__CMS__ = { state, expandCollapseAll }

// Embed messaging API (for shell iframe integration)
window.addEventListener('message', async (ev) => {
  const msg = ev && ev.data
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'highlightSettings') return

  let acked = false
  const ack = (details) => {
    if (acked) return
    if (msg.channel === messageChannel.CHANNEL && msg.requestId != null) {
      acknowledgeParentMessage(msg, details)
      acked = true
    }
  }

  try {
    if (msg.type === 'setDocRoot') {
      ack({ status: 'accepted' })
      const rootKey = msg.rootKey === 'uploads' ? 'uploads' : 'docRoot'
      const focus = typeof msg.focus === 'string' ? msg.focus : ''
      if (rootKey === 'docRoot') {
        if (typeof msg.path === 'string' && msg.path) {
          const options = {}
          if (Object.prototype.hasOwnProperty.call(msg, 'label')) {
            const incoming = msg.label
            if (incoming === null) options.label = null
            else if (typeof incoming === 'string' && incoming.trim()) options.label = incoming.trim()
          }
          state.pendingFocus = focus
          await persistDocRoot(msg.path, options)
          state.docRootAbsolute = msg.path || state.docRootAbsolute
          await startCms(true)
        }
        return
      }
      state.rootKey = rootKey
      if (Object.prototype.hasOwnProperty.call(msg, 'label')) {
        if (msg.label === null) {
          state.rootLabelOverride = null
        } else if (typeof msg.label === 'string' && msg.label.trim()) {
          state.rootLabelOverride = msg.label.trim()
        } else {
          state.rootLabelOverride = rootKey === 'uploads' ? 'Uploads' : null
        }
      } else {
        state.rootLabelOverride = rootKey === 'uploads' ? 'Uploads' : state.rootLabelOverride
      }
      state.pendingFocus = focus
      await startCms(true)
      return
    }
    if (msg.type === 'search') {
      const q = String(msg.q || '')
      const search = document.getElementById('search')
      if (search) {
        search.value = q
        search.dispatchEvent(new Event('input', { bubbles: true }))
      }
      ack({ status: 'ok' })
      return
    }
    if (msg.type === 'expandAll') {
      expandCollapseAll(true)
      ack({ status: 'ok' })
      return
    }
    if (msg.type === 'collapseAll') {
      expandCollapseAll(false)
      ack({ status: 'ok' })
      return
    }
    if (msg.type === 'applyTheme') {
      const theme = msg.theme === 'light' ? 'light' : 'dark'
      state.theme = theme
      localStorage.setItem('theme', theme)
      applyTheme(state)
      ack({ status: 'ok' })
      return
    }
    if (msg.channel === messageChannel.CHANNEL) ack({ status: 'ignored' })
  } catch (e) {
    ack({ status: 'error', error: e?.message || String(e) })
    console.warn('message handler failed', e)
  }
})
