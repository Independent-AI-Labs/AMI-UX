const DEFAULT_ACK_TIMEOUT = 600
const DEFAULT_MAX_ATTEMPTS = 4
const CHANNEL = 'cms-doc'
const ACK_TYPE = 'cms:ack'
const defaultWindow = typeof window !== 'undefined' ? window : null
const timerHost = typeof window !== 'undefined' ? window : globalThis

function isValidTarget(win) {
  if (!win) return false
  try {
    return typeof win.postMessage === 'function'
  } catch {
    return false
  }
}

export function createDocMessenger(options = {}) {
  const {
    getTargets,
    sourceWindow = defaultWindow || timerHost,
    origin = '*',
    ackTimeout = DEFAULT_ACK_TIMEOUT,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    onTimeout,
  } = options

  if (typeof getTargets !== 'function') {
    throw new Error('createDocMessenger requires a getTargets() function')
  }
  if (!sourceWindow || typeof sourceWindow.addEventListener !== 'function') {
    throw new Error('createDocMessenger requires a window-like object with addEventListener')
  }

  let seq = Date.now()
  const pending = new Map()

  function cleanupPending(requestId, resolver, data) {
    const entry = pending.get(requestId)
    if (!entry) return
    if (entry.timer != null) {
      sourceWindow.clearTimeout(entry.timer)
    }
    pending.delete(requestId)
    resolver?.(data)
  }

  function handleAck(event) {
    const data = event?.data
    if (!data || data.type !== ACK_TYPE) return
    const { requestId } = data
    if (requestId == null) return
    cleanupPending(requestId, pending.get(requestId)?.resolve, data)
  }

  sourceWindow.addEventListener('message', handleAck)

  function dispose() {
    sourceWindow.removeEventListener('message', handleAck)
    for (const [id, entry] of pending.entries()) {
      if (entry.timer != null) sourceWindow.clearTimeout(entry.timer)
      entry.reject?.(new Error('Doc messenger disposed'))
    }
    pending.clear()
  }

  function dispatch(message, overrides = {}) {
    const requestId = overrides.requestId ?? ++seq
    const attemptsLimit = overrides.maxAttempts ?? maxAttempts
    const timeoutMs = overrides.ackTimeout ?? ackTimeout
    const envelope = {
      ...message,
      channel: CHANNEL,
      requestId,
      version: 1,
      sentAt: Date.now(),
    }

    let attempt = 0

    const sendAttempt = (resolve, reject) => {
      attempt += 1
      const targets = (() => {
        try {
          const value = getTargets()
          if (Array.isArray(value)) return value.filter(isValidTarget)
          if (isValidTarget(value)) return [value]
          return []
        } catch {
          return []
        }
      })()

      if (targets.length === 0) {
        // No targets; retry after timeout
        scheduleRetry(resolve, reject)
        return
      }

      for (const target of targets) {
        try {
          target.postMessage(envelope, origin)
        } catch {}
      }

      scheduleRetry(resolve, reject)
    }

    const scheduleRetry = (resolve, reject) => {
      const entry = pending.get(requestId)
      if (!entry) return
      entry.timer = sourceWindow.setTimeout(() => {
        if (!pending.has(requestId)) return
        if (attempt >= attemptsLimit) {
          pending.delete(requestId)
          if (typeof onTimeout === 'function') {
            onTimeout({ message: envelope, attempts: attempt })
          }
          reject(new Error(`Doc message timed out: ${message?.type || 'unknown'}`))
          return
        }
        sendAttempt(resolve, reject)
      }, timeoutMs)
    }

    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject, timer: null })
      sendAttempt(resolve, reject)
    })
  }

  return {
    send: dispatch,
    dispose,
  }
}

const ackCache = new Map()
const ACK_CACHE_TTL = 8000

function rememberAck(requestId) {
  if (requestId == null) return
  const now = Date.now()
  ackCache.set(requestId, now)
  if (ackCache.size > 128) {
    for (const [key, value] of ackCache.entries()) {
      if (now - value > ACK_CACHE_TTL) ackCache.delete(key)
    }
    if (ackCache.size > 128) {
      const keys = Array.from(ackCache.keys())
      for (let i = 0; i < keys.length - 96; i += 1) {
        ackCache.delete(keys[i])
      }
    }
  }
  timerHost.setTimeout(() => ackCache.delete(requestId), ACK_CACHE_TTL)
}

export function acknowledgeParentMessage(message, details = {}) {
  try {
    const requestId = message?.requestId
    if (requestId == null || ackCache.has(requestId)) return
    rememberAck(requestId)
    const payload = {
      type: ACK_TYPE,
      requestId,
      status: typeof details === 'string' ? details : details?.status || 'ok',
    }
    if (details && typeof details === 'object') {
      if (details.error) payload.error = String(details.error)
      if (details.meta && typeof details.meta === 'object') payload.meta = { ...details.meta }
    }
    if (defaultWindow && defaultWindow.parent && typeof defaultWindow.parent.postMessage === 'function') {
      defaultWindow.parent.postMessage(payload, '*')
    }
  } catch (err) {
    console.warn('Failed to acknowledge parent message', err)
  }
}

export const messageChannel = {
  CHANNEL,
  ACK_TYPE,
}

