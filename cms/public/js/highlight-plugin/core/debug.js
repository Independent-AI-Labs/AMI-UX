const GLOBAL_KEY = '__AMI_HIGHLIGHT_DEBUG__'

function getGlobal() {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof window !== 'undefined') return window
  if (typeof self !== 'undefined') return self
  return {}
}

export function setDebugEnabled(value) {
  const globalRef = getGlobal()
  try {
    globalRef[GLOBAL_KEY] = value !== false
  } catch {}
}

export function isDebugEnabled() {
  const globalRef = getGlobal()
  try {
    if (Object.prototype.hasOwnProperty.call(globalRef, GLOBAL_KEY)) {
      return !!globalRef[GLOBAL_KEY]
    }
  } catch {}
  return true
}

export function debugLog(...args) {
  if (!isDebugEnabled()) return
  try {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[highlight]', ...args)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[highlight]', ...args)
    }
  } catch {}
}
