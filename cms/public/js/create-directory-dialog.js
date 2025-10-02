import { dialogService } from './dialog-service.js?v=20250306'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'

let dialogIdCounter = 0

function nextDialogId() {
  dialogIdCounter += 1
  return `create-directory-${dialogIdCounter}`
}

function defaultValidate(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return { ok: false, error: 'Folder name is required.' }
  if (trimmed === '.' || trimmed === '..') return { ok: false, error: 'Folder name is invalid.' }
  if (/[\\/]/.test(trimmed)) return { ok: false, error: 'Folder name cannot contain slashes.' }
  return { ok: true, value: trimmed }
}

export function openCreateDirectoryDialog(options = {}) {
  const {
    title = 'Create Directory',
    description = '',
    placeholder = 'Directory name',
    confirmLabel = 'Create',
    cancelLabel = 'Cancel',
    initialValue = '',
    ariaLabel = 'Directory name',
    validate = null,
  } = options

  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'dialog-backdrop'

    const surface = document.createElement('div')
    surface.className = 'dialog-surface create-directory-dialog'
    overlay.appendChild(surface)

    const header = document.createElement('div')
    header.className = 'dialog-header'

    const titles = document.createElement('div')
    titles.className = 'dialog-header__titles'

    const titleEl = document.createElement('h2')
    titleEl.className = 'dialog-title'
    titleEl.textContent = title
    titles.appendChild(titleEl)

    if (description) {
      const desc = document.createElement('p')
      desc.className = 'dialog-subtitle'
      desc.textContent = description
      titles.appendChild(desc)
    }

    header.appendChild(titles)

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'icon-button dialog-close'
    closeButton.setAttribute('aria-label', 'Close dialog')
    closeButton.innerHTML = iconMarkup('close-line', { size: 20 })

    header.appendChild(closeButton)
    surface.appendChild(header)

    const dialogContent = document.createElement('div')
    dialogContent.className = 'dialog-content'
    surface.appendChild(dialogContent)

    const form = document.createElement('form')
    form.className = 'create-directory-dialog__form'

    const field = document.createElement('label')
    field.className = 'create-directory-dialog__field'

    const span = document.createElement('span')
    span.className = 'create-directory-dialog__field-label'
    span.textContent = ariaLabel
    field.appendChild(span)

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'create-directory-dialog__input'
    input.placeholder = placeholder
    input.value = initialValue
    input.setAttribute('aria-label', ariaLabel)
    field.appendChild(input)

    const errorEl = document.createElement('div')
    errorEl.className = 'create-directory-dialog__error'
    errorEl.hidden = true

    form.appendChild(field)
    form.appendChild(errorEl)

    const footer = document.createElement('div')
    footer.className = 'dialog-footer'

    const cancelButton = document.createElement('button')
    cancelButton.type = 'button'
    cancelButton.className = 'dialog-button dialog-button--ghost'
    cancelButton.textContent = cancelLabel

    const confirmButton = document.createElement('button')
    confirmButton.type = 'submit'
    confirmButton.className = 'dialog-button dialog-button--primary'
    confirmButton.textContent = confirmLabel

    footer.appendChild(cancelButton)
    footer.appendChild(confirmButton)

    dialogContent.appendChild(form)
    dialogContent.appendChild(footer)

    let resolved = false
    let handle = null

    const showError = (message) => {
      if (!message) {
        errorEl.hidden = true
        errorEl.textContent = ''
      } else {
        errorEl.hidden = false
        errorEl.textContent = message
      }
    }

    const close = (result, immediate = false) => {
      if (resolved) return
      resolved = true
      if (handle) handle.close(immediate)
      resolve(result)
    }

    const runValidation = () => {
      const raw = input.value
      const validator = typeof validate === 'function' ? validate : defaultValidate
      const outcome = validator(raw)
      if (!outcome || outcome.ok === false) {
        const message = outcome?.error || 'Folder name is invalid.'
        showError(message)
        return null
      }
      showError('')
      return outcome.value || raw.trim()
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const value = runValidation()
      if (!value) {
        input.focus()
        return
      }
      close({ ok: true, name: value })
    })

    cancelButton.addEventListener('click', () => close({ ok: false, name: '' }))
    closeButton.addEventListener('click', () => close({ ok: false, name: '' }))

    document.body.appendChild(overlay)

    const dialogId = nextDialogId()
    handle = dialogService.register(dialogId, {
      overlay,
      surface,
      allowBackdropClose: true,
      closeDelay: 220,
      initialFocus: () => input,
      onClose: () => {
        if (!resolved) resolve({ ok: false, name: '' })
        setTimeout(() => {
          try {
            dialogService.unregister(dialogId)
          } catch {}
          overlay.remove()
        }, 0)
      },
    })

    input.addEventListener('input', () => {
      if (resolved) return
      showError('')
    })

    setTimeout(() => {
      input.focus()
      input.select()
    }, 0)

    handle.open()
  })
}
