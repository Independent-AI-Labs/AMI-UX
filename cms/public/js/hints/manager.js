const STATE_MAP = new WeakMap()
const STYLE_ID = 'ami-hint-layer-style'
const OFFSET = 12
const ELEMENT_NODE = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1

const STYLE_RULES = `
.hint-layer {
  --hint-bg: #ffffff;
  --hint-border: rgba(28, 33, 45, 0.12);
  --hint-color: #3c414d;
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 5200;
  opacity: 0;
  transition: opacity var(--duration-fast, 120ms) var(--easing-standard, cubic-bezier(0.33, 0, 0.2, 1));
}

.hint-layer.is-visible {
  opacity: 1;
}

.hint-layer__bubble {
  position: fixed;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--hint-border);
  background: var(--hint-bg);
  color: var(--hint-color);
  font-size: 0.75rem;
  line-height: 1.35;
  min-width: 8.75rem;
  max-width: 15rem;
  box-shadow: 0 12px 26px rgba(12, 20, 33, 0.24);
  white-space: pre-line;
  opacity: 0;
  filter: blur(calc(var(--overlay-blur-strength, 8px) * 0.5));
  visibility: hidden;
  transition:
    opacity var(--duration-medium, 200ms) var(--easing-standard, cubic-bezier(0.33, 0, 0.2, 1)),
    filter var(--duration-medium, 200ms) var(--easing-standard, cubic-bezier(0.33, 0, 0.2, 1));
  pointer-events: none;
  letter-spacing: 0;
  will-change: opacity, filter;
}

.hint-layer.is-visible .hint-layer__bubble {
  opacity: 1;
  filter: blur(0px);
  visibility: visible;
}

.hint-layer__bubble::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--hint-bg);
  border-left: 1px solid var(--hint-border);
  border-top: 1px solid var(--hint-border);
  transform: rotate(45deg);
  bottom: -6px;
  left: var(--hint-arrow-x, 50%);
  margin-left: -0.375rem;
}

.hint-layer[data-position='bottom'] .hint-layer__bubble::after {
  bottom: auto;
  top: -6px;
  border-left: none;
  border-top: none;
  border-right: 1px solid var(--hint-border);
  border-bottom: 1px solid var(--hint-border);
}

.hint-layer[data-tone='warning'],
.hint-layer[data-tone='danger'] {
  --hint-bg: #ffffff;
  --hint-border: rgba(28, 33, 45, 0.12);
  --hint-color: #3c414d;
}
`

function getState(doc) {
  let state = STATE_MAP.get(doc)
  if (!state) {
    state = {
      layer: null,
      bubble: null,
      rafId: null,
      activeTarget: null,
      initialised: false,
      styleInjected: false,
      pendingEnsure: null,
    }
    STATE_MAP.set(doc, state)
  }
  return state
}

function ensureStyles(doc, state) {
  if (state.styleInjected) return
  const head = doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement
  if (!head) return
  if (doc.getElementById(STYLE_ID)) {
    state.styleInjected = true
    return
  }
  try {
    const style = doc.createElement('style')
    style.id = STYLE_ID
    style.type = 'text/css'
    style.textContent = STYLE_RULES
    head.appendChild(style)
    state.styleInjected = true
  } catch {}
}

function ensureLayer(doc, state) {
  if (state.layer && state.bubble) return true
  if (!doc.body) return false
  ensureStyles(doc, state)
  try {
    const layer = doc.createElement('div')
    layer.className = 'hint-layer'
    layer.setAttribute('aria-hidden', 'true')
    layer.setAttribute('data-ami-highlight-ignore', '1')
    const bubble = doc.createElement('div')
    bubble.className = 'hint-layer__bubble'
    bubble.setAttribute('role', 'tooltip')
    bubble.setAttribute('data-ami-highlight-ignore', '1')
    layer.appendChild(bubble)
    doc.body.appendChild(layer)
    state.layer = layer
    state.bubble = bubble
    return true
  } catch {}
  return false
}

function clearScheduledUpdate(state) {
  if (!state.rafId) return
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.rafId)
  state.rafId = null
}

function scheduleUpdate(doc, state) {
  clearScheduledUpdate(state)
  if (!state.activeTarget) return
  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    updatePosition(doc, state, state.activeTarget)
  })
}

function updatePosition(doc, state, target) {
  if (!state.layer || !state.bubble || !target || !state.activeTarget) return
  if (!target.isConnected) {
    hideHint(doc, state, target)
    return
  }
  const rect = target.getBoundingClientRect()
  const bubbleRect = state.bubble.getBoundingClientRect()
  let bubbleWidth = bubbleRect.width
  let bubbleHeight = bubbleRect.height
  if (!bubbleWidth || !bubbleHeight) {
    bubbleWidth = state.bubble.offsetWidth || bubbleWidth
    bubbleHeight = state.bubble.offsetHeight || bubbleHeight
  }
  if (!bubbleWidth || !bubbleHeight) return
  const viewportWidth = doc.defaultView?.innerWidth || doc.documentElement.clientWidth || 0
  const viewportHeight = doc.defaultView?.innerHeight || doc.documentElement.clientHeight || 0
  let left = rect.left + rect.width / 2 - bubbleWidth / 2
  left = Math.max(12, Math.min(viewportWidth - bubbleWidth - 12, left))
  let top = rect.top - bubbleHeight - OFFSET
  let position = 'top'
  const spaceBelow = viewportHeight - (rect.bottom + OFFSET + bubbleHeight)
  if (top < 12 && spaceBelow > 0) {
    top = rect.bottom + OFFSET
    position = 'bottom'
  } else {
    top = Math.max(12, top)
  }
  state.bubble.style.left = `${Math.round(left)}px`
  state.bubble.style.top = `${Math.round(top)}px`
  const arrowCenter = rect.left + rect.width / 2
  let arrowOffset = arrowCenter - left
  arrowOffset = Math.max(12, Math.min(bubbleWidth - 12, arrowOffset))
  state.bubble.style.setProperty('--hint-arrow-x', `${arrowOffset}px`)
  state.layer.dataset.position = position
}

function applyTone(state, target) {
  if (!state.layer) return
  const tone = target?.dataset?.hintTone || ''
  if (tone) state.layer.dataset.tone = tone
  else delete state.layer.dataset.tone
}

function showHint(doc, state, target) {
  if (!target || !ensureLayer(doc, state)) {
    if (!state.pendingEnsure) {
      const retry = () => {
        if (ensureLayer(doc, state)) {
          doc.removeEventListener('readystatechange', retry)
          state.pendingEnsure = null
        }
      }
      state.pendingEnsure = retry
      doc.addEventListener('readystatechange', retry)
    }
    return
  }
  const text = (target.dataset?.hint || '').trim()
  if (!text) {
    hideHint(doc, state, target)
    return
  }
  if (state.activeTarget !== target) {
    state.activeTarget = target
    state.bubble.textContent = text
    applyTone(state, target)
  }
  if (!state.layer.dataset.position) state.layer.dataset.position = 'top'
  updatePosition(doc, state, target)
  state.layer.setAttribute('aria-hidden', 'false')
  state.layer.classList.add('is-visible')
  scheduleUpdate(doc, state)
}

function hideHint(doc, state, target) {
  if (!state.activeTarget) return
  if (target && target !== state.activeTarget) return
  state.activeTarget = null
  clearScheduledUpdate(state)
  if (!state.layer || !state.bubble) return
  state.layer.classList.remove('is-visible')
  state.layer.setAttribute('aria-hidden', 'true')
  delete state.layer.dataset.position
  state.bubble.style.removeProperty('--hint-arrow-x')
}

function findHintTarget(doc, node) {
  let current = node
  while (current && current !== doc.body) {
    if (current.nodeType === ELEMENT_NODE && current.dataset?.hint) return current
    current = current.parentElement
  }
  if (doc.body?.dataset?.hint) return doc.body
  return null
}

function initDoc(doc) {
  const state = getState(doc)
  if (state.initialised) return state
  state.initialised = true

  const onPointerEnter = (event) => {
    const target = findHintTarget(doc, event.target)
    if (!target) return
    showHint(doc, state, target)
  }

  const onPointerLeave = (event) => {
    const target = findHintTarget(doc, event.target)
    if (!target) return
    if (event.relatedTarget && target.contains(event.relatedTarget)) return
    hideHint(doc, state, target)
  }

  const onPointerCancel = () => hideHint(doc, state)

  const onFocusIn = (event) => {
    const target = findHintTarget(doc, event.target)
    if (!target) return
    showHint(doc, state, target)
  }

  const onFocusOut = (event) => {
    if (!state.activeTarget) return
    const target = findHintTarget(doc, event.target)
    if (!target) return
    if (target.contains?.(event.relatedTarget)) return
    hideHint(doc, state, target)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') hideHint(doc, state)
  }

  const onVisibilityChange = () => {
    if (doc.hidden) hideHint(doc, state)
  }

  const onScroll = () => scheduleUpdate(doc, state)
  const onResize = () => scheduleUpdate(doc, state)

  doc.addEventListener('pointerenter', onPointerEnter, true)
  doc.addEventListener('pointerleave', onPointerLeave, true)
  doc.addEventListener('pointercancel', onPointerCancel)
  doc.addEventListener('focusin', onFocusIn)
  doc.addEventListener('focusout', onFocusOut)
  doc.addEventListener('keydown', onKeyDown)
  doc.addEventListener('visibilitychange', onVisibilityChange)
  doc.defaultView?.addEventListener('scroll', onScroll, true)
  doc.defaultView?.addEventListener('resize', onResize)

  if (doc.readyState === 'loading') {
    doc.addEventListener(
      'DOMContentLoaded',
      () => {
        ensureLayer(doc, state)
        scheduleUpdate(doc, state)
      },
      { once: true },
    )
  }

  return state
}

function initWhenReady(doc) {
  if (doc.readyState === 'loading') {
    const state = getState(doc)
    if (!state.initialised) {
      doc.addEventListener(
        'DOMContentLoaded',
        () => {
          initDoc(doc)
        },
        { once: true },
      )
    }
    return state
  }
  return initDoc(doc)
}

export function ensureDocumentHintLayer(doc = document) {
  if (!doc) return null
  return initWhenReady(doc)
}

export function refreshHintPositions(doc = document) {
  const state = STATE_MAP.get(doc)
  if (!state) return
  scheduleUpdate(doc, state)
}

export function forceHideHints(doc = document) {
  const state = STATE_MAP.get(doc)
  if (!state) return
  hideHint(doc, state)
}
