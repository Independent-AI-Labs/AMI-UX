import { initHighlightEffects } from './effects.js'
import { debugLog } from './debug.js'

const DEFAULT_SETTINGS = Object.freeze({
  blocks: true,
  headings: true,
  inline: true,
  tree: true,
  overlay: true,
  ancestor: true,
  intensity: 'medium',
})

const ALLOWED_INTENSITY = new Set(['soft', 'medium', 'bold'])

const FOLLOW_TO_SETTING = {
  block: 'blocks',
  heading: 'headings',
  headings: 'headings',
  inline: 'inline',
  tree: 'tree',
}

function toArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return [value]
}

function uniqStrings(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = String(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function normaliseSettings(raw = {}) {
  const next = { ...DEFAULT_SETTINGS, ...raw }
  next.blocks = !!next.blocks
  next.headings = !!next.headings
  next.inline = !!next.inline
  next.tree = !!next.tree
  next.overlay = !!next.overlay
  next.ancestor = !!next.ancestor
  next.intensity = ALLOWED_INTENSITY.has(next.intensity) ? next.intensity : DEFAULT_SETTINGS.intensity
  return next
}

class HighlightContext {
  constructor(manager, config = {}) {
    this.manager = manager
    this.id = config.id || `highlight-context-${manager.nextContextId()}`
    this.document = config.document || manager.document
    this.scopeSelector = config.scopeSelector || 'body'
    this.trackTreeAncestors = config.trackTreeAncestors !== false
    this.overlayFollow = Array.isArray(config.overlayFollow) ? config.overlayFollow.slice() : []
    this.getSelectors = typeof config.getSelectors === 'function' ? config.getSelectors : null
    this.selectors = !this.getSelectors ? config.selectors || {} : {}
    this.handlers = { ...config.handlers }
    this.effect = null
    this.supports = {
      blocks: false,
      headings: false,
      inline: false,
      tree: false,
      overlay: false,
    }
    this.baseSelectors = {
      block: [],
      inline: [],
      heading: [],
      tree: [],
      overlay: [],
    }
  }

  updateConfig(partial = {}) {
    if (partial.document) this.document = partial.document
    if (partial.scopeSelector) this.scopeSelector = partial.scopeSelector
    if (partial.trackTreeAncestors !== undefined) this.trackTreeAncestors = !!partial.trackTreeAncestors
    if (partial.overlayFollow) {
      this.overlayFollow = Array.isArray(partial.overlayFollow) ? partial.overlayFollow.slice() : this.overlayFollow
    }
    if (typeof partial.getSelectors === 'function') {
      this.getSelectors = partial.getSelectors
      this.selectors = {}
    } else if (partial.selectors) {
      this.selectors = partial.selectors
      this.getSelectors = typeof partial.getSelectors === 'function' ? partial.getSelectors : null
    }
    if (partial.handlers) this.handlers = { ...this.handlers, ...partial.handlers }
  }

  destroyEffect() {
    if (this.effect && typeof this.effect.disconnect === 'function') {
      try {
        this.effect.disconnect()
      } catch {}
    }
    this.effect = null
  }

  prepareSelectors() {
    const source = this.getSelectors ? this.getSelectors() : this.selectors
    const block = toArray(source?.block)
    const inline = toArray(source?.inline)
    const heading = toArray(source?.heading || source?.headings)
    const tree = toArray(source?.tree)
    const overlay = toArray(source?.overlay)
    this.baseSelectors = {
      block: block.slice(),
      inline: inline.slice(),
      heading: heading.slice(),
      tree: tree.slice(),
      overlay: overlay.slice(),
    }
    this.supports = {
      blocks: block.length > 0,
      headings: heading.length > 0,
      inline: inline.length > 0,
      tree: tree.length > 0,
      overlay: overlay.length > 0 || this.overlayFollow.length > 0,
    }
    debugLog('context:prepareSelectors', {
      id: this.id,
      scopeSelector: this.scopeSelector,
      block: block.length,
      inline: inline.length,
      heading: heading.length,
      tree: tree.length,
      overlay: overlay.length,
      overlayFollow: this.overlayFollow,
    })
  }

  buildOverlaySelectors(settings) {
    const selectors = new Set()
    this.baseSelectors.overlay.forEach((sel) => selectors.add(sel))
    for (const follow of this.overlayFollow) {
      const key = FOLLOW_TO_SETTING[follow]
      if (!key || !settings[key]) continue
      if (follow === 'block') this.baseSelectors.block.forEach((sel) => selectors.add(sel))
      else if (follow === 'inline') this.baseSelectors.inline.forEach((sel) => selectors.add(sel))
      else if (follow === 'heading' || follow === 'headings') this.baseSelectors.heading.forEach((sel) => selectors.add(sel))
      else if (follow === 'tree') this.baseSelectors.tree.forEach((sel) => selectors.add(sel))
    }
    return Array.from(selectors)
  }

  rebuild(settings) {
    this.destroyEffect()
    if (!this.document) return
    this.prepareSelectors()

    const blockSelectors = settings.blocks ? this.baseSelectors.block.slice() : []
    const inlineSelectors = settings.inline ? this.baseSelectors.inline.slice() : []
    const headingSelectors = settings.headings ? this.baseSelectors.heading.slice() : []
    const treeSelectors = settings.tree ? this.baseSelectors.tree.slice() : []
    const overlaySelectors = settings.overlay ? this.buildOverlaySelectors(settings) : []

    const hasAny =
      blockSelectors.length ||
      inlineSelectors.length ||
      headingSelectors.length ||
      treeSelectors.length

    if (!hasAny && !overlaySelectors.length) {
      this.effect = null
      debugLog('context:rebuild:no-targets', { id: this.id })
      return
    }

    try {
      this.effect = initHighlightEffects({
        document: this.document,
        scopeSelector: this.scopeSelector,
        blockSelectors,
        inlineSelectors,
        underlineSelectors: headingSelectors,
        treeSelectors,
        overlaySelectors: uniqStrings(overlaySelectors),
        trackTreeAncestors: Boolean(settings.ancestor && settings.tree && this.trackTreeAncestors),
        onComment: settings.overlay ? this.handlers?.onComment : undefined,
        onSearch: settings.overlay ? this.handlers?.onSearch : undefined,
        intensity: settings.intensity,
      })
      debugLog('context:rebuild', {
        id: this.id,
        intensity: settings.intensity,
        blockSelectors: blockSelectors.length,
        inlineSelectors: inlineSelectors.length,
        headingSelectors: headingSelectors.length,
        treeSelectors: treeSelectors.length,
        overlaySelectors: overlaySelectors.length,
      })
      if (this.effect && typeof this.effect.refresh === 'function') {
        this.effect.refresh()
      }
    } catch (err) {
      console.warn('Failed to initialise highlight context', err)
      this.effect = null
    }
  }

  refresh() {
    if (this.effect && typeof this.effect.refresh === 'function') {
      try {
        this.effect.refresh()
        return
      } catch {}
    }
    this.rebuild(this.manager.settings)
  }

  destroy() {
    this.destroyEffect()
  }

  getHandle() {
    return {
      id: this.id,
      refresh: () => this.refresh(),
      rebuild: () => this.rebuild(this.manager.settings),
      update: (partial) => {
        this.updateConfig(partial)
        this.rebuild(this.manager.settings)
        this.manager.updateCapabilities()
      },
      destroy: () => this.manager.unregisterContext(this.id),
    }
  }
}

export class HighlightManager {
  constructor(options = {}) {
    this.document = options.document || (typeof document !== 'undefined' ? document : null)
    this.storageKey = options.storageKey || 'amiHighlightPluginSettings'
    this.settings = normaliseSettings(options.settings || this.loadSettings())
    this.contexts = new Map()
    this._listeners = {
      settings: new Set(),
      capabilities: new Set(),
    }
    this._contextCounter = 0
    this.availableTargets = {
      blocks: false,
      headings: false,
      inline: false,
      tree: false,
      overlay: false,
      ancestor: false,
    }
    debugLog('manager:init', {
      hasDocument: !!this.document,
      settings: this.settings,
    })
  }

  nextContextId() {
    this._contextCounter += 1
    return this._contextCounter
  }

  on(event, handler) {
    if (!handler || typeof handler !== 'function') return () => {}
    const set = this._listeners[event]
    if (!set) return () => {}
    set.add(handler)
    return () => set.delete(handler)
  }

  emit(event, payload) {
    const set = this._listeners[event]
    if (!set) return
    for (const handler of set) {
      try {
        handler(payload)
      } catch (err) {
        console.warn('HighlightManager listener failed', err)
      }
    }
  }

  loadSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SETTINGS
    try {
      const raw = window.localStorage.getItem(this.storageKey)
      if (!raw) return DEFAULT_SETTINGS
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  persistSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.settings))
    } catch {}
  }

  getSettings() {
    return { ...this.settings }
  }

  updateSettings(partial = {}) {
    const next = normaliseSettings({ ...this.settings, ...partial })
    const changed = Object.keys(next).some((key) => this.settings[key] !== next[key])
    if (!changed) return
    this.settings = next
    this.persistSettings()
    debugLog('manager:updateSettings', next)
    for (const context of this.contexts.values()) context.rebuild(this.settings)
    this.updateCapabilities()
    this.emit('settings', this.getSettings())
  }

  registerContext(config = {}) {
    const context = new HighlightContext(this, config)
    this.contexts.set(context.id, context)
    context.rebuild(this.settings)
    this.updateCapabilities()
    debugLog('manager:registerContext', {
      id: context.id,
      scopeSelector: context.scopeSelector,
      overlayFollow: context.overlayFollow,
    })
    return context.getHandle()
  }

  unregisterContext(id) {
    const context = this.contexts.get(id)
    if (!context) return
    context.destroy()
    this.contexts.delete(id)
    this.updateCapabilities()
  }

  refreshContext(id, options = {}) {
    const context = this.contexts.get(id)
    if (!context) return
    if (options.rebuild) {
      debugLog('manager:refreshContext', { id, mode: 'rebuild' })
      context.rebuild(this.settings)
    } else {
      debugLog('manager:refreshContext', { id, mode: 'refresh' })
      context.refresh()
    }
  }

  refreshAll(options = {}) {
    debugLog('manager:refreshAll', { rebuild: !!options.rebuild, size: this.contexts.size })
    for (const context of this.contexts.values()) {
      if (options.rebuild) context.rebuild(this.settings)
      else context.refresh()
    }
  }

  updateCapabilities() {
    const aggregate = {
      blocks: false,
      headings: false,
      inline: false,
      tree: false,
      overlay: false,
    }
    for (const context of this.contexts.values()) {
      aggregate.blocks = aggregate.blocks || !!context.supports.blocks
      aggregate.headings = aggregate.headings || !!context.supports.headings
      aggregate.inline = aggregate.inline || !!context.supports.inline
      aggregate.tree = aggregate.tree || !!context.supports.tree
      aggregate.overlay = aggregate.overlay || !!context.supports.overlay
    }
    this.availableTargets = {
      ...aggregate,
      ancestor: aggregate.tree,
    }
    debugLog('manager:updateCapabilities', this.availableTargets)
    this.emit('capabilities', { ...this.availableTargets })
  }
}

export { DEFAULT_SETTINGS }
