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
  details.appendChild(sum)
  const body = document.createElement('div')
  body.className = 'body'
  details.appendChild(body)

  if (node.type === 'dir') {
    const dirAnchor = document.createElement('a')
    dirAnchor.id = 'dir-' + (node.path ? node.path.replace(/[^a-zA-Z0-9]+/g, '-') : 'root')
    body.appendChild(dirAnchor)

    const children = (node.children || []).slice()
    // For every directory, ensure Introduction/README appears first
    {
      const idxIntro = children.findIndex((ch) => ch.type === 'file' && isIntroFile(ch.name))
      if (idxIntro >= 0) {
        const intro = children.splice(idxIntro, 1)[0]
        children.splice(0, 0, intro)
      }
    }
    let idx = 1
    children.forEach((child) => {
      const childEl = buildNode(state, child, depth + 1, indexPath.concat(idx++))
      // Auto-expand and preload Introduction/README everywhere
      if (child.type === 'file' && isIntroFile(child.name)) {
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
      // Mirror placement in TOC for every directory
      {
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
}
