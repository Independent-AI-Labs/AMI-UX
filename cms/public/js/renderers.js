import { slugify, pathAnchor } from './utils.js'
import { CodeView, guessLanguageFromClassName, normaliseLanguageHint } from './code-view.js'

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
