export const IGNORE_ATTR = 'data-ami-highlight-ignore'
export const ALT_IGNORE_ATTR = 'data-highlight-ignore'
export const IGNORE_CLASS = 'ami-highlight-ignore'
export const OWNED_ATTR = 'data-ami-highlight-owned'

const ElementRef = typeof Element !== 'undefined' ? Element : null

function hasAttr(el, attr) {
  if (!el || typeof el.hasAttribute !== 'function') return false
  try {
    return el.hasAttribute(attr)
  } catch {
    return false
  }
}

function closestAttr(el, attr) {
  if (!el || typeof el.closest !== 'function') return null
  try {
    return el.closest(`[${attr}]`)
  } catch {
    return null
  }
}

function hasClass(el, className) {
  if (!el || !className) return false
  const cls = typeof el.classList !== 'undefined' ? el.classList : null
  try {
    return !!cls && cls.contains(className)
  } catch {
    return false
  }
}

function closestClass(el, className) {
  if (!el || !className || typeof el.closest !== 'function') return null
  try {
    return el.closest('.' + className)
  } catch {
    return null
  }
}

export function markIgnoredNode(node, options = {}) {
  if (!node) return node
  const setAttr = options.attr !== false
  const setAltAttr = options.altAttr === true || options.attr !== false
  const setClass = options.class !== false
  if (setAttr && typeof node.setAttribute === 'function') {
    try {
      node.setAttribute(IGNORE_ATTR, '1')
    } catch {}
  }
  if (setAltAttr && typeof node.setAttribute === 'function') {
    try {
      node.setAttribute(ALT_IGNORE_ATTR, '1')
    } catch {}
  }
  if (setClass && node.classList) {
    try {
      node.classList.add(IGNORE_CLASS)
    } catch {}
  }
  return node
}

export function markPluginNode(node, options = {}) {
  if (!node || typeof node.setAttribute !== 'function') return node
  try {
    node.setAttribute(OWNED_ATTR, '1')
  } catch {}
  if (options.ignore !== false) markIgnoredNode(node, { altAttr: true })
  return node
}

export function isPluginNode(node) {
  if (!node || !ElementRef) return false
  if (node instanceof ElementRef) {
    if (hasAttr(node, OWNED_ATTR)) return true
    const owner = closestAttr(node, OWNED_ATTR)
    return !!owner
  }
  return false
}

export function shouldIgnoreNode(node) {
  if (!node || !ElementRef) return false
  if (node instanceof ElementRef) {
    if (hasAttr(node, IGNORE_ATTR) || hasAttr(node, ALT_IGNORE_ATTR) || hasClass(node, IGNORE_CLASS)) {
      return true
    }
    if (
      closestAttr(node, IGNORE_ATTR) ||
      closestAttr(node, ALT_IGNORE_ATTR) ||
      closestClass(node, IGNORE_CLASS)
    ) {
      return true
    }
  }
  return false
}

export function filterIgnored(collection) {
  const out = []
  if (!collection || !ElementRef) return out
  for (const node of collection) {
    if (!(node instanceof ElementRef)) continue
    if (shouldIgnoreNode(node)) continue
    out.push(node)
  }
  return out
}
