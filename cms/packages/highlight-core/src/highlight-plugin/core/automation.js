import { markPluginNode, shouldIgnoreNode } from './dom-utils.js'
import { setHint } from './hints.js'
import { debugLog } from './debug.js'

const TRIGGER_ATTR = 'data-ami-automation-trigger'
const ICON_CLASS = 'highlight-automation-trigger-pin'
const ICON_INACTIVE_CLASS = `${ICON_CLASS}--inactive`
const ICON_ACTIVE_CLASS = `${ICON_CLASS}--active`
const ICON_LABEL_CLASS = `${ICON_CLASS}__label`
const PLACEMENT_OVERLAY_CLASS = 'highlight-automation-placement-overlay'
const PLACEMENT_HINT_CLASS = 'highlight-automation-placement-hint'
const PLACEMENT_INSTRUCTIONS =
  'Click an element to place an automation trigger. Press Esc to cancel, or right-click to exit.'

const ICON_SVG = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 5V3m0 18v-2m7-7h2M3 12h2m11.95 6.95 1.41 1.41M5.05 5.05 6.46 6.46m11.9-1.41-1.41 1.41M5.05 18.95l1.41-1.41" />
  </svg>
`

function isElement(node) {
  return typeof Element !== 'undefined' && node instanceof Element
}

function computeElementLabel(el) {
  if (!isElement(el)) return ''
  const attrSources = ['data-label', 'data-name', 'aria-label', 'title']
  for (const attr of attrSources) {
    const value = el.getAttribute?.(attr)
    if (value && value.trim()) return value.trim()
  }
  const text = (el.textContent || '').trim()
  if (text) return text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 2).join(' · ')
  return el.id ? `#${el.id}` : el.tagName?.toLowerCase() || 'element'
}

function computeSelector(el) {
  if (!isElement(el)) return ''
  if (el.id && el.ownerDocument?.getElementById(el.id) === el) {
    try {
      return `#${CSS.escape(el.id)}`
    } catch {
      return `#${el.id}`
    }
  }
  const parts = []
  let node = el
  let depth = 0
  while (node && isElement(node) && depth < 6) {
    let part = node.tagName?.toLowerCase() || 'div'
    if (node.classList && node.classList.length) {
      const className = Array.from(node.classList).find((cls) => cls && !cls.startsWith('ami-highlight'))
      if (className) {
        try {
          part += `.${CSS.escape(className)}`
        } catch {
          part += `.${className}`
        }
      }
    }
    if (node.getAttribute) {
      const attr = node.getAttribute('data-testid') || node.getAttribute('data-id')
      if (attr) {
        try {
          part += `[data-testid="${CSS.escape(attr)}"]`
        } catch {
          part += `[data-testid="${attr}"]`
        }
      }
    }
    const parent = node.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter((child) => child.tagName === node.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(node)
        if (index >= 0) part += `:nth-of-type(${index + 1})`
      }
    }
    parts.unshift(part)
    node = parent
    depth += 1
  }
  return parts.join(' > ')
}

function computeDataPath(el) {
  if (!isElement(el)) return ''
  const parts = []
  let node = el
  while (node && isElement(node)) {
    let part = node.tagName?.toLowerCase() || 'div'
    if (node.id) {
      try {
        part += `#${CSS.escape(node.id)}`
      } catch {
        part += `#${node.id}`
      }
      parts.unshift(part)
      break
    }
    if (node.classList && node.classList.length) {
      const classes = Array.from(node.classList).filter((cls) => cls && !cls.startsWith('ami-highlight'))
      if (classes.length) {
        try {
          part += `.${CSS.escape(classes[0])}`
        } catch {
          part += `.${classes[0]}`
        }
      }
    }
    const parent = node.parentElement
    if (parent) {
      const siblings = Array.from(parent.children)
      const index = siblings.indexOf(node)
      part += `@${index}`
    }
    parts.unshift(part)
    node = parent
  }
  return parts.join('>')
}

function parseDataPath(doc, path) {
  if (!path || typeof path !== 'string' || !doc) return null
  const segments = path.split('>').filter(Boolean)
  let current = doc.documentElement
  if (!current) return null
  if (segments.length && segments[0].startsWith('html')) segments.shift()
  for (const segment of segments) {
    if (!current) return null
    const [sel, order] = segment.split('@')
    if (sel && sel.includes('#')) {
      const [tag, idPart] = sel.split('#')
      const id = idPart || ''
      if (id) {
        const candidate = doc.getElementById(id)
        if (candidate) {
          current = candidate
          continue
        }
      }
    }
    const tagName = sel?.split('.')[0] || '*'
    const className = sel?.includes('.') ? sel.split('.')[1] : ''
    const candidates = Array.from(current.children).filter((child) => {
      if (className && !child.classList?.contains(className)) return false
      return tagName === '*' || child.tagName.toLowerCase() === tagName
    })
    let index = Number.parseInt(order, 10)
    if (!Number.isFinite(index) || index < 0) index = 0
    current = candidates[index] || null
  }
  return current || null
}

function setTriggerAttr(el, triggerId) {
  if (!isElement(el) || !triggerId) return
  const existing = new Set((el.getAttribute(TRIGGER_ATTR) || '').split(' ').filter(Boolean))
  existing.add(triggerId)
  el.setAttribute(TRIGGER_ATTR, Array.from(existing).join(' '))
}

function removeTriggerAttr(el, triggerId) {
  if (!isElement(el) || !triggerId) return
  const existing = new Set((el.getAttribute(TRIGGER_ATTR) || '').split(' ').filter(Boolean))
  if (!existing.has(triggerId)) return
  existing.delete(triggerId)
  if (existing.size) el.setAttribute(TRIGGER_ATTR, Array.from(existing).join(' '))
  else el.removeAttribute(TRIGGER_ATTR)
}

function buildContext({ trigger, element, event, document, window, manager, target }) {
  return {
    trigger,
    element,
    event,
    document,
    window,
    manager,
    target: target || element,
  }
}

function compileFunction(key, source) {
  if (!source || typeof source !== 'string') return null
  try {
    const body = String(source)
    // Provide common shorthands in function scope
    return new Function(
      'context',
      `"use strict";\nconst document = context.document;\nconst window = context.window || (typeof globalThis !== 'undefined' ? globalThis : undefined);\nconst trigger = context.trigger;\nconst event = context.event;\nconst element = context.element;\nlet target = context.target;\nconst manager = context.manager;\n${body}`,
    )
  } catch (error) {
    console.warn(`Failed to compile ${key} script`, error)
    return null
  }
}

function ensureEventType(type) {
  if (typeof type !== 'string' || !type.trim()) return 'click'
  return type.trim()
}

function getOwnerDocument(el) {
  return (el && el.ownerDocument) || (typeof document !== 'undefined' ? document : null)
}

class AutomationController {
  constructor(options = {}) {
    const doc = options.document || (typeof document !== 'undefined' ? document : null)
    if (!doc) throw new Error('AutomationController requires a document')
    if (!options.manager) throw new Error('AutomationController requires a HighlightManager')
    this.document = doc
    this.manager = options.manager
    this.ownerId = typeof options.ownerId === 'string' ? options.ownerId : ''
    this.onPlacementStateChange = typeof options.onPlacementStateChange === 'function' ? options.onPlacementStateChange : null
    this.onTriggerCreated = typeof options.onTriggerCreated === 'function' ? options.onTriggerCreated : null
    this.onTriggerEditRequest = typeof options.onTriggerEditRequest === 'function' ? options.onTriggerEditRequest : null
    this.state = { enabled: false, triggers: [] }
    this.triggerMap = new Map()
    this.iconMap = new Map()
    this.compiledMap = new Map()
    this.placement = {
      active: false,
      overlay: null,
      highlight: null,
      pointerHandler: null,
      clickHandler: null,
      keyHandler: null,
      contextHandler: null,
    }
    this.boundAutomationListener = (state) => this.syncState(state)
    this.detachAutomation = this.manager.on('automation', this.boundAutomationListener)
    this.boundScroll = () => this.schedulePositionUpdate()
    this.boundResize = () => this.schedulePositionUpdate()
    this.boundMutation = () => this.scheduleRefresh()
    this.pendingRefresh = null
    this.pendingPositionFrame = null
    this.document.addEventListener('scroll', this.boundScroll, true)
    this.document.defaultView?.addEventListener('resize', this.boundResize, { passive: true })
    this.observer = null
    this.ensureObserver()
    this.syncState(this.manager.getAutomation())
  }

  ensureObserver() {
    if (this.observer || typeof MutationObserver === 'undefined') return
    this.observer = new MutationObserver(() => this.scheduleRefresh())
    try {
      this.observer.observe(this.document, { childList: true, subtree: true, attributes: true })
    } catch {}
  }

  destroy() {
    if (this.detachAutomation) this.detachAutomation()
    this.detachAutomation = null
    this.document.removeEventListener('scroll', this.boundScroll, true)
    this.document.defaultView?.removeEventListener('resize', this.boundResize)
    if (this.observer) {
      try {
        this.observer.disconnect()
      } catch {}
      this.observer = null
    }
    this.clearPlacement()
    this.iconMap.forEach((entry) => this.teardownTrigger(entry.triggerId))
    this.iconMap.clear()
    this.compiledMap.clear()
  }

  syncState(state) {
    const next = state && typeof state === 'object' ? state : { enabled: false, triggers: [] }
    const enabled = !!next.enabled
    const triggers = Array.isArray(next.triggers) ? next.triggers : []
    this.state = { enabled, triggers }
    const retainIds = new Set()
    triggers.forEach((trigger) => {
      if (!trigger || !trigger.id) return
      retainIds.add(trigger.id)
      const prev = this.triggerMap.get(trigger.id)
      this.triggerMap.set(trigger.id, trigger)
      if (!prev || prev.updatedAt !== trigger.updatedAt) {
        this.invalidateCompiled(trigger.id)
      }
    })
    Array.from(this.triggerMap.keys()).forEach((id) => {
      if (!retainIds.has(id)) {
        this.triggerMap.delete(id)
        this.invalidateCompiled(id)
        this.teardownTrigger(id)
      }
    })
    this.renderAll()
  }

  invalidateCompiled(triggerId) {
    const prefix = `${triggerId}::`
    Array.from(this.compiledMap.keys()).forEach((key) => {
      if (key.startsWith(prefix)) this.compiledMap.delete(key)
    })
  }

  scheduleRefresh() {
    if (this.pendingRefresh) return
    this.pendingRefresh = setTimeout(() => {
      this.pendingRefresh = null
      this.renderAll()
    }, 60)
  }

  schedulePositionUpdate() {
    if (this.pendingPositionFrame) return
    this.pendingPositionFrame = (this.document.defaultView || window).requestAnimationFrame(() => {
      this.pendingPositionFrame = null
      this.iconMap.forEach((entry) => this.positionIcon(entry))
    })
  }

  renderAll() {
    this.triggerMap.forEach((trigger) => this.ensureTrigger(trigger))
    Array.from(this.iconMap.keys()).forEach((id) => {
      if (!this.triggerMap.has(id)) this.teardownTrigger(id)
    })
    this.schedulePositionUpdate()
  }

  ensureTrigger(trigger) {
    if (!trigger || !trigger.id) return
    const element = this.resolveElement(trigger)
    const entry = this.ensureIcon(trigger)
    entry.triggerId = trigger.id
    entry.trigger = trigger
    entry.element = element
    if (element) {
      setTriggerAttr(element, trigger.id)
      this.attachListener(entry, trigger, element)
      entry.icon.removeAttribute('data-state')
      entry.icon.classList.toggle(ICON_INACTIVE_CLASS, !(this.state.enabled && trigger.enabled !== false))
    } else {
      this.detachListener(entry)
      entry.icon.dataset.state = 'detached'
      entry.icon.classList.add(ICON_INACTIVE_CLASS)
    }
    this.positionIcon(entry)
  }

  ensureIcon(trigger) {
    let entry = this.iconMap.get(trigger.id)
    if (entry) return entry
    const icon = this.document.createElement('button')
    icon.type = 'button'
    icon.className = ICON_CLASS
    icon.innerHTML = ICON_SVG
    icon.setAttribute('aria-label', `Edit automation trigger "${trigger.name}"`)
    setHint(icon, `Automation trigger: ${trigger.name}`)
    icon.dataset.triggerId = trigger.id
    icon.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (typeof this.onTriggerEditRequest === 'function') {
        this.onTriggerEditRequest(trigger.id, { focus: true })
      }
    })
    markPluginNode(icon, { ignore: true })
    this.document.body.appendChild(icon)
    const entryInfo = {
      triggerId: trigger.id,
      icon,
      trigger,
      element: null,
      handler: null,
      eventType: null,
    }
    this.iconMap.set(trigger.id, entryInfo)
    return entryInfo
  }

  positionIcon(entry) {
    const { icon, element } = entry
    if (!icon) return
    if (!element || !isElement(element)) {
      icon.style.opacity = '0'
      icon.style.pointerEvents = 'none'
      return
    }
    const rect = element.getBoundingClientRect()
    const view = this.document.defaultView || window
    const scrollX = view.scrollX || view.pageXOffset || 0
    const scrollY = view.scrollY || view.pageYOffset || 0
    const top = rect.top + scrollY + 4
    const left = rect.left + scrollX + rect.width + 6
    icon.style.position = 'absolute'
    icon.style.top = `${Math.round(top)}px`
    icon.style.left = `${Math.round(left)}px`
    icon.style.opacity = '1'
    icon.style.pointerEvents = 'auto'
  }

  detachListener(entry) {
    if (!entry || !entry.handler || !entry.element) return
    try {
      entry.element.removeEventListener(entry.eventType || 'click', entry.handler)
    } catch {}
    removeTriggerAttr(entry.element, entry.triggerId)
    entry.handler = null
    entry.element = null
    entry.eventType = null
  }

  teardownTrigger(triggerId) {
    const entry = this.iconMap.get(triggerId)
    if (!entry) return
    this.detachListener(entry)
    if (entry.icon?.parentElement) {
      entry.icon.parentElement.removeChild(entry.icon)
    }
    this.iconMap.delete(triggerId)
  }

  attachListener(entry, trigger, element) {
    if (!entry || !trigger || !element) return
    const eventType = ensureEventType(trigger.eventType)
    if (entry.handler && entry.element) {
      if (entry.element === element && entry.eventType === eventType) return
      this.detachListener(entry)
    }
    const handler = (event) => {
      if (!this.state.enabled || trigger.enabled === false) return
      this.executeTrigger(trigger, event, element)
    }
    element.addEventListener(eventType, handler)
    entry.handler = handler
    entry.element = element
    entry.eventType = eventType
  }

  resolveElement(trigger) {
    if (!trigger) return null
    const doc = this.document
    if (trigger.selector) {
      try {
        const el = doc.querySelector(trigger.selector)
        if (el) return el
      } catch {}
    }
    if (trigger.dataPath) {
      const el = parseDataPath(doc, trigger.dataPath)
      if (el) return el
    }
    const attrSelector = `[${TRIGGER_ATTR}~="${trigger.id}"]`
    try {
      const el = doc.querySelector(attrSelector)
      if (el) return el
    } catch {}
    return null
  }

  compile(trigger, key) {
    if (!trigger || !trigger.id) return null
    const cacheKey = `${trigger.id}::${key}`
    const cached = this.compiledMap.get(cacheKey)
    if (cached && cached.version === trigger.updatedAt) return cached.fn
    const fn = compileFunction(key, trigger[key])
    this.compiledMap.set(cacheKey, { fn, version: trigger.updatedAt })
    return fn
  }

  executeTrigger(trigger, event, element) {
    const doc = getOwnerDocument(element) || this.document
    const view = doc.defaultView || window
    const targetFn = this.compile(trigger, 'targetCode')
    const conditionFn = this.compile(trigger, 'conditionCode')
    const actionFn = this.compile(trigger, 'actionCode')
    const baseContext = buildContext({ trigger, element, event, document: doc, window: view, manager: this.manager })
    let target = baseContext.target
    if (typeof targetFn === 'function') {
      try {
        const result = targetFn(baseContext)
        if (result && isElement(result)) target = result
        else if (Array.isArray(result)) {
          target = result.filter((item) => isElement(item))
        } else if (result !== undefined) {
          target = result
        }
      } catch (error) {
        console.warn('Automation trigger target script failed', error)
      }
    }
    const context = { ...baseContext, target }
    let shouldRun = true
    if (typeof conditionFn === 'function') {
      try {
        shouldRun = conditionFn(context) !== false
      } catch (error) {
        console.warn('Automation trigger condition script failed', error)
        shouldRun = false
      }
    }
    if (!shouldRun) return
    if (typeof actionFn === 'function') {
      try {
        const result = actionFn(context)
        if (result && typeof result.then === 'function') {
          result.catch((error) => console.warn('Automation trigger action rejected', error))
        }
      } catch (error) {
        console.warn('Automation trigger action script failed', error)
      }
    }
    debugLog('automation:trigger-fired', {
      id: trigger.id,
      name: trigger.name,
      event: event?.type,
    })
  }

  startPlacement(options = {}) {
    if (this.placement.active) return
    const doc = this.document
    const overlay = doc.createElement('div')
    overlay.className = PLACEMENT_OVERLAY_CLASS
    overlay.innerHTML = `<span>${PLACEMENT_INSTRUCTIONS}</span>`
    markPluginNode(overlay)
    const highlight = doc.createElement('div')
    highlight.className = PLACEMENT_HINT_CLASS
    markPluginNode(highlight)
    doc.body.appendChild(overlay)
    doc.body.appendChild(highlight)
    this.placement = {
      active: true,
      overlay,
      highlight,
      pointerHandler: (event) => this.handlePlacementPointer(event),
      clickHandler: (event) => this.handlePlacementClick(event, options),
      keyHandler: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          this.clearPlacement(true)
        }
      },
      contextHandler: (event) => {
        event.preventDefault()
        this.clearPlacement(true)
      },
      targetElement: null,
    }
    doc.addEventListener('pointermove', this.placement.pointerHandler, true)
    doc.addEventListener('pointerdown', this.placement.clickHandler, true)
    doc.addEventListener('keydown', this.placement.keyHandler, true)
    doc.addEventListener('contextmenu', this.placement.contextHandler, true)
    if (typeof this.onPlacementStateChange === 'function') this.onPlacementStateChange(true)
  }

  handlePlacementPointer(event) {
    if (!this.placement.active) return
    const path = event.composedPath ? event.composedPath() : []
    let candidate = null
    if (path.length) {
      candidate = path.find((node) => isElement(node) && !shouldIgnoreNode(node)) || null
    } else if (isElement(event.target)) {
      candidate = shouldIgnoreNode(event.target) ? null : event.target
    }
    if (candidate && candidate instanceof HTMLElement) {
      this.highlightPlacementTarget(candidate)
    }
  }

  highlightPlacementTarget(el) {
    if (!this.placement.active) return
    if (this.placement.targetElement === el) return
    this.placement.targetElement = el
    const rect = el.getBoundingClientRect()
    const view = this.document.defaultView || window
    const scrollX = view.scrollX || view.pageXOffset || 0
    const scrollY = view.scrollY || view.pageYOffset || 0
    if (this.placement.highlight) {
      const box = this.placement.highlight
      box.style.position = 'absolute'
      box.style.left = `${rect.left + scrollX}px`
      box.style.top = `${rect.top + scrollY}px`
      box.style.width = `${rect.width}px`
      box.style.height = `${rect.height}px`
      box.style.opacity = '1'
    }
  }

  handlePlacementClick(event, options) {
    if (!this.placement.active) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const target = this.placement.targetElement
    this.clearPlacement()
    if (target) {
      this.createTriggerForElement(target, options)
    }
  }

  clearPlacement(cancelled = false) {
    if (!this.placement.active) return
    const doc = this.document
    doc.removeEventListener('pointermove', this.placement.pointerHandler, true)
    doc.removeEventListener('pointerdown', this.placement.clickHandler, true)
    doc.removeEventListener('keydown', this.placement.keyHandler, true)
    doc.removeEventListener('contextmenu', this.placement.contextHandler, true)
    if (this.placement.overlay?.parentElement) this.placement.overlay.parentElement.removeChild(this.placement.overlay)
    if (this.placement.highlight?.parentElement) this.placement.highlight.parentElement.removeChild(this.placement.highlight)
    this.placement = {
      active: false,
      overlay: null,
      highlight: null,
    }
    if (typeof this.onPlacementStateChange === 'function') this.onPlacementStateChange(false, { cancelled })
  }

  buildDraftForElement(element, options = {}) {
    if (!isElement(element)) return null
    const selector = computeSelector(element)
    const dataPath = computeDataPath(element)
    const label = computeElementLabel(element)
    const eventType = ensureEventType(options.eventType || 'click')
    let id = options.id && typeof options.id === 'string' ? options.id.trim() : ''
    if (!id) {
      try {
        id = this.manager?.generateTriggerId?.() || `ami-trigger-${Date.now().toString(36)}`
      } catch {
        id = `ami-trigger-${Date.now().toString(36)}`
      }
    }
    return {
      id,
      name: label || 'Automation trigger',
      selector,
      dataPath,
      elementLabel: label,
      owner: this.ownerId,
      targetCode: selector
        ? `return document.querySelector(${JSON.stringify(selector)});`
        : 'return context.event?.currentTarget || context.element;',
      conditionCode: 'return true;',
      actionCode: 'console.log("Automation trigger fired", context);',
      eventType,
      enabled: true,
      type: 'dom',
    }
  }

  createTriggerForElement(element, options = {}) {
    const draft = this.buildDraftForElement(element, options)
    if (!draft) return null
    const trigger = this.manager.createTrigger(draft)
    if (trigger) {
      debugLog('automation:trigger-created', {
        id: trigger.id,
        name: trigger.name,
        selector: trigger.selector,
      })
      if (typeof this.onTriggerCreated === 'function') this.onTriggerCreated(trigger)
      if (typeof this.onTriggerEditRequest === 'function') this.onTriggerEditRequest(trigger.id, {
        focus: true,
        autoOpen: true,
      })
    }
    return trigger
  }

  findTriggerByElement(element) {
    if (!isElement(element)) return null
    const attr = element.getAttribute(TRIGGER_ATTR)
    if (!attr) return null
    const [id] = attr.split(' ').filter(Boolean)
    if (id && this.triggerMap.has(id)) return this.triggerMap.get(id)
    return null
  }
 }

export function createAutomationController(options = {}) {
  return new AutomationController(options)
}
