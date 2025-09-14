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
}

// Theme
applyTheme(state)

// Markdown config
marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false })

function debounceRefreshTree() {
  if (state.refreshTimer) clearTimeout(state.refreshTimer)
  state.refreshTimer = setTimeout(async () => {
    try {
      const newTree = await fetchTree()
      state.tree = newTree
      const root = document.getElementById('content')
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

export async function startCms(fromSelect = false) {
  restoreState(state)
  attachEvents(state, setDocRoot, startCms, () => applyTheme(state))
  let cfg
  try {
    cfg = await fetchConfig()
  } catch {}
  const docRootLabel = document.getElementById('docRootLabel')
  if (cfg && cfg.docRoot) {
    docRootLabel.textContent = '(' + cfg.docRoot + ')'
  } else {
    docRootLabel.textContent = ''
  }
  const tree = await fetchTree()
  state.tree = tree
  const root = document.getElementById('content')
  root.innerHTML = ''
  const title = document.getElementById('appTitle')
  title.textContent = humanizeName(tree?.name || 'Docs', 'dir')
  const frag = document.createDocumentFragment()
  // Ensure root-level Introduction/README is rendered first
  const children = (tree.children || []).slice()
  const findIntroIdx = () => children.findIndex((c) => c.type === 'file' && ['readme.md','introduction.md','intro.md'].includes(String(c.name||'').toLowerCase()))
  const introIdx = findIntroIdx()
  if (introIdx > 0) { const intro = children.splice(introIdx, 1)[0]; children.unshift(intro) }
  let idx = 1
  children.forEach((child) => frag.appendChild(buildNode(state, child, 0, [idx++])))
  root.appendChild(frag)
  updateTOC(state)
  restoreHashTarget()
  // Auto-expand and preload root-level Introduction/README
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
  connectSSE(state, {
    onConfig: () => {
      debounceRefreshTree()
      fetchConfig()
        .then((c) => {
          const l = document.getElementById('docRootLabel')
          l.textContent = '(' + (c.docRoot || '') + ')'
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
        // Lazy import to avoid circulars
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
    if (msg.type === 'setDocRoot' && msg.path) {
      await setDocRoot(msg.path)
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
