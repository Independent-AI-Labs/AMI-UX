export const IGNORE_ATTR = 'data-ami-highlight-ignore'
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

export function markPluginNode(node, options = {}) {
  if (!node || typeof node.setAttribute !== 'function') return node
  try {
    node.setAttribute(OWNED_ATTR, '1')
  } catch {}
  if (options.ignore !== false) {
    try {
      node.setAttribute(IGNORE_ATTR, '1')
    } catch {}
  }
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
    if (hasAttr(node, IGNORE_ATTR)) return true
    const owner = closestAttr(node, IGNORE_ATTR)
    return !!owner
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
