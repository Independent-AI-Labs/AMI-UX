import { filterIgnored, markPluginNode, shouldIgnoreNode } from './dom-utils.js'

const STYLE_ID = 'fx-glow-highlight-style'

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
}
${scopeSelector} .${HIGHLIGHT_CLASSES.underline}::after {
  content: '';
  position: absolute;
  left: var(--glow-underline-left, -10px);
  right: var(--glow-underline-right, -10px);
  bottom: var(--glow-underline-bottom, -3px);
  height: var(--glow-underline-height, 4px);
  border-radius: 6px;
  background: radial-gradient(circle at 50% 120%,
    color-mix(in oklab, ${accent} 60%, transparent) 0%,
    color-mix(in oklab, ${accent} 40%, transparent) 45%,
    transparent 100%);
  opacity: 0;
  transform: scaleX(0.55);
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
  position: absolute;
  z-index: 1000;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--hover-fade, 0.45s) ease;
}
.${HOVER_OVERLAY_CLASS}.show {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 0.12s;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS} {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border, #242832);
  background: var(--bg, #0b0c0f);
  color: var(--muted, #9aa3b2);
  border-radius: 14px;
  cursor: pointer;
  transition: color 160ms ease, filter 160ms ease, border-color 160ms ease;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS}:hover {
  color: var(--text, #e6e9ef);
  filter: brightness(1.05);
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS}:focus {
  outline: 2px solid ${accent};
  outline-offset: 1px;
}
.${HOVER_OVERLAY_CLASS} .${HOVER_BTN_CLASS} svg {
  width: 18px;
  height: 18px;
}
`
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  doc.head.appendChild(style)
}

function normaliseSelectors(selectors) {
  if (!selectors) return []
  if (Array.isArray(selectors)) return selectors.filter(Boolean)
  return [selectors]
}

function matchesAny(el, selectors) {
  if (!selectors.length) return false
  for (const sel of selectors) {
    try {
      if (el.matches(sel)) return true
    } catch {
      continue
    }
  }
  return false
}

function decorateElement(el, rules) {
  if (shouldIgnoreNode(el)) return
  for (const rule of rules) {
    if (!rule.selectors.length) continue
    if (matchesAny(el, rule.selectors)) {
      rule.apply(el)
    }
  }
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

  const mkBtn = (cls, title, svg, onClick) => {
    const btn = doc.createElement('button')
    btn.className = `${HOVER_BTN_CLASS} ${cls}`
    btn.type = 'button'
    btn.title = title
    btn.setAttribute('aria-label', title)
    btn.innerHTML = svg
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', (event) => {
      event.stopPropagation()
      if (anchorEl && typeof onClick === 'function') onClick(anchorEl)
    })
    markPluginNode(btn)
    return btn
  }

  const commentBtn = mkBtn(
    'act-comment',
    'Comment',
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    callbacks.onComment,
  )
  const searchBtn = mkBtn(
    'act-search',
    'Search',
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    callbacks.onSearch,
  )

  overlay.appendChild(commentBtn)
  overlay.appendChild(searchBtn)
  doc.body.appendChild(overlay)

  let anchorEl = null
  let anchorHadPosition = ''
  let hideTimer = null
  let isShown = false
  let initialLeft = null

  function ensureOverlayParent(el) {
    if (overlay.parentElement === el) return
    if (anchorEl && anchorHadPosition) anchorEl.style.position = anchorHadPosition
    const view = doc.defaultView || (typeof window !== 'undefined' ? window : null)
    const cs = el && view ? view.getComputedStyle(el) : null
    anchorHadPosition = el && el.style ? el.style.position : ''
    if (el && cs && cs.position === 'static') {
      el.style.position = 'relative'
    }
    if (el) el.appendChild(overlay)
  }

  function showOverlay(el, mouseX) {
    if (isShown && anchorEl === el) return
    if (anchorEl && anchorEl !== el) {
      cleanupOverlay()
    }
    anchorEl = el
    ensureOverlayParent(el)
    overlay.classList.remove('show')
    overlay.style.setProperty('--hover-fade', '120ms')
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    anchorEl.classList.add(HIGHLIGHT_CLASSES.active)
    overlay.style.top = '50%'
    overlay.style.transform = 'translateY(-50%)'
    const rect = el.getBoundingClientRect()
    const width = overlay.offsetWidth || 40
    const maxLeft = Math.max(8, el.clientWidth - width - 8)
    if (typeof mouseX === 'number') {
      const rel = Math.max(8, Math.min(Math.round(mouseX - rect.left + 48), maxLeft))
      initialLeft = rel
      overlay.style.left = `${rel}px`
      overlay.style.right = 'auto'
    } else if (initialLeft != null) {
      const rel = Math.max(8, Math.min(initialLeft, maxLeft))
      overlay.style.left = `${rel}px`
      overlay.style.right = 'auto'
    } else {
      overlay.style.left = 'auto'
      overlay.style.right = '8px'
    }
    overlay.classList.add('show')
    isShown = true
  }

  function cleanupOverlay() {
    if (anchorEl) {
      anchorEl.classList.remove(HIGHLIGHT_CLASSES.active)
      if (anchorHadPosition) anchorEl.style.position = anchorHadPosition
    }
    anchorEl = null
    anchorHadPosition = ''
    initialLeft = null
    isShown = false
  }

  function hideOverlay() {
    if (!isShown) return
    overlay.style.setProperty('--hover-fade', '450ms')
    overlay.classList.remove('show')
    isShown = false
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      cleanupOverlay()
      hideTimer = null
    }, 470)
  }

  doc.addEventListener('mouseover', (event) => {
    if (!(event.target instanceof Element)) return
    const el = event.target.closest(allSelectors)
    if (!el) return
    showOverlay(el, event.clientX)
  })

  doc.addEventListener('mouseout', (event) => {
    if (!anchorEl) return
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null
    const inAnchor = related && anchorEl.contains(related)
    const inOverlay = related && overlay.contains(related)
    if (!inAnchor && !inOverlay) hideOverlay()
  })

  return () => {
    cleanupOverlay()
    overlay.remove()
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
      : ['#content .md h1', '#content .md h2', '#content .md h3', '#content .md h4'],
  )
  const treeSelectors = normaliseSelectors(
    options.treeSelectors !== undefined ? options.treeSelectors : ['#treeRoot summary'],
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
          'nav .toc a',
        ],
  )

  const trackTreeAncestors = options.trackTreeAncestors !== false

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

  const decorateAll = () => {
    for (const rule of rules) {
      if (!rule.selectors.length) continue
      for (const selector of rule.selectors) {
        let collection
        try {
          collection = doc.querySelectorAll(selector)
        } catch {
          continue
        }
        const filtered = filterIgnored(collection)
        for (const el of filtered) {
          rule.apply(el)
        }
      }
    }
  }

  decorateAll()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        if (shouldIgnoreNode(node)) return
        decorateElement(node, rules)
        node.querySelectorAll('*').forEach((child) => {
          if (shouldIgnoreNode(child)) return
          decorateElement(child, rules)
        })
      })
    }
  })

  observer.observe(doc.body, { childList: true, subtree: true })
  const detachTreeAncestorWatcher = trackTreeAncestors
    ? decorateTreeAncestors(doc, treeSelectors)
    : () => {}
  const detachOverlay = overlaySelectors.length
    ? createHoverOverlay(doc, overlaySelectors, {
        onComment: commentCallback,
        onSearch: searchCallback,
      })
    : () => {}

  return {
    refresh: decorateAll,
    setIntensity(nextIntensity) {
      applyIntensityPreset(doc, nextIntensity)
    },
    disconnect() {
      observer.disconnect()
      detachTreeAncestorWatcher()
      detachOverlay()
    },
  }
}
