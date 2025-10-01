import { dialogService } from '../../lib/dialog-service.js'
import { markPluginNode } from '../core/dom-utils.js'
import { ensureReact } from '../support/ensure-react.js'
import { createSyntaxEditorToolkit } from './syntax-editor.js'

const TAB_TARGET = 'target'
const TAB_CONDITION = 'condition'
const TAB_ACTION = 'action'
const EDITOR_LINES = 12
const DEFAULT_EVENT_TYPES = [
  'click',
  'input',
  'change',
  'submit',
  'focus',
  'blur',
  'mouseenter',
  'mouseleave',
  'pointerenter',
  'pointerleave',
  'keydown',
  'keyup',
]

function ensureArray(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

export class TriggerDialog {
  constructor(options = {}) {
    const doc = options.document || (typeof document !== 'undefined' ? document : null)
    if (!doc) throw new Error('TriggerDialog requires a document')
    this.document = doc
    this.manager = options.manager
    this.controller = options.controller || null
    this.ownerId = options.ownerId || ''
    this.trigger = null
    this.handle = null
    this.overlay = null
    this.surface = null
    this.activeTab = TAB_TARGET
    this.eventTypes = ensureArray(options.eventTypes).length ? ensureArray(options.eventTypes) : DEFAULT_EVENT_TYPES
    this.onDelete = typeof options.onDelete === 'function' ? options.onDelete : null
    this.onSave = typeof options.onSave === 'function' ? options.onSave : null
    this.onOpen = typeof options.onOpen === 'function' ? options.onOpen : null
    this.onClose = typeof options.onClose === 'function' ? options.onClose : null
    this.boundHandleClick = (event) => this.handleClick(event)
    this.boundHandleInput = (event) => this.handleInput(event)
    this.editorRoots = {}
    this.editorState = { target: '', condition: '', action: '' }
    this.setupEditorsPromise = null
    this.SyntaxEditor = null
    this.React = null
    this.ReactDOM = null
  }

  ensure() {
    if (this.overlay && this.surface && this.handle) return
    const overlay = this.document.createElement('div')
    overlay.className = 'dialog-backdrop'
    overlay.hidden = true
    markPluginNode(overlay)

    const surface = this.document.createElement('div')
    surface.className = 'dialog-surface trigger-dialog'
    surface.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-header__titles">
          <h2 class="dialog-title">Automation Trigger</h2>
          <p class="dialog-subtitle">Configure target, condition, and action handlers.</p>
        </div>
        <button type="button" class="trigger-dialog__close" data-trigger-action="close" aria-label="Close trigger dialog">×</button>
      </div>
      <div class="trigger-dialog__meta">
        <label class="trigger-dialog__field">
          <span>Name</span>
          <input type="text" name="name" data-trigger-field="name" placeholder="Trigger name" />
        </label>
        <label class="trigger-dialog__field trigger-dialog__field--event">
          <span>Event type</span>
          <input type="text" name="eventType" list="triggerEventTypes" data-trigger-field="eventType" placeholder="click" />
          <datalist id="triggerEventTypes">
            ${this.eventTypes.map((type) => `<option value="${type}"></option>`).join('')}
          </datalist>
        </label>
      </div>
      <div class="trigger-dialog__tabs" role="tablist">
        <button type="button" class="trigger-dialog__tab" data-trigger-tab="${TAB_TARGET}" aria-selected="true">Target</button>
        <button type="button" class="trigger-dialog__tab" data-trigger-tab="${TAB_CONDITION}" aria-selected="false">Condition</button>
        <button type="button" class="trigger-dialog__tab" data-trigger-tab="${TAB_ACTION}" aria-selected="false">Action</button>
      </div>
      <div class="trigger-dialog__panels">
        <section class="trigger-dialog__panel" data-trigger-panel="${TAB_TARGET}" role="tabpanel">
          <div data-trigger-editor="target" class="trigger-dialog__editor"></div>
          <p class="trigger-dialog__meta-info" data-trigger-element-label></p>
        </section>
        <section class="trigger-dialog__panel" data-trigger-panel="${TAB_CONDITION}" role="tabpanel" hidden>
          <div data-trigger-editor="condition" class="trigger-dialog__editor"></div>
        </section>
        <section class="trigger-dialog__panel" data-trigger-panel="${TAB_ACTION}" role="tabpanel" hidden>
          <div data-trigger-editor="action" class="trigger-dialog__editor"></div>
        </section>
      </div>
      <div class="trigger-dialog__footer">
        <button type="button" class="trigger-dialog__delete" data-trigger-action="delete">Delete trigger</button>
        <span class="trigger-dialog__spacer"></span>
        <button type="button" class="trigger-dialog__cancel" data-trigger-action="cancel">Cancel</button>
        <button type="button" class="trigger-dialog__save" data-trigger-action="save">Save</button>
      </div>
    `
    markPluginNode(surface)
    overlay.appendChild(surface)
    this.document.body.appendChild(overlay)

    overlay.addEventListener('click', this.boundHandleClick)
    overlay.addEventListener('input', this.boundHandleInput)

    this.overlay = overlay
    this.surface = surface

    this.setupEditors()

    this.handle = dialogService.register('highlightTriggerDialog', {
      overlay,
      surface,
      allowBackdropClose: false,
      initialFocus: () => surface.querySelector('input[data-trigger-field="name"]'),
      onOpen: () => this.handleOpen(),
      onClose: () => this.handleClose(),
    })
  }

  async setupEditors() {
    if (!this.setupEditorsPromise) {
      this.setupEditorsPromise = ensureReact()
        .then(({ React, ReactDOM }) => {
          this.React = React
          this.ReactDOM = ReactDOM
          this.SyntaxEditor = createSyntaxEditorToolkit(React).SyntaxEditor
          return true
        })
        .catch((error) => {
          console.warn('Failed to initialise trigger editors', error)
          this.React = null
          this.ReactDOM = null
          this.SyntaxEditor = null
          return false
        })
    }
    return this.setupEditorsPromise
  }

  handleOpen() {
    if (typeof this.onOpen === 'function') this.onOpen(this.trigger)
  }

  handleClose() {
    if (typeof this.onClose === 'function') this.onClose(this.trigger)
  }

  async renderEditor(kind, value, options = {}) {
    const surface = this.surface
    if (!surface) return
    const container = surface.querySelector(`[data-trigger-editor="${kind}"]`)
    if (!container) return

    const ready = await this.setupEditors()
    if (!ready || !this.SyntaxEditor || !this.ReactDOM || !this.React) {
      // Progressive enhancement: Use basic textarea when Monaco/React unavailable
      container.innerHTML = ''
      const basicEditor = this.document.createElement('textarea')
      basicEditor.value = value || ''
      basicEditor.dataset.triggerField = `${kind}Code`
      basicEditor.className = 'trigger-dialog__textarea-basic'
      container.appendChild(basicEditor)
      this.editorRoots[kind] = null
      this.editorState[kind] = basicEditor.value
      basicEditor.addEventListener('input', (event) => {
        this.editorState[kind] = event.target.value
      })
      return
    }

    if (!this.editorRoots) this.editorRoots = {}
    let root = this.editorRoots[kind]
    if (!root) {
      root = this.ReactDOM.createRoot(container)
      this.editorRoots[kind] = root
    }

    const SyntaxEditor = this.SyntaxEditor
    const props = {
      value: value || '',
      language: 'javascript',
      placeholder: options.placeholder || '',
      minLines: options.minLines || EDITOR_LINES,
      onChange: (next) => {
        this.editorState = { ...this.editorState, [kind]: next }
      },
    }

    this.editorState = { ...this.editorState, [kind]: value || '' }
    root.render(this.React.createElement(SyntaxEditor, props))
  }

  getEditorValue(kind) {
    if (this.editorState && Object.prototype.hasOwnProperty.call(this.editorState, kind)) {
      return this.editorState[kind]
    }
    return null
  }

  teardownEditors() {
    if (this.editorRoots) {
      Object.values(this.editorRoots).forEach((root) => {
        try {
          root?.unmount?.()
        } catch {}
      })
    }
    if (this.surface) {
      const containers = this.surface.querySelectorAll('[data-trigger-editor]')
      containers.forEach((container) => {
        container.innerHTML = ''
      })
    }
    this.editorRoots = {}
    this.editorState = { target: '', condition: '', action: '' }
  }

  updateFields(trigger) {
    const surface = this.surface
    if (!surface) return
    const nameInput = surface.querySelector('[data-trigger-field="name"]')
    if (nameInput instanceof HTMLInputElement) nameInput.value = trigger?.name || ''
    const eventInput = surface.querySelector('[data-trigger-field="eventType"]')
    if (eventInput instanceof HTMLInputElement) eventInput.value = trigger?.eventType || 'click'

    this.renderEditor('target', trigger?.targetCode || '', {
      placeholder: 'Return the element(s) to monitor.',
      minLines: EDITOR_LINES,
    })
    this.renderEditor('condition', trigger?.conditionCode || '', {
      placeholder: 'Return true to continue.',
      minLines: EDITOR_LINES,
    })
    this.renderEditor('action', trigger?.actionCode || '', {
      placeholder: 'Implement automation logic using context.',
      minLines: EDITOR_LINES,
    })

    const labelEl = surface.querySelector('[data-trigger-element-label]')
    if (labelEl) {
      const descriptor = trigger?.elementLabel || trigger?.selector || trigger?.dataPath || ''
      labelEl.textContent = descriptor ? `Target: ${descriptor}` : ''
    }
  }

  open(trigger, options = {}) {
    this.ensure()
    this.trigger = trigger
    this.updateFields(trigger)
    this.switchTab(options.tab || TAB_TARGET)
    if (this.handle) this.handle.open()
  }

  openById(triggerId, options = {}) {
    const state = this.manager?.getAutomation?.()
    const trigger = state?.triggers?.find((entry) => entry.id === triggerId) || null
    if (!trigger) return
    this.open(trigger, options)
  }

  close() {
    if (this.handle) this.handle.close()
  }

  destroy() {
    if (this.overlay) {
      this.overlay.removeEventListener('click', this.boundHandleClick)
      this.overlay.removeEventListener('input', this.boundHandleInput)
    }
    if (this.handle) this.handle.destroy()
    if (this.overlay?.parentElement) this.overlay.parentElement.removeChild(this.overlay)
    this.overlay = null
    this.surface = null
    this.handle = null
    this.teardownEditors()
  }

  handleClick(event) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.dataset.triggerTab) {
      event.preventDefault()
      this.switchTab(target.dataset.triggerTab)
      return
    }
    if (target.dataset.triggerAction) {
      event.preventDefault()
      const action = target.dataset.triggerAction
      if (action === 'close' || action === 'cancel') {
        this.close()
      } else if (action === 'save') {
        this.save()
      } else if (action === 'delete') {
        this.delete()
      }
    }
  }

  handleInput(event) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.dataset.triggerField === 'name' && this.surface) {
      const nameInput = this.surface.querySelector('[data-trigger-field="name"]')
      if (nameInput instanceof HTMLInputElement) nameInput.value = target.value || ''
    }
  }

  switchTab(tab) {
    const tabName = [TAB_TARGET, TAB_CONDITION, TAB_ACTION].includes(tab) ? tab : TAB_TARGET
    this.activeTab = tabName
    if (!this.surface) return
    const tabs = this.surface.querySelectorAll('.trigger-dialog__tab')
    tabs.forEach((btn) => {
      const isActive = btn.dataset.triggerTab === tabName
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false')
      btn.classList.toggle('is-active', isActive)
    })
    const panels = this.surface.querySelectorAll('[data-trigger-panel]')
    panels.forEach((panel) => {
      const isActive = panel.dataset.triggerPanel === tabName
      panel.toggleAttribute('hidden', !isActive)
    })
  }

  readForm() {
    if (!this.surface || !this.trigger) return null
    const fields = this.surface.querySelectorAll('[data-trigger-field]')
    const data = {}
    fields.forEach((field) => {
      const key = field.dataset.triggerField
      if (!key) return
      if (field instanceof HTMLInputElement) {
        data[key] = field.value
      }
    })
    return {
      name: data.name || this.trigger.name,
      eventType: data.eventType || this.trigger.eventType || 'click',
      targetCode: this.getEditorValue('target') ?? this.trigger.targetCode,
      conditionCode: this.getEditorValue('condition') ?? this.trigger.conditionCode,
      actionCode: this.getEditorValue('action') ?? this.trigger.actionCode,
    }
  }

  save() {
    if (!this.trigger || !this.manager) {
      this.close()
      return
    }
    const values = this.readForm()
    if (!values) {
      this.close()
      return
    }
    const updated = this.manager.updateTrigger(this.trigger.id, {
      ...values,
      updatedAt: Date.now(),
    })
    if (updated && typeof this.onSave === 'function') this.onSave(updated)
    this.close()
  }

  delete() {
    if (!this.trigger || !this.manager) {
      this.close()
      return
    }
    const confirmed = this.document.defaultView?.confirm
      ? this.document.defaultView.confirm('Delete this automation trigger?')
      : true
    if (!confirmed) return
    const removed = this.manager.removeTrigger(this.trigger.id)
    if (removed && typeof this.onDelete === 'function') this.onDelete(this.trigger)
    this.close()
  }
}

export function createTriggerDialog(options = {}) {
  return new TriggerDialog(options)
}
