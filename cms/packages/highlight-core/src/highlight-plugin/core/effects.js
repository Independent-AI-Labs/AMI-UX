import { IGNORE_ATTR, invalidateIgnoreCacheFor, markPluginNode, resetIgnoreCache, shouldIgnoreNode } from './dom-utils.js'
import { debugLog } from './debug.js'

const STYLE_ID = 'fx-glow-highlight-style'

const ASYNC_SLICE_BUDGET = 12

function now() {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function waitForIdle(timeout = 16) {
  if (typeof requestIdleCallback === 'function') {
    return new Promise((resolve) => requestIdleCallback(() => resolve(), { timeout }))
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const INTENSITY_PRESETS = {
  soft: {
    blockScaleRest: 0.97,
    blockScaleActive: 1.04,
    blockCore: '26%',
    blockMid: '16%',
    blockOpacity: '0.9',
    blockBlur: '6px',
    inlineScaleRest: 0.98,
    inlineScaleActive: 1.01,
    inlineCore: '24%',
    inlineMid: '14%',
    inlineOpacity: '0.95',
    underlineOpacity: '0.5',
    treeScaleActive: 1.03,
    treeCore: '28%',
    treeMid: '16%',
  },
  medium: {
    blockScaleRest: 0.94,
    blockScaleActive: 1.06,
    blockCore: '34%',
    blockMid: '20%',
    blockOpacity: '1',
    blockBlur: '9px',
    inlineScaleRest: 0.96,
    inlineScaleActive: 1.02,
    inlineCore: '30%',
    inlineMid: '16%',
    inlineOpacity: '1',
    underlineOpacity: '0.65',
    treeScaleActive: 1.05,
    treeCore: '38%',
    treeMid: '20%',
  },
  bold: {
    blockScaleRest: 0.92,
    blockScaleActive: 1.09,
    blockCore: '42%',
    blockMid: '26%',
    blockOpacity: '1',
    blockBlur: '11px',
    inlineScaleRest: 0.94,
    inlineScaleActive: 1.04,
    inlineCore: '38%',
    inlineMid: '22%',
    inlineOpacity: '1',
    underlineOpacity: '0.8',
    treeScaleActive: 1.07,
    treeCore: '46%',
    treeMid: '24%',
  },
}

export const HIGHLIGHT_CLASSES = {
  block: 'glow-block',
  inline: 'glow-inline',
  underline: 'glow-underline',
  tree: 'glow-tree',
  active: 'glow-active',
  ancestor: 'glow-ancestor',
}

const HOVER_OVERLAY_CLASS = 'glow-hover-actions'
const HOVER_BTN_CLASS = 'act'

function applyIntensityPreset(doc, intensity = 'medium') {
  const preset = INTENSITY_PRESETS[intensity] || INTENSITY_PRESETS.medium
  const root = doc.documentElement
  const mappings = {
    '--glow-block-scale-rest': preset.blockScaleRest,
    '--glow-block-scale-active': preset.blockScaleActive,
    '--glow-block-core': preset.blockCore,
    '--glow-block-mid': preset.blockMid,
    '--glow-block-opacity': preset.blockOpacity,
    '--glow-block-blur': preset.blockBlur,
    '--glow-inline-scale-rest': preset.inlineScaleRest,
    '--glow-inline-scale-active': preset.inlineScaleActive,
    '--glow-inline-core': preset.inlineCore,
    '--glow-inline-mid': preset.inlineMid,
    '--glow-inline-opacity': preset.inlineOpacity,
    '--glow-underline-opacity': preset.underlineOpacity,
    '--glow-tree-scale-active': preset.treeScaleActive,
    '--glow-tree-core': preset.treeCore,
    '--glow-tree-mid': preset.treeMid,
  }
  Object.entries(mappings).forEach(([key, value]) => {
    try {
      root.style.setProperty(key, String(value))
    } catch {}
  })
}

function injectStyles(doc, scopeSelector = 'body') {
  if (doc.getElementById(STYLE_ID)) return
  const accent = 'var(--accent, #7aa2f7)'
  const css = `

${scopeSelector} .${HIGHLIGHT_CLASSES.block} {
  position: relative;
  z-index: 0;
  contain: paint;
  overflow: visible;
}
${scopeSelector} .${HIGHLIGHT_CLASSES.block}::before {
  content: '';
  position: absolute;
  inset: var(--glow-inset, 0);
  border-radius: var(--glow-radius, 10px);
  background: radial-gradient(circle at center,
    color-mix(in oklab, ${accent} var(--glow-block-core, 30%), transparent) 0%,
    color-mix(in oklab, ${accent} var(--glow-block-mid, 18%), transparent) 82%,
    transparent 100%);
  opacity: 0;
  transform: scale(var(--glow-block-scale-rest, 0.94));
  transition: opacity var(--glow-fade-in, 160ms) ease-out,
              transform var(--glow-scale-time, 220ms) cubic-bezier(0.33, 0.0, 0.2, 1);
  pointer-events: none;
  z-index: -1;
  filter: blur(var(--glow-block-blur, 8px));
}
${scopeSelector} .${HIGHLIGHT_CLASSES.block}:hover::before,
${scopeSelector} .${HIGHLIGHT_CLASSES.block}:focus-visible::before,
${scopeSelector} .${HIGHLIGHT_CLASSES.block}.${HIGHLIGHT_CLASSES.active}::before {
  opacity: var(--glow-block-opacity, 1);
  transform: scale(var(--glow-block-scale-active, 1.06));
}

${scopeSelector} .${HIGHLIGHT_CLASSES.inline} {
  position: relative;
  z-index: 0;
  contain: paint;
  overflow: visible;
}
${scopeSelector} .${HIGHLIGHT_CLASSES.inline}::before {
  content: '';
  position: absolute;
  inset: var(--glow-inline-inset, -3px);
  border-radius: var(--glow-inline-radius, 8px);
  background: radial-gradient(circle at center,
    color-mix(in oklab, ${accent} var(--glow-inline-core, 26%), transparent) 0%,
    color-mix(in oklab, ${accent} var(--glow-inline-mid, 16%), transparent) 88%,
    transparent 100%);
  opacity: 0;
  transform: scale(var(--glow-inline-scale-rest, 0.96));
  transition: opacity 150ms ease-out, transform 220ms cubic-bezier(0.33, 0, 0.2, 1);
  pointer-events: none;
  z-index: -1;
}
${scopeSelector} .${HIGHLIGHT_CLASSES.inline}:hover::before,
${scopeSelector} .${HIGHLIGHT_CLASSES.inline}:focus-visible::before,
${scopeSelector} .${HIGHLIGHT_CLASSES.inline}.${HIGHLIGHT_CLASSES.active}::before {
  opacity: var(--glow-inline-opacity, 1);
  transform: scale(var(--glow-inline-scale-active, 1.02));
}

${scopeSelector} .${HIGHLIGHT_CLASSES.underline} {
  position: relative;
  z-index: 0;
  contain: paint;
  overflow: visible;
}
${scopeSelector} .${HIGHLIGHT_CLASSES.underline}::after {
  content: '';
  position: absolute;
  left: var(--glow-underline-left, 0);
  right: var(--glow-underline-right, 0);
  bottom: var(--glow-underline-bottom, -2px);
  height: var(--glow-underline-height, 4px);
  border-radius: 6px;
  background: radial-gradient(circle at 50% 120%,
    color-mix(in oklab, ${accent} 60%, transparent) 0%,
    color-mix(in oklab, ${accent} 40%, transparent) 45%,
    transparent 100%);
  opacity: 0;
  transform: scaleX(0.55);
  transform-origin: center;
  transition: opacity 160ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 200ms cubic-bezier(0.33, 0, 0.2, 1);
  pointer-events: none;
}
${scopeSelector} .${HIGHLIGHT_CLASSES.underline}:hover::after,
${scopeSelector} .${HIGHLIGHT_CLASSES.underline}:focus-visible::after,
${scopeSelector} .${HIGHLIGHT_CLASSES.underline}.${HIGHLIGHT_CLASSES.active}::after {
  opacity: var(--glow-underline-opacity, 0.65);
  transform: scaleX(1);
}

${scopeSelector} .${HIGHLIGHT_CLASSES.tree} {
  --glow-radius: 6px;
  --glow-inset: -2px;
  --glow-block-scale-rest: 1;
  --glow-block-scale-active: var(--glow-tree-scale-active, 1.04);
  --glow-block-opacity: 1;
}
${scopeSelector} .${HIGHLIGHT_CLASSES.tree}::before {
  background: radial-gradient(circle at center,
    color-mix(in oklab, ${accent} var(--glow-tree-core, 38%), transparent) 0%,
    color-mix(in oklab, ${accent} var(--glow-tree-mid, 20%), transparent) 78%,
    transparent 100%);
}
${scopeSelector} .${HIGHLIGHT_CLASSES.tree}::after {
  bottom: 6px;
  box-shadow: 0 0 9px color-mix(in oklab, ${accent} 50%, transparent);
}
${scopeSelector} .${HIGHLIGHT_CLASSES.tree}.${HIGHLIGHT_CLASSES.ancestor}::before {
  opacity: 0.3;
  transform: scale(1);
}
${scopeSelector} .${HIGHLIGHT_CLASSES.tree}.${HIGHLIGHT_CLASSES.ancestor}::after {
  opacity: 0.35;
  transform: scaleX(0.85);
}

@media (prefers-reduced-motion: reduce) {
  ${scopeSelector} .${HIGHLIGHT_CLASSES.block}::before,
  ${scopeSelector} .${HIGHLIGHT_CLASSES.inline}::before,
  ${scopeSelector} .${HIGHLIGHT_CLASSES.underline}::after {
    transition-duration: 0ms;
  }
}

.${HOVER_OVERLAY_CLASS} {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  border: none;
  background: transparent;
  box-shadow: 0 18px 36px rgba(17, 24, 39, 0.18);
  color: inherit;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px) scale(0.98);
  filter: blur(12px);
}
.${HOVER_OVERLAY_CLASS}.show {
  pointer-events: auto;
  animation: hover-pop-in var(--hover-fade, 0.16s) ease forwards;
}
.${HOVER_OVERLAY_CLASS}.show.relocating {
  animation: hover-pop-in var(--hover-fade, 0.16s) ease forwards;
}
.${HOVER_OVERLAY_CLASS}.leaving {
  pointer-events: none;
  animation: hover-pop-out var(--hover-fade, 0.18s) ease forwards;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS} {
  pointer-events: auto;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.18s ease, background 0.18s ease, transform 0.18s ease;
  cursor: pointer;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS}:hover {
  color: var(--accent, #1d4ed8);
  background: rgba(29, 78, 216, 0.12);
  transform: translateY(-2px);
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS}:focus-visible {
  outline: 2px solid var(--accent, #1d4ed8);
  outline-offset: 2px;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS}:disabled,
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS}[aria-disabled="true"] {
  opacity: 0.45;
  pointer-events: none;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS} i {
  font-size: 19px;
  line-height: 1;
}

@keyframes hover-pop-in {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
    filter: blur(14px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes hover-pop-out {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
    filter: blur(14px);
  }
}
`
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  markPluginNode(style)
  doc.head.appendChild(style)
}

function normaliseSelectors(selectors) {
  if (!selectors) return []
  if (Array.isArray(selectors)) return selectors.filter(Boolean)
  return [selectors]
}

const COMPOUND_INVALID_CHARS = /[>+~,:]/
const ATTRIBUTE_OPERATOR_PATTERN = /[~^$*|]/

function stripQuotes(value) {
  if (!value) return value
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1)
  }
  return value
}

function parseAttributeToken(raw) {
  if (!raw) return null
  if (ATTRIBUTE_OPERATOR_PATTERN.test(raw)) return null
  const match = raw.match(/^([^=\s]+)(?:\s*=\s*(.+))?$/)
  if (!match) return null
  const name = match[1]?.trim()
  if (!name) return null
  if (!match[2]) {
    return { name, hasValue: false, value: null }
  }
  const value = stripQuotes(match[2].trim())
  return { name, hasValue: true, value }
}

function parseSimpleCompound(raw) {
  if (!raw) return null
  const token = raw.trim()
  if (!token) return null
  if (token === '*') return { tag: null, id: null, classes: [], attrs: [] }
  if (COMPOUND_INVALID_CHARS.test(token)) return null
  if (token.includes('[') && token.indexOf(']') === -1) return null
  let rest = token
  const compound = { tag: null, id: null, classes: [], attrs: [] }
  if (rest[0] !== '.' && rest[0] !== '#' && rest[0] !== '[') {
    const tagMatch = rest.match(/^[a-zA-Z][a-zA-Z0-9-]*/)
    if (!tagMatch) return null
    compound.tag = tagMatch[0].toLowerCase()
    rest = rest.slice(tagMatch[0].length)
  }
  while (rest.length) {
    const prefix = rest[0]
    if (prefix === '#') {
      const idMatch = rest.slice(1).match(/^[a-zA-Z0-9_-]+/)
      if (!idMatch) return null
      compound.id = idMatch[0]
      rest = rest.slice(idMatch[0].length + 1)
      continue
    }
    if (prefix === '.') {
      const classMatch = rest.slice(1).match(/^[a-zA-Z0-9_-]+/)
      if (!classMatch) return null
      compound.classes.push(classMatch[0])
      rest = rest.slice(classMatch[0].length + 1)
      continue
    }
    if (prefix === '[') {
      const endIdx = rest.indexOf(']')
      if (endIdx === -1) return null
      const attrContent = rest.slice(1, endIdx).trim()
      const attr = parseAttributeToken(attrContent)
      if (!attr) return null
      compound.attrs.push(attr)
      rest = rest.slice(endIdx + 1)
      continue
    }
    return null
  }
  return compound
}

function compoundKey(compound) {
  if (!compound) return ''
  const tag = compound.tag || '*'
  const id = compound.id ? `#${compound.id}` : ''
  const classes = compound.classes.length
    ? `.${compound.classes.slice().sort().join('.')}`
    : ''
  const attrs = compound.attrs.length
    ? `[${compound.attrs
        .map((attr) =>
          attr.hasValue ? `${attr.name}=${attr.value || ''}` : attr.name,
        )
        .join('|')}]`
    : ''
  return `${tag}${id}${classes}${attrs}`
}

function parseSelectorChain(selector) {
  if (!selector) return null
  const trimmed = selector.trim()
  if (!trimmed) return null
  if (trimmed.includes(',')) return null
  const parts = trimmed.split(/\s+/)
  const chain = []
  for (const part of parts) {
    const compound = parseSimpleCompound(part)
    if (!compound) return null
    chain.push(compound)
  }
  return chain
}

function decorateTreeAncestors(doc, treeSelectors) {
  if (!treeSelectors.length) return () => {}
  const ancestryCache = new WeakMap()
  const handler = (type) => (event) => {
    const target =
      event.target instanceof Element ? event.target.closest(treeSelectors.join(',')) : null
    if (!target || shouldIgnoreNode(target)) return
    if (type === 'enter') {
      const ancestors = []
      let details = target.parentElement?.closest('details')
      while (details) {
        const summary = details.querySelector(':scope > summary')
        if (summary && summary !== target) {
          summary.classList.add(HIGHLIGHT_CLASSES.ancestor)
          ancestors.push(summary)
        }
        details = details.parentElement?.closest('details') || null
      }
      ancestryCache.set(target, ancestors)
    } else if (type === 'leave') {
      const fromCache = ancestryCache.get(target) || []
      const toEl = event.relatedTarget instanceof Element ? event.relatedTarget : null
      if (toEl && target.contains(toEl)) return
      for (const summary of fromCache) summary.classList.remove(HIGHLIGHT_CLASSES.ancestor)
      ancestryCache.delete(target)
    }
  }
  const overListener = handler('enter')
  const outListener = handler('leave')
  doc.addEventListener('pointerover', overListener)
  doc.addEventListener('pointerout', outListener)
  return () => {
    doc.removeEventListener('pointerover', overListener)
    doc.removeEventListener('pointerout', outListener)
  }
}

function createHoverOverlay(doc, selectors, callbacks) {
  const allSelectors = selectors.join(', ')
  if (!allSelectors.trim()) return () => {}

  const overlay = doc.createElement('div')
  overlay.className = HOVER_OVERLAY_CLASS
  overlay.setAttribute('aria-hidden', 'true')
  markPluginNode(overlay)

  const mkBtn = (cls, title, iconName, onClick) => {
    const btn = doc.createElement('button')
    btn.className = `${HOVER_BTN_CLASS} ${cls}`
    btn.type = 'button'
    btn.title = title
    btn.setAttribute('aria-label', title)
    const iconEl = doc.createElement('i')
    iconEl.className = `ri-${iconName}`
    iconEl.setAttribute('aria-hidden', 'true')
    btn.appendChild(iconEl)
    btn.addEventListener('mousedown', (event) => event.preventDefault())
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      if (anchorEl && typeof onClick === 'function') onClick(anchorEl)
    })
    if (typeof onClick !== 'function') {
      btn.disabled = true
      btn.classList.add(`${HOVER_BTN_CLASS}--disabled`, 'act-disabled')
    }
    markPluginNode(btn)
    markPluginNode(iconEl)
    return btn
  }

  const triggerBtn = mkBtn(
    'act-trigger',
    'Add Automation Trigger',
    'flashlight-line',
    callbacks.onTrigger,
  )

  const askBtn = mkBtn(
    'act-ask',
    'Ask About or Share',
    'global-line',
    callbacks.onAsk,
  )

  const commentBtn = mkBtn(
    'act-comment',
    'Add Comment',
    'chat-3-line',
    callbacks.onComment,
  )

  const searchBtn = mkBtn(
    'act-search',
    'Automatic Search',
    'search-2-line',
    callbacks.onSearch,
  )

  overlay.appendChild(triggerBtn)
  overlay.appendChild(askBtn)
  overlay.appendChild(commentBtn)
  overlay.appendChild(searchBtn)
  doc.body.appendChild(overlay)
  debugLog('overlay:create', { selectors })

  const SHOW_DELAY = 360
  const HIDE_DELAY = 420
  const OFFSET_X = 18
  const OFFSET_Y = 18
  const MIN_GAP = 12
  const REPOSITION_THRESHOLD = 14
  const PROXIMITY_THRESHOLD = 48

  let anchorEl = null
  let anchorPointer = null
  let pendingAnchor = null
  let pendingPointer = null
  let showTimer = null
  let hideTimer = null
  let isShown = false
  let lastPointer = null
  let relocateTimer = null
  let leaveTimer = null

  const view = doc.defaultView || (typeof window !== 'undefined' ? window : null)

  function clearShowTimer() {
    if (showTimer) {
      clearTimeout(showTimer)
      showTimer = null
    }
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function clearRelocateTimer() {
    if (relocateTimer) {
      clearTimeout(relocateTimer)
      relocateTimer = null
    }
  }

  function clearLeaveTimer() {
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
  }

  function shouldUpdatePointer(previous, next) {
    if (!next) return false
    if (!previous) return true
    const dx = previous.x - next.x
    const dy = previous.y - next.y
    return Math.hypot(dx, dy) > REPOSITION_THRESHOLD
  }

  function extractPointer(event, fallbackEl) {
    if (event instanceof MouseEvent || (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent)) {
      if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        return { x: event.clientX, y: event.clientY }
      }
    }
    if (fallbackEl && typeof fallbackEl.getBoundingClientRect === 'function') {
      const rect = fallbackEl.getBoundingClientRect()
      return {
        x: rect.right,
        y: rect.top + rect.height / 2,
      }
    }
    return null
  }

  function positionOverlay(pointer = anchorPointer) {
    if (!pointer) {
      if (anchorEl) pointer = extractPointer(null, anchorEl)
      if (!pointer) return
    }
    const overlayRect = overlay.getBoundingClientRect()
    const viewportWidth = view?.innerWidth || doc.documentElement.clientWidth || 0
    const viewportHeight = view?.innerHeight || doc.documentElement.clientHeight || 0

    let left = pointer.x + OFFSET_X
    let top = pointer.y - overlayRect.height - OFFSET_Y

    if (top < MIN_GAP) {
      top = pointer.y + OFFSET_Y
      if (top + overlayRect.height > viewportHeight - MIN_GAP) {
        top = Math.max(MIN_GAP, viewportHeight - overlayRect.height - MIN_GAP)
      }
    }

    if (left + overlayRect.width > viewportWidth - MIN_GAP) {
      left = viewportWidth - overlayRect.width - MIN_GAP
    }
    left = Math.max(MIN_GAP, left)
    top = Math.max(MIN_GAP, Math.min(top, viewportHeight - overlayRect.height - MIN_GAP))

    overlay.style.left = `${Math.round(left)}px`
    overlay.style.top = `${Math.round(top)}px`

    if (isShown) triggerRelocateAnimation()
  }

  function triggerRelocateAnimation() {
    clearRelocateTimer()
    overlay.classList.remove('relocating')
    // Force reflow to restart animation
    void overlay.offsetWidth
    overlay.classList.add('relocating')
    relocateTimer = setTimeout(() => {
      overlay.classList.remove('relocating')
      relocateTimer = null
    }, 220)
  }

  function hideOverlay() {
    if (!anchorEl && !isShown) return
    overlay.style.setProperty('--hover-fade', '0.18s')
    overlay.classList.remove('show')
    overlay.classList.remove('relocating')
    overlay.classList.add('leaving')
    overlay.setAttribute('aria-hidden', 'true')
    clearRelocateTimer()
    clearLeaveTimer()
    leaveTimer = setTimeout(() => {
      overlay.classList.remove('leaving')
      leaveTimer = null
    }, 200)
    if (anchorEl) {
      anchorEl.classList.remove(HIGHLIGHT_CLASSES.active)
    }
    anchorEl = null
    anchorPointer = null
    isShown = false
  }

  function isPointerNearRect(pointer, rect, threshold = 0) {
    if (!pointer || !rect) return false
    const expanded = {
      left: rect.left - threshold,
      right: rect.right + threshold,
      top: rect.top - threshold,
      bottom: rect.bottom + threshold,
    }
    return (
      pointer.x >= expanded.left &&
      pointer.x <= expanded.right &&
      pointer.y >= expanded.top &&
      pointer.y <= expanded.bottom
    )
  }

  function pointerNearOverlay(pointer) {
    if (!pointer) return false
    const rect = overlay.getBoundingClientRect()
    return isPointerNearRect(pointer, rect, PROXIMITY_THRESHOLD)
  }

  function pointerNearAnchor(pointer) {
    if (!pointer || !anchorEl || !(anchorEl instanceof Element)) return false
    const rect = anchorEl.getBoundingClientRect()
    return isPointerNearRect(pointer, rect, PROXIMITY_THRESHOLD)
  }

  function scheduleHide(pointer) {
    if (pointer && typeof pointer.x === 'number' && typeof pointer.y === 'number') {
      lastPointer = pointer
    }
    clearHideTimer()
    hideTimer = setTimeout(() => {
      const overlayHovered = overlay.matches(':hover')
      const anchorHovered = anchorEl ? anchorEl.matches(':hover') : false
      const pointerRef = lastPointer
      if (
        overlayHovered ||
        anchorHovered ||
        pointerNearOverlay(pointerRef) ||
        pointerNearAnchor(pointerRef)
      ) {
        scheduleHide(pointerRef)
        return
      }
      if (!overlayHovered && !anchorHovered) {
        hideOverlay()
      } else {
        scheduleHide(pointerRef)
      }
    }, HIDE_DELAY)
  }

  function shouldIgnorePointerDown(event) {
    if (!(event?.target instanceof Element)) return false
    if (overlay.contains(event.target)) return true
    if (anchorEl && anchorEl.contains(event.target)) return true
    return false
  }

  function handlePointerDown(event) {
    if (!isShown) return
    if (shouldIgnorePointerDown(event)) return
    let pointer = null
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      pointer = { x: event.clientX, y: event.clientY }
      lastPointer = pointer
    } else {
      pointer = lastPointer
    }
    if (pointer && (pointerNearOverlay(pointer) || pointerNearAnchor(pointer))) return
    hideOverlay()
  }

  function handleScrollEvent(event) {
    if (!isShown) return
    if (event?.target instanceof Element) {
      if (overlay.contains(event.target)) return
      if (anchorEl && anchorEl.contains(event.target)) return
    }
    hideOverlay()
  }

  function showOverlay(el, pointer) {
    if (!el) return
    clearHideTimer()
    clearShowTimer()
    pendingAnchor = null
    if (anchorEl && anchorEl !== el) {
      anchorEl.classList.remove(HIGHLIGHT_CLASSES.active)
    }
    anchorEl = el
    const candidate = pointer || extractPointer(null, el)
    if (!anchorPointer || !isShown) {
      if (candidate) anchorPointer = candidate
    } else if (candidate && shouldUpdatePointer(anchorPointer, candidate)) {
      anchorPointer = candidate
    }
    anchorEl.classList.add(HIGHLIGHT_CLASSES.active)
    overlay.style.setProperty('--hover-fade', '0.16s')
    overlay.classList.remove('leaving')
    clearLeaveTimer()
    overlay.classList.add('show')
    overlay.removeAttribute('aria-hidden')
    isShown = true
    positionOverlay(anchorPointer)
    debugLog('overlay:show', {
      tag: el.tagName,
    })
  }

  overlay.addEventListener('pointerenter', (event) => {
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      lastPointer = { x: event.clientX, y: event.clientY }
    }
    clearHideTimer()
    if (anchorEl) anchorEl.classList.add(HIGHLIGHT_CLASSES.active)
  })

  overlay.addEventListener('pointerleave', (event) => {
    const pointer =
      event && typeof event.clientX === 'number' && typeof event.clientY === 'number'
        ? { x: event.clientX, y: event.clientY }
        : lastPointer
    if (pointerNearOverlay(pointer) || pointerNearAnchor(pointer)) {
      scheduleHide(pointer)
      return
    }
    scheduleHide(pointer)
  })

  doc.addEventListener('mouseover', (event) => {
    if (!(event.target instanceof Element)) return
    const el = event.target.closest(allSelectors)
    if (!el) return
    if (shouldIgnoreNode(el)) return
    if (overlay.contains(el)) return
    clearHideTimer()
    pendingAnchor = el
    pendingPointer = extractPointer(event, el)
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      lastPointer = { x: event.clientX, y: event.clientY }
    } else if (pendingPointer) {
      lastPointer = pendingPointer
    }
    clearShowTimer()
    showTimer = setTimeout(() => {
      if (pendingAnchor === el) {
        showOverlay(el, pendingPointer)
        pendingPointer = null
      }
    }, SHOW_DELAY)
  })

  doc.addEventListener('mousemove', (event) => {
    if (!pendingAnchor) return
    if (!(event.target instanceof Element)) return
    if (!pendingAnchor.contains(event.target)) return
    const nextPointer = extractPointer(event, pendingAnchor)
    if (!pendingPointer || shouldUpdatePointer(pendingPointer, nextPointer)) {
      pendingPointer = nextPointer
    }
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      lastPointer = { x: event.clientX, y: event.clientY }
    }
  })

  doc.addEventListener('pointermove', (event) => {
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      lastPointer = { x: event.clientX, y: event.clientY }
    }
  })

  doc.addEventListener('mouseout', (event) => {
    if (!(event.target instanceof Element)) return
    const el = event.target.closest(allSelectors)
    if (!el) return
    if (shouldIgnoreNode(el)) return
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null
    if (related && shouldIgnoreNode(related)) {
      pendingAnchor = null
      pendingPointer = null
      clearShowTimer()
      let pointer = null
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        pointer = { x: event.clientX, y: event.clientY }
      } else if (typeof extractPointer === 'function') {
        pointer = extractPointer(event, el) || lastPointer
      } else {
        pointer = lastPointer
      }
      if (pointer) lastPointer = pointer
      if (isShown) {
        scheduleHide(lastPointer)
      } else {
        hideOverlay()
      }
      return
    }
    if (related && (el.contains(related) || overlay.contains(related))) return
    let pointer = null
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      pointer = { x: event.clientX, y: event.clientY }
    } else {
      pointer = extractPointer(event, el)
    }
    if (pointer) {
      lastPointer = pointer
      if (pointerNearOverlay(pointer) || pointerNearAnchor(pointer)) {
        scheduleHide(pointer)
        return
      }
    }
    if (pendingAnchor === el) {
      pendingAnchor = null
      pendingPointer = null
      clearShowTimer()
    }
    scheduleHide(pointer)
  })

  doc.addEventListener('pointerdown', handlePointerDown, true)
  const wheelOptions = { passive: true, capture: true }
  doc.addEventListener('wheel', handleScrollEvent, wheelOptions)
  if (view && typeof view.addEventListener === 'function') {
    view.addEventListener('scroll', handleScrollEvent, true)
  }

  return () => {
    clearShowTimer()
    clearHideTimer()
    clearRelocateTimer()
    clearLeaveTimer()
    hideOverlay()
    doc.removeEventListener('pointerdown', handlePointerDown, true)
    doc.removeEventListener('wheel', handleScrollEvent, wheelOptions)
    if (view && typeof view.removeEventListener === 'function') {
      view.removeEventListener('scroll', handleScrollEvent, true)
    }
    overlay.remove()
    debugLog('overlay:destroy')
  }
}

function getLabel(el) {
  try {
    return (el.textContent || '').trim().slice(0, 200)
  } catch {
    return ''
  }
}

export function activateHighlight(el, duration = 1400) {
  if (!el) return
  el.classList.add(HIGHLIGHT_CLASSES.active)
  if (duration > 0) {
    setTimeout(() => {
      try {
        el.classList.remove(HIGHLIGHT_CLASSES.active)
      } catch {}
    }, duration)
  }
}

function createAsyncHighlightRunner(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null)
  const rules = Array.isArray(options.rules) ? options.rules.slice() : []
  const onRender = typeof options.onRender === 'function' ? options.onRender : null

  if (!doc) {
    return {
      runFull: async () => 0,
      enqueueRecords: () => {},
      cancel: () => {},
    }
  }

  const ElementRef = doc?.defaultView?.Element || (typeof Element !== 'undefined' ? Element : null)
  const NodeRef = doc?.defaultView?.Node || (typeof Node !== 'undefined' ? Node : null)

  let runId = 0
  let mutationQueue = []
  let mutationScheduled = false
  let pendingNodes = new WeakSet()
  let currentRevision = 0

  const elementRecords = new WeakMap()
  const simplePlanCache = new Map()
  const fallbackPlanCache = new Map()

  const planIndex = {
    byId: new Map(),
    byClass: new Map(),
    byTag: new Map(),
  }
  const fallbackPlans = []

  function addToIndex(map, key, planRef) {
    if (!key) return
    if (!map.has(key)) {
      map.set(key, [planRef])
      return
    }
    map.get(key).push(planRef)
  }

  function registerSimplePlan(plan, planRef) {
    const compound = plan?.compound
    if (!compound) {
      fallbackPlans.push(planRef)
      return
    }
    const hasClasses = compound.classes && compound.classes.length > 0
    const tagKey = compound.tag || null
    if (compound.id) addToIndex(planIndex.byId, compound.id, planRef)
    if (hasClasses) {
      for (const cls of compound.classes) addToIndex(planIndex.byClass, cls, planRef)
    } else if (!compound.id && tagKey) {
      addToIndex(planIndex.byTag, tagKey, planRef)
    }
    if (!tagKey && !hasClasses && !compound.id) {
      addToIndex(planIndex.byTag, '*', planRef)
    }
  }

  rules.forEach((rule, index) => {
    const selectors = Array.isArray(rule.selectors) ? rule.selectors.filter(Boolean) : []
    if (!selectors.length) return
    const bit = 1 << index
    for (const selector of selectors) {
      const plan = getSelectorPlan(selector)
      const planRef = {
        ruleBit: bit,
        apply: rule.apply,
        predicate: plan.predicate,
        selector: plan.selector,
        simple: plan.simple,
        plan,
      }
      if (plan.simple) registerSimplePlan(plan, planRef)
      else fallbackPlans.push(planRef)
    }
  })

  function dispatchRender(mode, applied, duration) {
    const payload = {
      mode: mode || 'scan',
      applied,
      duration,
    }
    try {
      debugLog('effects:render', payload)
    } catch {}
    try {
      doc.dispatchEvent(new CustomEvent('ami:highlight:render', { detail: payload }))
    } catch {}
    try {
      const view = doc.defaultView || (typeof window !== 'undefined' ? window : null)
      if (view && typeof view.postMessage === 'function') {
        view.postMessage({ type: 'ami:highlight:render', detail: payload }, '*')
      }
    } catch {}
    if (onRender) {
      try {
        onRender(payload)
      } catch {}
    }
  }

  function bumpRevision() {
    currentRevision += 1
    if (currentRevision > Number.MAX_SAFE_INTEGER - 1) {
      currentRevision = 1
    }
  }

  function safeMatches(el, selector) {
    if (!el || (ElementRef && !(el instanceof ElementRef))) return false
    const matcher =
      el.matches || el.msMatchesSelector || el.webkitMatchesSelector || el.mozMatchesSelector
    if (!matcher) return false
    try {
      return matcher.call(el, selector)
    } catch {
      return false
    }
  }

  function compoundAttrKey(attr) {
    if (!attr) return ''
    return attr.hasValue ? `${attr.name}=${attr.value || ''}` : attr.name
  }

  function testCompound(el, compound) {
    if (!compound) return false
    if (compound.tag && el.tagName && el.tagName.toLowerCase() !== compound.tag) return false
    if (compound.id && el.id !== compound.id) return false
    if (compound.classes.length) {
      if (!el.classList) {
        return false
      }
      for (const cls of compound.classes) {
        if (!el.classList.contains(cls)) return false
      }
    }
    if (compound.attrs.length) {
      for (const attr of compound.attrs) {
        const value = typeof el.getAttribute === 'function' ? el.getAttribute(attr.name) : null
        if (!attr.hasValue) {
          if (value === null) return false
        } else if (value !== attr.value) {
          return false
        }
      }
    }
    return true
  }

  function findAncestorMatching(node, compound) {
    let current = node?.parentElement || null
    while (current) {
      if (!ElementRef || current instanceof ElementRef) {
        if (testCompound(current, compound)) return current
      }
      current = current.parentElement || null
    }
    return null
  }

  function buildChainPredicate(chain) {
    const tail = chain[chain.length - 1]
    const ancestors = chain.slice(0, -1)
    return (element) => {
      if (!element || (ElementRef && !(element instanceof ElementRef))) return false
      if (!testCompound(element, tail)) return false
      let cursor = element
      for (let i = ancestors.length - 1; i >= 0; i -= 1) {
        cursor = findAncestorMatching(cursor, ancestors[i])
        if (!cursor) return false
      }
      return true
    }
  }

  function getSelectorPlan(selector) {
    const trimmed = typeof selector === 'string' ? selector.trim() : ''
  if (!trimmed) {
    return {
      selector: '',
      predicate: () => false,
      simple: false,
      key: 'empty',
      tag: null,
      classHash: '',
      attrMask: '',
      compound: null,
    }
  }
  const chain = parseSelectorChain(trimmed)
  if (!chain) {
    if (fallbackPlanCache.has(trimmed)) return fallbackPlanCache.get(trimmed)
    const plan = {
      selector: trimmed,
      predicate: (el) => safeMatches(el, trimmed),
      simple: false,
      key: `matches:${trimmed}`,
      tag: null,
      classHash: '',
      attrMask: '',
      compound: null,
    }
    fallbackPlanCache.set(trimmed, plan)
    return plan
  }
  const key = chain.map((compound) => compoundKey(compound)).join(' ')
  if (simplePlanCache.has(key)) return simplePlanCache.get(key)
  const predicate = buildChainPredicate(chain)
  const last = chain[chain.length - 1]
  const compound = {
    tag: last.tag || null,
    id: last.id || null,
    classes: last.classes.slice(),
    attrs: last.attrs.map((attr) => ({ ...attr })),
  }
  const plan = {
    selector: trimmed,
    predicate,
    simple: true,
    key,
    tag: last.tag || '*',
    classHash: last.classes.length ? last.classes.slice().sort().join('.') : '',
    attrMask: last.attrs.length
      ? last.attrs.map((attr) => compoundAttrKey(attr)).sort().join('|')
      : '',
    compound,
  }
  simplePlanCache.set(key, plan)
  return plan
}

  function getRecord(el) {
    let record = elementRecords.get(el)
    if (!record) {
      record = { revision: currentRevision, matchesMask: 0, ignore: false }
      elementRecords.set(el, record)
      return record
    }
    return record
  }

  function markIgnore(el, value) {
    const record = getRecord(el)
    record.revision = currentRevision
    record.ignore = value
    if (value) record.matchesMask = 0
    return record
  }

  function collectPlans(source, seen, target) {
    if (!source) return
    for (const planRef of source) {
      if (!planRef) continue
      if (seen.has(planRef)) continue
      seen.add(planRef)
      target.push(planRef)
    }
  }

  function evaluateElement(el) {
    const record = getRecord(el)
    const previous = record.matchesMask || 0
    let nextMask = 0
    let applied = 0

    const seenPlans = new Set()
    const candidates = []

    const elementId = el && typeof el.id === 'string' ? el.id : ''
    if (elementId) collectPlans(planIndex.byId.get(elementId), seenPlans, candidates)

    if (el && el.classList && typeof el.classList.length === 'number') {
      for (let i = 0; i < el.classList.length; i += 1) {
        const cls = el.classList.item(i)
        if (cls) collectPlans(planIndex.byClass.get(cls), seenPlans, candidates)
      }
    }

    const tagName = el && el.tagName ? el.tagName.toLowerCase() : ''
    if (tagName) collectPlans(planIndex.byTag.get(tagName), seenPlans, candidates)
    collectPlans(planIndex.byTag.get('*'), seenPlans, candidates)

    if (fallbackPlans.length) collectPlans(fallbackPlans, seenPlans, candidates)

    for (const planRef of candidates) {
      const bit = planRef.ruleBit
      if ((nextMask & bit) !== 0) continue
      let matched = false
      try {
        matched = planRef.predicate(el)
      } catch {
        matched = false
      }
      if (!matched) continue
      nextMask |= bit
      if ((previous & bit) === 0) {
        try {
          planRef.apply(el)
          applied += 1
        } catch {}
      }
    }

    record.matchesMask = nextMask
    record.revision = currentRevision
    return applied
  }

  async function walkAndApply(root, token, seen, sliceState) {
    if (!root || (ElementRef && !(root instanceof ElementRef))) return 0
    const stack = [root]
    let applied = 0
    while (stack.length) {
      if (token !== runId) return applied
      const node = stack.pop()
      if (!node || (ElementRef && !(node instanceof ElementRef))) continue
      if (seen.has(node)) continue
      if (typeof node.nodeType === 'number' && node.nodeType !== 1) continue
      if (typeof node.isConnected === 'boolean' && !node.isConnected) {
        elementRecords.delete(node)
        continue
      }
      seen.add(node)
      const shouldSkip = shouldIgnoreNode(node)
      markIgnore(node, shouldSkip)
      if (shouldSkip) continue
      applied += evaluateElement(node)
      const children = node.children
      if (children && children.length) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
          const child = children[i]
          if (child) stack.push(child)
        }
      }
      if (now() - sliceState.start > ASYNC_SLICE_BUDGET) {
        await waitForIdle()
        sliceState.start = now()
      }
    }
    return applied
  }

  async function performFullScan(mode) {
    const token = ++runId
    bumpRevision()
    resetIgnoreCache()
    mutationQueue = []
    pendingNodes = new WeakSet()
    mutationScheduled = false

    const root = doc.body || doc.documentElement
    if (!root || (ElementRef && !(root instanceof ElementRef))) {
      debugLog('effects:pre-pass', { skipped: true })
      return 0
    }

    const started = now()
    const sliceState = { start: started }
    const seen = new WeakSet()
    const applied = await walkAndApply(root, token, seen, sliceState)

    debugLog('effects:pass', { applied })
    const duration = now() - started
    dispatchRender(mode || 'scan', applied, duration)
    return applied
  }

  async function flushMutationQueue(token) {
    if (!mutationQueue.length) return 0
    bumpRevision()
    resetIgnoreCache()
    const started = now()
    const sliceState = { start: started }
    const seen = new WeakSet()
    let applied = 0

    const localQueue = mutationQueue.slice()
    mutationQueue = []

    while (localQueue.length) {
      if (token !== runId) return 0
      const node = localQueue.shift()
      if (node && pendingNodes) {
        try {
          pendingNodes.delete(node)
        } catch {}
      }
      if (!node || (ElementRef && !(node instanceof ElementRef))) {
        if (!localQueue.length && mutationQueue.length) {
          localQueue.push(...mutationQueue)
          mutationQueue = []
        }
        continue
      }
      if (typeof node.nodeType === 'number' && node.nodeType !== 1) {
        elementRecords.delete(node)
        continue
      }
      if (typeof node.isConnected === 'boolean' && !node.isConnected) {
        elementRecords.delete(node)
        continue
      }
      debugLog('effects:mutation', {
        tag: node.tagName,
        childCount: node.childElementCount || 0,
      })
      applied += await walkAndApply(node, token, seen, sliceState)
      if (!localQueue.length && mutationQueue.length) {
        localQueue.push(...mutationQueue)
        mutationQueue = []
      }
    }

    if (applied) {
      const duration = now() - started
      dispatchRender('mutations', applied, duration)
    }
    return applied
  }

  function scheduleMutationFlush() {
    if (mutationScheduled) return
    mutationScheduled = true
    waitForIdle().then(() => {
      mutationScheduled = false
      const token = runId
      flushMutationQueue(token).catch(() => {})
    })
  }

  function enqueueNode(node) {
    if (!node || (ElementRef && !(node instanceof ElementRef))) return
    if (pendingNodes.has(node)) return
    pendingNodes.add(node)
    mutationQueue.push(node)
    debugLog('effects:mutation-queue', { pending: mutationQueue.length })
    scheduleMutationFlush()
  }

  function enqueueRecords(records) {
    if (!records) return
    for (const record of records) {
      if (!record) continue
      if (record.type === 'attributes') {
        const target = record.target
        if (!target || (ElementRef && !(target instanceof ElementRef))) continue
        invalidateIgnoreCacheFor(target)
        elementRecords.delete(target)
        enqueueNode(target)
        continue
      }
      if (record.addedNodes && record.addedNodes.length) {
        for (const candidate of record.addedNodes) {
          if (!candidate || candidate.nodeType !== 1) continue
          if (NodeRef && !(candidate instanceof NodeRef)) continue
          elementRecords.delete(candidate)
          enqueueNode(candidate)
        }
      }
      if (record.removedNodes && record.removedNodes.length) {
        for (const removed of record.removedNodes) {
          if (!removed || removed.nodeType !== 1) continue
          if (ElementRef && !(removed instanceof ElementRef)) continue
          elementRecords.delete(removed)
        }
      }
    }
  }

  function cancel() {
    runId += 1
    mutationQueue = []
    mutationScheduled = false
    pendingNodes = new WeakSet()
  }

  return {
    runFull: (mode) => performFullScan(mode),
    enqueueRecords,
    cancel,
  }
}

export function initHighlightEffects(options = {}) {
  if (typeof document === 'undefined') return null
  const doc = options.document || document
  const scopeSelector = options.scopeSelector || '.fx-glow'
  injectStyles(doc, scopeSelector)
  applyIntensityPreset(doc, options.intensity || 'medium')

  const blockSelectors = normaliseSelectors(
    options.blockSelectors !== undefined
      ? options.blockSelectors
      : [
          '#content .md p',
          '#content .md li',
          '#content .md pre',
          '#content .html-document p',
          '#content .html-document li',
          '#content .html-document pre',
          '#content pre',
          '#content p',
          '#content li',
        ],
  )
  const inlineSelectors = normaliseSelectors(
    options.inlineSelectors !== undefined ? options.inlineSelectors : ['nav .toc a'],
  )
  const underlineSelectors = normaliseSelectors(
    options.underlineSelectors !== undefined
      ? options.underlineSelectors
      : [
          '#content .md h1',
          '#content .md h2',
          '#content .md h3',
          '#content .md h4',
          '#content .html-document h1',
          '#content .html-document h2',
          '#content .html-document h3',
          '#content .html-document h4',
        ],
  )
  const treeSelectors = normaliseSelectors(
    options.treeSelectors !== undefined
      ? options.treeSelectors
      : ['#treeRoot summary .tree-title'],
  )

  const overlaySelectors = normaliseSelectors(
    options.overlaySelectors !== undefined
      ? options.overlaySelectors
      : [
          '#content .md p',
          '#content .md li',
          '#content .md pre',
          '#content .md h1',
          '#content .md h2',
          '#content .md h3',
          '#content .md h4',
          '#content .html-document p',
          '#content .html-document li',
          '#content .html-document pre',
          '#content .html-document h1',
          '#content .html-document h2',
          '#content .html-document h3',
          '#content .html-document h4',
          'nav .toc a',
        ],
  )

  const trackTreeAncestors = options.trackTreeAncestors !== false

  debugLog('effects:init', {
    scopeSelector,
    blockSelectors: blockSelectors.length,
    inlineSelectors: inlineSelectors.length,
    underlineSelectors: underlineSelectors.length,
    treeSelectors: treeSelectors.length,
    overlaySelectors: overlaySelectors.length,
    trackTreeAncestors,
  })

  const triggerCallback =
    typeof options.onTrigger === 'function'
      ? options.onTrigger
      : (el) => {
          try {
            doc.dispatchEvent(
              new CustomEvent('ami:highlight-add-trigger', {
                detail: { element: el },
              }),
            )
          } catch {}
        }

  const askCallback =
    typeof options.onAsk === 'function'
      ? options.onAsk
      : (el) => {
          try {
            doc.dispatchEvent(
              new CustomEvent('ami:highlight-ask', {
                detail: { element: el },
              }),
            )
          } catch {}
        }

  const commentCallback =
    typeof options.onComment === 'function'
      ? options.onComment
      : (el) => {
          const label = getLabel(el)
          try {
            window.parent?.postMessage?.({ type: 'addComment', path: el?.id || '', label }, '*')
          } catch {}
        }

  const searchCallback =
    typeof options.onSearch === 'function'
      ? options.onSearch
      : (el) => {
          const label = getLabel(el)
          const input = doc.getElementById('search')
          if (input && 'value' in input) {
            input.value = label
            input.dispatchEvent(new Event('input', { bubbles: true }))
            if (typeof input.focus === 'function') input.focus()
          }
        }

  const rules = [
    {
      selectors: blockSelectors,
      apply: (el) => {
        el.classList.add(HIGHLIGHT_CLASSES.block)
      },
    },
    {
      selectors: inlineSelectors,
      apply: (el) => {
        el.classList.add(HIGHLIGHT_CLASSES.inline)
      },
    },
    {
      selectors: underlineSelectors,
      apply: (el) => {
        el.classList.add(HIGHLIGHT_CLASSES.underline)
      },
    },
    {
      selectors: treeSelectors,
      apply: (el) => {
        el.classList.add(
          HIGHLIGHT_CLASSES.block,
          HIGHLIGHT_CLASSES.underline,
          HIGHLIGHT_CLASSES.tree,
        )
      },
    },
  ]

  const asyncRunner = createAsyncHighlightRunner({
    document: doc,
    rules,
  })

  asyncRunner
    .runFull('initial')
    .then(() => {
      debugLog('effects:initial-pass-complete')
    })
    .catch((err) => {
      debugLog('effects:initial-pass-error', { error: err?.message || String(err) })
    })

  const observer = new MutationObserver((records) => {
    asyncRunner.enqueueRecords(records)
  })

  const observerTarget = doc.body || doc.documentElement
  if (observerTarget) {
    observer.observe(observerTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'role', IGNORE_ATTR],
    })
  }
  const detachTreeAncestorWatcher = trackTreeAncestors
    ? decorateTreeAncestors(doc, treeSelectors)
    : () => {}
  const detachOverlay = overlaySelectors.length
    ? createHoverOverlay(doc, overlaySelectors, {
        onTrigger: triggerCallback,
        onAsk: askCallback,
        onComment: commentCallback,
        onSearch: searchCallback,
      })
    : () => {}

  return {
    refresh: () => {
      debugLog('effects:refresh')
      return asyncRunner.runFull('refresh')
    },
    notify(records = []) {
      asyncRunner.enqueueRecords(Array.isArray(records) ? records : [records])
    },
    setIntensity(nextIntensity) {
      applyIntensityPreset(doc, nextIntensity)
    },
    disconnect() {
      debugLog('effects:disconnect')
      observer.disconnect()
      detachTreeAncestorWatcher()
      detachOverlay()
      asyncRunner.cancel()
    },
  }
}
