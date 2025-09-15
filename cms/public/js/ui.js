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
    window.mermaid.initialize({ startOnLoad: false, theme: state.theme === 'dark' ? 'dark' : 'default' })
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
  btnComment.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
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
  btnSearch.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
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
        if (details.open && !state.cache.has(node.path)) {
          await loadFileNode(state, details, node, body)
          restoreHashTarget()
        }
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
  function addStruct(node, indexPath = []) {
    if (node.type === 'dir') {
      const det = document.createElement('details')
      det.open = indexPath.length <= 1
      const sum = document.createElement('summary')
      const num = indexPath.length ? indexPath.join('.') + '. ' : ''
      const label = displayName(node)
      const a = document.createElement('a')
      a.textContent = num + label + '/'
      a.href = '#' + ('dir-' + (node.path ? node.path.replace(/[^a-zA-Z0-9]+/g, '-') : 'root'))
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
}

export function expandCollapseAll(expand = true) {
  document.querySelectorAll('#content details, #toc details').forEach((d) => {
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
    document.querySelectorAll('#content details').forEach((d) => {
      const title = d.querySelector('summary')?.textContent?.toLowerCase() || ''
      const match = !q || title.includes(q)
      d.classList.toggle('hidden', !match)
    })
  })
  window.addEventListener('hashchange', restoreHashTarget)

  // Expand all for print and restore after
  let prevOpen = []
  window.addEventListener('beforeprint', () => {
    prevOpen = Array.from(document.querySelectorAll('#content details[open]'))
    expandCollapseAll(true)
  })
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('#content details').forEach((d) => d.removeAttribute('open'))
    prevOpen.forEach((d) => d.setAttribute('open', ''))
  })

  // Floating hover actions for highlighted elements (headings, lines, TOC links)
  initHoverActions()
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
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
  )
  const btnSearch = mkBtn(
    'act-search',
    'Search',
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  )
  overlay.appendChild(btnComment)
  overlay.appendChild(btnSearch)
  document.body.appendChild(overlay)

  let anchorEl = null
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

  const selector = [
    '#content summary',
    '#content .md p', '#content .md li', '#content .md pre',
    '#content .md h1', '#content .md h2', '#content .md h3', '#content .md h4',
    'nav .toc a'
  ].join(', ')

  function placeOverlay(el) {
    anchorEl = el
    overlay.style.display = 'inline-flex'
    // Place on same baseline (vertical center) and right aligned to element box
    const rect = el.getBoundingClientRect()
    const ow = overlay.offsetWidth || 40
    const oh = overlay.offsetHeight || 22
    const top = Math.round(rect.top + (rect.height - oh) / 2)
    const left = Math.round(Math.min(rect.right - ow - 8, window.innerWidth - ow - 8))
    overlay.style.top = top + 'px'
    overlay.style.left = left + 'px'
  }
  function hideOverlay() { overlay.style.display = 'none'; anchorEl = null }
  document.addEventListener('mouseover', (e) => {
    const t = e.target
    const el = t && typeof t.closest === 'function' ? t.closest(selector) : (t && t.parentElement ? t.parentElement.closest(selector) : null)
    if (el) placeOverlay(el)
  })
  document.addEventListener('mousemove', (e) => {
    if (!anchorEl) return
    const t = e.target
    const within = t && typeof t.closest === 'function' ? (t.closest(selector) === anchorEl) : false
    if (!within) return
    placeOverlay(anchorEl)
  })
  document.addEventListener('scroll', () => { if (anchorEl) placeOverlay(anchorEl) }, true)
  window.addEventListener('resize', () => { if (anchorEl) placeOverlay(anchorEl) })
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
