import { slugify, pathAnchor } from './utils.js'
import { CodeView, guessLanguageFromClassName, normaliseLanguageHint } from './code-view.js'

const DOCUMENT_NODE = 9
const DOCUMENT_FRAGMENT_NODE = 11

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
    console.warn('Failed to sanitise HTML document, falling back to raw text', err)
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

const LATEX_ASSET_BASE = 'vendor/latexjs'
const LATEX_SCRIPT_URL = `${LATEX_ASSET_BASE}/latex.min.js`
const LATEX_STYLESHEET_URL = `${LATEX_ASSET_BASE}/latex.min.css`

let latexSupportPromise = null

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document is not available'))
      return
    }
    const existing = document.querySelector(`script[data-latex-src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve(existing)
      else {
        existing.addEventListener('load', () => resolve(existing), { once: true })
        existing.addEventListener('error', (err) => reject(err), { once: true })
      }
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.latexSrc = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve(script)
    })
    script.addEventListener('error', (err) => {
      script.remove()
      reject(err)
    })
    document.head.appendChild(script)
  })
}

function loadStylesheetOnce(href) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document is not available'))
      return
    }
    const existing = document.querySelector(`link[data-latex-href="${href}"]`)
    if (existing) {
      resolve(existing)
      return
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.latexHref = href
    link.crossOrigin = 'anonymous'
    link.referrerPolicy = 'no-referrer'
    link.addEventListener('load', () => resolve(link), { once: true })
    link.addEventListener('error', (err) => {
      link.remove()
      reject(err)
    })
    document.head.appendChild(link)
  })
}

function ensureLatexSupport() {
  if (latexSupportPromise) return latexSupportPromise
  latexSupportPromise = new Promise(async (resolve, reject) => {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('LaTeX renderer requires browser environment')
      }
      if (window.latexjs) {
        resolve(window.latexjs)
        return
      }
      await Promise.all([loadStylesheetOnce(LATEX_STYLESHEET_URL), loadScriptOnce(LATEX_SCRIPT_URL)])
      if (window.latexjs) resolve(window.latexjs)
      else throw new Error('latex.js failed to load')
    } catch (err) {
      latexSupportPromise = null
      reject(err)
    }
  })
  return latexSupportPromise
}

function adoptInto(target, source) {
  if (!target || !source) return
  const doc = target.ownerDocument || document
  const adoptNode = (node) => doc.importNode ? doc.importNode(node, true) : node.cloneNode(true)

  const appendChildren = (node) => {
    if (!node) return
    if (node.nodeType === DOCUMENT_FRAGMENT_NODE || node.nodeType === DOCUMENT_NODE) {
      const fragmentChildren = node.nodeType === DOCUMENT_NODE && node.body ? node.body.childNodes : node.childNodes
      fragmentChildren && Array.from(fragmentChildren).forEach((child) => appendChildren(child))
      return
    }
    target.appendChild(adoptNode(node))
  }

  if (source.nodeType === DOCUMENT_FRAGMENT_NODE) {
    Array.from(source.childNodes || []).forEach((child) => appendChildren(child))
    return
  }
  if (source.nodeType === DOCUMENT_NODE) {
    const body = source.body || source.documentElement
    if (body) Array.from(body.childNodes || []).forEach((child) => appendChildren(child))
    return
  }
  if (source.childNodes && source !== target) {
    Array.from(source.childNodes).forEach((child) => appendChildren(child))
    return
  }
  if (source.nodeType) {
    appendChildren(source)
  }
}

function extractHeadingsFrom(container, relPath) {
  const base = pathAnchor(relPath)
  const seen = new Set()
  const headings = []
  container.querySelectorAll('h1, h2, h3, h4').forEach((heading) => {
    if (!(heading instanceof HTMLElement)) return
    const level = parseInt(heading.tagName.slice(1), 10)
    if (!Number.isFinite(level)) return
    const text = (heading.textContent || '').replace('¶', '').trim()
    if (!text) return
    let id = heading.id ? heading.id.trim() : ''
    if (!id) {
      const slugBase = slugify(text) || 'section'
      let suffix = 0
      let candidate = `${base}-${slugBase}`
      while (seen.has(candidate)) {
        suffix += 1
        candidate = `${base}-${slugBase}-${suffix}`
      }
      id = candidate
    }
    seen.add(id)
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
  return headings
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

  let headings = []

  try {
    const latexjs = await ensureLatexSupport()
    const generator = new latexjs.HtmlGenerator({ hyphenate: 'en-us' })
    latexjs.parse(raw, { generator })
    const fragment =
      typeof generator.domFragment === 'function'
        ? generator.domFragment()
        : typeof generator.documentFragment === 'function'
        ? generator.documentFragment()
        : null

    if (fragment) {
      adoptInto(page, fragment)
      headings = extractHeadingsFrom(page, relPath)
    } else {
      throw new Error('latex.js did not return a fragment')
    }
  } catch (err) {
    console.warn('LaTeX render failed, showing source', err)
    const notice = document.createElement('div')
    notice.className = 'latex-document__fallback'
    notice.textContent = 'Unable to render this LaTeX document. Showing source.'
    page.appendChild(notice)
    const fallback = new CodeView({
      code: raw,
      language: 'latex',
      showCopy: true,
      showLanguage: true,
      showHeader: true,
    })
    page.appendChild(fallback.element)
  }

  return { htmlEl: wrapper, headings }
}
