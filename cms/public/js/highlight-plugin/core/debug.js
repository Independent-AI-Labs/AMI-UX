const GLOBAL_KEY = '__AMI_HIGHLIGHT_DEBUG__'
const FORCE_DISABLED = true

function getGlobal() {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof window !== 'undefined') return window
  if (typeof self !== 'undefined') return self
  return {}
}

function normalizeDebugState(value) {
  if (value === true || value === 'all') return { all: true }
  if (value === false || value == null) return null
  if (Array.isArray(value)) {
    const next = {}
    for (const entry of value) {
      if (!entry) continue
      next[String(entry)] = true
    }
    return Object.keys(next).length ? next : null
  }
  if (typeof value === 'string') return { [value]: true }
  if (typeof value === 'object') {
    const next = {}
    for (const [key, enabled] of Object.entries(value)) {
      if (!enabled) continue
      next[String(key)] = true
    }
    return Object.keys(next).length ? next : null
  }
  return null
}

export function setDebugEnabled(value) {
  if (FORCE_DISABLED) return
  const globalRef = getGlobal()
  try {
    const normalized = normalizeDebugState(value)
    if (normalized) globalRef[GLOBAL_KEY] = normalized
    else globalRef[GLOBAL_KEY] = { __disabled: true }
  } catch {}
}

export function isDebugEnabled(channel) {
  if (FORCE_DISABLED) return false
  const globalRef = getGlobal()
  let state
  try {
    state = globalRef[GLOBAL_KEY]
  } catch {
    state = null
  }
  if (!state) return false
  if (state === true) return true
  if (typeof state !== 'object') return !!state
  if (state.__disabled) return false
  if (state.all) return true
  if (!channel) return false
  if (state[channel]) return true
  if (typeof channel === 'string') {
    const prefix = channel.split(':')[0]
    if (prefix && state[prefix]) return true
  }
  return false
}

export function debugLog(...args) {
  if (FORCE_DISABLED) return
  if (!args.length) return
  const maybeLabel = args[0]
  const label = typeof maybeLabel === 'string' ? maybeLabel : null
  const payload = label ? args.slice(1) : args
  if (!isDebugEnabled(label)) return
  try {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      const parts = label ? [label, ...payload] : payload
      console.log('[highlight]', ...parts)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      const parts = label ? [label, ...payload] : payload
      console.debug('[highlight]', ...parts)
    }
  } catch {}
}
