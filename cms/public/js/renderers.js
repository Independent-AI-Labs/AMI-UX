import { slugify, pathAnchor } from './utils.js'
import { CodeView, guessLanguageFromClassName, normaliseLanguageHint } from './code-view.js'
import { ensureTexLiveCompiler } from './texlive/compiler.js'

const DEFAULT_LATEX_PAGE_WIDTH = 816

let pdfjsLibPromise = null

function ensurePdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('/vendor/pdfjs/pdf.min.mjs')
      .then((mod) => {
        const lib = mod?.default || mod?.pdfjsLib || mod
        if (!lib || !lib.getDocument) throw new Error('pdf.js unavailable')
        if (lib.GlobalWorkerOptions) {
          lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs'
        }
        return lib
      })
  }
  return pdfjsLibPromise
}

function createLatexHeadings(tocEntries, relPath) {
  const headings = []
  const perPage = new Map()
  const base = pathAnchor(relPath || '') || 'tex'
  const used = new Set()
  let collision = 0

  (tocEntries || []).forEach((entry) => {
    if (!entry) return
    const text = (entry.text || '').trim()
    if (!text) return
    const level = Math.min(Math.max(Number(entry.level || 1), 1), 4)
    const number = (entry.number || '').trim()
    const page = Number.isFinite(entry.page) && entry.page > 0 ? entry.page : 1
    const slugSource = number ? `${number} ${text}` : text
    const slug = slugify(slugSource) || slugify(text) || 'section'
    let id = `${base}-${slug}`
    while (used.has(id)) {
      collision += 1
      id = `${base}-${slug}-${collision}`
    }
    used.add(id)

    const label = number ? `${number} ${text}` : text
    const heading = { id, text: label, level, page }
    headings.push(heading)

    if (!perPage.has(page)) perPage.set(page, [])
    perPage.get(page).push(heading)
  })

  headings.sort((a, b) => a.page - b.page)
  return { headings, perPage }
}

async function renderPdfDocument({ pdfjsLib, container, pdfBytes, perPageHeadings }) {
  const pageMap = perPageHeadings instanceof Map ? perPageHeadings : new Map()
  container.classList.add('latex-document__page--pdf')
  container.innerHTML = ''
  const pagesHost = document.createElement('div')
  pagesHost.className = 'latex-document__pages'
  container.appendChild(pagesHost)

  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
  const pdf = await loadingTask.promise
  const numPages = pdf.numPages || 0
  let resolvedHeight = null
  const deviceScale = Math.max(globalThis.devicePixelRatio || 1, 1)

  for (let pageIndex = 1; pageIndex <= numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = DEFAULT_LATEX_PAGE_WIDTH / (baseViewport.width || DEFAULT_LATEX_PAGE_WIDTH)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    canvas.width = Math.ceil(viewport.width * deviceScale)
    canvas.height = Math.ceil(viewport.height * deviceScale)
    canvas.style.width = '100%'
    canvas.style.height = `${viewport.height}px`
    if (context) {
      context.scale(deviceScale, deviceScale)
      await page.render({ canvasContext: context, viewport }).promise
    }

    const pageWrap = document.createElement('div')
    pageWrap.className = 'latex-document__page-canvas'
    pageWrap.dataset.pageNumber = String(pageIndex)

    const anchors = pageMap.get(pageIndex) || []
    anchors.forEach((heading, idx) => {
      const anchor = document.createElement('div')
      anchor.id = heading.id
      anchor.className = 'latex-document__anchor'
      anchor.style.marginTop = idx === 0 ? '0px' : `${idx * 18}px`
      pageWrap.appendChild(anchor)
    })

    pageWrap.appendChild(canvas)
    pagesHost.appendChild(pageWrap)

    if (!resolvedHeight) resolvedHeight = viewport.height
    page.cleanup()
  }

  try {
    await pdf.cleanup()
  } catch {}
  try {
    await pdf.destroy()
  } catch {}

  return { pageCount: numPages, pageHeight: resolvedHeight }
}

const LATEX_API_ROOT = '/api/latex'
const DEFAULT_ROOT_KEY = 'docRoot'

async function fetchLatexCache(relPath, root = DEFAULT_ROOT_KEY) {
  try {
    const params = new URLSearchParams({ path: relPath, root })
    const res = await fetch(`${LATEX_API_ROOT}?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const data = await res.json()
    return { ...data, root }
  } catch {
    return null
  }
}

async function downloadLatexPdf(pdfRelPath, root = DEFAULT_ROOT_KEY) {
  const params = new URLSearchParams({ path: pdfRelPath, root })
  const res = await fetch(`/api/media?${params.toString()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to download rendered PDF')
  const buffer = await res.arrayBuffer()
  return new Uint8Array(buffer)
}

async function persistLatexResult(relPath, payload, root = DEFAULT_ROOT_KEY) {
  try {
    const form = new FormData()
    form.set('path', relPath)
    form.set('root', root)
    if (payload.headings && payload.headings.length) {
      form.set('headings', JSON.stringify(payload.headings))
    }
    if (payload.log && typeof payload.log === 'string' && payload.log.trim()) {
      form.set('log', payload.log)
    }
    const bytes = payload.pdfBytes instanceof Uint8Array ? payload.pdfBytes : new Uint8Array(payload.pdfBytes || [])
    const blob = new Blob([bytes], { type: 'application/pdf' })
    form.append('pdf', blob, 'render.pdf')
    await fetch(LATEX_API_ROOT, {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
  } catch (error) {
    console.warn('Failed to persist LaTeX render', error)
  }
}

function groupHeadingsByPage(headings) {
  const map = new Map()
  if (!Array.isArray(headings)) return map
  headings.forEach((heading) => {
    if (!heading || typeof heading !== 'object') return
    const page = Number.isFinite(heading.page) && heading.page > 0 ? heading.page : 1
    if (!map.has(page)) map.set(page, [])
    map.get(page).push(heading)
  })
  return map
}

function ensureRootAnchor(container, anchorId) {
  if (!anchorId) return
  try {
    if (container.querySelector(`#${CSS.escape(anchorId)}`)) return
  } catch {
    if (container.querySelector(`#${anchorId}`)) return
  }
  const anchor = document.createElement('div')
  anchor.id = anchorId
  anchor.className = 'latex-document__anchor latex-document__anchor--root'
  container.insertBefore(anchor, container.firstChild || null)
}

function createLatexOverlay() {
  const overlay = document.createElement('div')
  overlay.className = 'latex-document__overlay'
  const spinner = document.createElement('div')
  spinner.className = 'latex-document__spinner'
  const label = document.createElement('div')
  label.className = 'latex-document__status'
  label.textContent = 'Preparing LaTeX…'
  overlay.append(spinner, label)
  return {
    element: overlay,
    setStatus(text) {
      label.textContent = text
    },
    hide() {
      overlay.classList.add('latex-document__overlay--hidden')
      setTimeout(() => {
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay)
      }, 320)
    },
  }
}

export function renderMarkdown(md, relPath) {
  const raw = marked.parse(md)
  const html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
  const wrapper = document.createElement('div')
  wrapper.className = 'md'
  wrapper.innerHTML = html

  const codeBlocks = []

  // Transform mermaid code blocks into <div class="mermaid"> nodes, collect standard code blocks for the CodeView
  wrapper.querySelectorAll('pre > code').forEach((code) => {
    const cls = code.className || ''
    const source = code.textContent || ''
    if (
      cls.includes('language-mermaid') ||
      /^\s*graph|sequenceDiagram|classDiagram|stateDiagram/.test(source)
    ) {
      const div = document.createElement('div')
      div.className = 'mermaid'
      // Preserve original diagram source for reliable re-render on theme changes
      div.textContent = source
      div.dataset.src = source
      // Also stash on an expando for older DOM query patterns
      try {
        div.__mermaidSrc = source
      } catch {}
      const pre = code.parentElement
      pre?.replaceWith(div)
    } else {
      codeBlocks.push({ code, cls, source })
    }
  })

  codeBlocks.forEach(({ code, cls, source }) => {
    const dataset = code.dataset || {}
    const hints = [
      guessLanguageFromClassName(cls),
      normaliseLanguageHint(code.getAttribute('data-lang')),
      normaliseLanguageHint(dataset.lang),
      normaliseLanguageHint(dataset.language),
    ]
    const language = hints.find(Boolean) || ''
    const view = new CodeView({
      code: source,
      language,
      showCopy: true,
      showLanguage: true,
      showHeader: true,
    })
    const pre = code.parentElement
    pre?.replaceWith(view.element)
  })

  // Math rendering (inline $...$, $$...$$)
  try {
    renderMathInElement(wrapper, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
    })
  } catch {}

  // Initialize mermaid only for new nodes
  const mermaidBlocks = wrapper.querySelectorAll('.mermaid')
  if (mermaidBlocks.length && window.mermaid) {
    if (window.mermaid.run) window.mermaid.run({ nodes: mermaidBlocks })
    else if (window.mermaid.init) window.mermaid.init(undefined, mermaidBlocks)
  }

  // Headings: add ids + anchor links
  const headings = []
  wrapper.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
    const text = h.textContent || ''
    const id = pathAnchor(relPath) + '-' + slugify(text)
    h.id = id
    const a = document.createElement('a')
    a.href = '#' + id
    a.className = 'anchor'
    a.textContent = '¶'
    h.appendChild(a)
    headings.push({ id, text, level: parseInt(h.tagName.slice(1), 10) })
  })

  // Process links: external links open in new tabs, local .md links become navigation
  wrapper.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href) return

    // Skip anchor links
    if (href.startsWith('#')) return

    // Check if external link
    try {
      const url = new URL(href, window.location.href)
      const isExternal = url.origin !== window.location.origin

      if (isExternal) {
        // External links open in new tab
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
      } else if (href.endsWith('.md') || href.includes('.md#')) {
        // Local .md links: convert to navigation within the doc viewer
        link.addEventListener('click', async (e) => {
          e.preventDefault()

          // Parse the link - could be relative or absolute
          let targetPath = href

          // If it's a relative path, resolve it relative to the current file
          if (!href.startsWith('/')) {
            const currentDir = relPath.split('/').slice(0, -1).join('/')
            targetPath = currentDir ? `${currentDir}/${href}` : href
          }

          // Normalize the path (remove .md extension for anchor)
          const anchorPath = targetPath.replace(/\.md(#.*)?$/, '$1')
          const pathOnly = anchorPath.split('#')[0]
          const hashPart = anchorPath.includes('#') ? anchorPath.split('#')[1] : ''

          // Find the tree node link and trigger it, or set the hash
          const treeLink = document.querySelector(`a[data-path="${pathOnly}"][data-type="file"]`)
          if (treeLink) {
            treeLink.click()
            if (hashPart) {
              setTimeout(() => {
                window.location.hash = hashPart
              }, 100)
            }
          } else {
            // Fallback: just set the hash if we can't find the tree node
            window.location.hash = pathAnchor(pathOnly) + (hashPart ? `-${hashPart}` : '')
          }
        })
      }
    } catch {
      // If URL parsing fails, treat as relative/local link
      if (href.endsWith('.md') || href.includes('.md#')) {
        link.addEventListener('click', async (e) => {
          e.preventDefault()

          let targetPath = href
          if (!href.startsWith('/')) {
            const currentDir = relPath.split('/').slice(0, -1).join('/')
            targetPath = currentDir ? `${currentDir}/${href}` : href
          }

          const anchorPath = targetPath.replace(/\.md(#.*)?$/, '$1')
          const pathOnly = anchorPath.split('#')[0]
          const hashPart = anchorPath.includes('#') ? anchorPath.split('#')[1] : ''

          const treeLink = document.querySelector(`a[data-path="${pathOnly}"][data-type="file"]`)
          if (treeLink) {
            treeLink.click()
            if (hashPart) {
              setTimeout(() => {
                window.location.hash = hashPart
              }, 100)
            }
          } else {
            window.location.hash = pathAnchor(pathOnly) + (hashPart ? `-${hashPart}` : '')
          }
        })
      }
    }
  })

  return { htmlEl: wrapper, headings }
}

export function renderCSV(text) {
  const rows = []
  let i = 0,
    field = '',
    row = [],
    inQuotes = false
  while (i <= text.length) {
    const ch = text[i] || '\n'
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\n' || ch === '\r') {
        if (field !== '' || row.length) {
          row.push(field)
          rows.push(row)
          row = []
          field = ''
        }
      } else {
        field += ch
      }
    }
    i++
  }
  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'collapse'
  const mkCell = (tag, txt, isHeader = false) => {
    const el = document.createElement(tag)
    el.textContent = txt
    el.style.border = '1px solid var(--border)'
    el.style.padding = '6px 8px'
    if (isHeader) el.style.background = 'var(--panel)'
    return el
  }
  if (!rows.length) return table
  const thead = document.createElement('thead')
  const tbody = document.createElement('tbody')
  const [head, ...rest] = rows
  const trh = document.createElement('tr')
  head.forEach((h) => trh.appendChild(mkCell('th', h, true)))
  thead.appendChild(trh)
  rest.forEach((r) => {
    const tr = document.createElement('tr')
    r.forEach((c) => tr.appendChild(mkCell('td', c)))
    tbody.appendChild(tr)
  })
  table.appendChild(thead)
  table.appendChild(tbody)
  table.style.overflowX = 'auto'
  return table
}

export function renderHTMLDocument(htmlText, relPath) {
  const wrapper = document.createElement('div')
  wrapper.className = 'html-document'

  let sanitized
  try {
    sanitized = DOMPurify.sanitize(htmlText, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style'],
      KEEP_CONTENT: true,
      FORBID_TAGS: ['script'],
      RETURN_DOM_FRAGMENT: true,
    })
  } catch (err) {
    console.warn('Failed to sanitise HTML document, using raw text instead', err)
    wrapper.textContent = htmlText
    return { htmlEl: wrapper, headings: [] }
  }

  const fragment = document.createDocumentFragment()
  const tmp = document.createElement('template')

  if (sanitized instanceof DocumentFragment) {
    tmp.content.appendChild(sanitized)
  } else {
    tmp.innerHTML = typeof sanitized === 'string' ? sanitized : String(sanitized || '')
  }

  const transferChildNodes = (source, target) => {
    if (!source) return
    const nodes = Array.from(source.childNodes)
    nodes.forEach((node) => target.appendChild(node))
  }

  const appendInlineStyle = (target, styleValue) => {
    if (!styleValue) return
    const current = target.style.cssText || ''
    const cleaned = current.endsWith(';') ? current.slice(0, -1) : current
    target.style.cssText = cleaned ? `${cleaned}; ${styleValue}` : styleValue
  }

  const htmlNode = tmp.content.querySelector('html')
  if (htmlNode instanceof HTMLElement) {
    if (htmlNode.hasAttribute('style')) appendInlineStyle(wrapper, htmlNode.getAttribute('style'))
    if (htmlNode.classList?.length) htmlNode.classList.forEach((cls) => wrapper.classList.add(cls))
  }

  const headNode = tmp.content.querySelector('head')
  if (headNode instanceof HTMLElement) {
    headNode.querySelectorAll('style').forEach((styleEl) => {
      fragment.appendChild(styleEl)
    })
    headNode.remove()
  }

  const bodyNode = tmp.content.querySelector('body')
  if (bodyNode instanceof HTMLElement) {
    if (bodyNode.hasAttribute('style')) appendInlineStyle(wrapper, bodyNode.getAttribute('style'))
    if (bodyNode.classList?.length) bodyNode.classList.forEach((cls) => wrapper.classList.add(cls))
    transferChildNodes(bodyNode, fragment)
    bodyNode.remove()
  }

  transferChildNodes(tmp.content, fragment)
  wrapper.appendChild(fragment)

  const seenIds = new Set()
  const base = pathAnchor(relPath)
  const headings = []
  wrapper.querySelectorAll('h1, h2, h3, h4').forEach((heading) => {
    if (!(heading instanceof HTMLElement)) return
    const tag = heading.tagName || ''
    const level = parseInt(tag.slice(1), 10)
    if (!Number.isFinite(level)) return
    const text = (heading.textContent || '').replace('¶', '').trim()
    if (!text) return

    let id = heading.id ? heading.id.trim() : ''
    if (!id) {
      const slugBase = slugify(text) || 'section'
      let suffix = 0
      let candidate = `${base}-${slugBase}`
      while (seenIds.has(candidate)) {
        suffix += 1
        candidate = `${base}-${slugBase}-${suffix}`
      }
      id = candidate
    }
    seenIds.add(id)
    heading.id = id
    if (!heading.querySelector(':scope > a.anchor')) {
      const anchor = document.createElement('a')
      anchor.href = '#' + id
      anchor.className = 'anchor'
      anchor.textContent = '¶'
      heading.appendChild(anchor)
    }
    headings.push({ id, text, level })
  })

  return { htmlEl: wrapper, headings }
}

export async function renderLaTeXDocument(texSource, relPath) {
  const raw = typeof texSource === 'string' ? texSource : String(texSource || '')
  if (!raw.trim()) {
    const empty = document.createElement('div')
    empty.className = 'latex-document latex-document--empty'
    empty.textContent = 'Empty LaTeX file'
    return { htmlEl: empty, headings: [] }
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'latex-document'

  const viewport = document.createElement('div')
  viewport.className = 'latex-document__viewport'

  const page = document.createElement('article')
  page.className = 'latex-document__page'

  viewport.appendChild(page)
  wrapper.appendChild(viewport)

  const overlay = createLatexOverlay()
  viewport.appendChild(overlay.element)

  const rootAnchorId = pathAnchor(relPath || '')
  const rootKey = DEFAULT_ROOT_KEY
  let headings = []

  try {
    overlay.setStatus('Checking cached render…')
    const cache = await fetchLatexCache(relPath, rootKey)

    let pdfBytes = null
    let perPageMap = new Map()
    let compilePayload = null

    if (cache && cache.hasPdf && !cache.stale && cache.pdfPath) {
      overlay.setStatus('Loading cached PDF…')
      try {
        pdfBytes = await downloadLatexPdf(cache.pdfPath, cache.root || rootKey)
        headings = Array.isArray(cache.headings) ? cache.headings : []
        perPageMap = groupHeadingsByPage(headings)
      } catch (err) {
        console.warn('Failed to load cached LaTeX PDF, recompiling', err)
      }
    }

    if (!pdfBytes) {
      overlay.setStatus('Compiling LaTeX…')
      const compiler = await ensureTexLiveCompiler()
      const result = await compiler.compile(raw)
      pdfBytes = result.pdfBytes instanceof Uint8Array ? result.pdfBytes : new Uint8Array(result.pdfBytes || [])
      const computed = createLatexHeadings(result.toc, relPath)
      headings = computed.headings
      perPageMap = computed.perPage
      compilePayload = { pdfBytes, headings, log: result.log }
    }

    overlay.setStatus('Rendering PDF…')
    const pdfjsLib = await ensurePdfJs()
    const { pageHeight } = await renderPdfDocument({
      pdfjsLib,
      container: page,
      pdfBytes,
      perPageHeadings: perPageMap,
    })
    if (pageHeight && Number.isFinite(pageHeight)) {
      wrapper.style.setProperty('--latex-page-height', `${Math.round(pageHeight)}px`)
    }
    if (rootAnchorId) ensureRootAnchor(page, rootAnchorId)
    if (!headings.length && rootAnchorId) {
      headings = [{ id: rootAnchorId, text: 'Document', level: 1, page: 1 }]
    }

    if (compilePayload) {
      overlay.setStatus('Saving render…')
      await persistLatexResult(relPath, compilePayload, rootKey)
    }

    overlay.hide()
  } catch (err) {
    overlay.hide()
    console.warn('LaTeX render failed, showing source', err)
    const hasPageSibling = page.parentElement === viewport
    if (hasPageSibling) viewport.removeChild(page)
    const notice = document.createElement('div')
    notice.className = 'latex-document__error-notice'
    notice.textContent = 'Unable to render this LaTeX document. Showing source.'
    if (err && err.message) {
      const sub = document.createElement('div')
      sub.className = 'latex-document__error-detail'
      sub.textContent = err.message
      notice.appendChild(sub)
    }
    const sourceView = new CodeView({
      code: raw,
      language: 'latex',
      showCopy: true,
      showLanguage: true,
      showHeader: true,
    })
    const fragment = document.createDocumentFragment()
    fragment.appendChild(notice)
    fragment.appendChild(sourceView.element)
    viewport.appendChild(fragment)
    headings = rootAnchorId ? [{ id: rootAnchorId, text: 'Document', level: 1 }] : []
  }

  return { htmlEl: wrapper, headings }
}
