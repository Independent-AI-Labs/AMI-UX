export const IGNORE_ATTR = 'data-ami-highlight-ignore'
export const IGNORE_VALUE = '1'
export const IGNORE_PROPS = Object.freeze({ [IGNORE_ATTR]: IGNORE_VALUE })
export const OWNED_ATTR = 'data-ami-highlight-owned'

const ElementRef = typeof Element !== 'undefined' ? Element : null

const IGNORE_SELECTOR = `[${IGNORE_ATTR}]`

let ignoreCache = new WeakMap()
let ignoreCacheToken = 0

function readIgnoreCache(node) {
  if (!node) return undefined
  const entry = ignoreCache.get(node)
  if (!entry) return undefined
  return entry.token === ignoreCacheToken ? entry.value : undefined
}

function writeIgnoreCache(node, value) {
  if (!node) return
  ignoreCache.set(node, { token: ignoreCacheToken, value })
}

export function resetIgnoreCache() {
  ignoreCacheToken += 1
  if (ignoreCacheToken > Number.MAX_SAFE_INTEGER - 1) {
    ignoreCacheToken = 0
    ignoreCache = new WeakMap()
  }
}

export function invalidateIgnoreCacheFor(node) {
  if (!node) return
  try {
    ignoreCache.delete(node)
  } catch {}
}

export function markIgnoredNode(node, options = {}) {
  if (!node || typeof node.setAttribute !== 'function') return node
  if (options.ignore === false) return node
  try {
    node.setAttribute(IGNORE_ATTR, IGNORE_VALUE)
    resetIgnoreCache()
  } catch {
    invalidateIgnoreCacheFor(node)
  }
  return node
}

export function markPluginNode(node, options = {}) {
  if (!node || typeof node.setAttribute !== 'function') return node
  try {
    node.setAttribute(OWNED_ATTR, '1')
  } catch {}
  if (options.ignore !== false) markIgnoredNode(node)
  invalidateIgnoreCacheFor(node)
  return node
}

export function isPluginNode(node) {
  if (!node || !ElementRef) return false
  if (node instanceof ElementRef) {
    try {
      return !!node.closest(`[${OWNED_ATTR}]`)
    } catch {
      return false
    }
  }
  return false
}

export function shouldIgnoreNode(node) {
  if (!node || !ElementRef) return false
  if (node instanceof ElementRef) {
    const cached = readIgnoreCache(node)
    if (typeof cached === 'boolean') return cached
    let ignored = false
    try {
      ignored = !!node.closest(IGNORE_SELECTOR)
    } catch {
      ignored = false
    }
    writeIgnoreCache(node, ignored)
    return ignored
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
export function withIgnoreProps(props = {}) {
  if (!props || typeof props !== 'object') {
    return { [IGNORE_ATTR]: IGNORE_VALUE }
  }
  if (props[IGNORE_ATTR] === IGNORE_VALUE) return props
  return { ...props, [IGNORE_ATTR]: IGNORE_VALUE }
}
