export const EXCLUDE_ATTR = 'data-ami-highlight-exclude'
export const EXCLUDE_VALUE = '1'
export const EXCLUDE_PROPS = Object.freeze({ [EXCLUDE_ATTR]: EXCLUDE_VALUE })
export const OWNED_ATTR = 'data-ami-highlight-owned'

const ElementRef = typeof Element !== 'undefined' ? Element : null

const EXCLUDE_SELECTOR = `[${EXCLUDE_ATTR}]`

let excludeCache = new WeakMap()
let excludeCacheToken = 0

function readExcludeCache(node) {
  if (!node) return undefined
  const entry = excludeCache.get(node)
  if (!entry) return undefined
  return entry.token === excludeCacheToken ? entry.value : undefined
}

function writeExcludeCache(node, value) {
  if (!node) return
  excludeCache.set(node, { token: excludeCacheToken, value })
}

export function resetExcludeCache() {
  excludeCacheToken += 1
  if (excludeCacheToken > Number.MAX_SAFE_INTEGER - 1) {
    excludeCacheToken = 0
    excludeCache = new WeakMap()
  }
}

export function invalidateExcludeCacheFor(node) {
  if (!node) return
  try {
    excludeCache.delete(node)
  } catch {}
}

export function markExcludedNode(node, options = {}) {
  if (!node || typeof node.setAttribute !== 'function') return node
  if (options.exclude === false) return node
  try {
    node.setAttribute(EXCLUDE_ATTR, EXCLUDE_VALUE)
    resetExcludeCache()
  } catch {
    invalidateExcludeCacheFor(node)
  }
  return node
}

export function markPluginNode(node, options = {}) {
  if (!node || typeof node.setAttribute !== 'function') return node
  try {
    node.setAttribute(OWNED_ATTR, '1')
  } catch {}
  if (options.exclude !== false) markExcludedNode(node)
  invalidateExcludeCacheFor(node)
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

export function shouldExcludeNode(node) {
  if (!node || !ElementRef) return false
  if (node instanceof ElementRef) {
    const cached = readExcludeCache(node)
    if (typeof cached === 'boolean') return cached
    let excluded = false
    try {
      excluded = !!node.closest(EXCLUDE_SELECTOR)
    } catch {
      excluded = false
    }
    writeExcludeCache(node, excluded)
    return excluded
  }
  return false
}

export function filterExcluded(collection) {
  const out = []
  if (!collection || !ElementRef) return out
  for (const node of collection) {
    if (!(node instanceof ElementRef)) continue
    if (shouldExcludeNode(node)) continue
    out.push(node)
  }
  return out
}
export function withExcludeProps(props = {}) {
  if (!props || typeof props !== 'object') {
    return { [EXCLUDE_ATTR]: EXCLUDE_VALUE }
  }
  if (props[EXCLUDE_ATTR] === EXCLUDE_VALUE) return props
  return { ...props, [EXCLUDE_ATTR]: EXCLUDE_VALUE }
}
