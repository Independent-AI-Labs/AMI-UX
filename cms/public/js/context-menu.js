/*
 * Context Menu Manager
 * --------------------
 * Provides a first-class registry for context menus in the CMS shell. Menus are
 * resolved via data-menu/data-menu-flags markers and rendered with consistent
 * styling, grouping, and optional hierarchy.
 */

const DEFAULT_MENU_OPTIONS = {
  defaultMenus: true,
  closeOnScroll: true,
  tokenMode: 'all',
  flagMode: 'all',
  ignoreSelectors: ['.ami-context-menu', '.media-ctx', '[data-menu="native"]'],
}

const STYLE_ELEMENT_ID = 'ami-context-menu-styles'
const MENU_CLASS = 'ami-context-menu'

const DEFAULT_MENU_CSS = `
.${MENU_CLASS} {
  position: fixed;
  z-index: 2147483000;
  background: var(--panel, #111417);
  color: var(--text, #f3f5f6);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  min-width: 176px;
  max-width: 300px;
  padding: 0.2rem;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  font-family: inherit;
  font-size: 0.82rem;
}
.${MENU_CLASS}[data-depth="0"] {
  border-radius: 10px;
}
.${MENU_CLASS}__section {
  padding: 0.05rem 0;
}
.${MENU_CLASS}__section + .${MENU_CLASS}__section {
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  margin-top: 0.075rem;
  padding-top: 0.2rem;
}
.${MENU_CLASS}__list {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.${MENU_CLASS}__item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.38rem 0.55rem;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  transition: background 110ms ease;
  position: relative;
}
.${MENU_CLASS}__item[disabled],
.${MENU_CLASS}__item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.4;
}
.${MENU_CLASS}__item:not([disabled]):not([aria-disabled="true"]):hover,
.${MENU_CLASS}__item[data-active="true"] {
  background: color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent);
}
.${MENU_CLASS}__item[data-danger="true"]:not([disabled]):hover {
  background: color-mix(in srgb, var(--danger, #ef4444) 22%, transparent);
}
.${MENU_CLASS}__icon {
  width: 1.15rem;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.95rem;
  opacity: 0.9;
}
.${MENU_CLASS}__label {
  flex: 1;
  display: block;
}
.${MENU_CLASS}__shortcut {
  font-size: 0.68rem;
  color: var(--text-muted, rgba(255, 255, 255, 0.6));
}
.${MENU_CLASS}__submenu-caret {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.6;
}
.${MENU_CLASS}__separator {
  height: 1px;
  background: var(--border, rgba(255, 255, 255, 0.08));
  margin: 0.25rem 0.2rem;
}
`

let singletonManager = null

export function initContextMenu(options = {}) {
  if (!singletonManager) {
    singletonManager = new ContextMenuManager(options)
    singletonManager.install()
  }
  return singletonManager
}

export function registerContextMenu(definition) {
  return initContextMenu().register(definition)
}

export function openContextMenu(id, options = {}) {
  return initContextMenu().openMenuById(id, options)
}

export function closeContextMenus() {
  return initContextMenu().closeAll()
}

export function getContextMenuManager() {
  return initContextMenu()
}

class ContextMenuManager {
  constructor(options = {}) {
    const opts = { ...DEFAULT_MENU_OPTIONS, ...options }
    this.root = opts.root && opts.root.nodeType === 9 ? opts.root : document
    this.options = opts
    this.definitions = new Map()
    this.sortedDefinitions = null
    this.installed = false
    this.defaultsRegistered = false
    this.activeState = null
    this.lastPointerEvent = null

    this.handleContextMenu = this.handleContextMenu.bind(this)
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleScroll = this.handleScroll.bind(this)
    this.handleWindowBlur = this.handleWindowBlur.bind(this)
    this.handleResize = this.handleResize.bind(this)
  }

  install() {
    if (this.installed) return
    const doc = this.root
    doc.addEventListener('contextmenu', this.handleContextMenu)
    doc.addEventListener('pointerdown', this.handlePointerDown, true)
    doc.addEventListener('keydown', this.handleKeyDown, true)
    if (this.options.closeOnScroll) doc.addEventListener('scroll', this.handleScroll, true)
    window.addEventListener('blur', this.handleWindowBlur)
    window.addEventListener('resize', this.handleResize)
    this.installed = true
    this.injectStyles()
    if (this.options.defaultMenus) this.ensureDefaultMenus()
  }

  dispose() {
    if (!this.installed) return
    const doc = this.root
    doc.removeEventListener('contextmenu', this.handleContextMenu)
    doc.removeEventListener('pointerdown', this.handlePointerDown, true)
    doc.removeEventListener('keydown', this.handleKeyDown, true)
    doc.removeEventListener('scroll', this.handleScroll, true)
    window.removeEventListener('blur', this.handleWindowBlur)
    window.removeEventListener('resize', this.handleResize)
    this.installed = false
    this.closeAll()
  }

  injectStyles() {
    const doc = this.root
    if (!doc || !doc.head) return
    if (doc.getElementById(STYLE_ELEMENT_ID)) return
    const style = doc.createElement('style')
    style.id = STYLE_ELEMENT_ID
    style.textContent = DEFAULT_MENU_CSS
    doc.head.appendChild(style)
  }

  ensureDefaultMenus() {
    if (this.defaultsRegistered) return
    this.register({
      id: 'builtin.clipboard',
      priority: -100,
      match: (ctx) => ctx.selectionText.length > 0 || ctx.isEditable,
      build: (ctx) => buildClipboardMenu(ctx, this),
    })
    this.defaultsRegistered = true
  }

  register(definition) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('Context menu definition must be an object')
    }
    if (!definition.id || typeof definition.id !== 'string') {
      throw new Error('Context menu definition requires an "id" string')
    }
    const normalized = normalizeDefinition(definition)
    this.definitions.set(normalized.id, normalized)
    this.sortedDefinitions = null
    return () => {
      this.unregister(normalized.id)
    }
  }

  unregister(id) {
    if (!id) return
    if (this.definitions.has(id)) {
      this.definitions.delete(id)
      this.sortedDefinitions = null
    }
  }

  getDefinitions() {
    if (this.sortedDefinitions) return this.sortedDefinitions
    const defs = Array.from(this.definitions.values())
    defs.sort((a, b) => {
      const prioDiff = (b.priority || 0) - (a.priority || 0)
      if (prioDiff !== 0) return prioDiff
      return a.id.localeCompare(b.id)
    })
    this.sortedDefinitions = defs
    return defs
  }

  shouldIgnoreTarget(target) {
    if (!(target instanceof Element)) return true
    for (const selector of this.options.ignoreSelectors || []) {
      if (!selector) continue
      if (target.closest(selector)) return true
    }
    return false
  }

  handleContextMenu(event) {
    this.lastPointerEvent = event
    if (event.defaultPrevented) return
    const target = event.target
    if (this.shouldIgnoreTarget(target)) return
    const ctx = this.createContext(event, target)
    const definition = this.resolveDefinition(ctx)
    try {
      event.preventDefault()
    } catch {}
    try {
      event.stopPropagation()
    } catch {}
    if (!definition) {
      this.closeAll()
      return
    }
    this.openDefinition(definition, ctx, { fromEvent: true })
  }

  async openDefinition(definition, ctx, options = {}) {
    const baseContext = { ...ctx, definition, menuId: definition.id, manager: this }
    const prepared = definition.prepare
      ? await safeInvoke(() => definition.prepare(baseContext), baseContext)
      : baseContext
    const resolvedContext = prepared && typeof prepared === 'object' ? { ...baseContext, ...prepared } : baseContext
    const model = await safeInvoke(() => definition.build(resolvedContext), resolvedContext)
    if (!model) return
    const normalizedModel = normalizeMenuModel(model)
    if (!normalizedModel.sections.length) return
    const point = resolveAnchorPoint(options, resolvedContext)
    this.renderMenu(definition, normalizedModel, resolvedContext, point)
  }

  async openMenuById(id, options = {}) {
    const definition = this.definitions.get(id)
    if (!definition) return false
    const target = options.target && options.target instanceof Element ? options.target : this.root.body
    const coords = {
      clientX: options.clientX ?? options.x ?? 0,
      clientY: options.clientY ?? options.y ?? 0,
    }
    const mouseEvent =
      options.event instanceof Event
        ? options.event
        : new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: this.root.defaultView || window,
            clientX: coords.clientX,
            clientY: coords.clientY,
          })
    const ctx = this.createContext(mouseEvent, target, options)
    await this.openDefinition(definition, ctx, { fromProgrammatic: true, ...options, event: mouseEvent })
    return true
  }

  createContext(event, target, overrides = {}) {
    const meta = collectMenuMetadata(target)
    const selection = getSelectionSummary(this.root)
    const pointer = {
      clientX: overrides.clientX ?? event.clientX ?? 0,
      clientY: overrides.clientY ?? event.clientY ?? 0,
    }
    const base = {
      event,
      target: target instanceof Element ? target : this.root.body,
      menuIds: meta.menuIds,
      flags: meta.flags,
      zone: meta.zone,
      selectionText: selection.text,
      selectionIsCollapsed: selection.collapsed,
      isEditable: isEditableElement(target),
      linkHref: meta.linkHref,
      point: pointer,
      time: Date.now(),
      manager: this,
    }
    if (overrides && typeof overrides === 'object') {
      return { ...base, ...overrides }
    }
    return base
  }

  resolveDefinition(ctx) {
    const defs = this.getDefinitions()
    for (const def of defs) {
      if (!this.matchesDefinition(def, ctx)) continue
      return def
    }
    return null
  }

  matchesDefinition(def, ctx) {
    if (def.selector && !ctx.target.closest(def.selector)) return false
    if (def.zones && def.zones.size) {
      if (!ctx.zone || !def.zones.has(ctx.zone)) return false
    }
    if (def.tokens && def.tokens.size) {
      const candidate = ctx.menuIds || new Set()
      if (def.tokenMode === 'any') {
        let hit = false
        for (const token of def.tokens) {
          if (candidate.has(token)) {
            hit = true
            break
          }
        }
        if (!hit) return false
      } else {
        for (const token of def.tokens) {
          if (!candidate.has(token)) return false
        }
      }
    }
    if (def.flags && def.flags.size) {
      const bag = ctx.flags || new Set()
      if (def.flagMode === 'any') {
        let ok = false
        for (const flag of def.flags) {
          if (bag.has(flag)) {
            ok = true
            break
          }
        }
        if (!ok) return false
      } else {
        for (const flag of def.flags) {
          if (!bag.has(flag)) return false
        }
      }
    }
    if (def.excludeFlags && def.excludeFlags.size) {
      const bag = ctx.flags || new Set()
      for (const flag of def.excludeFlags) {
        if (bag.has(flag)) return false
      }
    }
    if (typeof def.match === 'function' && !def.match(ctx)) return false
    if (typeof def.when === 'function' && !def.when(ctx)) return false
    return true
  }

  renderMenu(definition, model, ctx, point) {
    this.closeAll()
    const rootView = createMenuView({ definition, model, ctx, manager: this, depth: 0 })
    if (!rootView) return
    rootView.element.style.visibility = 'hidden'
    this.activeState = {
      definition,
      context: ctx,
      stack: [rootView],
    }
    this.root.body.appendChild(rootView.element)
    positionMenuAtPoint(rootView.element, point)
  }

  handlePointerDown(event) {
    const target = event.target
    if (this.activeState && target instanceof Element) {
      const menus = this.activeState.stack.map((view) => view.element)
      for (const menu of menus) {
        if (menu.contains(target)) return
      }
    }
    this.closeAll()
  }

  handleKeyDown(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      this.closeAll()
    }
  }

  handleScroll(event) {
    if (!this.options.closeOnScroll) return
    if (!this.activeState) return
    const target = event.target
    if (!(target instanceof Element)) {
      this.closeAll()
      return
    }
    const menus = this.activeState.stack.map((view) => view.element)
    for (const menu of menus) {
      if (menu.contains(target)) return
    }
    this.closeAll()
  }

  handleWindowBlur() {
    this.closeAll()
  }

  handleResize() {
    this.closeAll()
  }

  closeAll() {
    const state = this.activeState
    if (!state) return
    while (state.stack.length) {
      const view = state.stack.pop()
      if (view && view.element && view.element.parentNode) {
        view.element.parentNode.removeChild(view.element)
      }
      if (view && typeof view.destroy === 'function') {
        try {
          view.destroy()
        } catch {}
      }
    }
    this.activeState = null
  }

  closeSubmenusFrom(depth) {
    if (!this.activeState) return
    while (this.activeState.stack.length > depth + 1) {
      const view = this.activeState.stack.pop()
      if (view?.element?.parentNode) view.element.parentNode.removeChild(view.element)
    }
  }

  openSubmenu(parentView, submenuItem, anchorEl) {
    if (!this.activeState) return
    const depth = parentView.depth + 1
    this.closeSubmenusFrom(depth - 1)
    const descriptor = submenuItem?.model ? submenuItem.model : submenuItem
    const ctx = {
      ...this.activeState.context,
      parentMenu: parentView.model,
      parentItem: submenuItem,
    }
    const model = normalizeMenuModel(descriptor)
    if (!model.sections.length) return
    const view = createMenuView({
      definition: this.activeState.definition,
      model,
      ctx,
      manager: this,
      depth,
    })
    if (!view) return
    view.element.style.visibility = 'hidden'
    this.activeState.stack.push(view)
    this.root.body.appendChild(view.element)
    positionSubmenu(anchorEl, view.element)
  }
}

function normalizeDefinition(def) {
  const tokens = new Set()
  if (def.tokens) {
    const source = Array.isArray(def.tokens) ? def.tokens : [def.tokens]
    source.filter(Boolean).forEach((token) => tokens.add(String(token)))
  }
  const flags = new Set()
  if (def.flags) {
    const source = Array.isArray(def.flags) ? def.flags : [def.flags]
    source.filter(Boolean).forEach((flag) => flags.add(String(flag)))
  }
  const excludeFlags = new Set()
  if (def.excludeFlags) {
    const source = Array.isArray(def.excludeFlags) ? def.excludeFlags : [def.excludeFlags]
    source.filter(Boolean).forEach((flag) => excludeFlags.add(String(flag)))
  }
  const zones = new Set()
  if (def.zones) {
    const source = Array.isArray(def.zones) ? def.zones : [def.zones]
    source.filter(Boolean).forEach((zone) => zones.add(String(zone)))
  }
  return {
    ...def,
    tokens,
    flags,
    excludeFlags,
    zones,
    tokenMode: def.tokenMode === 'any' ? 'any' : 'all',
    flagMode: def.flagMode === 'any' ? 'any' : 'all',
  }
}

function normalizeMenuModel(input) {
  if (!input || typeof input !== 'object') return { sections: [] }
  if (Array.isArray(input)) {
    return normalizeMenuModel({ sections: [{ items: input }] })
  }
  const sections = []
  if (Array.isArray(input.sections)) {
    input.sections.forEach((section, index) => {
      const normalized = normalizeMenuSection(section, index)
      if (normalized.items.length) sections.push(normalized)
    })
  } else if (Array.isArray(input.items)) {
    const normalized = normalizeMenuSection({ items: input.items }, 0)
    if (normalized.items.length) sections.push(normalized)
  }
  return { id: input.id || null, title: input.title || null, sections }
}

function normalizeMenuSection(section, index) {
  const items = []
  const rawItems = Array.isArray(section?.items) ? section.items : []
  rawItems.forEach((item, idx) => {
    const normalized = normalizeMenuItem(item, idx)
    if (normalized) items.push(normalized)
  })
  return {
    id: section?.id || `section-${index}`,
    label: section?.label || null,
    items,
  }
}

function normalizeMenuItem(item, index) {
  if (!item) return null
  const type = item.type || 'action'
  if (type === 'separator') {
    return { type: 'separator', id: item.id || `separator-${index}` }
  }
  if (type === 'submenu') {
    const nested = normalizeMenuModel({
      id: item.id || `submenu-${index}`,
      title: item.title || item.label || null,
      sections: Array.isArray(item.sections)
        ? item.sections
        : [{ items: Array.isArray(item.items) ? item.items : [] }],
    })
    return {
      type: 'submenu',
      id: item.id || nested.id || `submenu-${index}`,
      label: item.label || 'Submenu',
      hint: item.hint || null,
      disabled: !!item.disabled,
      danger: !!item.danger,
      icon: item.icon || null,
      shortcut: item.shortcut || null,
      keepOpen: item.keepOpen || false,
      model: nested,
    }
  }
  if (type === 'action') {
    return {
      type: 'action',
      id: item.id || `action-${index}`,
      label: item.label || 'Untitled action',
      hint: item.hint || item.description || null,
      disabled: !!item.disabled,
      danger: !!item.danger,
      icon: item.icon || null,
      shortcut: item.shortcut || null,
      keepOpen: !!item.keepOpen,
      onSelect: typeof item.onSelect === 'function' ? item.onSelect : null,
    }
  }
  return null
}

function resolveAnchorPoint(options, ctx) {
  if (options && typeof options === 'object') {
    if (typeof options.clientX === 'number' && typeof options.clientY === 'number') {
      return { clientX: options.clientX, clientY: options.clientY }
    }
    if (typeof options.x === 'number' && typeof options.y === 'number') {
      return { clientX: options.x, clientY: options.y }
    }
  }
  if (ctx?.point) {
    const { clientX = 0, clientY = 0 } = ctx.point
    if (clientX !== 0 || clientY !== 0) return { clientX, clientY }
  }
  const target = ctx?.target
  if (target instanceof Element) {
    const rect = target.getBoundingClientRect()
    return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
  }
  return { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }
}

function createMenuView({ definition, model, ctx, manager, depth }) {
  const doc = manager.root
  const menu = doc.createElement('div')
  menu.className = MENU_CLASS
  menu.dataset.depth = String(depth)
  menu.setAttribute('data-ami-highlight-ignore', '1')
  if (model.title) menu.setAttribute('data-title', model.title)

  const stack = []

  model.sections.forEach((section) => {
    const sectionEl = doc.createElement('div')
    sectionEl.className = `${MENU_CLASS}__section`
    const listEl = doc.createElement('div')
    listEl.className = `${MENU_CLASS}__list`
    section.items.forEach((item) => {
      const itemEl = createMenuItem({ item, ctx, manager, depth })
      if (itemEl) listEl.appendChild(itemEl)
    })
    sectionEl.appendChild(listEl)
    menu.appendChild(sectionEl)
    stack.push(sectionEl)
  })

  const destroy = () => {
    stack.splice(0, stack.length)
  }

  return { element: menu, destroy, depth, model, definition, ctx }
}

function createMenuItem({ item, ctx, manager, depth }) {
  const doc = manager.root
  if (item.type === 'separator') {
    const separator = doc.createElement('div')
    separator.className = `${MENU_CLASS}__separator`
    return separator
  }

  const el = doc.createElement('button')
  el.type = 'button'
  el.className = `${MENU_CLASS}__item`
  el.dataset.itemId = item.id

  if (item.danger) el.dataset.danger = 'true'
  if (item.disabled) {
    el.setAttribute('disabled', 'true')
    el.setAttribute('aria-disabled', 'true')
  }

  el.addEventListener('mouseenter', () => {
    manager.closeSubmenusFrom(depth)
  })
  el.addEventListener('focus', () => {
    manager.closeSubmenusFrom(depth)
  })

  const iconEl = doc.createElement('span')
  iconEl.className = `${MENU_CLASS}__icon`
  if (item.icon) {
    if (item.icon.startsWith('<')) {
      iconEl.innerHTML = item.icon
    } else {
      const iconNode = doc.createElement('i')
      iconNode.className = item.icon
      iconEl.appendChild(iconNode)
    }
  }
  el.appendChild(iconEl)

  const labelWrap = doc.createElement('span')
  labelWrap.className = `${MENU_CLASS}__label`
  const labelNode = doc.createElement('span')
  labelNode.textContent = item.label
  labelWrap.appendChild(labelNode)
  el.appendChild(labelWrap)

  if (item.shortcut) {
    const shortcut = doc.createElement('span')
    shortcut.className = `${MENU_CLASS}__shortcut`
    shortcut.textContent = item.shortcut
    el.appendChild(shortcut)
  }

  if (item.type === 'submenu') {
    const caret = doc.createElement('span')
    caret.className = `${MENU_CLASS}__submenu-caret`
    caret.innerHTML = '&rsaquo;'
    el.appendChild(caret)
    el.addEventListener('mouseenter', () => {
      if (item.disabled) return
      const parentView = manager.activeState?.stack?.[depth]
      if (!parentView) return
      manager.openSubmenu(parentView, item, el)
    })
    el.addEventListener('focus', () => {
      if (item.disabled) return
      const parentView = manager.activeState?.stack?.[depth]
      if (!parentView) return
      manager.openSubmenu(parentView, item, el)
    })
    return el
  }

  if (typeof item.onSelect === 'function') {
    el.addEventListener('click', async (event) => {
      event.preventDefault()
      if (item.disabled) return
      if (item.keepOpen !== true) manager.closeAll()
      try {
        await item.onSelect({ ...ctx, manager })
      } catch (err) {
        console.warn('Context menu action failed', err)
      }
    })
  }

  return el
}

function positionMenuAtPoint(element, point) {
  if (!(element instanceof Element)) return
  const doc = element.ownerDocument
  const win = doc?.defaultView || window
  const viewport = {
    w: win.innerWidth || 1024,
    h: win.innerHeight || 768,
  }
  element.style.visibility = 'hidden'
  element.style.left = '0px'
  element.style.top = '0px'
  element.style.maxHeight = `${Math.max(220, viewport.h - 32)}px`
  const rect = element.getBoundingClientRect()
  let left = point.clientX
  let top = point.clientY
  if (left + rect.width > viewport.w - 8) left = Math.max(8, viewport.w - rect.width - 8)
  if (top + rect.height > viewport.h - 8) top = Math.max(8, viewport.h - rect.height - 8)
  element.style.left = `${Math.max(8, left)}px`
  element.style.top = `${Math.max(8, top)}px`
  element.style.visibility = 'visible'
}

function positionSubmenu(anchor, submenu) {
  if (!(anchor instanceof Element) || !(submenu instanceof Element)) return
  const doc = anchor.ownerDocument
  const win = doc?.defaultView || window
  const viewportWidth = win.innerWidth || 1024
  const viewportHeight = win.innerHeight || 768
  const anchorRect = anchor.getBoundingClientRect()
  submenu.style.visibility = 'hidden'
  submenu.style.left = '0px'
  submenu.style.top = '0px'
  const menuRect = submenu.getBoundingClientRect()
  let left = anchorRect.right + 6
  if (left + menuRect.width > viewportWidth - 8) {
    left = anchorRect.left - menuRect.width - 6
  }
  if (left < 8) left = Math.max(8, viewportWidth - menuRect.width - 8)
  let top = anchorRect.top
  if (top + menuRect.height > viewportHeight - 8) {
    top = Math.max(8, viewportHeight - menuRect.height - 8)
  }
  submenu.style.left = `${left}px`
  submenu.style.top = `${top}px`
  submenu.style.visibility = 'visible'
}

function collectMenuMetadata(target) {
  const menuIds = new Set()
  const flags = new Set()
  let zone = null
  let linkHref = null
  const doc = target && target.ownerDocument ? target.ownerDocument : document
  let current = target instanceof Element ? target : null
  while (current && current !== doc.body) {
    const menuAttr = current.getAttribute?.('data-menu')
    if (menuAttr) {
      const tokens = menuAttr.split(/\s+/).filter(Boolean)
      tokens.forEach((token) => menuIds.add(token))
    }
    const flagAttr = current.getAttribute?.('data-menu-flags')
    if (flagAttr) {
      const tokens = flagAttr.split(/\s+/).filter(Boolean)
      tokens.forEach((token) => flags.add(token))
    }
    if (!zone) {
      const zoneAttr = current.getAttribute?.('data-menu-zone')
      if (zoneAttr) zone = zoneAttr
    }
    if (!linkHref) {
      const link = current.tagName?.toLowerCase() === 'a' ? current : current.closest?.('a')
      if (link && link.href) linkHref = link.href
    }
    if (current.dataset?.menuStop === 'true') break
    current = current.parentElement
  }
  return { menuIds, flags, zone, linkHref }
}

function getSelectionSummary(doc) {
  try {
    const sel = doc.getSelection ? doc.getSelection() : window.getSelection()
    if (!sel) return { text: '', collapsed: true }
    const text = sel.toString().trim()
    return { text, collapsed: sel.isCollapsed }
  } catch {
    return { text: '', collapsed: true }
  }
}

function isEditableElement(element) {
  if (!(element instanceof Element)) return false
  const tag = element.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return !element.hasAttribute('readonly')
  if (element.isContentEditable) return true
  return false
}

async function buildClipboardMenu(ctx, manager) {
  const items = []
  const selection = ctx.selectionText
  items.push({
    type: 'action',
    id: 'builtin.copy',
    label: 'Copy',
    disabled: !selection,
    onSelect: () => copySelectionText(manager.root),
  })
  if (ctx.isEditable) {
    items.push({
      type: 'action',
      id: 'builtin.paste',
      label: 'Paste',
      onSelect: () => pasteIntoTarget(ctx.target),
    })
  }
  if (ctx.linkHref) {
    items.push({
      type: 'action',
      id: 'builtin.copy-link',
      label: 'Copy Link',
      onSelect: () => copyLink(ctx.linkHref),
    })
  }
  return { sections: [{ items }] }
}

async function copySelectionText(doc) {
  try {
    const sel = doc.getSelection ? doc.getSelection() : window.getSelection()
    if (!sel || sel.toString().trim() === '') return
    const text = sel.toString()
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = doc.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      doc.body.appendChild(textarea)
      textarea.select()
      doc.execCommand('copy')
      doc.body.removeChild(textarea)
    }
  } catch (err) {
    console.warn('Failed to copy selection', err)
  }
}

async function pasteIntoTarget(target) {
  if (!isEditableElement(target)) return
  try {
    const text = navigator.clipboard?.readText ? await navigator.clipboard.readText() : ''
    if (!text) return
    const doc = target.ownerDocument || document
    if (target.tagName?.toLowerCase() === 'input' || target.tagName?.toLowerCase() === 'textarea') {
      const start = target.selectionStart ?? target.value.length
      const end = target.selectionEnd ?? target.value.length
      const value = target.value || ''
      target.value = value.slice(0, start) + text + value.slice(end)
      target.selectionStart = target.selectionEnd = start + text.length
      target.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    if (target.isContentEditable) {
      doc.execCommand('insertText', false, text)
    }
  } catch (err) {
    console.warn('Failed to paste into element', err)
  }
}

async function copyLink(href) {
  try {
    if (!href) return
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(href)
    }
  } catch (err) {
    console.warn('Failed to copy link', err)
  }
}

async function safeInvoke(fn, ctx) {
  try {
    return await fn(ctx)
  } catch (err) {
    console.warn('Context menu handler failed', err)
    return null
  }
}

export default initContextMenu
