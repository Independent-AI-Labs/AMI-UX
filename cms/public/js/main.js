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

async function init(fromSelect = false) {
  restoreState(state)
  attachEvents(state, setDocRoot, init, () => applyTheme(state))
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
  let idx = 1
  ;(tree.children || []).forEach((child) => frag.appendChild(buildNode(state, child, 0, [idx++])))
  root.appendChild(frag)
  updateTOC(state)
  restoreHashTarget()
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

init().catch((err) => {
  document.getElementById('content').textContent = 'Failed to load documentation tree.'
  console.error(err)
})

// Expose helpers for console debugging
window.__CMS__ = { state, expandCollapseAll }

