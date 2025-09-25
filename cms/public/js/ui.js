import { displayName, pathAnchor } from './utils.js'
import { fetchFile } from './api.js'
import { renderMarkdown, renderCSV } from './renderers.js'
import { CodeView, guessLanguageFromFilename } from './code-view.js'
import { ensureDocHighlightContext, refreshDocHighlight } from './highlight/doc-context.js'

function isIntroFile(name) {
  const n = String(name || '').toLowerCase()
  return n === 'readme.md' || n === 'introduction.md' || n === 'intro.md'
}

export function applyTheme(state) {
  document.documentElement.setAttribute('data-theme', state.theme)
  if (window.mermaid) {
    // Re-initialize Mermaid with the current theme
    const themeName = state.theme === 'dark' ? 'dark' : 'default'
    window.mermaid.initialize({ startOnLoad: false, theme: themeName })
    // Re-render any already-rendered Mermaid diagrams with the new theme
    try {
      const blocks = document.querySelectorAll('.md .mermaid')
      if (blocks && blocks.length) {
        blocks.forEach((el) => {
          try {
            // Use preserved source if available
            const src = el.dataset?.src || el.__mermaidSrc || null
            if (src) {
              // Reset content to original source and clear processed flag
              el.textContent = src
              el.removeAttribute('data-processed')
              // Remove any child nodes left by prior renders
              // (textContent assignment above should clear children, but be safe)
              while (el.firstChild && el.childNodes.length > 1) {
                el.removeChild(el.firstChild)
              }
            } else {
              // No preserved source; attempt to force re-processing by removing flag
              el.removeAttribute('data-processed')
            }
          } catch {}
        })
        try {
          if (window.mermaid.run) window.mermaid.run({ nodes: blocks })
          else if (window.mermaid.init) window.mermaid.init(undefined, blocks)
        } catch (e) {
          console.warn('Mermaid re-render failed', e)
        }
      }
    } catch {}
  }
}

function cacheKey(state, relPath) {
  const rootKey = state?.rootKey === 'uploads' ? 'uploads' : 'docRoot'
  const context = rootKey === 'uploads' ? 'uploads' : state?.docRootAbsolute || 'docRoot'
  return `${rootKey}@${context}::${relPath}`
}

export async function loadFileNode(state, details, node, body) {
  const key = cacheKey(state, node.path)
  if (state.cache.has(key)) return
  try {
    const rootKey = state?.rootKey === 'uploads' ? 'uploads' : 'docRoot'
    const raw = await fetchFile(node.path, rootKey)
    let contentEl
    let headings = []
    const lname = node.name.toLowerCase()
    if (lname.endsWith('.md')) {
      const out = renderMarkdown(raw, node.path)
      contentEl = out.htmlEl
      headings = out.headings
    } else if (lname.endsWith('.csv')) {
      contentEl = renderCSV(raw)
    } else {
      const language = guessLanguageFromFilename(node.name)
      const view = new CodeView({
        code: raw,
        language,
        filename: node.name,
        showCopy: true,
        showLanguage: true,
        showHeader: true,
      })
      contentEl = view.element
    }
    state.cache.set(key, { html: contentEl, headings })
    body.innerHTML = ''
    const anchor = document.createElement('a')
    anchor.id = pathAnchor(node.path)
    body.appendChild(anchor)
    body.appendChild(contentEl)
    refreshDocHighlight(state)
  } catch (e) {
    body.textContent = 'Failed to load file.'
  }
}

function formatIndex(indexPath) {
  if (!indexPath || !indexPath.length) return ''
  return `${indexPath.join('.')}. `
}

function makeNodeKey(node, depth, position) {
  if (node && typeof node.path === 'string' && node.path) return node.path
  const type = node?.type || 'node'
  const name = node?.name || ''
  return `__${depth}:${position}:${type}:${name}`
}

function saveOpenState(state) {
  try {
    localStorage.setItem('open', JSON.stringify(Array.from(state.open)))
  } catch {}
}

function handleCommentClick(e) {
  e.stopPropagation()
  const btn = e.currentTarget
  if (!btn) return
  const path = btn.dataset.path || ''
  const label = btn.dataset.label || ''
  try {
    window.parent?.postMessage?.({ type: 'addComment', path, label }, '*')
  } catch {}
}

function handleSearchClick(e) {
  e.stopPropagation()
  const btn = e.currentTarget
  if (!btn) return
  const label = btn.dataset.label || ''
  try {
    const inp = document.getElementById('search')
    if (inp && 'value' in inp) {
      inp.value = label
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.focus()
    }
  } catch {}
}

function createRowActions(node, label) {
  const actions = document.createElement('span')
  actions.className = 'row-actions'

  const btnComment = document.createElement('button')
  btnComment.className = 'act act-comment'
  btnComment.title = 'Comment'
  btnComment.setAttribute('aria-label', 'Add comment')
  btnComment.dataset.path = node.path || ''
  btnComment.dataset.label = label
  btnComment.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
  btnComment.addEventListener('click', handleCommentClick)

  const btnSearch = document.createElement('button')
  btnSearch.className = 'act act-search'
  btnSearch.title = 'Search'
  btnSearch.setAttribute('aria-label', 'Search for this item')
  btnSearch.dataset.path = node.path || ''
  btnSearch.dataset.label = label
  btnSearch.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  btnSearch.addEventListener('click', handleSearchClick)

  actions.appendChild(btnComment)
  actions.appendChild(btnSearch)
  return actions
}

function updateRowActions(actions, node, label) {
  if (!actions) return
  actions.querySelectorAll('button').forEach((btn) => {
    btn.dataset.path = node.path || ''
    btn.dataset.label = label
  })
}

function ensureDirAnchor(body, node) {
  if (!body) return
  const desiredId = 'dir-' + (node.path ? node.path.replace(/[^a-zA-Z0-9]+/g, '-') : 'root')
  let anchor = body.querySelector(':scope > a.dir-anchor')
  if (!anchor) {
    anchor = document.createElement('a')
    anchor.className = 'dir-anchor'
    body.insertBefore(anchor, body.firstChild)
  }
  anchor.id = desiredId
}

function cleanupNode(details, state) {
  if (!details) return
  const nested = details.querySelectorAll(':scope > .body details')
  nested.forEach((child) => cleanupNode(child, state))
  if (details.__fileToggleHandler) {
    details.removeEventListener('toggle', details.__fileToggleHandler)
    details.__fileToggleHandler = null
  }
  if (details.__openHandler) {
    details.removeEventListener('toggle', details.__openHandler)
    details.__openHandler = null
  }
  const path = details.__nodeData?.path
  if (path && state?.open?.has(path)) {
    state.open.delete(path)
    saveOpenState(state)
  }
}

function attachOpenState(details, state) {
  const handler = () => {
    const path = details.__nodeData?.path
    if (!path) return
    if (details.open) state.open.add(path)
    else state.open.delete(path)
    saveOpenState(state)
  }
  details.__openHandler = handler
  details.addEventListener('toggle', handler)
}

function attachFileLoader(details, state, body) {
  const handler = async () => {
    if (!details.open) return
    const meta = details.__nodeData || {}
    const node = { name: meta.name || '', path: meta.path || '', type: meta.type || 'file' }
    const key = cacheKey(state, node.path)
    if (state.cache.has(key)) {
      const cached = state.cache.get(key)
      try {
        body.innerHTML = ''
        const anchor = document.createElement('a')
        anchor.id = pathAnchor(node.path)
        body.appendChild(anchor)
        const cloned =
          cached && cached.html && typeof cached.html.cloneNode === 'function'
            ? cached.html.cloneNode(true)
            : cached.html || document.createTextNode('')
        body.appendChild(cloned)
      } catch {
        await loadFileNode(state, details, node, body)
      }
      restoreHashTarget()
      return
    }
    await loadFileNode(state, details, node, body)
    restoreHashTarget()
  }
  details.__fileToggleHandler = handler
  details.addEventListener('toggle', handler)
}

function createSummary(node, depth, indexPath) {
  const summary = document.createElement('summary')
  summary.dataset.type = node.type
  summary.dataset.path = node.path || ''
  summary.dataset.depth = String(depth)

  const indent = document.createElement('span')
  indent.className = 'indent'
  summary.appendChild(indent)

  const numbering = document.createElement('span')
  numbering.className = 'tree-numbering'
  numbering.textContent = formatIndex(indexPath)
  summary.appendChild(numbering)

  const labelSpan = document.createElement('span')
  labelSpan.className = 'tree-label'
  const label = displayName(node)
  labelSpan.textContent = label
  summary.appendChild(labelSpan)

  if (node.type === 'file') {
    const meta = document.createElement('span')
    meta.className = 'meta'
    meta.textContent = ` (${node.path})`
    summary.appendChild(meta)
  }

  const actions = createRowActions(node, label)
  summary.appendChild(actions)
  return summary
}

function updateSummary(summary, node, depth, indexPath) {
  if (!summary) return displayName(node)
  summary.dataset.type = node.type
  summary.dataset.path = node.path || ''
  summary.dataset.depth = String(depth)

  const numbering = summary.querySelector('.tree-numbering')
  if (numbering) numbering.textContent = formatIndex(indexPath)

  const label = displayName(node)
  const labelSpan = summary.querySelector('.tree-label')
  if (labelSpan) labelSpan.textContent = label

  const meta = summary.querySelector('.meta')
  if (node.type === 'file') {
    if (meta) meta.textContent = ` (${node.path})`
    else {
      const newMeta = document.createElement('span')
      newMeta.className = 'meta'
      newMeta.textContent = ` (${node.path})`
      summary.insertBefore(newMeta, summary.querySelector('.row-actions'))
    }
  } else if (meta) {
    meta.remove()
  }

  const actions = summary.querySelector('.row-actions')
  if (actions) updateRowActions(actions, node, label)
  else summary.appendChild(createRowActions(node, label))
  return label
}

function createDetailsNode(state, node, depth, indexPath, key) {
  const details = document.createElement('details')
  details.__nodeData = { path: node.path || '', name: node.name || '', type: node.type }
  details.dataset.path = details.__nodeData.path
  details.dataset.type = node.type
  details.dataset.key = key
  details.className = node.type === 'dir' ? 'dir' : 'file'
  details.style.setProperty('--depth', String(depth))

  const summary = createSummary(node, depth, indexPath)
  details.appendChild(summary)

  const body = document.createElement('div')
  body.className = 'body'
  details.appendChild(body)

  attachOpenState(details, state)

  if (node.type === 'dir') {
    ensureDirAnchor(body, node)
  } else {
    attachFileLoader(details, state, body)
  }

  if (node.path && state.open.has(node.path)) {
    details.setAttribute('open', '')
  }
  return details
}

function updateDetailsNode(state, details, node, depth, indexPath, key) {
  details.__nodeData = details.__nodeData || {}
  details.__nodeData.path = node.path || ''
  details.__nodeData.name = node.name || ''
  details.__nodeData.type = node.type
  details.dataset.path = details.__nodeData.path
  details.dataset.type = node.type
  details.dataset.key = key
  details.className = node.type === 'dir' ? 'dir' : 'file'
  details.style.setProperty('--depth', String(depth))

  const summary = details.querySelector(':scope > summary')
  updateSummary(summary, node, depth, indexPath)

  const body = details.querySelector(':scope > .body')
  if (node.type === 'dir') {
    ensureDirAnchor(body, node)
  } else if (body) {
    const dirAnchor = body.querySelector(':scope > a.dir-anchor')
    if (dirAnchor) dirAnchor.remove()
  }

  if (node.type === 'file' && !details.__fileToggleHandler) {
    attachFileLoader(details, state, body)
  }
}

function reorderRoot(children) {
  const list = Array.isArray(children) ? children.slice() : []
  const idxIntro = list.findIndex(
    (child) => child && child.type === 'file' && isIntroFile(child.name),
  )
  if (idxIntro > 0) {
    const intro = list.splice(idxIntro, 1)[0]
    list.unshift(intro)
  }
  return list
}

function syncChildren(state, parentEl, children, depth = 0, indexPath = []) {
  if (!parentEl) return
  const ordered = depth === 0 ? reorderRoot(children) : Array.isArray(children) ? children : []
  const existingDetails = Array.from(parentEl.children).filter((el) => el.tagName === 'DETAILS')
  const lookup = new Map(
    existingDetails.map((el) => {
      const key = el.dataset.key || el.dataset.path || ''
      return [key, el]
    }),
  )

  ordered.forEach((child, idx) => {
    if (!child) return
    const childIndexPath = indexPath.concat(idx + 1)
    const key = makeNodeKey(child, depth, idx)
    let details = lookup.get(key)
    if (details) {
      lookup.delete(key)
      const existingType =
        details.dataset.type || (details.classList.contains('dir') ? 'dir' : 'file')
      if (existingType !== child.type) {
        cleanupNode(details, state)
        details.remove()
        details = createDetailsNode(state, child, depth, childIndexPath, key)
      } else {
        updateDetailsNode(state, details, child, depth, childIndexPath, key)
      }
    } else {
      details = createDetailsNode(state, child, depth, childIndexPath, key)
    }

    if (child.type === 'dir') {
      const body = details.querySelector(':scope > .body')
      syncChildren(state, body, child.children || [], depth + 1, childIndexPath)
    }

    parentEl.appendChild(details)
  })

  lookup.forEach((el) => {
    cleanupNode(el, state)
    el.remove()
  })
}

export function renderTree(state, container, tree) {
  if (!state || !container || !tree) return
  const children = Array.isArray(tree.children) ? tree.children : []
  syncChildren(state, container, children, 0, [])
}

export function updateTOC(state) {
  const toc = document.getElementById('toc')
  toc.innerHTML = ''

  const structHdr = document.createElement('h3')
  structHdr.textContent = 'Structure'
  toc.appendChild(structHdr)

  const struct = document.createElement('div')
  struct.className = 'structure-nav'
  function addStruct(node, indexPath = []) {
    if (node.type === 'dir') {
      const det = document.createElement('details')
      det.open = indexPath.length <= 1
      det.dataset.path = node.path || ''
      const sum = document.createElement('summary')
      const num = indexPath.length ? indexPath.join('.') + '. ' : ''
      const label = displayName(node)
      const toggle = document.createElement('span')
      toggle.className = 'struct-toggle'
      toggle.setAttribute('aria-hidden', 'true')
      sum.appendChild(toggle)
      const a = document.createElement('a')
      a.textContent = num + label + '/'
      a.href = '#' + ('dir-' + (node.path ? node.path.replace(/[^a-zA-Z0-9]+/g, '-') : 'root'))
      a.dataset.path = node.path || ''
      a.dataset.type = 'dir'
      sum.appendChild(a)
      det.appendChild(sum)
      const container = document.createElement('div')
      const kids = (node.children || []).slice()
      // Mirror placement in TOC for root only
      if (indexPath.length === 1) {
        const i = kids.findIndex((ch) => ch.type === 'file' && isIntroFile(ch.name))
        if (i >= 0) {
          const rm = kids.splice(i, 1)[0]
          kids.splice(0, 0, rm)
        }
      }
      let idx = 1
      kids.forEach((ch) => {
        container.appendChild(addStruct(ch, indexPath.concat(idx++)))
      })
      det.appendChild(container)
      return det
    } else {
      const a = document.createElement('a')
      const num = indexPath.join('.') + '. '
      a.textContent = num + displayName(node)
      a.href = '#' + pathAnchor(node.path)
      a.style.display = 'block'
      a.style.paddingLeft = indexPath.length * 12 + 'px'
      a.dataset.path = node.path || ''
      a.dataset.type = 'file'
      return a
    }
  }
  if (state.tree?.children) {
    let idx = 1
    state.tree.children.forEach((ch) => struct.appendChild(addStruct(ch, [idx++])))
  }
  toc.appendChild(struct)

  const headHdr = document.createElement('h3')
  headHdr.textContent = 'Table of Contents'
  toc.appendChild(headHdr)
  const hnav = document.createElement('div')
  document.querySelectorAll('.md h1, .md h2, .md h3, .md h4').forEach((h) => {
    const level = parseInt(h.tagName.slice(1), 10)
    const id = h.id
    const text = (h.textContent || '').replace('¶', '').trim()
    const a = document.createElement('a')
    a.href = '#' + id
    a.textContent = text
    a.style.paddingLeft = (level - 1) * 12 + 'px'
    hnav.appendChild(a)
  })
  toc.appendChild(hnav)

  if (state && state._structureWatcher) state._structureWatcher.refresh(true)
}

export function expandCollapseAll(expand = true) {
  const treeRoot = document.getElementById('treeRoot') || document.getElementById('content')
  if (treeRoot) {
    treeRoot.querySelectorAll('details').forEach((d) => {
      const isOpen = d.hasAttribute('open')
      if (expand && !isOpen) d.setAttribute('open', '')
      if (!expand && isOpen) d.removeAttribute('open')
    })
  }
  document.querySelectorAll('#toc details').forEach((d) => {
    const isOpen = d.hasAttribute('open')
    if (expand && !isOpen) d.setAttribute('open', '')
    if (!expand && isOpen) d.removeAttribute('open')
  })
}

export function restoreState(state) {
  try {
    const saved = JSON.parse(localStorage.getItem('open') || '[]')
    state.open = new Set(saved)
  } catch {
    state.open = new Set()
  }
}

export function restoreHashTarget() {
  if (location.hash) {
    const id = location.hash.slice(1)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}

export function attachEvents(state, setDocRoot, init, applyThemeCb) {
  const on = (id, evt, fn) => {
    const el = document.getElementById(id)
    if (el && typeof el.addEventListener === 'function') el.addEventListener(evt, fn)
    return el
  }
  on('themeToggle', 'click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', state.theme)
    applyThemeCb()
  })
  on('expandAll', 'click', () => expandCollapseAll(true))
  on('collapseAll', 'click', () => expandCollapseAll(false))
  on('printBtn', 'click', () => window.print())
  on('selectDirBtn', 'click', async () => {
    try {
      const current =
        (
          await fetch('/api/config')
            .then((r) => r.json())
            .catch(() => ({}))
        ).docRoot || ''
      const val = prompt('Enter docs directory path (absolute or relative to server):', current)
      if (!val) return
      await setDocRoot(val)
      await init(true)
    } catch (e) {
      alert(e.message || 'Failed to set directory')
    }
  })

  const search = document.getElementById('search')
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) {
      e.preventDefault()
      search && search.focus && search.focus()
    }
  })
  if (search && typeof search.addEventListener === 'function')
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase()
      const scope = document.getElementById('treeRoot') || document.getElementById('content')
      if (!scope) return
      scope.querySelectorAll('details').forEach((d) => {
        const title = d.querySelector('summary')?.textContent?.toLowerCase() || ''
        const match = !q || title.includes(q)
        d.classList.toggle('hidden', !match)
      })
    })
  window.addEventListener('hashchange', restoreHashTarget)

  // Expand all for print and restore after
  let prevOpen = []
  window.addEventListener('beforeprint', () => {
    const scope = document.getElementById('treeRoot') || document.getElementById('content')
    prevOpen = scope ? Array.from(scope.querySelectorAll('details[open]')) : []
    expandCollapseAll(true)
  })
  window.addEventListener('afterprint', () => {
    const scope = document.getElementById('treeRoot') || document.getElementById('content')
    if (scope) scope.querySelectorAll('details').forEach((d) => d.removeAttribute('open'))
    prevOpen.forEach((d) => d.setAttribute('open', ''))
  })

  ensureDocHighlightContext(state)
  refreshDocHighlight(state)

  if (!state._structureWatcher) state._structureWatcher = createStructureWatcher(state)
  else state._structureWatcher.refresh(true)
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const item of a) if (!b.has(item)) return false
  return true
}

function createStructureWatcher(state) {
  const content = document.getElementById('content')
  const tocRoot = document.querySelector('nav .toc')
  if (!content || !tocRoot) return null

  const watcher = {
    content,
    tocRoot,
    links: [],
    lastActive: new Set(),
    ignoreHashClearUntil: 0,
    refresh(force = false) {
      this.links = Array.from(this.tocRoot.querySelectorAll('a[data-path]'))
      if (force) this.lastActive = new Set()
      this.updateActive(true)
    },
    updateActive(force = false) {
      const contentRect = this.content.getBoundingClientRect()
      const top = contentRect.top
      const bottom = contentRect.bottom
      const anchorOffset = Math.min(Math.max(contentRect.height * 0.15, 56), 200)
      const anchorY = Math.max(top, Math.min(bottom - 20, top + anchorOffset))
      const visible = new Set()
      const details = this.content.querySelectorAll('details[data-path]')
      details.forEach((det) => {
        const path = det.dataset?.path || ''
        const summary = det.querySelector(':scope > summary')
        if (!summary) return
        const hidden = det.classList?.contains('hidden') || summary.offsetParent === null
        let isVisible = false
        if (!hidden) {
          const sectionRect = det.getBoundingClientRect()
          const summaryRect = summary.getBoundingClientRect()
          const intersectsAnchor = sectionRect.top <= anchorY && sectionRect.bottom >= anchorY
          const summaryInView = summaryRect.bottom >= top && summaryRect.top <= bottom
          isVisible = intersectsAnchor || summaryInView
        }
        summary.classList.toggle('is-visible', isVisible && !!path)
        if (isVisible && path) visible.add(path)
      })
      const changed = force || !setsEqual(this.lastActive, visible)
      if (changed) {
        this.links.forEach((link) => {
          const path = link.dataset?.path || ''
          const isActive = !!path && visible.has(path)
          link.classList.toggle('is-active', isActive)
          const parent = link.parentElement
          if (parent && parent.tagName === 'SUMMARY') parent.classList.toggle('is-active', isActive)
          else if (parent && parent !== this.tocRoot) parent.classList.toggle('is-active', isActive)
        })
        if (visible.size) {
          const firstActive = this.links.find((link) => visible.has(link.dataset?.path || ''))
          if (firstActive) {
            try {
              firstActive.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            } catch {}
          }
        }
        this.lastActive = new Set(visible)
      }
    },
  }

  const handleScroll = () => {
    watcher.updateActive()
    if (location.hash && Date.now() > watcher.ignoreHashClearUntil) {
      try {
        history.replaceState(null, '', location.pathname + location.search)
      } catch {}
    }
  }

  content.addEventListener('scroll', handleScroll, { passive: true })
  tocRoot.addEventListener('click', (e) => {
    const link =
      e.target && typeof e.target.closest === 'function' ? e.target.closest('a[data-path]') : null
    if (link) watcher.ignoreHashClearUntil = Date.now() + 800
  })
  tocRoot.addEventListener('toggle', () => watcher.updateActive(true), true)
  window.addEventListener('resize', () => watcher.updateActive(true))

  watcher.refresh(true)

  return watcher
}
