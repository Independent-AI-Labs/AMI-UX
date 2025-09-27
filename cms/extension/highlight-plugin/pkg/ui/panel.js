import { dialogService } from '../../dialog-service.js'
import { markPluginNode } from '../core/dom-utils.js'
import { ensureUIStyles } from './styles.js'

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

const CLOSE_SYMBOL = '\u00D7'

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

    ensureUIStyles(doc)

    this.boundHandleInput = (event) => this.handleInput(event)
    this.boundHandleClick = (event) => this.handleClick(event)

    this.detachSettings = this.manager.on('settings', (settings) => this.syncFromSettings(settings))
    this.detachCapabilities = this.manager.on('capabilities', (caps) => this.syncCapabilities(caps))

    if (options.autoAttach !== false) {
      const target = options.toggleButton || this.locateToggleButton()
      if (target) this.attachToggleButton(target)
      else this.createFloatingToggle()
    }

    // Prepare UI immediately if desired
    if (options.renderImmediately) this.ensurePanel()
  }

  locateToggleButton() {
    try {
      return this.document.querySelector('[data-ami-highlight-toggle="1"]')
    } catch {
      return null
    }
  }

  createFloatingToggle() {
    const btn = this.document.createElement('button')
    btn.type = 'button'
    btn.className = 'ami-highlight-toggle'
    btn.title = 'Toggle highlight settings'
    btn.setAttribute('aria-label', 'Toggle highlight settings')
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.37 1.05V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-.37-1.05 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.05-1 1.65 1.65 0 0 0-1.05-.37H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.05-.37 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .37-1.05V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 .37 1.05 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.05.37H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.05.37 1.65 1.65 0 0 0-.46.66z"></path>
      </svg>
    `
    markPluginNode(btn)
    btn.dataset.amiHighlightToggle = '1'
    btn.dataset.amiHighlightOwned = '1'
    this.document.body?.appendChild(btn)
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
    this.ownsToggle = options.ownsToggle || this.toggleButton.dataset?.amiHighlightOwned === '1'
    this.toggleButton.setAttribute('aria-haspopup', 'dialog')
    this.toggleButton.setAttribute('aria-expanded', this.isOpen() ? 'true' : 'false')
    this.buttonHandler = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const opened = this.toggle()
      this.toggleButton?.setAttribute('aria-expanded', opened ? 'true' : 'false')
    }
    this.toggleButton.addEventListener('click', this.buttonHandler)
  }

  detachToggleButton() {
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
    this.toggleButton = null
    this.buttonHandler = null
    this.ownsToggle = false
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
            <p class="dialog-subtitle" id="${this.id}Subtitle">Configure highlight targets and hover tools.</p>
          </div>
          <button type="button" class="dialog-close" aria-label="Close highlight settings"><span aria-hidden="true">${CLOSE_SYMBOL}</span></button>
        </div>
        <div class="highlight-settings__section" data-section="targets">
          <h3>Highlight Targets</h3>
          ${this.buildTargetControl('blocks')}
          ${this.buildTargetControl('headings')}
          ${this.buildTargetControl('inline')}
          ${this.buildTargetControl('tree')}
          ${this.buildTargetControl('ancestor')}
        </div>
        <div class="highlight-settings__section" data-section="overlay">
          <h3>Hover Tools</h3>
          ${this.buildTargetControl('overlay')}
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
      markPluginNode(panel)
      this.panelEl = panel
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
      onOpen: () => this.updateButtonExpanded(true),
      onClose: () => this.updateButtonExpanded(false),
    })

    if (this.toggleButton) {
      this.toggleButton.setAttribute('aria-controls', this.overlayEl.id)
    }

    this.syncFromSettings(this.manager.getSettings())
    this.syncCapabilities(this.manager.availableTargets)
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

  updateButtonExpanded(expanded) {
    if (!this.toggleButton) return
    this.toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false')
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
    this.overlayEl = null
    this.panelEl = null
    this.dialogHandle = null
    if (this.detachSettings) this.detachSettings()
    if (this.detachCapabilities) this.detachCapabilities()
    this.detachSettings = null
    this.detachCapabilities = null
  }
}

export function createHighlightSettingsUI(options = {}) {
  return new HighlightSettingsUI(options)
}
