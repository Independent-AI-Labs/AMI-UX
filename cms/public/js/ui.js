import { displayName, pathAnchor } from './utils.js'
import { fetchFile } from './api.js'
import { resolveFileView, getFallbackFileView } from './file-view-registry.js'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'

const DOM_NODE = typeof Node === 'function' ? Node : null

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

function normaliseHeadings(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (value instanceof Set) return Array.from(value)
  return []
}

function resolveElementFromResult(result) {
  if (!result) return null
  if (DOM_NODE && result.element instanceof DOM_NODE) return result.element
  if (DOM_NODE && result.htmlEl instanceof DOM_NODE) return result.htmlEl
  if (DOM_NODE && result.html instanceof DOM_NODE) return result.html
  if (typeof result.html === 'string') {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = result.html
    return wrapper
  }
  if (typeof result.text === 'string') return document.createTextNode(result.text)
  return null
}

async function renderWithView(view, providedContent, baseContext) {
  if (!view || typeof view.render !== 'function') return null
  try {
    const result = await view.render({
      ...baseContext,
      view,
      content: providedContent,
    })
    const element = resolveElementFromResult(result)
    if (!element) return null
    const headings = normaliseHeadings(result?.headings || result?.toc)
    const cleanup = typeof result?.cleanup === 'function' ? result.cleanup : null
    return {
      element,
      headings,
      cleanup,
      viewId: view.id || 'unknown',
      raw: result,
    }
  } catch (err) {
    console.warn('File view render failed', view?.id, err)
    return null
  }
}

async function ensureFileContent(state, node) {
  if (!node || !node.path) return null
  const key = cacheKey(state, node.path)
  if (state.cache.has(key)) {
    return state.cache.get(key)
  }
  try {
    const rootKey = state?.rootKey === 'uploads' ? 'uploads' : 'docRoot'
    const { view, meta } = resolveFileView(node)
    const primaryFormat = view?.contentFormat === 'manual' ? null : view?.contentFormat || 'text'
    const fetchForFormat = (format) => fetchFile(node.path, rootKey, { format })
    let primaryContent = null
    if (primaryFormat) primaryContent = await fetchForFormat(primaryFormat)

    const baseContext = {
      state,
      node,
      meta,
      rootKey,
      fetchContent: (format = 'text') => fetchForFormat(format),
    }

    let rendered = await renderWithView(view, primaryContent, baseContext)
    if (!rendered) {
      const fallback = getFallbackFileView()
      if (fallback !== view) {
        const fallbackFormat = fallback?.contentFormat === 'manual' ? null : fallback?.contentFormat || 'text'
        let fallbackContent = primaryContent
        if (fallbackFormat && fallbackFormat !== primaryFormat) {
          fallbackContent = await fetchForFormat(fallbackFormat)
        } else if (fallbackFormat && fallbackContent == null) {
          fallbackContent = await fetchForFormat(fallbackFormat)
        }
        rendered = await renderWithView(fallback, fallbackContent, baseContext)
      }
    }

    if (!rendered) throw new Error('Failed to render file view for ' + (node.path || node.name || ''))

    const entry = {
      html: rendered.element,
      headings: rendered.headings,
      viewId: rendered.viewId,
      meta,
    }
    if (rendered.cleanup) entry.cleanup = rendered.cleanup
    state.cache.set(key, entry)
    return entry
  } catch (e) {
    console.warn('Failed to build file content', e)
    throw e
  }
}

export async function preloadFileContent(state, node) {
  if (!state || !node) return null
  try {
    const entry = await ensureFileContent(state, node)
    if (entry && node.path) state.activePath = node.path || ''
    return entry
  } catch (e) {
    return null
  }
}

export async function loadFileNode(state, details, node, body) {
  if (!details || !body || !node) return
  const label = node?.name ? `Loading ${displayName(node)}…` : 'Loading document…'
  const releaseLoading =
    typeof state?.beginDocumentLoading === 'function'
      ? state.beginDocumentLoading(label)
      : () => {}
  try {
    const entry = await ensureFileContent(state, node)
    if (!entry) return
    const { html } = entry
    state.activePath = node.path || ''
    body.innerHTML = ''
    const anchor = document.createElement('a')
    anchor.id = pathAnchor(node.path)
    body.appendChild(anchor)
    const cloned =
      html && typeof html.cloneNode === 'function' ? html.cloneNode(true) : html || document.createTextNode('')
    body.appendChild(cloned)
    updateTOC(state)
    if (state._structureWatcher) {
      try {
        state._structureWatcher.refresh(true)
      } catch {}
    }
  } catch (e) {
    body.textContent = 'Failed to load file.'
  } finally {
    if (typeof releaseLoading === 'function') {
      try {
        releaseLoading()
      } catch {}
    }
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
      let releaseLoading = null
      try {
        if (typeof state.beginDocumentLoading === 'function') {
          releaseLoading = state.beginDocumentLoading(`Loading ${displayName(node)}…`)
        }
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
          if (typeof releaseLoading === 'function') releaseLoading()
          await loadFileNode(state, details, node, body)
          return
        }
        state.activePath = node.path || ''
        restoreHashTarget()
        updateTOC(state)
        if (state._structureWatcher) {
          try {
            state._structureWatcher.refresh(true)
          } catch {}
        }
      } finally {
        if (typeof releaseLoading === 'function') releaseLoading()
      }
      return
    }
    await loadFileNode(state, details, node, body)
    state.activePath = node.path || ''
    restoreHashTarget()
    updateTOC(state)
  }
  details.__fileToggleHandler = handler
  details.addEventListener('toggle', handler)
}

function createSummary(node, depth, indexPath) {
  const summary = document.createElement('summary')
  summary.dataset.type = node.type
  summary.dataset.path = node.path || ''
  summary.dataset.depth = String(depth)

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
  return summary
}

function updateSummary(summary, node, depth, indexPath) {
  if (!summary) return displayName(node)
  summary.dataset.type = node.type
  summary.dataset.path = node.path || ''
  summary.dataset.depth = String(depth)

  const existingIndent = summary.querySelector('.indent')
  if (existingIndent) existingIndent.remove()

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
      const labelEl = summary.querySelector('.tree-label')
      if (labelEl && labelEl.nextSibling) {
        summary.insertBefore(newMeta, labelEl.nextSibling)
      } else {
        summary.appendChild(newMeta)
      }
    }
  } else if (meta) {
    meta.remove()
  }
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
    try {
      Object.defineProperty(child, '__indexPath', {
        value: childIndexPath,
        enumerable: false,
        configurable: true,
        writable: true,
      })
    } catch {
      try {
        child.__indexPath = childIndexPath
      } catch {}
    }
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

function ensureTocProgress(state) {
  if (!state) return null
  if (state._tocProgress && state._tocProgress.ownerDocument === document) return state._tocProgress
  const progress = document.createElement('div')
  progress.className = 'toc-progress'
  progress.setAttribute('aria-hidden', 'true')
  const iconWrap = document.createElement('span')
  iconWrap.className = 'toc-progress__icon'
  iconWrap.innerHTML = iconMarkup('loader-4-line', { spin: true, label: 'Updating table of contents' })
  const label = document.createElement('span')
  label.className = 'toc-progress__label'
  label.textContent = 'Updating…'
  progress.appendChild(iconWrap)
  progress.appendChild(label)
  state._tocProgress = progress
  return progress
}

function rebuildTOC(state, progress) {
  const toc = document.getElementById('toc')
  if (!toc) return

  if (!state._structureOpen || !(state._structureOpen instanceof Set)) {
    state._structureOpen = new Set()
  }
  const openMemory = state._structureOpen
  const previousNav = toc.querySelector('.structure-nav')
  if (previousNav) {
    previousNav.querySelectorAll('details').forEach((det) => {
      const key = det.dataset.structureKey || det.dataset.path || ''
      if (!key) return
      if (det.hasAttribute('open')) openMemory.add(key)
      else openMemory.delete(key)
    })
  }

  toc.innerHTML = ''

  const structHdr = document.createElement('h3')
  structHdr.textContent = 'Structure'
  toc.appendChild(structHdr)

  const struct = document.createElement('div')
  struct.className = 'structure-nav'

  const structIndexPath = (node, fallback = []) => {
    if (node && Array.isArray(node.__indexPath)) return node.__indexPath
    return fallback
  }

  const renderStructToggle = (el, open = false) => {
    if (!el) return
    const iconName = open ? 'subtract-line' : 'add-line'
    el.innerHTML = iconMarkup(iconName, { size: 16 })
  }

  const structKeyFor = (node, indexPath = []) => {
    const path = node.path || ''
    if (path) return `p:${path}`
    if (indexPath.length) return `i:${indexPath.join('.')}`
    return 'root'
  }

  const addStruct = (node, providedIndexPath = []) => {
    if (node.type === 'dir') {
      const det = document.createElement('details')
      const indexPath = structIndexPath(node, providedIndexPath)
      const key = structKeyFor(node, indexPath)
      det.dataset.structureKey = key
      det.dataset.indexPath = indexPath.join('.')
      const remembered = openMemory.has(key)
      const shouldDefaultOpen = indexPath.length <= 1
      det.open = remembered || (!remembered && shouldDefaultOpen)
      det.dataset.path = node.path || ''
      const sum = document.createElement('summary')
      const depth = Math.max(indexPath.length - 1, 0)
      const baseIndent = 32
      const indent = baseIndent + depth * 18
      sum.style.setProperty('--struct-indent', `${indent}px`)
      const num = indexPath.length ? indexPath.join('.') + '. ' : ''
      const label = displayName(node)
      const toggle = document.createElement('span')
      toggle.className = 'struct-toggle'
      toggle.style.setProperty('--struct-toggle-offset', `${Math.max(indent - 20, 12)}px`)
      toggle.setAttribute('aria-hidden', 'true')
      sum.appendChild(toggle)
      const a = document.createElement('a')
      a.textContent = num + label + '/'
      a.href = '#' + ('dir-' + (node.path ? node.path.replace(/[^a-zA-Z0-9]+/g, '-') : 'root'))
      a.dataset.path = node.path || ''
      a.dataset.type = 'dir'
      a.style.setProperty('--struct-indent', `${indent + 8}px`)
      sum.appendChild(a)
      det.appendChild(sum)
      const setToggleState = () => {
        renderStructToggle(toggle, det.hasAttribute('open'))
        if (key) {
          if (det.hasAttribute('open')) openMemory.add(key)
          else openMemory.delete(key)
        }
      }
      det.__structToggle = toggle
      det.__structToggleUpdate = setToggleState
      setToggleState()
      det.addEventListener('toggle', setToggleState)
      const container = document.createElement('div')
      const kids = Array.isArray(node.children) ? node.children : []
      let idx = 1
      kids.forEach((ch) => {
        const childIndexPath = structIndexPath(ch, indexPath.concat(idx))
        container.appendChild(addStruct(ch, childIndexPath))
        idx += 1
      })
      det.appendChild(container)
      return det
    }
    const a = document.createElement('a')
    const indexPath = structIndexPath(node, providedIndexPath)
    const num = indexPath.length ? indexPath.join('.') + '. ' : ''
    a.textContent = num + displayName(node)
    a.href = '#' + pathAnchor(node.path)
    a.style.display = 'block'
    const depth = Math.max(indexPath.length - 1, 0)
    const baseIndent = 32
    const indent = baseIndent + depth * 18
    a.style.setProperty('--struct-indent', `${indent}px`)
    a.dataset.path = node.path || ''
    a.dataset.type = 'file'
    return a
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
  hnav.className = 'toc-headings'
  const headingScope = document.getElementById('treeRoot') || document.getElementById('content')
  const headingNodes = headingScope
    ? Array.from(
        headingScope.querySelectorAll(
          '.md h1, .md h2, .md h3, .md h4, .html-document h1, .html-document h2, .html-document h3, .html-document h4',
        ),
      )
    : []

  headingNodes
    .filter((node) => {
      const details = node.closest('details.file')
      if (!details) return false
      const path = details.dataset?.path || ''
      const isActiveFile = state && state.activePath && state.activePath === path
      if (!details.hasAttribute('open') && !isActiveFile) return false
      if (details.classList?.contains('hidden')) return false
      return true
    })
    .forEach((h) => {
      const id = h.id
      if (!id) return
      const text = (h.textContent || '').replace('¶', '').trim()
      if (!text) return
      const a = document.createElement('a')
      a.href = '#' + id
      a.textContent = text
      a.style.paddingLeft = '0px'
      hnav.appendChild(a)
    })

  if (!hnav.childElementCount && state?.activePath) {
    const key = cacheKey(state, state.activePath)
    const cached = state.cache.get(key)
    const headings = cached?.headings || []
    headings.forEach((item) => {
      if (!item || !item.id || !item.text) return
      const a = document.createElement('a')
      a.href = '#' + item.id
      a.textContent = item.text
      a.style.paddingLeft = '0px'
      hnav.appendChild(a)
    })
  }

  if (progress) hnav.appendChild(progress)
  toc.appendChild(hnav)

  if (state && state._structureWatcher) state._structureWatcher.refresh(true)
}

export function updateTOC(state) {
  if (!state) return
  const toc = document.getElementById('toc')
  if (!toc) return

  const progress = ensureTocProgress(state)
  if (progress) {
    progress.classList.add('is-active')
    progress.setAttribute('aria-hidden', 'false')
    if (!progress.parentElement) toc.appendChild(progress)
  }

  if (state._tocUpdateScheduled) return
  state._tocUpdateScheduled = true

  const run = () => {
    state._tocUpdateScheduled = false
    rebuildTOC(state, progress)
    if (progress) {
      progress.classList.remove('is-active')
      progress.setAttribute('aria-hidden', 'true')
    }
  }

  const execute = () => {
    if (typeof Promise !== 'undefined') Promise.resolve().then(run)
    else run()
  }

  if (typeof window !== 'undefined') {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => execute(), { timeout: 160 })
      return
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => execute())
      return
    }
  }
  setTimeout(() => execute(), 0)
}

export function expandCollapseAll(expand = true) {
  const treeRoot = document.getElementById('treeRoot') || document.getElementById('content')
  if (treeRoot) {
    treeRoot.querySelectorAll('details').forEach((d) => {
      const isOpen = d.hasAttribute('open')
      if (expand && !isOpen) d.setAttribute('open', '')
      if (!expand && isOpen) d.removeAttribute('open')
      if (typeof d.__structToggleUpdate === 'function') d.__structToggleUpdate()
    })
  }
  document.querySelectorAll('#toc details').forEach((d) => {
    const isOpen = d.hasAttribute('open')
    if (expand && !isOpen) d.setAttribute('open', '')
    if (!expand && isOpen) d.removeAttribute('open')
    if (typeof d.__structToggleUpdate === 'function') d.__structToggleUpdate()
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

  const boundTreeFilters = new Set()
  const applyTreeFilter = (rawValue = '', origin = null) => {
    const value = String(rawValue || '')
    state.treeFilterValue = value
    boundTreeFilters.forEach((input) => {
      if (!input || input === origin) return
      if (input.value !== value) input.value = value
    })
    const scope = document.getElementById('treeRoot') || document.getElementById('content')
    if (!scope) return
    const query = value.toLowerCase()
    scope.querySelectorAll('details').forEach((d) => {
      const title = d.querySelector('summary')?.textContent?.toLowerCase() || ''
      const match = !query || title.includes(query)
      d.classList.toggle('hidden', !match)
    })
  }
  const bindTreeFilterInput = (input) => {
    if (!input || typeof input.addEventListener !== 'function' || boundTreeFilters.has(input)) return
    const handler = (event) => {
      const value = event?.target?.value ?? ''
      applyTreeFilter(value, input)
    }
    input.addEventListener('input', handler)
    input.addEventListener('change', handler)
    boundTreeFilters.add(input)
    if (state.treeFilterValue) {
      if (input.value !== state.treeFilterValue) input.value = state.treeFilterValue
      requestAnimationFrame(() => applyTreeFilter(state.treeFilterValue, input))
    }
  }
  state.registerTreeFilterInput = (input) => bindTreeFilterInput(input)
  state.applyTreeFilter = (value) => applyTreeFilter(value, null)

  const search = document.getElementById('search')
  bindTreeFilterInput(search)
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) {
      e.preventDefault()
      if (search && typeof search.focus === 'function') search.focus()
    }
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

  if (!state._structureWatcher) state._structureWatcher = createStructureWatcher(state)
  else state._structureWatcher.refresh(true)
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const item of a) if (!b.has(item)) return false
  return true
}

function createStructureWatcher(state) {
  const doc = document
  const tocRoot = doc.querySelector('nav .toc')
  const fallbackContent = doc.getElementById('content')
  if (!tocRoot || !fallbackContent) return null

  void state

  const ownerDoc = fallbackContent.ownerDocument || document
  const defaultView = ownerDoc.defaultView || window

  const resolveTreeRoot = () => ownerDoc.getElementById('treeRoot')
  const resolveContainer = () => resolveTreeRoot() || ownerDoc.getElementById('content') || fallbackContent

  let watcher = null
  let viewportEl = null

  let updateQueued = false
  let queuedForce = false

  const scheduleWatcherUpdate = (force = false) => {
    queuedForce = queuedForce || force
    if (updateQueued) return
    updateQueued = true
    const runUpdate = () => {
      updateQueued = false
      const shouldForce = queuedForce
      queuedForce = false
      if (watcher) watcher.updateActive(shouldForce)
      if (
        watcher &&
        defaultView &&
        defaultView.location &&
        defaultView.location.hash &&
        Date.now() > watcher.ignoreHashClearUntil
      ) {
        try {
          defaultView.history.replaceState(
            null,
            '',
            defaultView.location.pathname + defaultView.location.search,
          )
        } catch {}
      }
    }

    const schedule = (() => {
      if (defaultView && typeof defaultView.requestIdleCallback === 'function') {
        return (cb) => defaultView.requestIdleCallback(() => cb(), { timeout: 160 })
      }
      if (defaultView && typeof defaultView.requestAnimationFrame === 'function') {
        return (cb) => defaultView.requestAnimationFrame(() => cb())
      }
      return (cb) => setTimeout(cb, 0)
    })()

    schedule(runUpdate)
  }

  const handleScroll = () => {
    if (!watcher) return
    scheduleWatcherUpdate(false)
  }

  const swapViewport = (next) => {
    if (!next || viewportEl === next) return
    if (viewportEl) viewportEl.removeEventListener('scroll', handleScroll)
    viewportEl = next
    viewportEl.addEventListener('scroll', handleScroll, { passive: true })
    if (watcher) watcher.viewport = viewportEl
  }

  const escapeSelector = (value) => {
    const raw = String(value || '')
    try {
      const view = ownerDoc.defaultView || window
      if (view.CSS && typeof view.CSS.escape === 'function') return view.CSS.escape(raw)
    } catch {}
    return raw.replace(/"/g, '\\"')
  }

  const ensureDetailsChain = (path) => {
    const parts = String(path || '')
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
    if (!parts.length) return null
    const scope = resolveContainer()
    if (!scope) return null
    let current = ''
    let last = null
    for (let idx = 0; idx < parts.length; idx += 1) {
      current = current ? `${current}/${parts[idx]}` : parts[idx]
      const selector = `details[data-path="${escapeSelector(current)}"]`
      const details = scope.querySelector(selector)
      if (!details) return last
      const body = details.querySelector(':scope > .body')
      const isFile = (details.dataset?.type || details.classList?.contains('file')) === 'file'
      const wasOpen = details.open
      if (!wasOpen) {
        try {
          details.open = true
        } catch {}
        details.setAttribute('open', '')
      }
      details.classList.remove('hidden')
      const needsLoad = isFile && (!body || body.childElementCount === 0)
      if (!wasOpen || needsLoad) {
        try {
          details.dispatchEvent(new Event('toggle'))
        } catch {}
      }
      last = details
    }
    return last
  }

  const scrollToAnchorWhenReady = (anchorId, options = {}) => {
    if (!anchorId) return
    const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 8
    const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : 100
    const behavior = options.behavior || 'smooth'
    const block = options.block || 'start'
    let attempt = 0
    const seek = () => {
      const anchor = ownerDoc.getElementById(anchorId)
      if (anchor) {
        try {
          anchor.scrollIntoView({ block, behavior })
        } catch {}
        return
      }
      attempt += 1
      if (attempt <= maxAttempts) {
        setTimeout(seek, baseDelay * Math.max(1, attempt))
      }
    }
    setTimeout(seek, baseDelay)
  }

  const dirAnchorId = (path) => {
    const raw = String(path || '')
    const slug = raw ? raw.replace(/[^a-zA-Z0-9]+/g, '-') : 'root'
    return `dir-${slug}`
  }

  watcher = {
    container: resolveContainer(),
    viewport: null,
    tocRoot,
    links: [],
    lastActive: new Set(),
    ignoreHashClearUntil: 0,
    scheduleUpdate(force = false) {
      scheduleWatcherUpdate(force)
    },
    ensureTargets(force = false) {
      const latestContainer = resolveContainer()
      if (latestContainer && latestContainer !== this.container) {
        this.container = latestContainer
      }
      const nextViewport = resolveTreeRoot() || this.container
      if (nextViewport) swapViewport(nextViewport)
      else if (force && this.container) swapViewport(this.container)
      if (!this.viewport) this.viewport = viewportEl
    },
    refresh(force = false) {
      this.ensureTargets(true)
      this.links = Array.from(this.tocRoot.querySelectorAll('a[data-path]'))
      if (force) this.lastActive = new Set()
      this.scheduleUpdate(true)
    },
    updateActive(force = false) {
      this.ensureTargets()
      const viewport = this.viewport || viewportEl || resolveTreeRoot() || this.container
      if (!viewport) return
      const contentRect = viewport.getBoundingClientRect()
      const top = contentRect.top
      const bottom = contentRect.bottom
      const anchorOffset = Math.min(Math.max(contentRect.height * 0.15, 56), 200)
      const anchorY = Math.max(top, Math.min(bottom - 20, top + anchorOffset))
      const visible = new Set()
      const scope = this.container || resolveContainer()
      if (!scope) return
      const details = scope.querySelectorAll('details[data-path]')
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
          const isFile = (det.dataset?.type || det.classList?.contains('file')) === 'file'
          if (isFile) {
            const body = det.querySelector(':scope > .body')
            const bodyRect = body ? body.getBoundingClientRect() : null
            const bodyVisible = bodyRect
              ? bodyRect.top <= anchorY && bodyRect.bottom >= Math.min(bottom, top + 120)
              : false
            isVisible = bodyVisible || summaryInView
          } else {
            isVisible = intersectsAnchor || summaryInView
          }
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

  watcher.ensureTargets(true)

  tocRoot.addEventListener('click', (e) => {
    const link =
      e.target && typeof e.target.closest === 'function' ? e.target.closest('a[data-path]') : null
    if (!link) return
    const path = link.dataset?.path || ''
    const type = link.dataset?.type || ''
    if (!path) {
      watcher.ignoreHashClearUntil = Date.now() + 1200
      return
    }
    watcher.ignoreHashClearUntil = Date.now() + 1600
    if (type === 'dir' || type === 'file') {
      e.preventDefault()
      const details = ensureDetailsChain(path)
      const anchorId = type === 'dir' ? dirAnchorId(path) : pathAnchor(path)
      if (anchorId) {
        let hashApplied = false
        if (defaultView && defaultView.location) {
          try {
            const currentHash = (defaultView.location.hash || '').slice(1)
            if (currentHash !== anchorId) defaultView.location.hash = anchorId
            hashApplied = true
          } catch {}
        }
        if (!hashApplied && ownerDoc && ownerDoc.location) {
          try {
            const currentHash = (ownerDoc.location.hash || '').slice(1)
            if (currentHash !== anchorId) ownerDoc.location.hash = anchorId
            hashApplied = true
          } catch {}
        }
        scrollToAnchorWhenReady(anchorId, { baseDelay: 60 })
        setTimeout(() => watcher && watcher.scheduleUpdate(true), 220)
      } else if (details && type === 'file') {
        scrollToAnchorWhenReady(pathAnchor(path), { baseDelay: 80 })
        setTimeout(() => watcher && watcher.scheduleUpdate(true), 220)
      }
      return
    }
    watcher.ignoreHashClearUntil = Date.now() + 1200
  })
  tocRoot.addEventListener('toggle', () => watcher.scheduleUpdate(true), true)
  window.addEventListener('resize', () => watcher.scheduleUpdate(true))

  watcher.refresh(true)

  return watcher
}
