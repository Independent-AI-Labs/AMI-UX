import { ensureDocumentHintLayer } from './hints/manager.js'

// Utility helpers for CMS UI

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function pathAnchor(relPath) {
  return 'file-' + String(relPath || '').replace(/[^a-zA-Z0-9]+/g, '-')
}

export function humanizeName(name, type = 'file') {
  let base = String(name || '')
  if (type === 'file') {
    const dot = base.lastIndexOf('.')
    if (dot > 0) base = base.slice(0, dot)
  }
  base = base.replace(/[_\-]+/g, ' ')
  base = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  base = base.replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1 $2')
  base = base.replace(/\s+/g, ' ').trim()
  base = base
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
  return base
}

export function displayName(node) {
  const lname = String(node.name || '').toLowerCase()
  if (node.type === 'file' && lname === 'readme.md') return 'Introduction'
  return humanizeName(node.name, node.type)
}

export function normalizeFsPath(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const swapped = trimmed.replace(/\\/g, '/')
  let result = ''
  let lastWasSlash = false
  for (let i = 0; i < swapped.length; i += 1) {
    const ch = swapped[i]
    if (ch === '/') {
      if (lastWasSlash) continue
      lastWasSlash = true
    } else {
      lastWasSlash = false
    }
    result += ch
  }
  while (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1)
  }
  return result
}

function normaliseHintText(value) {
  if (value == null) return ''
  const str = typeof value === 'string' ? value : String(value)
  return str.trim()
}

export function applyHint(element, text, options = {}) {
  if (!element || typeof element !== 'object') return element
  const hint = normaliseHintText(text)
  try {
    if (typeof element.removeAttribute === 'function') element.removeAttribute('title')
  } catch {}
  if (!hint) {
    try {
      if (element.dataset) {
        delete element.dataset.hint
        delete element.dataset.hintTone
      } else {
        element.removeAttribute?.('data-hint')
        element.removeAttribute?.('data-hint-tone')
      }
      if (options.clearAriaLabel && typeof element.removeAttribute === 'function') {
        element.removeAttribute('aria-label')
      }
    } catch {}
    return element
  }
  try {
    if (element.dataset) {
      element.dataset.hint = hint
      if (options.tone) element.dataset.hintTone = options.tone
      else delete element.dataset.hintTone
    } else {
      element.setAttribute?.('data-hint', hint)
      if (options.tone) element.setAttribute?.('data-hint-tone', options.tone)
      else element.removeAttribute?.('data-hint-tone')
    }
    const needsAriaLabel =
      typeof element.getAttribute !== 'function' ||
      !element.getAttribute('aria-label') ||
      options.replaceAriaLabel
    if (needsAriaLabel) element.setAttribute?.('aria-label', hint)
    try {
      const doc = element.ownerDocument || document
      ensureDocumentHintLayer(doc)
    } catch {}
  } catch {}
  return element
}
