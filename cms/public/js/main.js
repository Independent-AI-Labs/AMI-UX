import './auth-fetch.js'

import { applyHint, humanizeName, pathAnchor } from './utils.js'
import { ensureDocumentHintLayer } from './hints/manager.js'
import { fetchConfig, fetchTreeChildren, setDocRoot } from './api.js'
import {
  applyTheme,
  renderTree,
  updateTOC,
  expandCollapseAll,
  restoreState,
  restoreHashTarget,
  attachEvents,
  preloadFileContent,
  ensureFileContent,
} from './ui.js'
import { connectSSE } from './sse.js'
import { acknowledgeParentMessage, messageChannel } from './message-channel.js'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'
import { markIgnoredNode } from './highlight-plugin/core/dom-utils.js'
import { normalizeFsPath } from './file-tree.js'
import { createVisibilityTracker } from './visibility-tracker.js'
import {
  createDocRootFromConfig,
  createDocRootFromMessage,
  buildDocRootSubtitle,
} from './models.js'

window.addEventListener('ami:unauthorized', () => {
  window.dispatchEvent(new Event('ami:navigate-signin'))
})

ensureDocumentHintLayer(document)

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
  bootOptions,
  fileOnly: Boolean(bootOptions.fileOnly),
  treeIndex: new Map(),
  loadDirectoryChildren: null,
  visibilityTracker: null,
  // SINGLE SOURCE OF TRUTH for doc root context
  docRootContext: {
    rootKey: 'docRoot',
    path: '',
    absolutePath: '',
    label: 'Docs',
    focus: '',
  },
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

function normalizeTreeKey(pathValue) {
  return normalizeFsPath(pathValue || '')
}

function ensureTreeIndex(state) {
  if (!state.treeIndex || !(state.treeIndex instanceof Map)) state.treeIndex = new Map()
  return state.treeIndex
}

function registerTreeNode(state, node) {
  if (!node) return null
  const index = ensureTreeIndex(state)
  const key = normalizeTreeKey(node.path)
  node.path = key
  index.set(key, node)
  if (node.type === 'dir') {
    const meta = ensureNodeMeta(node)
    if (Array.isArray(node.children) && node.children.length) {
      meta.loaded = true
      node.children.forEach((child) => registerTreeNode(state, child))
    } else if (!meta.initialized) {
      meta.initialized = true
    }
  }
  return node
}

function ensureNodeMeta(node) {
  if (!node) return { hasChildren: false, loaded: true, loading: false, error: null }
  if (!node.__lazy) {
    const hasChildren = node.type === 'dir'
    node.__lazy = {
      hasChildren,
      loaded: hasChildren ? Array.isArray(node.children) && node.children.length > 0 : true,
      loading: false,
      error: null,
      childCount: Array.isArray(node.children) ? node.children.length : 0,
      initialized: true,
      promise: null,
    }
  }
  return node.__lazy
}

function createNodeFromSummary(summary) {
  const normalizedPath = normalizeTreeKey(summary.path || '')
  const node = {
    name: summary.name || '',
    path: normalizedPath,
    type: summary.type === 'dir' ? 'dir' : 'file',
    children: summary.type === 'dir' ? [] : [],
  }
  if (node.type === 'dir') {
    node.__lazy = {
      hasChildren: summary.hasChildren !== false,
      childCount:
        typeof summary.childCount === 'number' && summary.childCount >= 0
          ? summary.childCount
          : undefined,
      loaded: false,
      loading: false,
      error: null,
      initialized: true,
      promise: null,
    }
    if (!node.__lazy.hasChildren) node.__lazy.loaded = true
  }
  return node
}

function locateNode(state, pathValue) {
  const index = ensureTreeIndex(state)
  const key = normalizeTreeKey(pathValue)
  return index.get(key) || null
}

async function loadDirectoryChildren(state, node) {
  if (!node || node.type !== 'dir') return []
  const meta = ensureNodeMeta(node)
  if (meta.loaded) return Array.isArray(node.children) ? node.children : []
  if (meta.promise) return meta.promise
  meta.loading = true
  meta.error = null
  meta.promise = (async () => {
    try {
      const res = await fetchTreeChildren(state.rootKey || 'docRoot', node.path || '')
      const summaries = Array.isArray(res.children) ? res.children : []
      const children = summaries.map((summary) => createNodeFromSummary(summary))
      node.children = children
      meta.loaded = true
      meta.hasChildren = children.length > 0
      meta.childCount = children.length
      children.forEach((child) => registerTreeNode(state, child))
      return children
    } catch (err) {
      meta.error = err?.message || 'Failed to load directory'
      throw err
    } finally {
      meta.loading = false
      meta.promise = null
    }
  })()
  return meta.promise
}

async function buildInitialTree(state, rootKey) {
  const res = await fetchTreeChildren(rootKey, '')
  const nodeInfo = res?.node || { name: '', path: '', type: 'dir', hasChildren: true }
  const rootNode = {
    name: nodeInfo.name || (rootKey === 'uploads' ? 'Uploads' : 'Docs'),
    path: '',
    type: nodeInfo.type === 'file' ? 'file' : 'dir',
    children: [],
  }
  rootNode.__lazy = {
    hasChildren: nodeInfo.type === 'dir' ? nodeInfo.hasChildren !== false : false,
    childCount:
      nodeInfo.type === 'dir' && typeof nodeInfo.childCount === 'number'
        ? nodeInfo.childCount
        : undefined,
    loaded: false,
    loading: false,
    error: null,
    initialized: true,
  }
  ensureTreeIndex(state).clear()
  registerTreeNode(state, rootNode)
  const summaries = Array.isArray(res.children) ? res.children : []
  const children = summaries.map((summary) => createNodeFromSummary(summary))
  rootNode.children = children
  const meta = ensureNodeMeta(rootNode)
  meta.loaded = true
  meta.hasChildren = children.length > 0
  meta.childCount = children.length
  children.forEach((child) => registerTreeNode(state, child))
  return rootNode
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
  expandBtn.className = 'btn btn--ghost icon-button'
  expandBtn.id = 'treeExpandAll'
  expandBtn.type = 'button'
  expandBtn.innerHTML = iconMarkup('add-box-line', { size: 18 })
  applyHint(expandBtn, 'Expand all sections')
  expandBtn.setAttribute('aria-label', 'Expand all sections')
  markIgnoredNode(expandBtn)
  expandBtn.addEventListener('click', () => expandCollapseAll(true))

  const collapseBtn = document.createElement('button')
  collapseBtn.className = 'btn btn--ghost icon-button'
  collapseBtn.id = 'treeCollapseAll'
  collapseBtn.type = 'button'
  collapseBtn.innerHTML = iconMarkup('checkbox-indeterminate-line', { size: 18 })
  applyHint(collapseBtn, 'Collapse all sections')
  collapseBtn.setAttribute('aria-label', 'Collapse all sections')
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
  applyHint(overlay, '', { clearAriaLabel: true })
  const spinner = document.createElement('span')
  spinner.className = 'loading-indicator__spinner'
  spinner.setAttribute('aria-hidden', 'true')
  applyHint(spinner, '', { clearAriaLabel: true })
  const label = document.createElement('span')
  label.className = 'tree-root__overlay-label'
  label.textContent = 'Loading…'
  applyHint(label, '', { clearAriaLabel: true })
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
  if (!state.visibilityTracker) {
    try {
      state.visibilityTracker = createVisibilityTracker({ root: container })
    } catch (error) {
      console.warn('Failed to initialize visibility tracker', error)
      state.visibilityTracker = null
    }
  } else {
    try {
      state.visibilityTracker.setRoot(container)
    } catch (error) {
      console.warn('Failed to bind visibility tracker root', error)
    }
  }
  if (state.visibilityTracker && typeof state.visibilityTracker.setOptions === 'function') {
    state.visibilityTracker.setOptions({ rootMargin: '10rem 0px' })
  }
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
      const newTree = await buildInitialTree(state, state.rootKey || 'docRoot')
      state.tree = newTree
      state.loadDirectoryChildren = async (nodeOrPath) => {
        if (!nodeOrPath) return []
        if (typeof nodeOrPath === 'string') {
          const target = locateNode(state, nodeOrPath)
          if (!target) throw new Error('Directory not found')
          return loadDirectoryChildren(state, target)
        }
        return loadDirectoryChildren(state, nodeOrPath)
      }
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

function findNodeByPath(tree, targetPath) {
  if (!tree || !targetPath) return null
  const normalized = String(targetPath || '').trim()
  if (!normalized) return null
  if (tree.path === normalized) return tree
  const queue = Array.isArray(tree.children) ? tree.children.slice() : []
  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    if (current.path === normalized) return current
    if (current.type === 'dir' && Array.isArray(current.children)) {
      queue.push(...current.children)
    }
  }
  return null
}

async function renderStandaloneDocument(state, tree, targetPath) {
  const content = document.getElementById('content')
  if (!content) return
  const desiredPath = String(targetPath || '').trim()
  const releaseLoading =
    typeof state.beginDocumentLoading === 'function'
      ? state.beginDocumentLoading('Loading document…')
      : () => {}
  try {
    const nodeFromTree = desiredPath ? findNodeByPath(tree, desiredPath) : null
    const derivedName = desiredPath.split('/').pop() || desiredPath || 'document'
    const node = nodeFromTree || {
      name: derivedName,
      path: desiredPath,
      type: 'file',
    }
    const entry = await ensureFileContent(state, node)
    if (!entry) throw new Error('No document content available')
    state.activePath = node.path || ''
    content.innerHTML = ''
    if (node.path) {
      const anchor = document.createElement('a')
      anchor.id = pathAnchor(node.path)
      content.appendChild(anchor)
    }
    const cloned =
      entry.html && typeof entry.html.cloneNode === 'function'
        ? entry.html.cloneNode(true)
        : entry.html || document.createTextNode('')
    content.appendChild(cloned)
    try {
      const docRootKey = state?.rootKey || 'docRoot'
      if (document && document.documentElement) {
        document.documentElement.setAttribute('data-ami-doc-root', docRootKey)
        if (node.path) document.documentElement.setAttribute('data-ami-doc-path', node.path)
        else document.documentElement.removeAttribute('data-ami-doc-path')
      }
      document.dispatchEvent(
        new CustomEvent('ami:doc-context', {
          detail: {
            path: node.path || '',
            name: node.name || '',
            root: docRootKey,
          },
        }),
      )
    } catch (error) {
      console.warn('Failed to broadcast doc context', error)
    }
    updateTOC(state)
  } catch (error) {
    console.warn('Failed to render standalone document', error)
    content.textContent = 'Failed to load file.'
  } finally {
    try {
      if (typeof releaseLoading === 'function') releaseLoading()
    } catch {}
  }
}

async function persistDocRoot(pathStr, options = {}) {
  // NOTE: Server ignores docRoot/docRootLabel changes (they're ENV-configured)
  // So we don't POST them - just update local state
  const context = createDocRootFromMessage({
    rootKey: 'docRoot',
    path: pathStr,
    label: options.label || null,
    focus: state.pendingFocus || '',
  })

  // Update state with new context (preserves label!)
  state.docRootContext = context
  state.rootKey = context.rootKey
  state.docRootAbsolute = context.absolutePath
  state.rootLabelOverride = context.label // ✓ NO LONGER NULLED
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
    // Initialize docRootContext from server config if not already set
    if (!state.docRootContext.absolutePath || state.rootKey === 'docRoot') {
      state.docRootContext = createDocRootFromConfig(cfg)
      state.rootKey = state.docRootContext.rootKey
      state.docRootAbsolute = state.docRootContext.absolutePath
      state.rootLabelOverride = state.docRootContext.label
    }

    try {
      window.parent?.postMessage?.(
        {
          type: 'docConfig',
          docRoot: cfg.docRoot,
          docRootLabel: cfg.docRootLabel,
          docRootAbsolute: state.docRootContext.absolutePath,
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
      const displayLabel =
        state.rootLabelOverride || (activeRootKey === 'uploads' ? 'Uploads' : '')
      rootLabelEl.textContent = displayLabel ? '(' + displayLabel + ')' : ''
    }
  }
  const treeSubtitleEl = document.getElementById('treeToolbarSubtitle')
  if (treeSubtitleEl) {
    // Use SINGLE SOURCE OF TRUTH for subtitle
    const subtitleText = buildDocRootSubtitle(state.docRootContext)
    treeSubtitleEl.textContent = subtitleText
  }
  let root = null
  let shouldWipe = false
  if (state.fileOnly) {
    root = document.getElementById('content')
    if (!root) return
    state.treeContainer = root
    state.treeShell = root.parentElement || state.treeShell || null
    root.innerHTML = ''
  } else {
    root = ensureTreeContainer()
    if (!root) return
    const hasDetails = root.querySelector('details')
    shouldWipe = !hasDetails
    setTreeStatus('loading', 'Loading content…', { wipe: shouldWipe, skeleton: true })
  }
  state.isLoading = true
  let tree = null
  try {
    tree = await buildInitialTree(state, activeRootKey)
  } catch (err) {
    state.isLoading = false
    if (state.fileOnly) {
      console.warn('Failed to load tree', err)
      if (root) root.textContent = 'Failed to load document.'
    } else {
      setTreeStatus('error', 'Failed to load content', { wipe: shouldWipe })
      console.warn('Failed to load tree', err)
    }
    return
  }
  state.isLoading = false
  state.tree = tree
  state.loadDirectoryChildren = async (nodeOrPath) => {
    if (!nodeOrPath) return []
    if (typeof nodeOrPath === 'string') {
      const target = locateNode(state, nodeOrPath)
      if (!target) throw new Error('Directory not found')
      return loadDirectoryChildren(state, target)
    }
    return loadDirectoryChildren(state, nodeOrPath)
  }
  const title = document.getElementById('appTitle')
  if (title) {
    const treeName = tree?.name || (activeRootKey === 'uploads' ? 'Uploads' : 'Docs')
    title.textContent = humanizeName(treeName, 'dir')
  }

  const rootChildren = Array.isArray(tree.children) ? tree.children.slice() : []
  const findIntroIdx = () =>
    rootChildren.findIndex(
      (c) =>
        c.type === 'file' &&
        ['readme.md', 'introduction.md', 'intro.md'].includes(String(c.name || '').toLowerCase()),
    )
  const introIdx = findIntroIdx()
  const intro = introIdx >= 0 ? rootChildren[introIdx] : null
  const defaultFile = intro || rootChildren.find((child) => child && child.type === 'file') || null
  const trimmedFocus = (state.pendingFocus || '').trim()
  const hasPendingFocus = Boolean(trimmedFocus)

  if (state.fileOnly) {
    const targetPath = hasPendingFocus
      ? trimmedFocus
      : defaultFile && defaultFile.type === 'file'
        ? defaultFile.path
        : ''
    await renderStandaloneDocument(state, tree, targetPath)
    state.pendingFocus = ''
    restoreHashTarget()
    return
  }

  renderTree(state, root, tree)
  if (!hasPendingFocus && defaultFile && defaultFile.type === 'file') {
    await preloadFileContent(state, {
      name: defaultFile.name,
      path: defaultFile.path,
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

      // Use model to create context from message
      const context = createDocRootFromMessage({
        rootKey: msg.rootKey,
        path: msg.path,
        label: msg.label,
        focus: msg.focus,
      })

      // Update state with context (single source of truth!)
      state.docRootContext = context
      state.rootKey = context.rootKey
      state.docRootAbsolute = context.absolutePath
      state.rootLabelOverride = context.label
      state.pendingFocus = context.focus

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
