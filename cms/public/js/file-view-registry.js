import { renderMarkdown, renderCSV, renderHTMLDocument, renderLaTeXDocument } from './renderers.js?v=20251004'
import { CodeView, guessLanguageFromFilename } from './code-view.js?v=20251004'

const registry = []

const DEFAULT_VIEW = {
  id: 'code-default',
  label: 'Code preview',
  contentFormat: 'text',
  priority: -Infinity,
  match: () => true,
  render: ({ meta, content }) => {
    const text = typeof content === 'string' ? content : String(content || '')
    const language = guessLanguageFromFilename(meta.name)
    const view = new CodeView({
      code: text,
      language,
      filename: meta.name,
      showCopy: true,
      showLanguage: true,
      showHeader: true,
    })
    return { element: view.element, headings: [] }
  },
}

function normaliseDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('Cannot register empty file view definition')
  }
  const { id } = definition
  if (!id || typeof id !== 'string') throw new Error('File view must have a string id')
  const priority = Number.isFinite(definition.priority) ? definition.priority : 0
  const match = typeof definition.match === 'function' ? definition.match : () => false
  const render = typeof definition.render === 'function' ? definition.render : () => null
  const contentFormat = definition.contentFormat || 'text'
  return { ...definition, id, priority, match, render, contentFormat }
}

export function registerFileView(definition) {
  const normalised = normaliseDefinition(definition)
  const existingIndex = registry.findIndex((entry) => entry.id === normalised.id)
  if (existingIndex >= 0) registry.splice(existingIndex, 1)
  const insertAt = registry.findIndex((entry) => entry.priority < normalised.priority)
  if (insertAt === -1) registry.push(normalised)
  else registry.splice(insertAt, 0, normalised)
}

export function listFileViews() {
  return registry.slice()
}

function extensionFromName(name) {
  const lower = String(name || '').toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return ''
  return lower.slice(dot)
}

export function buildFileMeta(node) {
  const name = String(node?.name || '')
  const path = typeof node?.path === 'string' && node.path ? node.path : name
  const nameExtension = extensionFromName(name)
  const pathExtension = extensionFromName(path)
  const extension = nameExtension || pathExtension
  const mime = node?.mime || node?.mimeType || ''
  return {
    node,
    name,
    path,
    extension,
    mime,
    lowerName: name.toLowerCase(),
    lowerPath: path.toLowerCase(),
    segments: path.split('/').filter(Boolean),
    type: node?.type || 'file',
  }
}

export function resolveFileView(node) {
  const meta = buildFileMeta(node)
  const view = registry.find((definition) => {
    try {
      return !!definition.match(meta)
    } catch (err) {
      console.warn('File view match predicate failed', definition.id, err)
      return false
    }
  })
  return { view: view || DEFAULT_VIEW, meta }
}

export function getDefaultFileView() {
  return DEFAULT_VIEW
}

registerFileView({
  id: 'markdown-document',
  label: 'Markdown document',
  priority: 100,
  contentFormat: 'text',
  match: (meta) => ['.md', '.markdown', '.mdown'].includes(meta.extension),
  render: ({ content, meta }) => {
    const raw = typeof content === 'string' ? content : String(content || '')
    const out = renderMarkdown(raw, meta.path)
    return { element: out.htmlEl, headings: out.headings }
  },
})

registerFileView({
  id: 'csv-table',
  label: 'CSV preview',
  priority: 90,
  contentFormat: 'text',
  match: (meta) => meta.extension === '.csv',
  render: ({ content }) => {
    const text = typeof content === 'string' ? content : String(content || '')
    const table = renderCSV(text)
    return { element: table, headings: [] }
  },
})

registerFileView({
  id: 'json-document',
  label: 'JSON viewer',
  priority: 85,
  contentFormat: 'text',
  match: (meta) => meta.extension === '.json',
  render: ({ content, meta }) => {
    const raw = typeof content === 'string' ? content : String(content || '')
    let formatted = raw
    try {
      const parsed = JSON.parse(raw)
      formatted = JSON.stringify(parsed, null, 2)
    } catch {}
    const view = new CodeView({
      code: formatted,
      language: 'json',
      filename: meta.name,
      showCopy: true,
      showLanguage: true,
      showHeader: true,
    })
    return { element: view.element, headings: [] }
  },
})

registerFileView({
  id: 'html-document',
  label: 'HTML document',
  priority: 80,
  contentFormat: 'text',
  match: (meta) => meta.extension === '.html' || meta.extension === '.htm',
  render: ({ content, meta }) => {
    const raw = typeof content === 'string' ? content : String(content || '')
    const out = renderHTMLDocument(raw, meta.path)
    return { element: out.htmlEl, headings: out.headings }
  },
})

registerFileView({
  id: 'latex-document',
  label: 'LaTeX preview',
  priority: 75,
  contentFormat: 'text',
  match: (meta) => ['.tex', '.latex', '.ltx'].includes(meta.extension),
  render: async ({ content, meta }) => {
    const raw = typeof content === 'string' ? content : String(content || '')
    const out = await renderLaTeXDocument(raw, meta.path)
    return { element: out.htmlEl, headings: out.headings }
  },
})
