import { initHighlightEffects } from './effects.js'
import { dialogService } from '../dialog-service.js'
import { acknowledgeParentMessage, messageChannel } from '../message-channel.js'

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

const TARGET_META = {
  blocks: {
    label: 'Structured blocks',
    description: 'Paragraphs, lists, tables, and code samples',
  },
  headings: {
    label: 'Headings',
    description: 'Underline accents for document headings',
  },
  inline: {
    label: 'Inline links',
    description: 'Inline anchors, navigation links, and references',
  },
  tree: {
    label: 'Navigation lists',
    description: 'Directory rows, tree summaries, and list headers',
  },
  ancestor: {
    label: 'Ancestor trace',
    description: 'Tint parent nodes while hovering navigation items',
    requires: ['tree'],
  },
  overlay: {
    label: 'Hover tools',
    description: 'Show contextual actions when hovering highlights',
  },
}

let CONTEXT_COUNTER = 0

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

const FOLLOW_TO_SETTING = {
  block: 'blocks',
  heading: 'headings',
  headings: 'headings',
  inline: 'inline',
  tree: 'tree',
}

class HighlightContext {
  constructor(manager, config = {}) {
    this.manager = manager
    this.id = config.id || `highlight-context-${++CONTEXT_COUNTER}`
    this.document = config.document || manager.document
    this.scopeSelector = config.scopeSelector || '.fx-glow'
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

  setHandlers(partial = {}) {
    this.handlers = { ...this.handlers, ...partial }
  }

  updateConfig(partial = {}) {
    if (partial.document) this.document = partial.document
    if (partial.scopeSelector) this.scopeSelector = partial.scopeSelector
    if (partial.trackTreeAncestors !== undefined) this.trackTreeAncestors = !!partial.trackTreeAncestors
    if (partial.overlayFollow) this.overlayFollow = Array.isArray(partial.overlayFollow)
      ? partial.overlayFollow.slice()
      : this.overlayFollow
    if (typeof partial.getSelectors === 'function') {
      this.getSelectors = partial.getSelectors
    }
    if (partial.selectors) {
      this.selectors = partial.selectors
      this.getSelectors = typeof partial.getSelectors === 'function' ? partial.getSelectors : null
    }
    if (partial.handlers) this.setHandlers(partial.handlers)
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
    this.storageKey = options.storageKey || 'highlightSettings'
    this.settings = normaliseSettings(this.loadSettings())
    this.contexts = new Map()
    this.availableTargets = {
      blocks: false,
      headings: false,
      inline: false,
      tree: false,
      overlay: false,
      ancestor: false,
    }
    this.toggleButton = null
    this.buttonHandler = null
    this.overlayEl = null
    this.panelEl = null
    this.dialogHandle = null
    this.boundHandleMessage = (event) => this.handleMessage(event)
    if (typeof window !== 'undefined') window.addEventListener('message', this.boundHandleMessage)
    this.boundPanelChange = (event) => this.handlePanelInput(event)
    this.boundPanelClick = (event) => this.handlePanelClick(event)
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

  registerContext(config = {}) {
    const context = new HighlightContext(this, config)
    this.contexts.set(context.id, context)
    context.rebuild(this.settings)
    this.updateCapabilities()
    return context.getHandle()
  }

  unregisterContext(id) {
    const context = this.contexts.get(id)
    if (!context) return
    context.destroy()
    this.contexts.delete(id)
    this.updateCapabilities()
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
    this.updatePanelControls()
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
    for (const context of this.contexts.values()) context.rebuild(this.settings)
    this.updatePanelControls()
  }

  refreshContext(id, options = {}) {
    const context = this.contexts.get(id)
    if (!context) return
    if (options.rebuild) context.rebuild(this.settings)
    else context.refresh()
  }

  refreshAll(options = {}) {
    for (const context of this.contexts.values()) {
      if (options.rebuild) context.rebuild(this.settings)
      else context.refresh()
    }
  }

  attachToggleButton(button) {
    if (this.toggleButton && this.buttonHandler) {
      try {
        this.toggleButton.removeEventListener('click', this.buttonHandler)
      } catch {}
    }
    this.toggleButton = button || null
    if (!this.toggleButton) return
    this.toggleButton.setAttribute('aria-haspopup', 'dialog')
    this.toggleButton.setAttribute('aria-expanded', this.isOpen() ? 'true' : 'false')
    if (this.overlayEl?.id) {
      this.toggleButton.setAttribute('aria-controls', this.overlayEl.id)
    }
    this.buttonHandler = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const opened = this.toggleSettings()
      this.toggleButton?.setAttribute('aria-expanded', opened ? 'true' : 'false')
    }
    this.toggleButton.addEventListener('click', this.buttonHandler)
  }

  ensurePanel() {
    if (this.panelEl && this.overlayEl && this.dialogHandle) return
    if (!this.document) return
    if (!this.overlayEl) {
      const overlay = this.document.createElement('div')
      overlay.id = overlay.id || 'highlightSettingsOverlay'
      overlay.className = 'dialog-backdrop dialog-backdrop--right'
      overlay.hidden = true
      overlay.dataset.state = 'closed'
      this.overlayEl = overlay
    }
    if (!this.panelEl) {
      const panel = this.document.createElement('div')
      panel.className = 'dialog-surface highlight-settings-panel'
      panel.innerHTML = `
        <div class="dialog-header">
          <div class="dialog-header__titles">
            <h2 class="dialog-title">Highlight Settings</h2>
            <p class="dialog-subtitle">Configure highlight targets and hover tools.</p>
          </div>
          <button type="button" class="icon-button dialog-close" aria-label="Close highlight settings"><span aria-hidden="true">×</span></button>
        </div>
        <div class="highlight-settings__section" data-section="targets">
          <h3>Highlight Targets</h3>
          <label class="highlight-settings__item" data-target="blocks">
            <input type="checkbox" data-setting="blocks" />
            <div>
              <span>${TARGET_META.blocks.label}</span>
              <p class="muted">${TARGET_META.blocks.description}</p>
            </div>
          </label>
          <label class="highlight-settings__item" data-target="headings">
            <input type="checkbox" data-setting="headings" />
            <div>
              <span>${TARGET_META.headings.label}</span>
              <p class="muted">${TARGET_META.headings.description}</p>
            </div>
          </label>
          <label class="highlight-settings__item" data-target="inline">
            <input type="checkbox" data-setting="inline" />
            <div>
              <span>${TARGET_META.inline.label}</span>
              <p class="muted">${TARGET_META.inline.description}</p>
            </div>
          </label>
          <label class="highlight-settings__item" data-target="tree">
            <input type="checkbox" data-setting="tree" />
            <div>
              <span>${TARGET_META.tree.label}</span>
              <p class="muted">${TARGET_META.tree.description}</p>
            </div>
          </label>
          <label class="highlight-settings__item" data-target="ancestor">
            <input type="checkbox" data-setting="ancestor" />
            <div>
              <span>${TARGET_META.ancestor.label}</span>
              <p class="muted">${TARGET_META.ancestor.description}</p>
            </div>
          </label>
        </div>
        <div class="highlight-settings__section" data-section="overlay">
          <h3>Hover Tools</h3>
          <label class="highlight-settings__item" data-target="overlay">
            <input type="checkbox" data-setting="overlay" />
            <div>
              <span>${TARGET_META.overlay.label}</span>
              <p class="muted">${TARGET_META.overlay.description}</p>
            </div>
          </label>
        </div>
        <div class="highlight-settings__section" data-section="style">
          <h3>Style</h3>
          <label class="highlight-settings__item highlight-settings__item--select">
            <div>
              <span>Glow intensity</span>
              <p class="muted">Adjust highlight strength and spread</p>
            </div>
            <select data-setting="intensity">
              <option value="soft">Soft</option>
              <option value="medium">Balanced</option>
              <option value="bold">Vibrant</option>
            </select>
          </label>
        </div>
      `
      this.panelEl = panel
      this.overlayEl.appendChild(panel)
    }
    if (!this.overlayEl.parentElement) {
      const targetParent = this.document.body || this.document.documentElement
      targetParent.appendChild(this.overlayEl)
    }
    this.overlayEl.addEventListener('change', this.boundPanelChange)
    this.overlayEl.addEventListener('click', this.boundPanelClick)
    this.dialogHandle = dialogService.register('highlight-settings', {
      overlay: this.overlayEl,
      surface: this.panelEl,
      allowBackdropClose: true,
      closeOnEscape: true,
      onOpen: () => this.setButtonExpanded(true),
      onClose: () => this.setButtonExpanded(false),
    })
    this.updatePanelControls()
    if (this.toggleButton && this.overlayEl?.id) {
      this.toggleButton.setAttribute('aria-controls', this.overlayEl.id)
    }
  }

  setButtonExpanded(expanded) {
    if (!this.toggleButton) return
    this.toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  }

  openSettings() {
    this.ensurePanel()
    if (!this.dialogHandle) return false
    this.dialogHandle.open()
    return this.isOpen()
  }

  closeSettings() {
    if (!this.dialogHandle) return false
    this.dialogHandle.close()
    return false
  }

  toggleSettings() {
    this.ensurePanel()
    if (!this.dialogHandle) return false
    this.dialogHandle.toggle()
    return this.isOpen()
  }

  isOpen() {
    if (!this.dialogHandle || typeof this.dialogHandle.isOpen !== 'function') return false
    return !!this.dialogHandle.isOpen()
  }

  handlePanelInput(event) {
    const target = event?.target
    if (!target || !target.dataset) return
    const key = target.dataset.setting
    if (!key) return
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      this.updateSettings({ [key]: target.checked })
    } else if (target instanceof HTMLSelectElement) {
      this.updateSettings({ [key]: target.value })
    }
  }

  handlePanelClick(event) {
    const target = event?.target
    if (!(target instanceof HTMLElement)) return
    const closeButton = target.closest('.dialog-close')
    if (closeButton) {
      event.preventDefault()
      this.closeSettings()
    }
  }

  updatePanelControls() {
    if (!this.panelEl) return
    const inputs = this.panelEl.querySelectorAll('[data-setting]')
    inputs.forEach((input) => {
      const key = input.dataset.setting
      if (!key) return
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.checked = !!this.settings[key]
      } else if (input instanceof HTMLSelectElement) {
        input.value = this.settings[key] || DEFAULT_SETTINGS[key] || ''
      }
      if (key !== 'intensity') {
        const targetEl = input.closest('[data-target]')
        const supported =
          key === 'ancestor'
            ? !!this.availableTargets.ancestor
            : key === 'overlay'
            ? !!this.availableTargets.overlay
            : !!this.availableTargets[key]
        if (targetEl) {
          if (!supported) targetEl.setAttribute('hidden', '')
          else targetEl.removeAttribute('hidden')
        }
        input.disabled = !supported
      }
    })
  }

  handleMessage(event) {
    const data = event?.data
    if (!data || data.type !== 'highlightSettings') return
    try {
      let status
      if (data.action === 'open') {
        this.openSettings()
        status = this.isOpen() ? 'opened' : 'closed'
      } else if (data.action === 'close') {
        this.closeSettings()
        status = 'closed'
      } else {
        const opened = this.toggleSettings()
        status = opened ? 'opened' : 'closed'
      }
      if (data.channel === messageChannel.CHANNEL && data.requestId != null) {
        acknowledgeParentMessage(data, { status })
      }
    } catch (err) {
      if (data.channel === messageChannel.CHANNEL && data.requestId != null) {
        acknowledgeParentMessage(data, { status: 'error', error: err?.message || String(err) })
      }
      console.warn('highlightSettings message failed', err)
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.boundHandleMessage)
    }
    if (this.overlayEl) {
      this.overlayEl.removeEventListener('change', this.boundPanelChange)
      this.overlayEl.removeEventListener('click', this.boundPanelClick)
    }
    if (this.dialogHandle && typeof this.dialogHandle.destroy === 'function') {
      this.dialogHandle.destroy()
    }
    this.dialogHandle = null
    this.panelEl = null
    this.overlayEl = null
    if (this.toggleButton && this.buttonHandler) {
      this.toggleButton.removeEventListener('click', this.buttonHandler)
    }
    this.toggleButton = null
    this.buttonHandler = null
    for (const context of this.contexts.values()) context.destroy()
    this.contexts.clear()
  }
}

export function createHighlightManager(options = {}) {
  return new HighlightManager(options)
}
