import { displayName, pathAnchor } from './utils.js'
import { fetchFile } from './api.js'
import { renderMarkdown, renderCSV } from './renderers.js'

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

export async function loadFileNode(state, details, node, body) {
  if (state.cache.has(node.path)) return
  try {
    const raw = await fetchFile(node.path)
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
      contentEl = document.createElement('pre')
      contentEl.textContent = raw
    }
    state.cache.set(node.path, { html: contentEl, headings })
    body.innerHTML = ''
    const anchor = document.createElement('a')
    anchor.id = pathAnchor(node.path)
    body.appendChild(anchor)
    body.appendChild(contentEl)
  } catch (e) {
    body.textContent = 'Failed to load file.'
  }
}

export function buildNode(state, node, depth = 0, indexPath = []) {
  const details = document.createElement('details')
  details.className = node.type === 'dir' ? 'dir' : 'file'
  details.style.setProperty('--depth', String(depth))
  details.dataset.path = node.path
  const sum = document.createElement('summary')
  const label = displayName(node)
  const num = indexPath.length ? indexPath.join('.') + '. ' : ''
  sum.innerHTML = '<span class="indent"></span>' + num + label + (node.type === 'file' ? ' <span class="meta">(' + node.path + ')</span>' : '')
  // Floating actions on the same baseline as the highlighted line
  const actions = document.createElement('span')
  actions.className = 'row-actions'
  const btnComment = document.createElement('button')
  btnComment.className = 'act act-comment'
  btnComment.title = 'Comment'
  btnComment.setAttribute('aria-label', 'Add comment')
  btnComment.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
  btnComment.addEventListener('click', (e) => {
    e.stopPropagation()
    try {
      window.parent?.postMessage?.({ type: 'addComment', path: node.path, label }, '*')
    } catch {}
  })
  const btnSearch = document.createElement('button')
  btnSearch.className = 'act act-search'
  btnSearch.title = 'Search'
  btnSearch.setAttribute('aria-label', 'Search for this item')
  btnSearch.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  btnSearch.addEventListener('click', (e) => {
    e.stopPropagation()
    try {
      const inp = document.getElementById('search')
      if (inp && 'value' in inp) {
        inp.value = label
        inp.dispatchEvent(new Event('input', { bubbles: true }))
        inp.focus()
      }
    } catch {}
  })
  actions.appendChild(btnComment)
  actions.appendChild(btnSearch)
  sum.appendChild(actions)
  details.appendChild(sum)
  const body = document.createElement('div')
  body.className = 'body'
  details.appendChild(body)

  if (node.type === 'dir') {
    const dirAnchor = document.createElement('a')
    dirAnchor.id = 'dir-' + (node.path ? node.path.replace(/[^a-zA-Z0-9]+/g, '-') : 'root')
    body.appendChild(dirAnchor)

    const children = (node.children || []).slice()
    // Root only: ensure Introduction/README appears first
    if (depth === 0) {
      const idxIntro = children.findIndex((ch) => ch.type === 'file' && isIntroFile(ch.name))
      if (idxIntro >= 0) {
        const intro = children.splice(idxIntro, 1)[0]
        children.splice(0, 0, intro)
      }
    }
    let idx = 1
    children.forEach((child) => {
      const childEl = buildNode(state, child, depth + 1, indexPath.concat(idx++))
      // Auto-expand and preload Introduction/README at root only
      if (depth === 0 && child.type === 'file' && isIntroFile(child.name)) {
        childEl.setAttribute('open', '')
        const childBody = childEl.querySelector('.body')
        loadFileNode(state, childEl, child, childBody)
      }
      body.appendChild(childEl)
    })
  } else {
    details.addEventListener(
      'toggle',
      async () => {
        if (!details.open) return
        if (state.cache.has(node.path)) {
          const cached = state.cache.get(node.path)
          try {
            body.innerHTML = ''
            const anchor = document.createElement('a')
            anchor.id = pathAnchor(node.path)
            body.appendChild(anchor)
            // Use a cloned node to avoid detaching existing instances
            const cloned = cached && cached.html && typeof cached.html.cloneNode === 'function'
              ? cached.html.cloneNode(true)
              : cached.html || document.createTextNode('')
            body.appendChild(cloned)
          } catch {
            // Fallback to reload if cloning/rendering fails
            await loadFileNode(state, details, node, body)
          }
          restoreHashTarget()
          return
        }
        await loadFileNode(state, details, node, body)
        restoreHashTarget()
      },
      { once: false },
    )
  }

  details.addEventListener('toggle', () => {
    const p = node.path
    if (details.open) state.open.add(p)
    else state.open.delete(p)
    localStorage.setItem('open', JSON.stringify(Array.from(state.open)))
  })
  if (state.open.has(node.path)) details.setAttribute('open', '')
  return details
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
      const current = (await fetch('/api/config').then((r) => r.json()).catch(() => ({}))).docRoot || ''
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
  if (search && typeof search.addEventListener === 'function') search.addEventListener('input', () => {
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

  // Floating hover actions for highlighted elements (headings, lines, TOC links)
  initHoverActions()

  if (!state._structureWatcher) state._structureWatcher = createStructureWatcher(state)
  else state._structureWatcher.refresh(true)
}

function initHoverActions() {
  const overlay = document.createElement('div')
  overlay.className = 'hover-actions'
  overlay.setAttribute('aria-hidden', 'true')
  const mkBtn = (cls, title, svg) => {
    const b = document.createElement('button')
    b.className = 'act ' + cls
    b.title = title
    b.setAttribute('aria-label', title)
    b.innerHTML = svg
    b.addEventListener('mousedown', (e) => e.preventDefault())
    return b
  }
  const btnComment = mkBtn(
    'act-comment',
    'Comment',
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
  )
  const btnSearch = mkBtn(
    'act-search',
    'Search',
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  )
  overlay.appendChild(btnComment)
  overlay.appendChild(btnSearch)

  let anchorEl = null
  let anchorHadPosition = ''
  let showTimer = null
  let hideTimer = null
  let initialLeft = null
  let isShown = false
  function labelFor(el) {
    try { return (el.textContent || '').trim().slice(0, 200) } catch { return '' }
  }
  function sendComment(el) {
    const label = labelFor(el)
    try { window.parent?.postMessage?.({ type: 'addComment', path: el?.id || '', label }, '*') } catch {}
  }
  function performSearch(el) {
    const label = labelFor(el)
    const inp = document.getElementById('search')
    if (inp && 'value' in inp) {
      inp.value = label
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.focus()
    }
  }
  btnComment.addEventListener('click', (e) => { e.stopPropagation(); if (anchorEl) sendComment(anchorEl) })
  btnSearch.addEventListener('click', (e) => { e.stopPropagation(); if (anchorEl) performSearch(anchorEl) })

  // Exclude '#content summary' to avoid duplicate icons on file titles;
  // summaries already render embedded .row-actions.
  const treeScope = document.getElementById('treeRoot') ? '#treeRoot' : '#content'
  const selector = [
    `${treeScope} .md p`, `${treeScope} .md li`, `${treeScope} .md pre`,
    `${treeScope} .md h1`, `${treeScope} .md h2`, `${treeScope} .md h3`, `${treeScope} .md h4`,
    'nav .toc a'
  ].join(', ')

  function ensureOverlayParent(el) {
    if (overlay.parentElement !== el) {
      // Restore prior anchor position if we modified it
      if (anchorEl && anchorHadPosition) {
        anchorEl.style.position = anchorHadPosition
      }
      // Ensure el is positioning context
      const cs = window.getComputedStyle(el)
      anchorHadPosition = el.style.position
      if (cs.position === 'static') {
        el.style.position = 'relative'
      }
      el.appendChild(overlay)
    }
  }

  function placeOverlay(el, mouseX) {
    // If we're already showing for this element, do nothing
    if ((isShown || showTimer) && anchorEl === el) return
    anchorEl = el
    ensureOverlayParent(el)
    // Prepare for static positioning and delayed fade-in
    overlay.classList.remove('show')
    if (showTimer) { clearTimeout(showTimer); showTimer = null }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    overlay.style.top = '50%'
    overlay.style.transform = 'translateY(-50%)'
    // Compute initial horizontal placement near the mouse, clamped within element
    const ow = overlay.offsetWidth || 40
    const rect = el.getBoundingClientRect()
    const maxLeft = Math.max(8, el.clientWidth - ow - 8)
    if (typeof mouseX === 'number') {
      const rel = Math.max(8, Math.min(Math.round(mouseX - rect.left + 16), maxLeft))
      initialLeft = rel
      overlay.style.left = rel + 'px'
      overlay.style.right = 'auto'
    } else if (initialLeft != null) {
      const rel = Math.max(8, Math.min(initialLeft, maxLeft))
      overlay.style.left = rel + 'px'
      overlay.style.right = 'auto'
    } else {
      overlay.style.left = 'auto'
      overlay.style.right = '8px'
    }
    // Fade in after the highlight animation completes
    showTimer = setTimeout(() => {
      // Faster fade-in
      overlay.style.setProperty('--hover-fade', '120ms')
      overlay.classList.add('show')
      isShown = true
    }, 120)
  }
  function cleanupOverlay() {
    // Restore anchor inline position if we modified it
    if (anchorEl && anchorHadPosition) {
      anchorEl.style.position = anchorHadPosition
    }
    anchorEl = null
    anchorHadPosition = ''
    initialLeft = null
    isShown = false
  }
  function hideOverlay() {
    if (!isShown && !showTimer) return
    if (showTimer) { clearTimeout(showTimer); showTimer = null }
    // Slow fade-out; keep position static until it completes
    overlay.style.setProperty('--hover-fade', '450ms')
    overlay.classList.remove('show')
    isShown = false
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = null
      cleanupOverlay()
    }, 470)
  }
  document.addEventListener('mouseover', (e) => {
    const t = e.target
    const el = t && typeof t.closest === 'function' ? t.closest(selector) : (t && t.parentElement ? t.parentElement.closest(selector) : null)
    if (el) placeOverlay(el, e.clientX)
  })
  // No mouse-following; overlay remains static until hover ends
  document.addEventListener('mouseout', (e) => {
    if (!anchorEl) return
    const toEl = e.relatedTarget || null
    const inAnchor = toEl && typeof toEl.closest === 'function' && toEl.closest(selector) === anchorEl
    const inOverlay = toEl && typeof toEl.closest === 'function' && !!toEl.closest('.hover-actions')
    if (!inAnchor && !inOverlay) {
      hideOverlay()
    }
  })
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
      const visible = new Set()
      const details = this.content.querySelectorAll('details[data-path]')
      details.forEach((det) => {
        const path = det.dataset?.path || ''
        const summary = det.querySelector(':scope > summary')
        if (!summary) return
        const hidden = det.classList?.contains('hidden') || summary.offsetParent === null
        let isVisible = false
        if (!hidden) {
          const rect = summary.getBoundingClientRect()
          isVisible = rect.bottom >= top && rect.top <= bottom
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
    const link = e.target && typeof e.target.closest === 'function' ? e.target.closest('a[data-path]') : null
    if (link) watcher.ignoreHashClearUntil = Date.now() + 800
  })
  tocRoot.addEventListener('toggle', () => watcher.updateActive(true), true)
  window.addEventListener('resize', () => watcher.updateActive(true))

  watcher.refresh(true)

  return watcher
}
