import { createHighlightManager, HighlightManager } from './manager.js'

const CONTEXT_ID = 'doc-viewer'

const BASE_BLOCK_SELECTORS = [
  '#content .md p',
  '#content .md li',
  '#content .md pre',
  '#content pre',
  '#content p',
  '#content li',
]

const BASE_INLINE_SELECTORS = ['nav .toc a']

const BASE_HEADING_SELECTORS = [
  '#content .md h1',
  '#content .md h2',
  '#content .md h3',
  '#content .md h4',
]

const BASE_TREE_SELECTORS = ['#treeRoot summary']

function getManager(state) {
  if (state?.highlightManager instanceof HighlightManager) return state.highlightManager
  if (state?.highlightManager) return state.highlightManager
  const manager = createHighlightManager()
  if (state) state.highlightManager = manager
  return manager
}

function postAddComment(path, label) {
  try {
    window.parent?.postMessage?.({ type: 'addComment', path, label }, '*')
  } catch {}
}

function runSearch(anchor) {
  const search = document.getElementById('search')
  if (!search) return
  const label = (anchor?.textContent || '').trim().slice(0, 200)
  search.value = label
  search.dispatchEvent(new Event('input', { bubbles: true }))
  if (typeof search.focus === 'function') search.focus()
}

export function ensureDocHighlightContext(state) {
  const manager = getManager(state)
  if (!manager) return null
  if (state.highlightContextHandle) return state.highlightContextHandle

  const handle = manager.registerContext({
    id: CONTEXT_ID,
    document,
    scopeSelector: '.fx-glow',
    selectors: {
      block: BASE_BLOCK_SELECTORS,
      inline: BASE_INLINE_SELECTORS,
      heading: BASE_HEADING_SELECTORS,
      tree: BASE_TREE_SELECTORS,
    },
    overlayFollow: ['block', 'inline', 'heading'],
    handlers: {
      onComment: (anchor) => {
        const label = (anchor?.textContent || '').trim().slice(0, 200)
        const path = anchor?.id || ''
        postAddComment(path, label)
      },
      onSearch: (anchor) => runSearch(anchor),
    },
  })

  const btn = document.getElementById('highlightSettingsBtn')
  if (btn) manager.attachToggleButton(btn)

  state.highlightContextHandle = handle
  return handle
}

export function refreshDocHighlight(state, options = {}) {
  const manager = getManager(state)
  if (!manager) return
  const mode = options.mode || 'refresh'
  manager.refreshContext(CONTEXT_ID, { rebuild: mode === 'rebuild' })
}
