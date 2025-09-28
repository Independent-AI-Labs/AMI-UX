import { initHighlightEffects } from './effects.js'
import { debugLog } from './debug.js'
import { createAutomationStore } from './automation-store.js'

const DEFAULT_SETTINGS = Object.freeze({
  blocks: true,
  headings: true,
  inline: true,
  tree: true,
  overlay: true,
  ancestor: true,
  intensity: 'medium',
})

const DEFAULT_AUTOMATION = Object.freeze({
  enabled: false,
  triggers: [],
  activeScenario: 'default',
  capabilities: {
    network: false,
    plugins: true,
  },
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

function sanitiseTrigger(raw, { refreshTimestamp = false, scenario = null } = {}) {
  if (!raw) return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const now = Date.now()
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now
  const updatedAt = refreshTimestamp ? now : Number.isFinite(raw.updatedAt) ? raw.updatedAt : now
  const enabled = raw.enabled !== false
  const selector = typeof raw.selector === 'string' ? raw.selector : ''
  const dataPath = typeof raw.dataPath === 'string' ? raw.dataPath : ''
  const elementLabel = typeof raw.elementLabel === 'string' ? raw.elementLabel : ''
  const owner = typeof raw.owner === 'string' ? raw.owner : ''
  const scenarioSlug = (() => {
    if (typeof raw.scenario === 'string' && raw.scenario.trim()) return raw.scenario.trim()
    if (typeof scenario === 'string' && scenario.trim()) return scenario.trim()
    return DEFAULT_AUTOMATION.activeScenario
  })()
  const triggerType =
    typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim().toLowerCase() : 'dom'
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Trigger ${id}`,
    selector,
    dataPath,
    elementLabel,
    owner,
    eventType: typeof raw.eventType === 'string' && raw.eventType.trim() ? raw.eventType.trim() : 'click',
    targetCode:
      typeof raw.targetCode === 'string' && raw.targetCode.trim()
        ? raw.targetCode
        : selector
        ? `return document.querySelector(${JSON.stringify(selector)});`
        : 'return context.event?.currentTarget || null;',
    conditionCode:
      typeof raw.conditionCode === 'string' && raw.conditionCode.trim()
        ? raw.conditionCode
        : 'return true;',
    actionCode:
      typeof raw.actionCode === 'string' && raw.actionCode.trim()
        ? raw.actionCode
        : 'console.log("Trigger fired", context);',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    enabled,
    createdAt,
    updatedAt,
    scenario: scenarioSlug,
    type: triggerType,
  }
}

function normaliseAutomation(raw = {}) {
  const enabled = raw?.enabled !== false && raw?.enabled !== 'false'
  const list = Array.isArray(raw?.triggers) ? raw.triggers : []
  const triggers = []
  for (const entry of list) {
    const trigger = sanitiseTrigger(entry, {
      scenario:
        entry && typeof entry === 'object' && typeof entry.scenario === 'string' && entry.scenario.trim()
          ? entry.scenario.trim()
          : typeof raw?.activeScenario === 'string' && raw.activeScenario.trim()
            ? raw.activeScenario.trim()
            : DEFAULT_AUTOMATION.activeScenario,
    })
    if (trigger) triggers.push(trigger)
  }
  return {
    enabled,
    triggers,
    activeScenario:
      typeof raw?.activeScenario === 'string' && raw.activeScenario.trim() ? raw.activeScenario.trim() : DEFAULT_AUTOMATION.activeScenario,
    capabilities: (() => {
      const merged = {
        ...DEFAULT_AUTOMATION.capabilities,
        ...(raw?.capabilities && typeof raw.capabilities === 'object' ? raw.capabilities : {}),
      }
      merged.plugins = true
      return merged
    })(),
  }
}

function cloneAutomation(state) {
  if (!state) return { ...DEFAULT_AUTOMATION }
  return {
    enabled: !!state.enabled,
    triggers: Array.isArray(state.triggers) ? state.triggers.map((trigger) => ({ ...trigger })) : [],
    activeScenario:
      typeof state.activeScenario === 'string' && state.activeScenario.trim() ? state.activeScenario.trim() : DEFAULT_AUTOMATION.activeScenario,
    capabilities: (() => {
      const merged = {
        ...DEFAULT_AUTOMATION.capabilities,
        ...(state.capabilities && typeof state.capabilities === 'object' ? state.capabilities : {}),
      }
      merged.plugins = true
      return merged
    })(),
  }
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
        onTrigger: settings.overlay ? this.handlers?.onTrigger : undefined,
        onAsk: settings.overlay ? this.handlers?.onAsk : undefined,
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

  processMutations(records = []) {
    if (!this.effect) {
      this.refresh()
      return
    }
    if (typeof this.effect.notify === 'function') {
      try {
        this.effect.notify(records)
        return
      } catch {}
    }
    this.refresh()
  }

  destroy() {
    this.destroyEffect()
  }

  getHandle() {
    return {
      id: this.id,
      refresh: () => this.refresh(),
      rebuild: () => this.rebuild(this.manager.settings),
      notifyMutations: (records) => this.processMutations(records),
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
    const storedSettings = this.loadSettings()
    const providedSettings = options.settings && typeof options.settings === 'object' ? options.settings : null
    this.settings = normaliseSettings({
      ...(providedSettings || {}),
      ...storedSettings,
    })
    this.contexts = new Map()
    this._listeners = {
      settings: new Set(),
      capabilities: new Set(),
      automation: new Set(),
    }
    this._contextCounter = 0
    this._automationCounter = 0
    this._automationKey = `${this.storageKey}::automation`
    const storedAutomation = this.loadAutomation()
    const providedAutomation =
      options.automation && typeof options.automation === 'object' ? options.automation : null
    const automationSeed = (() => {
      if (!providedAutomation) return storedAutomation
      const next = {
        ...(providedAutomation || {}),
        ...storedAutomation,
      }
      if (Array.isArray(storedAutomation?.triggers) && storedAutomation.triggers.length) {
        next.triggers = storedAutomation.triggers
      } else if (Array.isArray(providedAutomation?.triggers)) {
        next.triggers = providedAutomation.triggers
      }
      return next
    })()
    this.automation = normaliseAutomation(automationSeed)
    this._automationCounter = Math.max(
      this.automation.triggers.reduce((max, trigger) => {
        const match = trigger?.id?.match(/(\d+)$/)
        if (match) return Math.max(max, Number.parseInt(match[1], 10) || 0)
        return max
      }, 0),
      0,
    )
    this.availableTargets = {
      blocks: false,
      headings: false,
      inline: false,
      tree: false,
      overlay: false,
      ancestor: false,
    }
    this.automationStore = createAutomationStore()
    this.documentContext = null
    this._pendingAutomationConfig = null
    this.automationMeta = {
      metaPath: '',
      scenarios: [],
    }
    this.scenarioMap = new Map()
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

  loadAutomation() {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_AUTOMATION
    try {
      const raw = window.localStorage.getItem(this._automationKey)
      if (!raw) return DEFAULT_AUTOMATION
      const parsed = JSON.parse(raw)
      return normaliseAutomation(parsed)
    } catch {
      return DEFAULT_AUTOMATION
    }
  }

  persistSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.settings))
    } catch {}
  }

  persistAutomation() {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(this._automationKey, JSON.stringify(this.automation))
    } catch {}
  }

  persistAutomationConfig() {
    const payload = this.buildAutomationConfigPayload()
    if (this.automationStore && this.documentContext && this.documentContext.path) {
      this._pendingAutomationConfig = null
      this.automationStore
        .setConfig(payload)
        .catch((error) => {
          debugLog('automation:config:error', { error: error?.message || String(error) })
          this._pendingAutomationConfig = payload
        })
    } else {
      this._pendingAutomationConfig = payload
    }
    this.persistAutomation()
  }

  persistTriggerRecord(trigger, { previousScenario = null } = {}) {
    this.persistAutomation()
    if (!trigger || !trigger.id) return
    if (!this.automationStore || !this.documentContext || !this.documentContext.path) return
    const scenario = trigger.scenario && String(trigger.scenario).trim() ? trigger.scenario.trim() : this.automation.activeScenario
    const tasks = []
    if (previousScenario && previousScenario !== scenario) {
      tasks.push(
        this.automationStore.deleteTrigger(trigger.id, previousScenario).catch((error) => {
          debugLog('automation:delete-trigger:error', { error: error?.message || String(error) })
        }),
      )
    }
    tasks.push(
      this.automationStore.saveTrigger(trigger, scenario).catch((error) => {
        debugLog('automation:save-trigger:error', { error: error?.message || String(error) })
      }),
    )
    Promise.all(tasks)
      .then(() => this.reloadAutomation(true))
      .catch((error) => debugLog('automation:reload:error', { error: error?.message || String(error) }))
  }

  persistTriggerRemoval(trigger) {
    this.persistAutomation()
    if (!trigger || !trigger.id) return
    if (!this.automationStore || !this.documentContext || !this.documentContext.path) return
    const scenario = trigger.scenario && String(trigger.scenario).trim() ? trigger.scenario.trim() : this.automation.activeScenario
    this.automationStore
      .deleteTrigger(trigger.id, scenario)
      .then(() => this.reloadAutomation(true))
      .catch((error) => debugLog('automation:delete-trigger:error', { error: error?.message || String(error) }))
  }

  async setDocumentContext(context = null) {
    if (context && typeof context === 'object' && context.path) {
      const next = {
        path: String(context.path),
        root: context.root || 'docRoot',
        name: context.name || '',
        metaPath: context.metaPath || '',
      }
      this.documentContext = next
      this.automationStore.setContext(next)
      if (this._pendingAutomationConfig) {
        const payload = this._pendingAutomationConfig
        this._pendingAutomationConfig = null
        try {
          await this.automationStore.setConfig(payload)
        } catch (error) {
          debugLog('automation:config:flush:error', { error: error?.message || String(error) })
          this._pendingAutomationConfig = payload
        }
      }
      await this.reloadAutomation(true)
    } else {
      this.documentContext = null
      this.automationStore.setContext(null)
      this.automationMeta = { metaPath: '', scenarios: [] }
      this.scenarioMap = new Map()
      this.automation = cloneAutomation(DEFAULT_AUTOMATION)
      this.persistAutomation()
      this.emit('automation', this.getAutomation())
      this._pendingAutomationConfig = null
    }
  }

  buildAutomationConfigPayload() {
    return {
      enabled: !!this.automation.enabled,
      activeScenario:
        typeof this.automation.activeScenario === 'string' && this.automation.activeScenario.trim()
          ? this.automation.activeScenario.trim()
          : DEFAULT_AUTOMATION.activeScenario,
      capabilities: {
        ...DEFAULT_AUTOMATION.capabilities,
        ...(this.automation.capabilities && typeof this.automation.capabilities === 'object'
          ? this.automation.capabilities
          : {}),
      },
    }
  }

  async reloadAutomation(force = false) {
    if (!this.automationStore || !this.documentContext || !this.documentContext.path) return null
    try {
      const payload = await this.automationStore.loadAutomation(force)
      if (payload && payload.ok !== false) {
        this.applyAutomationPayload(payload)
      }
      return payload
    } catch (error) {
      debugLog('automation:load:error', { error: error?.message || String(error) })
      return null
    }
  }

  applyAutomationPayload(payload) {
    if (!payload) return
    const scenarios = Array.isArray(payload.scenarios) ? payload.scenarios : []
    this.automationMeta = {
      metaPath: payload.metaPath || '',
      scenarios: scenarios.map((scenario) => ({
        slug: scenario.slug,
        name: scenario.name || scenario.slug,
        path: scenario.path || '',
        triggers: Array.isArray(scenario.triggers) ? scenario.triggers.map((trigger) => ({ ...trigger })) : [],
      })),
    }
    this.scenarioMap = new Map()
    for (const scenario of this.automationMeta.scenarios) {
      this.scenarioMap.set(scenario.slug, scenario)
    }
    let activeSlug = payload.activeScenario && this.scenarioMap.has(payload.activeScenario)
      ? payload.activeScenario
      : this.automationMeta.scenarios[0]?.slug || DEFAULT_AUTOMATION.activeScenario
    const activeScenario = this.scenarioMap.get(activeSlug)
    const triggersSource = activeScenario && Array.isArray(activeScenario.triggers) ? activeScenario.triggers : []
    const triggers = triggersSource.map((record) =>
      sanitiseTrigger(record, {
        scenario: activeSlug,
      }),
    )
    this.automation = {
      enabled: !!payload.enabled,
      activeScenario: activeSlug,
      capabilities: {
        ...DEFAULT_AUTOMATION.capabilities,
        ...(payload.capabilities && typeof payload.capabilities === 'object' ? payload.capabilities : {}),
      },
      triggers,
    }
    if (this._pendingAutomationConfig) {
      this.automation.enabled = !!this._pendingAutomationConfig.enabled
      this.automation.capabilities = {
        ...this.automation.capabilities,
        ...(this._pendingAutomationConfig.capabilities || {}),
      }
    } else {
      const stored = this.loadAutomation()
      if (stored) {
        this.automation.enabled = stored.enabled
        this.automation.capabilities = {
          ...this.automation.capabilities,
          ...(stored.capabilities || {}),
        }
      }
    }
    this.persistAutomation()
    this.emit('automation', this.getAutomation())
  }

  getSettings() {
    return { ...this.settings }
  }

  getAutomation() {
    return cloneAutomation(this.automation)
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

  updateAutomation(partial = {}) {
    if (!partial || typeof partial !== 'object') return
    const prev = this.automation
    const next = normaliseAutomation({ ...prev, ...partial })
    const changed =
      prev.enabled !== next.enabled ||
      prev.activeScenario !== next.activeScenario ||
      prev.triggers.length !== next.triggers.length ||
      prev.triggers.some((trigger, index) => {
        const other = next.triggers[index]
        if (!other) return true
        const keys = Object.keys(trigger)
        return keys.some((key) => trigger[key] !== other[key])
      }) ||
      Object.keys({ ...prev.capabilities, ...next.capabilities }).some(
        (key) => prev.capabilities?.[key] !== next.capabilities?.[key],
      )
    if (!changed) return
    this.automation = next
    const configChanged =
      prev.enabled !== next.enabled ||
      prev.activeScenario !== next.activeScenario ||
      Object.keys({ ...prev.capabilities, ...next.capabilities }).some(
        (key) => prev.capabilities?.[key] !== next.capabilities?.[key],
      )
    if (configChanged) this.persistAutomationConfig()
    else this.persistAutomation()
    this.emit('automation', this.getAutomation())
  }

  setAutomationEnabled(enabled) {
    const next = !!enabled
    if (this.automation.enabled === next) return
    this.automation = { ...this.automation, enabled: next }
    this.persistAutomationConfig()
    this.emit('automation', this.getAutomation())
  }

  setActiveScenario(slug) {
    const nextSlug = typeof slug === 'string' && slug.trim() ? slug.trim() : DEFAULT_AUTOMATION.activeScenario
    if (this.automation.activeScenario === nextSlug) return
    const scenarioRecord = this.scenarioMap?.get(nextSlug) || null
    const triggersSource = scenarioRecord && Array.isArray(scenarioRecord.triggers) ? scenarioRecord.triggers : []
    const triggers = triggersSource.map((record) => sanitiseTrigger(record, { scenario: nextSlug }))
    this.automation = {
      ...this.automation,
      activeScenario: nextSlug,
      triggers,
    }
    this.persistAutomationConfig()
    this.emit('automation', this.getAutomation())
    if (this.automationStore && this.documentContext && this.documentContext.path) {
      this.automationStore
        .setActiveScenario(nextSlug)
        .then(() => this.reloadAutomation(true))
        .catch((error) => debugLog('automation:set-scenario:error', { error: error?.message || String(error) }))
    }
  }

  generateTriggerId() {
    this._automationCounter += 1
    const suffix = this._automationCounter.toString().padStart(3, '0')
    const base = Math.abs(Date.now()).toString(36)
    return `ami-trigger-${base}-${suffix}`
  }

  createTrigger(def = {}) {
    const id = def.id && typeof def.id === 'string' ? def.id : this.generateTriggerId()
    const scenario =
      typeof def.scenario === 'string' && def.scenario.trim() ? def.scenario.trim() : this.automation.activeScenario
    const trigger = sanitiseTrigger({ ...def, id, scenario }, { refreshTimestamp: true, scenario })
    if (!trigger) return null
    const triggers = Array.isArray(this.automation.triggers) ? [...this.automation.triggers] : []
    triggers.push(trigger)
    this.automation = {
      ...this.automation,
      triggers,
    }
    this.persistTriggerRecord(trigger)
    this.emit('automation', this.getAutomation())
    return trigger
  }

  updateTrigger(id, updates = {}) {
    const key = String(id || '').trim()
    if (!key) return null
    const triggers = Array.isArray(this.automation.triggers) ? [...this.automation.triggers] : []
    const index = triggers.findIndex((trigger) => trigger.id === key)
    if (index === -1) return null
    const previous = { ...triggers[index] }
    const scenario =
      typeof updates.scenario === 'string' && updates.scenario.trim()
        ? updates.scenario.trim()
        : previous.scenario || this.automation.activeScenario
    const merged = { ...previous, ...updates, id: key, scenario }
    const trigger = sanitiseTrigger(merged, { refreshTimestamp: true, scenario })
    triggers[index] = trigger
    this.automation = { ...this.automation, triggers }
    this.persistTriggerRecord(trigger, {
      previousScenario:
        previous.scenario && previous.scenario !== trigger.scenario ? previous.scenario : null,
    })
    this.emit('automation', this.getAutomation())
    return trigger
  }

  removeTrigger(id) {
    const key = String(id || '').trim()
    if (!key) return false
    const triggers = Array.isArray(this.automation.triggers) ? [...this.automation.triggers] : []
    let removed = null
    const next = []
    for (const trigger of triggers) {
      if (!removed && trigger.id === key) {
        removed = trigger
        continue
      }
      next.push(trigger)
    }
    if (!removed) return false
    this.automation = { ...this.automation, triggers: next }
    this.persistTriggerRemoval(removed)
    this.emit('automation', this.getAutomation())
    return true
  }

  clearTriggers() {
    if (!this.automation.triggers.length) return
    const removed = Array.isArray(this.automation.triggers) ? this.automation.triggers.slice() : []
    this.automation = { ...this.automation, triggers: [] }
    removed.forEach((trigger) => this.persistTriggerRemoval(trigger))
    this.emit('automation', this.getAutomation())
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

  notifyContextMutations(id, records = []) {
    const context = this.contexts.get(id)
    if (!context) return
    context.processMutations(records)
  }

  notifyAllMutations(records = []) {
    for (const context of this.contexts.values()) context.processMutations(records)
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

export { DEFAULT_SETTINGS, DEFAULT_AUTOMATION }
