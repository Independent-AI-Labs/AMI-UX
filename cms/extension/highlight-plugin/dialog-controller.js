const globalObj = typeof window !== 'undefined' ? window : globalThis

const RAF =
  (globalObj.requestAnimationFrame && globalObj.requestAnimationFrame.bind(globalObj)) ||
  ((cb) => setTimeout(cb, 16))
const CANCEL_RAF =
  (globalObj.cancelAnimationFrame && globalObj.cancelAnimationFrame.bind(globalObj)) || clearTimeout

const STATE_CLOSED = 'closed'
const STATE_ENTER = 'enter'
const STATE_OPEN = 'open'
const STATE_CLOSING = 'closing'

function setState(el, state) {
  if (!el) return
  el.dataset.state = state
}

function ensureClosedState(overlay, surface) {
  setState(overlay, STATE_CLOSED)
  setState(surface, STATE_CLOSED)
  if (overlay) overlay.hidden = true
}

export function createDialogController(options = {}) {
  const {
    overlay,
    surface,
    allowBackdropClose = true,
    closeDelay = 240,
    closeOnEscape = true,
    onOpen,
    onClose,
  } = options

  if (!overlay) throw new Error('createDialogController requires an overlay element')
  const surfaceEl = surface || overlay.querySelector('.dialog-surface') || overlay.firstElementChild

  let state = STATE_CLOSED
  let rafId = null
  let closeTimer = null
  let escHandler = null

  ensureClosedState(overlay, surfaceEl)

  function clearTimers() {
    if (rafId != null) {
      CANCEL_RAF(rafId)
      rafId = null
    }
    if (closeTimer != null) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  function bindEscape() {
    if (!closeOnEscape || escHandler) return
    if (typeof globalObj.addEventListener !== 'function') return
    escHandler = (event) => {
      const key = event.key || event.code || ''
      if (key === 'Escape' || key === 'Esc') {
        event.preventDefault()
        closeInternal(true)
      }
    }
    globalObj.addEventListener('keydown', escHandler)
  }

  function unbindEscape() {
    if (!escHandler) return
    if (typeof globalObj.removeEventListener === 'function') {
      globalObj.removeEventListener('keydown', escHandler)
    }
    escHandler = null
  }

  function commitClosed() {
    clearTimers()
    ensureClosedState(overlay, surfaceEl)
    if (state !== STATE_CLOSED) {
      state = STATE_CLOSED
      unbindEscape()
      onClose?.()
    }
  }

  function openInternal() {
    if (state === STATE_OPEN || state === STATE_ENTER) return
    clearTimers()
    bindEscape()
    overlay.hidden = false
    setState(overlay, STATE_ENTER)
    setState(surfaceEl, STATE_ENTER)
    state = STATE_ENTER
    rafId = RAF(() => {
      rafId = null
      setState(overlay, STATE_OPEN)
      setState(surfaceEl, STATE_OPEN)
      state = STATE_OPEN
      onOpen?.()
    })
  }

  function closeInternal(immediate = false) {
    if (state === STATE_CLOSED && !immediate) return
    clearTimers()
    if (immediate || state === STATE_ENTER) {
      commitClosed()
      return
    }
    setState(overlay, STATE_CLOSING)
    setState(surfaceEl, STATE_CLOSING)
    state = STATE_CLOSING
    closeTimer = globalObj.setTimeout(() => {
      closeTimer = null
      commitClosed()
    }, closeDelay)
  }

  function toggleInternal() {
    if (state === STATE_OPEN || state === STATE_ENTER) {
      closeInternal()
    } else {
      openInternal()
    }
  }

  const backdropHandler = (event) => {
    if (!allowBackdropClose) return
    if (event.target === overlay) closeInternal()
  }
  overlay.addEventListener('mousedown', backdropHandler)

  const controller = {
    open: openInternal,
    close(immediate = false) {
      closeInternal(immediate)
    },
    toggle: toggleInternal,
    isOpen: () => state === STATE_OPEN || state === STATE_ENTER,
    destroy() {
      clearTimers()
      unbindEscape()
      overlay.removeEventListener('mousedown', backdropHandler)
      commitClosed()
    },
  }

  return controller
}

export function destroyDialogController(controller) {
  if (controller && typeof controller.destroy === 'function') controller.destroy()
}
