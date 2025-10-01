import { displayName, pathAnchor, normalizeFsPath } from './utils.js'
import { fetchFile } from './api.js'
import { resolveFileView, getDefaultFileView } from './file-view-registry.js'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'
import { markIgnoredNode, markPluginNode } from './highlight-plugin/core/dom-utils.js'

const DOM_NODE = typeof Node === 'function' ? Node : null
const STRUCTURE_WIDTH_STORAGE_KEY = 'ami:cms:structurePanelWidth'
const STRUCTURE_WIDTH_DEFAULT = 320
const STRUCTURE_WIDTH_MIN = 240
const STRUCTURE_WIDTH_MAX = 560


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

let fullscreenListenerAttached = false

function assignFullscreenTarget(button, target) {
  if (!button) return
  if (target && target instanceof HTMLElement) {
    button.__fullscreenTarget = target
    button.dataset.fullscreenTarget = '1'
  } else {
    button.__fullscreenTarget = null
    delete button.dataset.fullscreenTarget
  }
}

function isFullscreenForTarget(target) {
  if (typeof document === 'undefined') return false
  const active = document.fullscreenElement
  if (!active || !target) return false
  if (active === target) return true
  if (typeof active.contains === 'function' && active.contains(target)) return true
  if (typeof target.contains === 'function' && target.contains(active)) return true
  return false
}

function updateFullscreenButtonState() {
  if (typeof document === 'undefined') return
  const buttons = document.querySelectorAll('[data-fullscreen-target]')
  buttons.forEach((btn) => {
    const target = btn.__fullscreenTarget
    const active = isFullscreenForTarget(target)
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  })
}

function ensureFullscreenListener() {
  if (fullscreenListenerAttached || typeof document === 'undefined') return
  document.addEventListener('fullscreenchange', () => updateFullscreenButtonState())
  fullscreenListenerAttached = true
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

export async function ensureFileContent(state, node) {
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
      const defaultView = getDefaultFileView()
      if (defaultView !== view) {
        const defaultFormat = defaultView?.contentFormat === 'manual' ? null : defaultView?.contentFormat || 'text'
        let defaultContent = primaryContent
        if (defaultFormat && defaultFormat !== primaryFormat) {
          defaultContent = await fetchForFormat(defaultFormat)
        } else if (defaultFormat && defaultContent == null) {
          defaultContent = await fetchForFormat(defaultFormat)
        }
        rendered = await renderWithView(defaultView, defaultContent, baseContext)
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
    ensureSummaryActions(state, details, node)
    ensureFullscreenListener()
    body.innerHTML = ''

    if (node.path) {
      const anchor = document.createElement('a')
      anchor.id = pathAnchor(node.path)
      body.appendChild(anchor)
    }
    const cloned =
      html && typeof html.cloneNode === 'function' ? html.cloneNode(true) : html || document.createTextNode('')
    body.appendChild(cloned)
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
  if (details.__dirToggleHandler) {
    details.removeEventListener('toggle', details.__dirToggleHandler)
    details.__dirToggleHandler = null
  }
  if (details.__openHandler) {
    details.removeEventListener('toggle', details.__openHandler)
    details.__openHandler = null
  }
  if (state?.visibilityTracker && typeof state.visibilityTracker.unobserve === 'function') {
    try {
      state.visibilityTracker.unobserve(details)
    } catch (error) {
      console.warn('Failed to unobserve tree node', error)
    }
  }
  details.__nodeRef = null
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
          state.activePath = node.path || ''
          ensureSummaryActions(state, details, node)
          ensureFullscreenListener()
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
        if (details.querySelector(':scope > summary')) {
          updateFullscreenButtonState()
        }
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

function attachDirLoader(details, state, node, depth, indexPath) {
  if (!details || details.__dirToggleHandler) return
  const handler = async () => {
    if (!details.open) return
    if (typeof state.loadDirectoryChildren !== 'function') return
    const meta = node && node.__lazy ? node.__lazy : null
    const body = details.querySelector(':scope > .body')
    const parentIndexPath = Array.isArray(node?.__indexPath) ? node.__indexPath : indexPath
    const ensureSpinner = () => {
      if (!body) return () => {}
      let spinner = body.querySelector(':scope > .tree-loading')
      if (!spinner) {
        spinner = document.createElement('div')
        spinner.className = 'tree-loading'
        spinner.textContent = 'Loading…'
        body.appendChild(spinner)
      }
      return () => {
        if (spinner && spinner.parentElement === body) spinner.remove()
      }
    }
    const release = meta && meta.loaded ? () => {} : ensureSpinner()
    try {
      const children = await state.loadDirectoryChildren(node)
      if (body) {
        syncChildren(state, body, children, depth + 1, parentIndexPath)
      }
      if (state._structureWatcher) {
        try {
          state._structureWatcher.refresh(true)
        } catch {}
      }
    } catch (error) {
      if (body) {
        body.innerHTML = ''
        const errEl = document.createElement('div')
        errEl.className = 'tree-error'
        errEl.textContent = error?.message || 'Failed to load directory'
        body.appendChild(errEl)
      }
      console.warn('Failed to load directory', error)
    } finally {
      release()
    }
  }
  details.__dirToggleHandler = handler
  details.addEventListener('toggle', handler)
}

function createSummary(node, depth, indexPath) {
  const summary = document.createElement('summary')
  summary.dataset.type = node.type
  summary.dataset.path = node.path || ''
  summary.dataset.depth = String(depth)

  const titleWrap = document.createElement('span')
  titleWrap.className = 'tree-title'
  summary.appendChild(titleWrap)

  const numbering = document.createElement('span')
  numbering.className = 'tree-numbering'
  numbering.textContent = formatIndex(indexPath)
  titleWrap.appendChild(numbering)

  const labelSpan = document.createElement('span')
  labelSpan.className = 'tree-label'
  const label = displayName(node)
  labelSpan.textContent = label
  titleWrap.appendChild(labelSpan)

  if (node.type === 'file' && node.path) {
    const meta = document.createElement('span')
    meta.className = 'meta'
    meta.textContent = ` ${node.path}`
    titleWrap.appendChild(meta)
  }
  return summary
}

function updateSummary(summary, node, depth, indexPath) {
  if (!summary) return displayName(node)
  summary.dataset.type = node.type
  summary.dataset.path = node.path || ''
  summary.dataset.depth = String(depth)

  let titleWrap = summary.querySelector(':scope > .tree-title')
  if (!titleWrap) {
    titleWrap = document.createElement('span')
    titleWrap.className = 'tree-title'
    summary.insertBefore(titleWrap, summary.firstChild || null)
    const legacyNodes = summary.querySelectorAll(
      ':scope > .tree-numbering, :scope > .tree-label, :scope > .meta',
    )
    legacyNodes.forEach((node) => {
      try {
        titleWrap.appendChild(node)
      } catch {}
    })
  }

  const existingIndent = titleWrap.querySelector('.indent')
  if (existingIndent) existingIndent.remove()

  const numbering = titleWrap.querySelector('.tree-numbering')
  if (numbering) numbering.textContent = formatIndex(indexPath)

  const label = displayName(node)
  const labelSpan = titleWrap.querySelector('.tree-label')
  if (labelSpan) labelSpan.textContent = label

  const meta = summary.querySelector('.meta')
  if (node.type === 'file' && node.path) {
    const text = ` ${node.path}`
    if (meta) meta.textContent = text
    else {
      const newMeta = document.createElement('span')
      newMeta.className = 'meta'
      newMeta.textContent = text
      const labelEl = titleWrap.querySelector('.tree-label')
      if (labelEl && labelEl.nextSibling) {
        titleWrap.insertBefore(newMeta, labelEl.nextSibling)
      } else {
        titleWrap.appendChild(newMeta)
      }
    }
  } else if (meta) {
    meta.remove()
  }
  return label
}

function ensureSummaryActions(state, details, node) {
  if (!state || !details || !node || node.type !== 'file') {
    const summary = details?.querySelector?.(':scope > summary') || null
    const existing = summary ? summary.querySelector(':scope > .tree-actions') : null
    if (existing) existing.remove()
    return null
  }

  const summary = details.querySelector(':scope > summary')
  if (!summary) return null

  let actions = summary.querySelector(':scope > .tree-actions')
  if (!actions) {
    actions = document.createElement('div')
    actions.className = 'tree-actions'
    markPluginNode(actions)
    summary.appendChild(actions)
  } else {
    actions.innerHTML = ''
    markPluginNode(actions)
  }

  const makeButton = (action, iconName, label, handler, options = {}) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tree-actions__btn icon-button'
    btn.dataset.action = action
    btn.setAttribute('aria-label', label)
    btn.dataset.hint = label
    btn.innerHTML = iconMarkup(iconName, { size: 16 })
    markPluginNode(btn)
    const iconEl = btn.querySelector('i, svg, span')
    if (iconEl) markPluginNode(iconEl)
    btn.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      handler(btn)
    })
    if (options.fullscreenTarget instanceof HTMLElement) {
      assignFullscreenTarget(btn, options.fullscreenTarget)
    }
    actions.appendChild(btn)
    return btn
  }

  const fullscreenTarget =
    (details.__fileBody && details.__fileBody instanceof HTMLElement && details.__fileBody) ||
    details

  makeButton(
    'fullscreen',
    'fullscreen-line',
    'Toggle full-screen view',
    async (btn) => {
      try {
        let target = btn.__fullscreenTarget
        if (!(target instanceof HTMLElement)) target = fullscreenTarget
        const element = target && typeof target.requestFullscreen === 'function'
          ? target
          : document.documentElement
        if (typeof document !== 'undefined' && !isFullscreenForTarget(element)) {
          await element?.requestFullscreen?.()
        } else if (typeof document !== 'undefined' && document.exitFullscreen) {
          await document.exitFullscreen()
        }
      } catch (error) {
        console.warn('Failed to toggle fullscreen', error)
      } finally {
        updateFullscreenButtonState()
      }
    },
    { fullscreenTarget },
  )
  updateFullscreenButtonState()

  const path = node.path || ''

  const embedBtn = makeButton('embed', 'share-forward-line', 'Open embed view', () => {
    if (!path) return
    try {
      const base = new URL('/doc.html', window.location.origin)
      base.searchParams.set('embed', '1')
      base.searchParams.set('mode', 'file')
      base.searchParams.set('path', path)
      base.hash = pathAnchor(path)
      window.open(base.toString(), '_blank', 'noopener')
    } catch (error) {
      console.warn('Failed to open embed view', error)
    }
  })
  if (!path) embedBtn.disabled = true

  const exportBtn = makeButton('export', 'download-2-line', 'Export this document', async (btn) => {
    if (!path) return
    try {
      btn.classList.add('is-busy')
      const rootKey = state?.rootKey || 'docRoot'
      const blob = await fetchFile(path, rootKey, { format: 'blob' })
      const url = URL.createObjectURL(blob)
      const anchorEl = document.createElement('a')
      anchorEl.href = url
      anchorEl.download = node.name || 'document'
      document.body.appendChild(anchorEl)
      anchorEl.click()
      setTimeout(() => {
        document.body.removeChild(anchorEl)
        URL.revokeObjectURL(url)
      }, 120)
    } catch (error) {
      console.warn('Failed to export document', error)
    } finally {
      btn.classList.remove('is-busy')
    }
  })
  if (!path) exportBtn.disabled = true

  const activePath = state.activePath || ''
  if (path && path === activePath) {
    updateFullscreenButtonState()
  }

  return actions
}

function createDetailsNode(state, node, depth, indexPath, key) {
  const details = document.createElement('details')
  details.__nodeData = { path: node.path || '', name: node.name || '', type: node.type }
  details.__nodeRef = node
  details.dataset.path = details.__nodeData.path
  details.dataset.type = node.type
  details.dataset.key = key
  details.className = node.type === 'dir' ? 'dir' : 'file'
  details.style.setProperty('--depth', String(depth))

  const summary = createSummary(node, depth, indexPath)
  details.appendChild(summary)
  ensureSummaryActions(state, details, node)

  const body = document.createElement('div')
  body.className = 'body'
  details.appendChild(body)
  details.__fileBody = body

  attachOpenState(details, state)

  if (node.type === 'dir') {
    ensureDirAnchor(body, node)
    attachDirLoader(details, state, node, depth, indexPath)
  } else {
    attachFileLoader(details, state, body)
  }

  if (node.path && state.open.has(node.path)) {
    details.setAttribute('open', '')
  }
  if (state?.visibilityTracker && typeof state.visibilityTracker.observe === 'function') {
    try {
      state.visibilityTracker.observe(details, node.path || '')
    } catch (error) {
      console.warn('Failed to observe tree node', error)
    }
  }
  return details
}

function updateDetailsNode(state, details, node, depth, indexPath, key) {
  details.__nodeData = details.__nodeData || {}
  details.__nodeData.path = node.path || ''
  details.__nodeData.name = node.name || ''
  details.__nodeData.type = node.type
  details.__nodeRef = node
  details.dataset.path = details.__nodeData.path
  details.dataset.type = node.type
  details.dataset.key = key
  details.className = node.type === 'dir' ? 'dir' : 'file'
  details.style.setProperty('--depth', String(depth))

  const summary = details.querySelector(':scope > summary')
  updateSummary(summary, node, depth, indexPath)
  ensureSummaryActions(state, details, node)

  const body = details.querySelector(':scope > .body')
  details.__fileBody = body
  if (node.type === 'dir') {
    ensureDirAnchor(body, node)
    if (!details.__dirToggleHandler) attachDirLoader(details, state, node, depth, indexPath)
  } else if (body) {
    const dirAnchor = body.querySelector(':scope > a.dir-anchor')
    if (dirAnchor) dirAnchor.remove()
  }

  if (node.type === 'file' && !details.__fileToggleHandler) {
    attachFileLoader(details, state, body)
  }

  if (state?.visibilityTracker && typeof state.visibilityTracker.observe === 'function') {
    try {
      state.visibilityTracker.observe(details, node.path || '')
    } catch (error) {
      console.warn('Failed to refresh tree node observation', error)
    }
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

  const nextOrder = []

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
    nextOrder.push(details)

    if (
      child.type === 'dir' &&
      details.open &&
      typeof state?.loadDirectoryChildren === 'function'
    ) {
      const meta = child.__lazy
      if (!meta || !meta.loaded) {
        state
          .loadDirectoryChildren(child)
          .then((children) => {
            const body = details.querySelector(':scope > .body')
            if (body) syncChildren(state, body, children || [], depth + 1, childIndexPath)
          })
          .catch((error) => console.warn('Failed to preload directory', error))
      }
    }
  })

  lookup.forEach((el) => {
    cleanupNode(el, state)
    el.remove()
  })

  const ElementRef = typeof Element === 'undefined' ? null : Element
  const staticNodes = Array.from(parentEl.childNodes || []).filter((node) => {
    if (!ElementRef) return true
    return !(node instanceof ElementRef) || node.tagName !== 'DETAILS'
  })

  const desired = staticNodes.concat(nextOrder)
  const current = Array.from(parentEl.childNodes || [])
  let needsReplace = desired.length !== current.length
  if (!needsReplace) {
    for (let i = 0; i < desired.length; i += 1) {
      if (desired[i] !== current[i]) {
        needsReplace = true
        break
      }
    }
  }

  if (needsReplace) parentEl.replaceChildren(...desired)
}

export function renderTree(state, container, tree) {
  if (!state || !container || !tree) return
  const children = Array.isArray(tree.children) ? tree.children : []
  syncChildren(state, container, children, 0, [])
}

function ensureStructurePanelResizer(state, tocEl) {
  if (!state || !tocEl) return
  const ownerDoc = tocEl.ownerDocument || document
  if (!ownerDoc) return
  const view = ownerDoc.defaultView || window
  let nav = null
  try {
    if (typeof tocEl.closest === 'function') nav = tocEl.closest('nav')
  } catch {}
  if (!nav) {
    const parent = tocEl.parentElement
    if (parent && parent.tagName === 'NAV') nav = parent
  }
  if (!nav) {
    try {
      nav = ownerDoc.querySelector('nav')
    } catch {}
  }
  if (!nav) return
  const root = ownerDoc.documentElement || document.documentElement
  if (!root) return
  if (nav.dataset) nav.dataset.structureScroll = 'true'

  if (!state._structureResize || typeof state._structureResize !== 'object') {
    state._structureResize = {}
  }
  const resizeState = state._structureResize

  const readCssDimension = (varName, defaultValue) => {
    if (!root || !view || typeof view.getComputedStyle !== 'function') return defaultValue
    try {
      const styles = view.getComputedStyle(root)
      const raw = styles.getPropertyValue(varName)
      const numeric = parseFloat(raw)
      return Number.isFinite(numeric) ? numeric : defaultValue
    } catch {
      return defaultValue
    }
  }

  const minCss = readCssDimension('--structure-panel-min-width', STRUCTURE_WIDTH_MIN)
  const maxCss = readCssDimension('--structure-panel-max-width', STRUCTURE_WIDTH_MAX)
  resizeState.min = Number.isFinite(resizeState.min) ? resizeState.min : minCss
  resizeState.max = Number.isFinite(resizeState.max) ? resizeState.max : Math.max(maxCss, resizeState.min + 120)

  const clampWidth = (value) => {
    const base = Number.isFinite(value) ? value : STRUCTURE_WIDTH_DEFAULT
    const viewportLimit = (() => {
      const width = view?.innerWidth || 0
      if (!width) return resizeState.max
      return Math.max(resizeState.min + 80, width - 280)
    })()
    const allowedMax = Math.max(resizeState.max, resizeState.min + 80)
    const maxWidth = Math.max(resizeState.min, Math.min(allowedMax, viewportLimit))
    return Math.min(Math.max(base, resizeState.min), maxWidth)
  }

  let handle = resizeState.handle && resizeState.handle.isConnected ? resizeState.handle : null
  if (!handle || handle.parentElement !== nav) {
    handle = nav.querySelector('.structure-resize-handle')
  }
  if (!handle) {
    handle = ownerDoc.createElement('button')
    handle.type = 'button'
    handle.className = 'structure-resize-handle'
    handle.setAttribute('aria-label', 'Resize structure panel')
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-orientation', 'vertical')
    handle.tabIndex = 0
    nav.appendChild(handle)
  }

  const applyWidth = (value, dragging = false) => {
    const clamped = clampWidth(value)
    const rounded = Math.round(clamped)
    resizeState.width = clamped
    try {
      root.style.setProperty('--structure-panel-width', `${rounded}px`)
      root.style.setProperty('--doc-toc-width', `${rounded}px`)
    } catch {}
    try {
      nav.style.setProperty('--structure-panel-width', `${rounded}px`)
    } catch {}
    if (handle) {
      handle.setAttribute('aria-valuenow', String(rounded))
      handle.classList.toggle('is-dragging', dragging)
    }
    nav.classList.toggle('is-resizing', dragging)
    return clamped
  }

  handle.setAttribute('aria-valuemin', String(Math.round(resizeState.min)))
  handle.setAttribute('aria-valuemax', String(Math.round(resizeState.max)))

  const storedWidth = (() => {
    try {
      const raw = view?.localStorage?.getItem(STRUCTURE_WIDTH_STORAGE_KEY)
      const parsed = raw ? parseFloat(raw) : NaN
      return Number.isFinite(parsed) ? parsed : null
    } catch {
      return null
    }
  })()

  const navWidth = (() => {
    try {
      const rect = nav.getBoundingClientRect()
      return rect && rect.width ? rect.width : null
    } catch {
      return null
    }
  })()

  const initialWidth = clampWidth(resizeState.width || storedWidth || navWidth || STRUCTURE_WIDTH_DEFAULT)
  applyWidth(initialWidth, false)

  const persistWidth = (value) => {
    try {
      view?.localStorage?.setItem(STRUCTURE_WIDTH_STORAGE_KEY, String(Math.round(value)))
    } catch {}
  }

  const startDrag = (event) => {
    if (!event) return
    if (typeof event.button === 'number' && event.button !== 0) return
    event.preventDefault()
    const pointerId = event.pointerId
    if (pointerId !== undefined && handle?.setPointerCapture) {
      try {
        handle.setPointerCapture(pointerId)
      } catch {}
    }
    const startX = event.clientX || 0
    const startWidth = nav.getBoundingClientRect()?.width || initialWidth
    const moveHandler = (moveEvent) => {
      moveEvent.preventDefault()
      const delta = (moveEvent.clientX || 0) - startX
      const next = clampWidth(startWidth + delta)
      resizeState.pendingWidth = next
      applyWidth(next, true)
    }
    const stop = () => {
      if (pointerId !== undefined && handle?.releasePointerCapture) {
        try {
          handle.releasePointerCapture(pointerId)
        } catch {}
      }
      view.removeEventListener('pointermove', moveHandler)
      view.removeEventListener('pointerup', stop)
      view.removeEventListener('pointercancel', stop)
      const finalWidth = clampWidth(
        resizeState.pendingWidth || nav.getBoundingClientRect()?.width || resizeState.width || initialWidth,
      )
      resizeState.pendingWidth = null
      applyWidth(finalWidth, false)
      persistWidth(finalWidth)
    }
    view.addEventListener('pointermove', moveHandler)
    view.addEventListener('pointerup', stop, { once: false })
    view.addEventListener('pointercancel', stop, { once: false })
  }

  if (!handle.dataset.resizeBound) {
    handle.addEventListener('pointerdown', startDrag)
    handle.addEventListener('keydown', (event) => {
      if (!event) return
      const key = event.key
      if (key !== 'ArrowLeft' && key !== 'ArrowRight') return
      event.preventDefault()
      const step = key === 'ArrowLeft' ? -16 : 16
      const next = clampWidth((resizeState.width || initialWidth) + step)
      applyWidth(next, false)
      persistWidth(next)
    })
    handle.addEventListener('dblclick', () => {
      const reset = clampWidth(STRUCTURE_WIDTH_DEFAULT)
      applyWidth(reset, false)
      persistWidth(reset)
    })
    handle.dataset.resizeBound = 'true'
  }

  if (!resizeState.boundResize) {
    view.addEventListener('resize', () => {
      const clamped = clampWidth(resizeState.width || initialWidth)
      if (clamped !== resizeState.width) {
        applyWidth(clamped, false)
        persistWidth(clamped)
      }
    })
    resizeState.boundResize = true
  }

  resizeState.handle = handle
  resizeState.nav = nav
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

  ensureStructurePanelResizer(state, toc)

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
  const renderStructToggle = (el, open = false) => {
    if (!el) return
    const iconName = open ? 'subtract-line' : 'add-line'
    el.innerHTML = iconMarkup(iconName, { size: 16 })
  }

  const structKeyFor = (node, indexPath = []) => {
    const pathValue = node?.path ? normalizeFsPath(node.path) : ''
    if (pathValue) return `p:${pathValue}`
    if (indexPath.length) return `i:${indexPath.join('.')}`
    return 'root'
  }

  const ensureStructureChildren = async (container, node, indexPath) => {
    if (!container || !node || node.type !== 'dir') return
    if (container.dataset.loaded === 'true') return
    if (container.__loadingPromise) return container.__loadingPromise
    container.dataset.loading = 'true'
    const loadTask = (async () => {
      let children = []
      if (typeof state.loadDirectoryChildren === 'function') {
        try {
          children = await state.loadDirectoryChildren(node)
        } catch (error) {
          console.warn('Structure load failed', error)
          children = Array.isArray(node.children) ? node.children : []
        }
      } else if (Array.isArray(node.children)) {
        children = node.children
      }
      container.innerHTML = ''
      let childIndex = 1
      children.forEach((child) => {
        if (!child) return
        const childIndexPath = indexPath.concat(childIndex)
        child.__indexPath = childIndexPath
        const element =
          child.type === 'dir'
            ? createDirectoryEntry(child, childIndexPath)
            : createFileEntry(child, childIndexPath)
        if (element) container.appendChild(element)
        childIndex += 1
      })
      if (state && state._structureWatcher && typeof state._structureWatcher.scheduleUpdate === 'function') {
        try {
          state._structureWatcher.scheduleUpdate(true)
        } catch {}
      }
      container.dataset.loaded = 'true'
    })()
    container.__loadingPromise = loadTask
    try {
      await loadTask
    } finally {
      container.dataset.loading = 'false'
      container.__loadingPromise = null
    }
  }

  const createSummaryContent = (node, indexPath, indent) => {
    const num = indexPath.length ? `${indexPath.join('.')}. ` : ''
    const label = displayName(node)
    const a = document.createElement('a')
    a.dataset.path = node.path || ''
    a.style.setProperty('--struct-indent', `${indent + 8}px`)
    if (node.type === 'dir') {
      a.dataset.type = 'dir'
      a.textContent = num + label + '/'
      const anchorId = node.path
        ? `dir-${node.path.replace(/[^a-zA-Z0-9]+/g, '-')}`
        : 'dir-root'
      a.href = '#' + anchorId
    } else {
      a.dataset.type = 'file'
      a.textContent = num + label
      a.href = '#' + pathAnchor(node.path)
    }
    return a
  }

  const createDirectoryEntry = (node, indexPath = []) => {
    const details = document.createElement('details')
    const key = structKeyFor(node, indexPath)
    details.dataset.structureKey = key
    details.dataset.indexPath = indexPath.join('.')
    details.dataset.type = 'dir'
    details.classList.add('dir')
    const depth = Math.max(indexPath.length - 1, 0)
    const baseIndent = 32
    const indent = baseIndent + depth * 18
    const summary = document.createElement('summary')
    summary.style.setProperty('--struct-indent', `${indent}px`)
    const toggle = document.createElement('span')
    toggle.className = 'struct-toggle'
    toggle.style.setProperty('--struct-toggle-offset', `${Math.max(indent - 20, 12)}px`)
    toggle.setAttribute('aria-hidden', 'true')
    summary.appendChild(toggle)
    summary.appendChild(createSummaryContent(node, indexPath, indent))
    details.appendChild(summary)
    const body = document.createElement('div')
    body.className = 'body'
    details.appendChild(body)
    details.dataset.path = node.path || ''
    const remembered = openMemory.has(key)
    const shouldDefaultOpen = false
    const setToggleState = () => {
      renderStructToggle(toggle, details.open)
      if (details.open) openMemory.add(key)
      else openMemory.delete(key)
    }
    details.__ensureStructureChildren = () => ensureStructureChildren(body, node, indexPath)
    details.addEventListener('toggle', () => {
      setToggleState()
      if (details.open) details.__ensureStructureChildren()
    })
    details.__structToggle = toggle
    details.__structToggleUpdate = setToggleState
    if (remembered || shouldDefaultOpen) {
      details.setAttribute('open', '')
      details.__ensureStructureChildren()
    }
    setToggleState()
    return details
  }

  const createFileEntry = (node, indexPath = []) => {
    const anchor = document.createElement('a')
    const depth = Math.max(indexPath.length - 1, 0)
    const baseIndent = 32
    const indent = baseIndent + depth * 18
    anchor.style.setProperty('--struct-indent', `${indent}px`)
    anchor.style.display = 'block'
    anchor.dataset.path = node.path || ''
    anchor.dataset.type = 'file'
    anchor.textContent = `${indexPath.length ? `${indexPath.join('.')}. ` : ''}${displayName(node)}`
    anchor.href = '#' + pathAnchor(node.path)
    return anchor
  }

  if (state.tree?.children) {
    const fragment = document.createDocumentFragment()
    let idx = 1
    state.tree.children.forEach((child) => {
      if (!child) return
      const indexPath = [idx]
      child.__indexPath = indexPath
      const element =
        child.type === 'dir'
          ? createDirectoryEntry(child, indexPath)
          : createFileEntry(child, indexPath)
      if (element) fragment.appendChild(element)
      idx += 1
    })
    struct.appendChild(fragment)
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
      if (expand) {
        if (!isOpen) d.setAttribute('open', '')
        // Trigger lazy loading for directories when expanding
        if (typeof d.__lazyLoad === 'function') {
          try {
            d.__lazyLoad()
          } catch {}
        }
      }
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
    if (el) {
      try {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      } catch (err) {
        console.warn('Failed to scroll to element:', err)
      }
    }
  }
}

function escapeSelector(str) {
  return String(str || '').replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&')
}

export async function ensureDetailsChainForPath(path) {
  const parts = String(path || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (!parts.length) return null
  const scope = document.getElementById('treeRoot') || document.getElementById('content')
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
    if (details.__ensureStructureChildren && details.open) {
      try {
        await details.__ensureStructureChildren()
      } catch (error) {
        console.warn('Structure ensure failed', error)
      }
    }
    last = details
  }
  return last
}

export function scrollToAnchorWhenReady(anchorId, options = {}) {
  if (!anchorId) return
  const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 8
  const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : 100
  const behavior = options.behavior || 'smooth'
  const block = options.block || 'start'
  let attempt = 0
  const seek = () => {
    const anchor = document.getElementById(anchorId)
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
    const query = value.trim().toLowerCase()

    const allDetails = Array.from(scope.querySelectorAll('details'))
    if (!query) {
      allDetails.forEach((details) => {
        details.classList.remove('hidden')
        if (details.dataset.filterPrevOpen) {
          const restoreOpen = details.dataset.filterPrevOpen === '1'
          if (!restoreOpen) details.removeAttribute('open')
          delete details.dataset.filterPrevOpen
        }
        const summary = details.querySelector(':scope > summary')
        if (summary) summary.classList.remove('tree-filter-hit')
      })
      return
    }

    const evaluate = (details) => {
      if (!details) return false
      const summary = details.querySelector(':scope > summary')
      const text = summary ? (summary.textContent || '').toLowerCase() : ''
      const directMatch = text.includes(query)
      if (summary) summary.classList.toggle('tree-filter-hit', directMatch)

      let childMatch = false
      const body = details.querySelector(':scope > .body')
      if (body) {
        const children = Array.from(body.querySelectorAll(':scope > details'))
        for (const child of children) {
          if (evaluate(child)) childMatch = true
        }
      }

      const match = directMatch || childMatch
      details.classList.toggle('hidden', !match)

      if (match) {
        const type = details.dataset.type || (details.classList.contains('file') ? 'file' : 'dir')
        const wasOpen = details.hasAttribute('open')
        const shouldForceOpen = type === 'file' || childMatch
        if (shouldForceOpen && !wasOpen) {
          if (!details.dataset.filterPrevOpen) details.dataset.filterPrevOpen = wasOpen ? '1' : '0'
          details.setAttribute('open', '')
        }
        if (type === 'dir' && childMatch && wasOpen === false && !details.dataset.filterPrevOpen) {
          details.dataset.filterPrevOpen = '0'
        }
      }

      return match
    }

    const roots = Array.from(scope.querySelectorAll(':scope > details'))
    roots.forEach((details) => evaluate(details))
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
  const contentElement = doc.getElementById('content')
  if (!tocRoot || !contentElement) return null

  void state

  const ownerDoc = contentElement.ownerDocument || document
  const defaultView = ownerDoc.defaultView || window

  const resolveTreeRoot = () => ownerDoc.getElementById('treeRoot')
  const resolveContainer = () => resolveTreeRoot() || ownerDoc.getElementById('content') || contentElement
  const visibilityTracker = state?.visibilityTracker || null

  let structureScrollEl = null
  const resolveStructureScrollContainer = () => {
    if (!tocRoot) return null
    try {
      if (typeof tocRoot.closest === 'function') {
        const navMatch = tocRoot.closest('nav')
        if (navMatch) return navMatch
      }
    } catch {}
    return tocRoot.parentElement || tocRoot
  }
  const ensureStructureScrollContainer = () => {
    const next = resolveStructureScrollContainer()
    if (next && next.dataset) next.dataset.structureScroll = 'true'
    if (structureScrollEl !== next) structureScrollEl = next
    return structureScrollEl
  }

  let watcher = null
  let viewportEl = null
  let detailNodes = []
  let detailScope = null
  let lastUpdateTime = 0
  const UPDATE_THROTTLE_MS = 90

  let updateQueued = false
  let queuedForce = false

  const markDetailCacheDirty = () => {
    detailScope = null
  }

  const collectDetailNodes = (force = false) => {
    const scope = resolveContainer()
    if (!scope) {
      detailNodes = []
      detailScope = null
      return detailNodes
    }
    if (!force && scope === detailScope && detailNodes.length) return detailNodes
    detailScope = scope
    detailNodes = Array.from(scope.querySelectorAll('details[data-path]'))
    return detailNodes
  }

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
    if (visibilityTracker && typeof visibilityTracker.setRoot === 'function') {
      try {
        visibilityTracker.setRoot(next)
      } catch (error) {
        console.warn('Failed to update visibility tracker root', error)
      }
    }
  }

  const escapeSelector = (value) => {
    const raw = String(value || '')
    try {
      const view = ownerDoc.defaultView || window
      if (view.CSS && typeof view.CSS.escape === 'function') return view.CSS.escape(raw)
    } catch {}
    return raw.replace(/"/g, '\\"')
  }

  const ensureDetailsChain = async (path) => {
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
        markDetailCacheDirty()
      }
      if (details.__ensureStructureChildren && details.open) {
        try {
          await details.__ensureStructureChildren()
        } catch (error) {
          console.warn('Structure ensure failed', error)
        }
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
        collectDetailNodes(true)
      }
      const nextViewport = resolveTreeRoot() || this.container
      if (nextViewport) swapViewport(nextViewport)
      else if (force && this.container) swapViewport(this.container)
      if (!this.viewport) this.viewport = viewportEl
      if (force) collectDetailNodes(true)
    },
    refresh(force = false) {
      this.ensureTargets(true)
      this.links = Array.from(this.tocRoot.querySelectorAll('a[data-path]'))
      if (force) this.lastActive = new Set()
      ensureStructureScrollContainer()
      collectDetailNodes(true)
      if (visibilityTracker && typeof visibilityTracker.refresh === 'function') {
        try {
          visibilityTracker.refresh()
        } catch (error) {
          console.warn('Failed to refresh visibility tracker', error)
        }
      }
      this.scheduleUpdate(true)
    },
    updateActive(force = false) {
      this.ensureTargets()
      const now = Date.now()
      if (!force && now - lastUpdateTime < UPDATE_THROTTLE_MS) return
      lastUpdateTime = now
      const viewport = this.viewport || viewportEl || resolveTreeRoot() || this.container
      if (!viewport) return
      const contentRect = viewport.getBoundingClientRect()
      const top = contentRect.top
      const bottom = contentRect.bottom
      const anchorOffset = Math.min(Math.max(contentRect.height * 0.15, 56), 200)
      const anchorY = Math.max(top, Math.min(bottom - 20, top + anchorOffset))

      const evaluate = (items) => {
        if (!items || !items.length) return null
        const visibleSet = new Set()
        const activeDetails = []
        for (let i = 0; i < items.length; i += 1) {
          const payload = items[i]
          const det = payload?.element || payload
          if (!det || !det.isConnected) continue
          const path = payload?.path || det.dataset?.path || ''
          const summary = det.querySelector(':scope > summary')
          if (!summary) continue
          const hidden = det.classList?.contains('hidden') || summary.offsetParent === null
          let isVisible = false
          if (!hidden) {
            const sectionRect = payload?.entry?.boundingClientRect || det.getBoundingClientRect()
            const summaryRect = summary.getBoundingClientRect()
            const intersectsAnchor = sectionRect.top <= anchorY && sectionRect.bottom >= anchorY
            const summaryInView = summaryRect.bottom >= top && summaryRect.top <= bottom
            const isFile = (det.dataset?.type || det.classList?.contains('file')) === 'file'
            if (isFile) {
              const detailVisible =
                sectionRect.top <= anchorY && sectionRect.bottom >= Math.min(bottom, top + 120)
              isVisible = detailVisible || summaryInView
            } else {
              isVisible = intersectsAnchor || summaryInView
            }
          }
          summary.classList.toggle('is-visible', isVisible && !!path)
          if (isVisible && path) {
            visibleSet.add(path)
            activeDetails.push(det)
          }
        }
        return { visible: visibleSet, activeDetails }
      }

      let result = null
      if (visibilityTracker && typeof visibilityTracker.getVisibleEntries === 'function') {
        try {
          const snapshot = visibilityTracker.getVisibleEntries()
          if (Array.isArray(snapshot) && snapshot.length) {
            result = evaluate(snapshot)
          }
        } catch (error) {
          console.warn('Failed to read visibility tracker snapshot', error)
        }
      }

      if (!result) {
        const details = collectDetailNodes(force)
        if (!details.length) return
        result = evaluate(details)
      }

      if (!result) return

      if (result.activeDetails.length === 0 && force) markDetailCacheDirty()
      const changed = force || !setsEqual(this.lastActive, result.visible)
      if (!changed) return

      let lastActiveLink = null
      this.links.forEach((link) => {
        const path = link.dataset?.path || ''
        const isActive = !!path && result.visible.has(path)
        link.classList.toggle('is-active', isActive)
        const parent = link.parentElement
        if (parent && parent.tagName === 'SUMMARY') parent.classList.toggle('is-active', isActive)
        else if (parent && parent !== this.tocRoot) parent.classList.toggle('is-active', isActive)
        if (isActive) lastActiveLink = link
      })
      // Do not auto-scroll the structure/TOC container
      this.lastActive = new Set(result.visible)
    },
  }

  watcher.ensureTargets(true)

  if (visibilityTracker && typeof visibilityTracker.subscribe === 'function') {
    try {
      const unsubscribe = visibilityTracker.subscribe(() => scheduleWatcherUpdate(false))
      watcher.__unsubscribeVisibility = unsubscribe
    } catch (error) {
      console.warn('Failed to subscribe to visibility tracker', error)
    }
  }

  tocRoot.addEventListener('click', async (e) => {
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
      const details = await ensureDetailsChain(path)
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
  // Also handle clicks on links in the content area (rendered markdown files)
  contentElement.addEventListener('click', async (e) => {
    const link =
      e.target && typeof e.target.closest === 'function' ? e.target.closest('a[data-path]') : null
    if (!link) return
    const path = link.dataset?.path || ''
    const type = link.dataset?.type || ''
    console.log('[Content Click] path:', path, 'type:', type)
    if (!path) {
      watcher.ignoreHashClearUntil = Date.now() + 1200
      return
    }
    watcher.ignoreHashClearUntil = Date.now() + 1600
    if (type === 'dir' || type === 'file') {
      e.preventDefault()
      console.log('[Content Click] Calling ensureDetailsChain for:', path)
      const details = await ensureDetailsChain(path)
      console.log('[Content Click] ensureDetailsChain returned:', details)
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
