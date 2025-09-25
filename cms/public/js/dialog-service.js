import { createDialogController } from './dialog-controller.js?v=20250306'

const FOCUSABLE_SELECTORS = [
  'a[href]','area[href]','button:not([disabled])','input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])','textarea:not([disabled])','iframe','object','embed',
  '[contenteditable="true"]','[tabindex]:not([tabindex="-1"])'
].join(',')

function resolveElement(ref) {
  if (!ref) return null
  if (ref instanceof HTMLElement) return ref
  if (typeof ref === 'string') return document.querySelector(ref)
  return null
}

function isFocusable(el) {
  if (!el || typeof el !== 'object') return false
  if (!(el instanceof HTMLElement)) return false
  if (el.hasAttribute('disabled')) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return false
  if (el.offsetParent === null && style.position !== 'fixed') return false
  return true
}

function collectFocusable(root) {
  if (!root) return []
  const nodes = Array.from(root.querySelectorAll(FOCUSABLE_SELECTORS))
  return nodes.filter(isFocusable)
}

function safeFocus(el) {
  if (!el || typeof el.focus !== 'function') return
  try {
    el.focus({ preventScroll: true })
  } catch {
    try {
      el.focus()
    } catch {}
  }
}

function elementInDocument(el) {
  if (!el || !(el instanceof Node)) return false
  return document.contains(el)
}

class DialogInstance {
  constructor(service, id, options) {
    this.service = service
    this.id = id
    this.overlay = resolveElement(options.overlay)
    if (!this.overlay) throw new Error(`Dialog overlay not found for "${id}"`)
    this.surface = resolveElement(options.surface)
    if (!this.surface) {
      this.surface = this.overlay.querySelector('.dialog-surface') || this.overlay.firstElementChild
    }
    if (!(this.surface instanceof HTMLElement)) throw new Error(`Dialog surface not found for "${id}"`)

    this.allowBackdropClose = options.allowBackdropClose !== false
    this.closeOnEscape = options.closeOnEscape !== false
    this.closeDelay = typeof options.closeDelay === 'number' ? options.closeDelay : 240
    this.trapFocus = options.trapFocus !== false
    this.returnFocus = options.returnFocus !== false
    this.initialFocus = options.initialFocus || null
    this.onOpenCallback = options.onOpen || null
    this.onCloseCallback = options.onClose || null

    this.previousFocus = null
    this.focusHandler = null
    this.isOpen = false

    if (!this.overlay.id) this.overlay.id = `dialog-${id}`
    this.overlay.dataset.dialogId = id
    this.overlay.setAttribute('aria-hidden', 'true')
    if (!this.surface.hasAttribute('role')) this.surface.setAttribute('role', 'dialog')
    this.surface.setAttribute('aria-modal', 'true')
    if (!this.surface.hasAttribute('tabindex')) this.surface.setAttribute('tabindex', '-1')

    this.controller = createDialogController({
      overlay: this.overlay,
      surface: this.surface,
      allowBackdropClose: this.allowBackdropClose,
      closeOnEscape: this.closeOnEscape,
      closeDelay: this.closeDelay,
      onOpen: () => this.handleOpen(),
      onClose: () => this.handleClose(),
    })
  }

  bindFocusTrap() {
    if (!this.trapFocus || this.focusHandler) return
    this.focusHandler = (event) => {
      if (event.key !== 'Tab') return
      const focusables = collectFocusable(this.surface)
      if (!focusables.length) {
        event.preventDefault()
        safeFocus(this.surface)
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !this.surface.contains(active)) {
          event.preventDefault()
          safeFocus(last)
        }
      } else if (active === last) {
        event.preventDefault()
        safeFocus(first)
      }
    }
    this.overlay.addEventListener('keydown', this.focusHandler, true)
  }

  releaseFocusTrap() {
    if (this.focusHandler) {
      this.overlay.removeEventListener('keydown', this.focusHandler, true)
      this.focusHandler = null
    }
  }

  scheduleInitialFocus() {
    if (!this.trapFocus) return
    const chooseTarget = () => {
      if (typeof this.initialFocus === 'function') {
        const candidate = this.initialFocus(this)
        if (candidate) return candidate
      } else if (typeof this.initialFocus === 'string') {
        const candidate = this.surface.querySelector(this.initialFocus)
        if (candidate) return candidate
      }
      const focusables = collectFocusable(this.surface)
      if (focusables.length) return focusables[0]
      return this.surface
    }
    const target = chooseTarget()
    requestAnimationFrame(() => {
      safeFocus(target)
    })
  }

  handleOpen() {
    if (!this.isOpen) {
      this.isOpen = true
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      this.service.onDialogOpened(this)
    }
    this.overlay.setAttribute('aria-hidden', 'false')
    this.bindFocusTrap()
    this.scheduleInitialFocus()
    if (typeof this.onOpenCallback === 'function') this.onOpenCallback(this.getPublicApi())
  }

  handleClose() {
    if (this.isOpen) {
      this.isOpen = false
      this.service.onDialogClosed(this)
    }
    this.overlay.setAttribute('aria-hidden', 'true')
    this.releaseFocusTrap()
    if (this.returnFocus && this.previousFocus && elementInDocument(this.previousFocus)) {
      safeFocus(this.previousFocus)
    }
    this.previousFocus = null
    if (typeof this.onCloseCallback === 'function') this.onCloseCallback(this.getPublicApi())
  }

  open() {
    this.controller.open()
  }

  close(immediate = false) {
    this.controller.close(immediate)
  }

  toggle() {
    this.controller.toggle()
  }

  destroy() {
    this.releaseFocusTrap()
    this.controller.destroy?.()
    this.service.onDialogDestroyed(this)
  }

  getPublicApi() {
    return {
      id: this.id,
      open: () => this.open(),
      close: (immediate = false) => this.close(immediate),
      toggle: () => this.toggle(),
      isOpen: () => this.controller.isOpen(),
    }
  }
}

class DialogService {
  constructor() {
    this.instances = new Map()
    this.openCount = 0
    this.bodyClass = 'has-open-dialog'
  }

  onDialogOpened(instance) {
    if (!instance || instance.__countedOpen) return
    instance.__countedOpen = true
    this.openCount += 1
    this.applyBodyState()
  }

  onDialogClosed(instance) {
    if (!instance || !instance.__countedOpen) return
    instance.__countedOpen = false
    this.openCount = Math.max(0, this.openCount - 1)
    this.applyBodyState()
  }

  onDialogDestroyed(instance) {
    if (instance && instance.__countedOpen) {
      instance.__countedOpen = false
      this.openCount = Math.max(0, this.openCount - 1)
      this.applyBodyState()
    }
    this.instances.delete(instance?.id)
  }

  applyBodyState() {
    try {
      const body = document.body
      if (!body) return
      const isOpen = this.openCount > 0
      body.classList.toggle(this.bodyClass, isOpen)
      if (isOpen) body.setAttribute('data-dialog-open', '1')
      else body.removeAttribute('data-dialog-open')
    } catch {}
  }

  register(id, options = {}) {
    if (!id) throw new Error('Dialog id is required')
    if (this.instances.has(id)) {
      this.instances.get(id)?.destroy()
    }
    const instance = new DialogInstance(this, id, options)
    this.instances.set(id, instance)
    return instance.getPublicApi()
  }

  unregister(id) {
    const instance = this.instances.get(id)
    if (!instance) return
    instance.destroy()
    this.instances.delete(id)
  }

  get(id) {
    return this.instances.get(id)?.getPublicApi() || null
  }

  open(id) {
    this.instances.get(id)?.open()
  }

  close(id, immediate = false) {
    this.instances.get(id)?.close(immediate)
  }

  toggle(id) {
    const inst = this.instances.get(id)
    if (!inst) return
    inst.toggle()
  }

  closeAll() {
    for (const instance of this.instances.values()) {
      instance.close()
    }
  }
}

export const dialogService = new DialogService()

