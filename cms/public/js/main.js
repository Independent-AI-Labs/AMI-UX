import { humanizeName } from './utils.js'
import { fetchConfig, fetchTree, setDocRoot } from './api.js'
import { applyTheme, buildNode, updateTOC, expandCollapseAll, restoreState, restoreHashTarget, attachEvents } from './ui.js'
import { connectSSE } from './sse.js'

const state = {
  tree: null,
  cache: new Map(),
  open: new Set(),
  theme: localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  sse: null,
  refreshTimer: null,
  treeContainer: null,
  rootKey: 'docRoot',
  rootLabelOverride: null,
  pendingFocus: '',
  docRootAbsolute: '',
  eventsAttached: false,
}

// Theme
applyTheme(state)

// Markdown config
marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false })

function ensureTreeContainer() {
  if (state.treeContainer && document.body.contains(state.treeContainer)) return state.treeContainer
  const content = document.getElementById('content')
  if (!content) return null
  content.innerHTML = ''

  const toolbar = document.createElement('div')
  toolbar.className = 'tree-toolbar'
  toolbar.id = 'treeToolbar'

  const titleWrap = document.createElement('div')
  titleWrap.className = 'tree-toolbar__title'
  titleWrap.textContent = 'Document Tree'
  toolbar.appendChild(titleWrap)

  const actions = document.createElement('div')
  actions.className = 'tree-toolbar__actions'

  const expandBtn = document.createElement('button')
  expandBtn.className = 'btn'
  expandBtn.id = 'treeExpandAll'
  expandBtn.type = 'button'
  expandBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="7" x2="12" y2="17"></line><line x1="7" y1="12" x2="17" y2="12"></line></svg><span>Expand All</span>'
  expandBtn.addEventListener('click', () => expandCollapseAll(true))

  const collapseBtn = document.createElement('button')
  collapseBtn.className = 'btn'
  collapseBtn.id = 'treeCollapseAll'
  collapseBtn.type = 'button'
  collapseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="7" y1="12" x2="17" y2="12"></line></svg><span>Collapse All</span>'
  collapseBtn.addEventListener('click', () => expandCollapseAll(false))

  actions.appendChild(expandBtn)
  actions.appendChild(collapseBtn)
  toolbar.appendChild(actions)

  const container = document.createElement('div')
  container.id = 'treeRoot'

  content.appendChild(toolbar)
  content.appendChild(container)

  state.treeContainer = container
  return container
}

function debounceRefreshTree() {
  if (state.refreshTimer) clearTimeout(state.refreshTimer)
  state.refreshTimer = setTimeout(async () => {
    try {
      const newTree = await fetchTree(state.rootKey || 'docRoot')
      state.tree = newTree
      const root = ensureTreeContainer()
      if (!root) return
      const scrollY = window.scrollY
      root.innerHTML = ''
      const frag = document.createDocumentFragment()
      let idx = 1
      ;(newTree.children || []).forEach((child) => frag.appendChild(buildNode(state, child, 0, [idx++])))
      root.appendChild(frag)
      updateTOC(state)
      window.scrollTo(0, scrollY)
    } catch (e) {
      console.warn('Failed to refresh tree', e)
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
  const parts = String(relativePath).split('/').map((part) => part.trim()).filter(Boolean)
  if (!parts.length) return
  let agg = ''
  let lastDetails = null
  for (const segment of parts) {
    agg = agg ? `${agg}/${segment}` : segment
    const selector = `details[data-path="${escapePathSelector(agg)}"]`
    const node = document.querySelector(selector)
    if (!node) break
    if (!node.open) {
      try { node.open = true } catch {}
      try { node.dispatchEvent(new Event('toggle')) } catch {}
    }
    lastDetails = node
  }
  if (lastDetails) {
    try { lastDetails.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch {}
    lastDetails.classList.add('tree-focus-highlight')
    setTimeout(() => { try { lastDetails.classList.remove('tree-focus-highlight') } catch {} }, 1400)
  }
}

async function persistDocRoot(pathStr, options = {}) {
  await setDocRoot(pathStr, options)
  state.rootKey = 'docRoot'
  state.rootLabelOverride = null
}

export async function startCms(fromSelect = false) {
  restoreState(state)
  if (!state.eventsAttached) {
    attachEvents(state, (path) => persistDocRoot(path), startCms, () => applyTheme(state))
    state.eventsAttached = true
  }
  let cfg = null
  try {
    cfg = await fetchConfig()
  } catch {}
  if (cfg) {
    state.docRootAbsolute = cfg.docRootAbsolute || cfg.docRoot || ''
    try {
      window.parent?.postMessage?.({ type: 'docConfig', docRoot: cfg.docRoot, docRootLabel: cfg.docRootLabel, docRootAbsolute: state.docRootAbsolute }, '*')
    } catch {}
  }
  const rootLabelEl = document.getElementById('docRootLabel')
  const activeRootKey = state.rootKey || 'docRoot'
  if (rootLabelEl) {
    if (activeRootKey === 'docRoot') {
      const label = cfg ? (cfg.docRootLabel || cfg.docRootAbsolute || cfg.docRoot || '') : ''
      rootLabelEl.textContent = label ? '(' + label + ')' : ''
    } else {
      const fallbackLabel = state.rootLabelOverride || (activeRootKey === 'uploads' ? 'Uploads' : '')
      rootLabelEl.textContent = fallbackLabel ? '(' + fallbackLabel + ')' : ''
    }
  }
  const tree = await fetchTree(activeRootKey)
  state.tree = tree
  const root = ensureTreeContainer()
  if (!root) return
  root.innerHTML = ''
  const title = document.getElementById('appTitle')
  if (title) {
    const treeName = tree?.name || (activeRootKey === 'uploads' ? 'Uploads' : 'Docs')
    title.textContent = humanizeName(treeName, 'dir')
  }
  const frag = document.createDocumentFragment()
  const children = (tree.children || []).slice()
  const findIntroIdx = () => children.findIndex((c) => c.type === 'file' && ['readme.md','introduction.md','intro.md'].includes(String(c.name||'').toLowerCase()))
  const introIdx = findIntroIdx()
  if (introIdx > 0) { const intro = children.splice(introIdx, 1)[0]; children.unshift(intro) }
  let idx = 1
  children.forEach((child) => frag.appendChild(buildNode(state, child, 0, [idx++])))
  root.appendChild(frag)
  updateTOC(state)
  restoreHashTarget()
  try {
    const introIdx2 = findIntroIdx()
    const intro = introIdx2 >= 0 ? children[introIdx2] : null
    if (intro && intro.type === 'file') {
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
            window.parent?.postMessage?.({ type: 'docConfig', docRoot: c.docRoot, docRootLabel: c.docRootLabel, docRootAbsolute: state.docRootAbsolute }, '*')
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
  try {
    if (msg.type === 'setDocRoot') {
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
      if (search) { search.value = q; search.dispatchEvent(new Event('input', { bubbles: true })) }
      return
    }
    if (msg.type === 'expandAll') return expandCollapseAll(true)
    if (msg.type === 'collapseAll') return expandCollapseAll(false)
    if (msg.type === 'applyTheme') {
      const theme = msg.theme === 'light' ? 'light' : 'dark'
      state.theme = theme
      localStorage.setItem('theme', theme)
      applyTheme(state)
      return
    }
  } catch (e) {
    console.warn('message handler failed', e)
  }
})
