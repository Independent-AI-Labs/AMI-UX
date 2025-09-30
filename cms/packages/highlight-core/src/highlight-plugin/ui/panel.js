import { dialogService } from '../../lib/dialog-service.js'
import { markPluginNode } from '../core/dom-utils.js'
import { setHint } from '../core/hints.js'
import { debugLog, setDebugEnabled } from '../core/debug.js'
import { createAutomationController } from '../core/automation.js'
import { ensureUIStyles } from './styles.js'
import { createTriggerDialog } from './trigger-dialog.js'
import { createScenarioManager } from './scenario-manager.js'
import { createTriggerComposer } from './trigger-composer.js'

const DEBUG_GLOBAL_KEY = '__AMI_HIGHLIGHT_DEBUG__'

function ensureToggleDebugChannel() {
  try {
    const globalRef = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null
    if (globalRef && Object.prototype.hasOwnProperty.call(globalRef, DEBUG_GLOBAL_KEY)) {
      const state = globalRef[DEBUG_GLOBAL_KEY]
      if (state && typeof state === 'object' && !state.__disabled) return
    }
  } catch {}
  setDebugEnabled({ toggle: true })
}

function logToggleEvent(instance, event, extra = {}) {
  if (!instance || !instance.document) return
  try {
    const doc = instance.document
    let toggleCount = null
    try {
      toggleCount = doc.querySelectorAll('.ami-highlight-toggle').length
    } catch {}
    const payload = {
      event,
      owner: instance.ownerId || null,
      href: (() => {
        try {
          return doc.defaultView?.location?.href || null
        } catch {
          return null
        }
      })(),
      toggleCount,
      ...extra,
    }
    ensureToggleDebugChannel()
    debugLog('toggle', payload)
  } catch {}
}

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
    description: 'Anchors, buttons, and inline references',
  },
  tree: {
    label: 'Navigation lists',
    description: 'Tree rows, summaries, and navigation links',
  },
  ancestor: {
    label: 'Ancestor trace',
    description: 'Tint parent nodes while hovering navigation items',
  },
  overlay: {
    label: 'Hover tools',
    description: 'Show contextual actions when hovering highlights',
  },
}

export class HighlightSettingsUI {
  constructor(options = {}) {
    const doc = options.document || (typeof document !== 'undefined' ? document : null)
    if (!doc) throw new Error('HighlightSettingsUI requires a document')
    if (!options.manager) throw new Error('HighlightSettingsUI requires a HighlightManager')

    this.document = doc
    this.manager = options.manager
    this.overlayEl = null
    this.panelEl = null
    this.dialogHandle = null
    this.toggleButton = null
    this.buttonHandler = null
    this.detachSettings = null
    this.detachCapabilities = null
    this.id = options.id || 'amiHighlightSettings'
    this.ownsToggle = false
    this.ownerId = typeof options.ownerId === 'string' ? options.ownerId : ''
    this.togglePosition = null
    this.dragState = null
    this.draggedDuringLastInteraction = false
    this.toggleDragEnabled = false
    this.boundToggleDragStart = (event) => this.handleToggleDragStart(event)
    this.boundToggleDragMove = (event) => this.handleToggleDragMove(event)
    this.boundToggleDragEnd = (event) => this.handleToggleDragEnd(event)

    ensureUIStyles(doc)

    this.activeTab = 'targets'
    this.automationRootEl = null
    this.automationToggle = null
    this.automationState = this.manager.getAutomation
      ? this.manager.getAutomation()
      : { enabled: false, triggers: [] }
    this.scenarioManager = null

    try {
      this.automationController = createAutomationController({
        document: this.document,
        manager: this.manager,
        ownerId: this.ownerId,
        onPlacementStateChange: (active) => this.handlePlacementStateChange(active),
        onTriggerCreated: (trigger) => this.handleTriggerCreated(trigger),
        onTriggerEditRequest: (id, options = {}) => this.openTriggerEditor(id, options),
      })
    } catch (error) {
      console.warn('Failed to initialise highlight automation controller', error)
      this.automationController = null
    }

    try {
      this.triggerDialog = createTriggerDialog({
        document: this.document,
        manager: this.manager,
        ownerId: this.ownerId,
        onSave: () => this.renderAutomationPanel(),
        onDelete: () => this.renderAutomationPanel(),
        onOpen: () => this.switchTab('automation'),
      })
    } catch (error) {
      console.warn('Failed to initialise highlight trigger dialog', error)
      this.triggerDialog = null
    }

    try {
      this.scenarioManager = createScenarioManager({
        document: this.document,
        manager: this.manager,
      })
    } catch (error) {
      console.warn('Failed to initialise scenario manager', error)
      this.scenarioManager = null
    }

    try {
      this.triggerComposer = createTriggerComposer({
        document: this.document,
        manager: this.manager,
        ownerId: this.ownerId,
      })
    } catch (error) {
      console.warn('Failed to initialise trigger composer', error)
      this.triggerComposer = null
    }

    const explicitToggle = this.resolveToggleOption(options.toggleButton)
    this.cleanupOwnedToggles(explicitToggle ? [explicitToggle] : [])

    this.boundHandleInput = (event) => this.handleInput(event)
    this.boundHandleClick = (event) => this.handleClick(event)

    this.detachSettings = this.manager.on('settings', (settings) => this.syncFromSettings(settings))
    this.detachCapabilities = this.manager.on('capabilities', (caps) => this.syncCapabilities(caps))
    this.detachAutomation = this.manager.on('automation', (state) => this.syncAutomation(state))

    if (options.autoAttach !== false) {
      const target = explicitToggle || this.locateToggleButton()
      if (target) {
        const ownedFlag = target.dataset?.amiHighlightOwned === '1'
        this.attachToggleButton(target, { ownsToggle: ownedFlag })
      } else if (options.createFallbackToggle !== false) {
        this.createFloatingToggle()
      }
    }

    // Prepare UI immediately if desired
    if (options.renderImmediately) this.ensurePanel()
  }

  resolveToggleOption(option) {
    if (!option) return null
    if (option instanceof HTMLElement) return option
    if (typeof option === 'string') {
      const selector = option.trim()
      if (!selector) return null
      try {
        return this.document.querySelector(selector)
      } catch {
        return null
      }
    }
    return null
  }

  locateToggleButton() {
    try {
      return this.document.querySelector('[data-ami-highlight-toggle="1"]')
    } catch {
      return null
    }
  }

  isToggleOwnedByUs(toggle) {
    if (!toggle || !this.ownerId) return false
    try {
      return toggle.dataset?.amiHighlightOwner === this.ownerId
    } catch {
      return false
    }
  }

  cleanupOwnedToggles(exceptions = []) {
    const guards = Array.isArray(exceptions) ? new Set(exceptions.filter(Boolean)) : new Set()
    try {
      const toggles = Array.from(
        this.document.querySelectorAll(
          '.ami-highlight-toggle[data-ami-highlight-owned="1"], [data-ami-highlight-toggle="1"][data-ami-highlight-owned="1"]',
        ),
      )
      let removed = 0
      for (const toggle of toggles) {
        if (guards.has(toggle)) continue
        try {
          toggle.parentElement?.removeChild(toggle)
          removed += 1
        } catch {}
      }
      logToggleEvent(this, 'toggle:cleanup', {
        guarded: guards.size,
        removed,
        existing: toggles.length,
      })
    } catch {}
  }

  enforceSingleOwnedToggle(keeper) {
    if (!keeper) return
    try {
      const toggles = Array.from(
        this.document.querySelectorAll(
          '.ami-highlight-toggle[data-ami-highlight-owned="1"], [data-ami-highlight-toggle="1"][data-ami-highlight-owned="1"]',
        ),
      )
      let removed = 0
      for (const toggle of toggles) {
        if (toggle === keeper) continue
        try {
          toggle.parentElement?.removeChild(toggle)
          removed += 1
        } catch {}
      }
      logToggleEvent(this, 'toggle:enforce-single', {
        kept: !!keeper,
        removed,
        existing: toggles.length,
      })
    } catch {}
  }

  createFloatingToggle() {
    const btn = this.document.createElement('button')
    btn.type = 'button'
    btn.className = 'ami-highlight-toggle'
    setHint(btn, 'Toggle highlight settings')
    btn.innerHTML = `
      <span class="ami-highlight-toggle__icon ami-highlight-toggle__icon--gear" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.37 1.05V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-.37-1.05 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.05-1 1.65 1.65 0 0 0-1.05-.37H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.05-.37 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .37-1.05V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 .37 1.05 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.05.37H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.05.37 1.65 1.65 0 0 0-.46.66z"></path>
        </svg>
      </span>
      <span class="ami-highlight-toggle__icon ami-highlight-toggle__icon--close" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>
    `
    markPluginNode(btn)
    btn.dataset.amiHighlightToggle = '1'
    btn.dataset.amiHighlightOwned = '1'
    if (this.ownerId) btn.dataset.amiHighlightOwner = this.ownerId
    const appendToggle = () => {
      if (!this.document.body) return
      try {
        this.document.body.appendChild(btn)
      } catch {}
    }
    if (this.document.body) appendToggle()
    else {
      const onReady = () => {
        appendToggle()
        try {
          this.document.removeEventListener('DOMContentLoaded', onReady)
        } catch {}
      }
      try {
        this.document.addEventListener('DOMContentLoaded', onReady, { once: true })
      } catch {
        // Fallback: schedule microtask
        setTimeout(appendToggle, 0)
      }
    }
    logToggleEvent(this, 'toggle:create', {
      bodyReady: !!this.document.body,
      readyState: this.document.readyState,
    })
    this.attachToggleButton(btn, { ownsToggle: true })
    return btn
  }

  attachToggleButton(button, options = {}) {
    if (!button) return
    this.detachToggleButton()
    this.toggleButton = button
    markPluginNode(this.toggleButton)
    try {
      this.toggleButton.dataset.amiHighlightToggle = '1'
    } catch {}
    const claimOwnership = options.claimOwnership === true
    const ownedByUs = claimOwnership || options.ownsToggle === true || this.isToggleOwnedByUs(this.toggleButton)
    this.ownsToggle = ownedByUs
    if (ownedByUs) {
      this.toggleButton.dataset.amiHighlightOwned = '1'
      if (this.ownerId) this.toggleButton.dataset.amiHighlightOwner = this.ownerId
    } else if (options.claimOwnership === false && this.toggleButton.dataset) {
      // Ensure stale owner metadata does not point to previous instances
      if (this.toggleButton.dataset.amiHighlightOwner === this.ownerId) {
        delete this.toggleButton.dataset.amiHighlightOwner
      }
    }
    this.toggleButton.setAttribute('aria-haspopup', 'dialog')
    this.toggleButton.setAttribute('aria-expanded', this.isOpen() ? 'true' : 'false')
    this.buttonHandler = (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (this.draggedDuringLastInteraction) {
        this.draggedDuringLastInteraction = false
        return
      }
      const opened = this.toggle()
      this.toggleButton?.setAttribute('aria-expanded', opened ? 'true' : 'false')
    }
    this.toggleButton.addEventListener('click', this.buttonHandler)
    logToggleEvent(this, 'toggle:attach', {
      ownsToggle: this.ownsToggle,
      claimOwnership,
      buttonOwnedFlag: options.ownsToggle === true,
      datasetOwner: (() => {
        try {
          return this.toggleButton?.dataset?.amiHighlightOwner || null
        } catch {
          return null
        }
      })(),
    })
    if (this.ownsToggle) this.enableToggleDrag()
    else this.disableToggleDrag()
    if (this.ownsToggle) this.enforceSingleOwnedToggle(this.toggleButton)
  }

  detachToggleButton() {
    const previousButton = this.toggleButton
    const previouslyOwned = this.ownsToggle
    this.disableToggleDrag()
    if (this.toggleButton && this.buttonHandler) {
      try {
        this.toggleButton.removeEventListener('click', this.buttonHandler)
      } catch {}
    }
    if (this.ownsToggle && this.toggleButton && this.toggleButton.parentElement) {
      try {
        this.toggleButton.parentElement.removeChild(this.toggleButton)
      } catch {}
    }
    logToggleEvent(this, 'toggle:detach', {
      hadButton: !!previousButton,
      previouslyOwned,
    })
    this.toggleButton = null
    this.buttonHandler = null
    this.ownsToggle = false
  }

  enableToggleDrag() {
    if (!this.toggleButton || this.toggleDragEnabled) return
    this.toggleDragEnabled = true
    this.applyStoredTogglePosition()
    this.toggleButton.addEventListener('pointerdown', this.boundToggleDragStart)
  }

  disableToggleDrag() {
    if (!this.toggleDragEnabled) return
    this.toggleDragEnabled = false
    this.teardownDragListeners()
    if (this.toggleButton) {
      this.toggleButton.removeEventListener('pointerdown', this.boundToggleDragStart)
      if (this.dragState) {
        try {
          this.toggleButton.releasePointerCapture(this.dragState.pointerId)
        } catch {}
      }
    }
    this.dragState = null
    this.draggedDuringLastInteraction = false
  }

  applyStoredTogglePosition() {
    if (!this.toggleButton) return
    if (this.togglePosition && Number.isFinite(this.togglePosition.left) && Number.isFinite(this.togglePosition.top)) {
      const style = this.toggleButton.style
      style.left = `${this.togglePosition.left}px`
      style.top = `${this.togglePosition.top}px`
      style.right = 'auto'
      style.bottom = 'auto'
    } else if (this.ownsToggle) {
      const style = this.toggleButton.style
      if (style) {
        style.left = ''
        style.top = ''
        style.right = ''
        style.bottom = ''
      }
    }
  }

  positionPanelRelativeToToggle(options = {}) {
    if (!this.panelEl || !this.toggleButton) return
    if (this.overlayEl && this.overlayEl.hidden && !options.force) return

    let rect
    try {
      rect = this.toggleButton.getBoundingClientRect()
    } catch {
      rect = null
    }
    if (!rect) return

    const view = this.document.defaultView || window
    const docEl = this.document.documentElement || this.document.body
    const viewportWidth = view?.innerWidth || docEl?.clientWidth || 0
    const viewportHeight = view?.innerHeight || docEl?.clientHeight || 0
    if (!viewportWidth || !viewportHeight) return

    const margin = Number.isFinite(options.margin) ? Math.max(4, options.margin) : 12
    const panel = this.panelEl
    panel.style.position = 'fixed'
    panel.style.right = 'auto'
    panel.style.bottom = 'auto'

    let panelRect
    try {
      panelRect = panel.getBoundingClientRect()
    } catch {
      panelRect = { width: panel.offsetWidth || 0, height: panel.offsetHeight || 0 }
    }
    const panelWidth = panelRect.width || panel.offsetWidth || 0
    const panelHeight = panelRect.height || panel.offsetHeight || 0

    let left = rect.left
    if (panelWidth) {
      if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin
      if (left < margin) left = margin
    } else {
      left = Math.max(margin, Math.min(left, viewportWidth - margin))
    }

    let top = rect.bottom + margin
    if (panelHeight) {
      const spaceBelow = viewportHeight - rect.bottom - margin
      const spaceAbove = rect.top - margin
      if (panelHeight > spaceBelow && spaceAbove >= panelHeight) {
        top = rect.top - margin - panelHeight
      } else if (panelHeight > spaceBelow) {
        top = Math.max(margin, viewportHeight - panelHeight - margin)
      }
    } else {
      top = Math.max(margin, Math.min(top, viewportHeight - margin))
    }

    panel.style.left = `${Math.round(left)}px`
    panel.style.top = `${Math.round(top)}px`
  }

  handleToggleDragStart(event) {
    if (!this.toggleButton || !this.ownsToggle) return
    if (event.button != null && event.button !== 0) return
    this.draggedDuringLastInteraction = false
    const rect = this.toggleButton.getBoundingClientRect()
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    }
    try {
      this.toggleButton.setPointerCapture(event.pointerId)
    } catch {}
    this.document.addEventListener('pointermove', this.boundToggleDragMove)
    this.document.addEventListener('pointerup', this.boundToggleDragEnd)
    this.document.addEventListener('pointercancel', this.boundToggleDragEnd)
    event.preventDefault()
  }

  handleToggleDragMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
    const dx = event.clientX - this.dragState.startX
    const dy = event.clientY - this.dragState.startY
    if (!this.dragState.moved && Math.abs(dx) + Math.abs(dy) > 3) this.dragState.moved = true
    if (!this.dragState.moved) return
    event.preventDefault()
    const view = this.document.defaultView || window
    const docEl = this.document.documentElement
    const viewportWidth = view.innerWidth || docEl.clientWidth || this.dragState.width
    const viewportHeight = view.innerHeight || docEl.clientHeight || this.dragState.height
    const minGap = 12
    let left = event.clientX - this.dragState.offsetX
    let top = event.clientY - this.dragState.offsetY
    const maxLeft = viewportWidth - this.dragState.width - minGap
    const maxTop = viewportHeight - this.dragState.height - minGap
    left = Math.min(Math.max(minGap, left), Math.max(minGap, maxLeft))
    top = Math.min(Math.max(minGap, top), Math.max(minGap, maxTop))
    const style = this.toggleButton.style
    style.left = `${left}px`
    style.top = `${top}px`
    style.right = 'auto'
    style.bottom = 'auto'
    this.togglePosition = { left, top }
    if (this.isOpen()) this.positionPanelRelativeToToggle({ force: true })
  }

  handleToggleDragEnd(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
    this.teardownDragListeners()
    try {
      this.toggleButton.releasePointerCapture(event.pointerId)
    } catch {}
    if (this.dragState.moved) {
      this.draggedDuringLastInteraction = true
      event.preventDefault()
    }
    this.dragState = null
    if (this.isOpen()) this.positionPanelRelativeToToggle({ force: true })
  }

  teardownDragListeners() {
    this.document.removeEventListener('pointermove', this.boundToggleDragMove)
    this.document.removeEventListener('pointerup', this.boundToggleDragEnd)
    this.document.removeEventListener('pointercancel', this.boundToggleDragEnd)
  }

  ensurePanel() {
    if (this.panelEl && this.overlayEl && this.dialogHandle) return

    if (!this.overlayEl) {
      const overlay = this.document.createElement('div')
      overlay.className = 'dialog-backdrop dialog-backdrop--right'
      overlay.hidden = true
      overlay.dataset.state = 'closed'
      overlay.id = `${this.id}Overlay`
      markPluginNode(overlay)
      this.overlayEl = overlay
    }

    if (!this.panelEl) {
      const panel = this.document.createElement('div')
      panel.className = 'dialog-surface highlight-settings-panel'
      panel.setAttribute('role', 'dialog')
      panel.setAttribute('aria-labelledby', `${this.id}Title`)
      panel.setAttribute('aria-describedby', `${this.id}Subtitle`)
      panel.innerHTML = `
        <div class="dialog-header">
          <div class="dialog-header__titles">
            <h2 class="dialog-title" id="${this.id}Title">Highlight Settings</h2>
            <p class="dialog-subtitle" id="${this.id}Subtitle">Configure highlight targets, hover tools, and automation triggers.</p>
          </div>
        </div>
        <div class="highlight-settings__tabs" role="tablist">
          <button type="button" class="highlight-settings__tab" data-settings-tab="targets" aria-selected="true">Targets</button>
          <button type="button" class="highlight-settings__tab" data-settings-tab="automation" aria-selected="false">Automation</button>
        </div>
        <div class="highlight-settings__tab-panels">
          <section class="highlight-settings__tab-panel" data-settings-panel="targets">
            <div class="highlight-settings__section" data-section="targets">
              <h3>Highlight Targets</h3>
              ${this.buildTargetControl('blocks')}
              ${this.buildTargetControl('headings')}
              ${this.buildTargetControl('inline')}
              ${this.buildTargetControl('tree')}
              ${this.buildTargetControl('ancestor')}
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
          </section>
          <section class="highlight-settings__tab-panel" data-settings-panel="automation" hidden>
            <div class="highlight-automation" data-automation-root>
              <div class="highlight-settings__section highlight-automation__capabilities" data-section="automation-capabilities">
                <h3>Capabilities</h3>
                <label class="highlight-settings__item highlight-automation__capability" data-automation-capability="runtime">
                  <input type="checkbox" data-automation-setting="enabled" />
                  <div>
                    <span>Enable automation runtime</span>
                    <p class="muted">Attach triggers to matching elements and execute actions for this page.</p>
                  </div>
                </label>
                <label class="highlight-settings__item highlight-automation__capability" data-automation-capability="network">
                  <input type="checkbox" data-automation-setting="capabilities.network" />
                  <div>
                    <span>Allow network automation</span>
                    <p class="muted">Permit triggers to read from network requests and streaming data sources.</p>
                  </div>
                </label>
              </div>
              <p class="highlight-automation__lead">Create automation triggers that react to DOM events with custom scripts.</p>
              <div class="highlight-settings__section" data-section="automation-tools">
                <h3>Automation Tools</h3>
                ${this.buildTargetControl('overlay')}
              </div>
              <div class="highlight-automation__scenario-select">
                <label>
                  <span>Active scenario</span>
                  <select data-automation-setting="activeScenario"></select>
                </label>
              </div>
              <div class="highlight-automation__toolbar">
                <button type="button" class="highlight-automation__btn highlight-automation__btn--primary" data-automation-action="scenarios">Manage Scenarios</button>
              </div>
            </div>
          </section>
        </div>
      `
      markPluginNode(panel)
      this.panelEl = panel
      this.automationRootEl = panel.querySelector('[data-automation-root]')
      this.automationToggle = panel.querySelector('[data-automation-setting="enabled"]')
    }

    if (!this.overlayEl.contains(this.panelEl)) this.overlayEl.appendChild(this.panelEl)
    if (!this.overlayEl.parentElement) this.document.body?.appendChild(this.overlayEl)

    this.overlayEl.addEventListener('change', this.boundHandleInput)
    this.overlayEl.addEventListener('click', this.boundHandleClick)

    this.dialogHandle = dialogService.register(this.id, {
      overlay: this.overlayEl,
      surface: this.panelEl,
      allowBackdropClose: true,
      closeOnEscape: true,
      onOpen: () => {
        this.updateButtonExpanded(true)
        this.positionPanelRelativeToToggle({ force: true })
      },
      onClose: () => this.updateButtonExpanded(false),
    })

    if (this.toggleButton) {
      this.toggleButton.setAttribute('aria-controls', this.overlayEl.id)
    }

    this.syncFromSettings(this.manager.getSettings())
    this.syncCapabilities(this.manager.availableTargets)
    this.syncAutomation(this.automationState)
    this.switchTab(this.activeTab || 'targets')
  }

  buildTargetControl(key) {
    const meta = TARGET_META[key]
    if (!meta) return ''
    return `
      <label class="highlight-settings__item" data-target="${key}">
        <input type="checkbox" data-setting="${key}" />
        <div>
          <span>${meta.label}</span>
          <p class="muted">${meta.description}</p>
        </div>
      </label>
    `
  }

  switchTab(tabName) {
    const targetTab = tabName === 'automation' ? 'automation' : 'targets'
    this.activeTab = targetTab
    if (!this.panelEl) return
    const tabs = this.panelEl.querySelectorAll('[data-settings-tab]')
    tabs.forEach((tab) => {
      const isActive = tab.dataset.settingsTab === targetTab
      tab.classList.toggle('is-active', isActive)
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
    })
    const panels = this.panelEl.querySelectorAll('[data-settings-panel]')
    panels.forEach((panel) => {
      const active = panel.dataset.settingsPanel === targetTab
      panel.toggleAttribute('hidden', !active)
    })
  }

  syncAutomation(state) {
    this.automationState = state && typeof state === 'object' ? state : { enabled: false, triggers: [] }
    this.renderAutomationPanel()
  }

  getAutomationSettingValue(path) {
    const segments = String(path || '')
      .split('.')
      .map((seg) => seg.trim())
      .filter(Boolean)
    if (!segments.length) return undefined
    let current = this.automationState
    for (const segment of segments) {
      if (!current || typeof current !== 'object') return undefined
      current = current[segment]
    }
    return current
  }

  updateAutomationSetting(path, value) {
    if (!this.manager || typeof this.manager.updateAutomation !== 'function') return
    if (path === 'activeScenario' && typeof this.manager.setActiveScenario === 'function') {
      this.manager.setActiveScenario(typeof value === 'string' ? value : '')
      return
    }
    const segments = String(path || '')
      .split('.')
      .map((seg) => seg.trim())
      .filter(Boolean)
    if (!segments.length) return
    if (segments.length === 1) {
      this.manager.updateAutomation({ [segments[0]]: value })
      return
    }
    const [head, ...tail] = segments
    const sourceRoot =
      this.automationState && typeof this.automationState[head] === 'object' && this.automationState[head] !== null
        ? this.automationState[head]
        : {}
    const rootClone = Array.isArray(sourceRoot) ? [...sourceRoot] : { ...sourceRoot }
    let cursor = rootClone
    for (let i = 0; i < tail.length - 1; i += 1) {
      const key = tail[i]
      const existing = cursor && typeof cursor === 'object' && cursor[key] && typeof cursor[key] === 'object' ? cursor[key] : {}
      cursor[key] = Array.isArray(existing) ? [...existing] : { ...existing }
      cursor = cursor[key]
    }
    cursor[tail[tail.length - 1]] = value
    this.manager.updateAutomation({ [head]: rootClone })
  }

  renderAutomationPanel() {
    if (!this.panelEl || !this.automationState) return
    if (this.automationToggle instanceof HTMLInputElement) {
      this.automationToggle.checked = !!this.automationState.enabled
    }
    if (this.automationRootEl) {
      this.automationRootEl.classList.toggle('is-enabled', !!this.automationState.enabled)
    }
    const automationInputs = this.panelEl.querySelectorAll('[data-automation-setting]')
    automationInputs.forEach((input) => {
      if (input === this.automationToggle) return
      const settingKey = input.dataset.automationSetting
      if (!settingKey || settingKey === 'enabled') return
      const value = this.getAutomationSettingValue(settingKey)
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.checked = !!value
      } else if (input instanceof HTMLSelectElement) {
        input.value = value == null ? '' : String(value)
      }
    })
    const scenarioSelect = this.panelEl.querySelector('[data-automation-setting="activeScenario"]')
    if (scenarioSelect instanceof HTMLSelectElement) {
      const meta = this.manager?.automationMeta || { scenarios: [] }
      const scenarios = Array.isArray(meta.scenarios) ? meta.scenarios : []
      const currentSlug =
        this.automationState?.activeScenario && this.automationState.activeScenario.trim()
          ? this.automationState.activeScenario.trim()
          : scenarios[0]?.slug || 'default'
      scenarioSelect.innerHTML = ''
      scenarios.forEach((scenario) => {
        const option = this.document.createElement('option')
        option.value = scenario.slug
        option.textContent = scenario.name || scenario.slug
        scenarioSelect.appendChild(option)
      })
      if (!scenarioSelect.options.length) {
        const option = this.document.createElement('option')
        option.value = currentSlug
        option.textContent = currentSlug
        scenarioSelect.appendChild(option)
      }
      scenarioSelect.value = currentSlug
    }
  }

  handlePlacementStateChange(active) {
    if (this.automationRootEl) {
      this.automationRootEl.classList.toggle('is-placing', !!active)
    }
    if (active) {
      this.switchTab('automation')
    } else {
      this.renderAutomationPanel()
    }
  }

  handleTriggerCreated(trigger) {
    if (trigger && trigger.id) {
      this.renderAutomationPanel()
      this.switchTab('automation')
    }
  }

  openScenarioManager() {
    this.ensurePanel()
    this.switchTab('automation')
    if (this.scenarioManager && typeof this.scenarioManager.open === 'function') {
      this.scenarioManager
        .open()
        .catch((error) => console.warn('Failed to open scenario manager dialog', error))
      return
    }
    try {
      this.document.dispatchEvent(
        new CustomEvent('ami:highlight-manage-scenarios', {
          detail: { ownerId: this.ownerId },
        }),
      )
    } catch (error) {
      console.warn('Scenario manager dispatch failed', error)
    }
  }

  openTriggerEditor(triggerId, options = {}) {
    if (!triggerId || !this.triggerDialog) return
    this.ensurePanel()
    this.switchTab(options.tab || 'automation')
    try {
      this.triggerDialog.openById(triggerId, options)
    } catch (error) {
      console.warn('Failed to open trigger editor', error)
    }
  }

  createAutomationTriggerForElement(element, options = {}) {
    if (!this.automationController) return null
    this.switchTab('automation')

    const buildDraft = () => {
      if (typeof this.automationController.buildDraftForElement !== 'function') return null
      return this.automationController.buildDraftForElement(element, options) || null
    }

    const initialDraft = buildDraft()
    const activeScenario = this.manager?.automation?.activeScenario
    const scenarioSlug =
      typeof options.scenario === 'string' && options.scenario.trim()
        ? options.scenario.trim()
        : typeof activeScenario === 'string' && activeScenario.trim()
          ? activeScenario.trim()
          : 'default'

    const composerDraft =
      initialDraft && typeof initialDraft === 'object'
        ? { ...initialDraft, scenario: initialDraft.scenario || scenarioSlug }
        : null

    const fallbackToComposer = () => {
      if (
        this.triggerComposer &&
        typeof this.triggerComposer.open === 'function' &&
        typeof this.automationController.buildDraftForElement === 'function'
      ) {
        return this.triggerComposer
          .open({
            scenarioSlug,
            initialType: 'dom',
            initialDraft: composerDraft || undefined,
            submitLabel: 'Create Trigger',
          })
          .then((payload) => {
            if (!payload) return null
            const triggerPayload = {
              ...payload,
              scenario: payload.scenario || scenarioSlug,
            }
            const trigger = this.manager?.createTrigger?.(triggerPayload) || null
            if (trigger) {
              if (typeof this.handleTriggerCreated === 'function') this.handleTriggerCreated(trigger)
              this.openTriggerEditor(trigger.id, { tab: 'target' })
            }
            return trigger
          })
          .catch((error) => {
            if (error) console.warn('Failed to create trigger via composer', error)
            return null
          })
      }
      if (typeof this.automationController.createTriggerForElement === 'function') {
        return this.automationController.createTriggerForElement(element, options)
      }
      return null
    }

    if (
      this.scenarioManager &&
      typeof this.scenarioManager.openAddTriggerForElement === 'function'
    ) {
      return this.scenarioManager
        .openAddTriggerForElement({
          scenarioSlug,
          initialType: 'dom',
          initialDraft: composerDraft || undefined,
        })
        .then((payload) => {
          if (!payload) return null
          if (typeof this.handleTriggerCreated === 'function') this.handleTriggerCreated(payload)
          if (payload.id) this.openTriggerEditor(payload.id, { tab: 'target' })
          return payload
        })
        .catch((error) => {
          if (error) console.warn('Failed to create trigger via scenario manager', error)
          return fallbackToComposer()
        })
    }

    return fallbackToComposer()
  }

  editAutomationTriggerForElement(element) {
    if (!this.automationController || typeof this.automationController.findTriggerByElement !== 'function') return
    const trigger = this.automationController.findTriggerByElement(element) || null
    if (trigger) this.openTriggerEditor(trigger.id, { tab: 'target' })
    else this.createAutomationTriggerForElement(element)
  }

  updateButtonExpanded(expanded) {
    if (!this.toggleButton) return
    this.toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    if (expanded) this.toggleButton.classList.add('is-active')
    else this.toggleButton.classList.remove('is-active')
    if (expanded) this.positionPanelRelativeToToggle({ force: true })
  }

  open() {
    this.ensurePanel()
    if (!this.dialogHandle) return false
    this.dialogHandle.open()
    return this.isOpen()
  }

  close() {
    if (!this.dialogHandle) return false
    this.dialogHandle.close()
    return false
  }

  toggle() {
    this.ensurePanel()
    if (!this.dialogHandle) return false
    this.dialogHandle.toggle()
    return this.isOpen()
  }

  isOpen() {
    if (!this.dialogHandle || typeof this.dialogHandle.isOpen !== 'function') return false
    return !!this.dialogHandle.isOpen()
  }

  syncFromSettings(settings) {
    if (!this.panelEl) return
    const inputs = this.panelEl.querySelectorAll('[data-setting]')
    inputs.forEach((input) => {
      const key = input.dataset.setting
      if (!key) return
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.checked = !!settings[key]
      } else if (input instanceof HTMLSelectElement) {
        input.value = settings[key] || 'medium'
      }
    })
  }

  syncCapabilities(capabilities) {
    if (!this.panelEl) return
    const sections = this.panelEl.querySelectorAll('[data-target]')
    sections.forEach((section) => {
      const key = section.dataset.target
      if (!key) return
      const supported = key === 'ancestor' ? !!capabilities.tree : !!capabilities[key]
      if (!supported) section.setAttribute('hidden', '')
      else section.removeAttribute('hidden')
      const input = section.querySelector('[data-setting]')
      if (input) input.disabled = !supported
    })
  }

  handleInput(event) {
    const target = event?.target
    if (!(target instanceof HTMLElement)) return
    const automationKey = target.dataset.automationSetting
    if (automationKey) {
      if (automationKey === 'enabled' && target instanceof HTMLInputElement && target.type === 'checkbox') {
        if (typeof this.manager.setAutomationEnabled === 'function') this.manager.setAutomationEnabled(target.checked)
        else if (typeof this.manager.updateAutomation === 'function') this.manager.updateAutomation({ enabled: target.checked })
        return
      }
      let value = null
      if (target instanceof HTMLInputElement) {
        value = target.type === 'checkbox' ? target.checked : target.value
      } else if (target instanceof HTMLSelectElement) {
        value = target.value
      }
      if (value !== null && value !== undefined) this.updateAutomationSetting(automationKey, value)
      return
    }
    const key = target.dataset.setting
    if (!key) return
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      this.manager.updateSettings({ [key]: target.checked })
    } else if (target instanceof HTMLSelectElement) {
      this.manager.updateSettings({ [key]: target.value })
    }
  }

  handleClick(event) {
    const target = event?.target
    if (!(target instanceof HTMLElement)) return
    const tabBtn = target.closest('[data-settings-tab]')
    if (tabBtn) {
      event.preventDefault()
      this.switchTab(tabBtn.dataset.settingsTab || 'targets')
      return
    }
    const automationBtn = target.closest('[data-automation-action]')
    if (automationBtn) {
      event.preventDefault()
      const action = automationBtn.dataset.automationAction
      if (action === 'edit') {
        const triggerId = automationBtn.dataset.triggerId
        if (triggerId) this.openTriggerEditor(triggerId, { tab: 'target' })
      } else if (action === 'scenarios') {
        this.openScenarioManager()
      }
      return
    }
    const closeBtn = target.closest('.dialog-close')
    if (closeBtn) {
      event.preventDefault()
      this.close()
    }
  }

  destroy() {
    this.detachToggleButton()
    if (this.overlayEl) {
      try {
        this.overlayEl.removeEventListener('change', this.boundHandleInput)
        this.overlayEl.removeEventListener('click', this.boundHandleClick)
      } catch {}
    }
    if (this.dialogHandle && typeof this.dialogHandle.destroy === 'function') {
      this.dialogHandle.destroy()
    }
    if (this.triggerDialog && typeof this.triggerDialog.destroy === 'function') {
      try {
        this.triggerDialog.destroy()
      } catch {}
    }
    if (this.triggerComposer && typeof this.triggerComposer.destroy === 'function') {
      try {
        this.triggerComposer.destroy()
      } catch {}
    }
    if (this.automationController && typeof this.automationController.destroy === 'function') {
      try {
        this.automationController.destroy()
      } catch {}
    }
    if (this.scenarioManager && typeof this.scenarioManager.destroy === 'function') {
      try {
        this.scenarioManager.destroy()
      } catch {}
    }
    this.scenarioManager = null
    this.overlayEl = null
    this.panelEl = null
    this.dialogHandle = null
    if (this.detachSettings) this.detachSettings()
    if (this.detachCapabilities) this.detachCapabilities()
    if (this.detachAutomation) this.detachAutomation()
    this.detachSettings = null
    this.detachCapabilities = null
    this.detachAutomation = null
    this.triggerDialog = null
    this.triggerComposer = null
    this.automationController = null
    this.automationToggle = null
    this.automationRootEl = null
  }
}

export function createHighlightSettingsUI(options = {}) {
  return new HighlightSettingsUI(options)
}
