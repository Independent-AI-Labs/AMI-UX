import { dialogService } from './dialog-service.js?v=20250306'
import { icon as iconMarkup } from './icon-pack.js?v=20250306'
import { showToast } from './toast-manager.js?v=20250306'

let overlayEl = null
let surfaceEl = null
let dialogHandle = null

const fields = {
  subtitle: null,
  metaValueWrap: null,
  metaValueText: null,
  metaCopyButton: null,
  metaActionWrap: null,
  metaServerButton: null,
  contentValueWrap: null,
  contentValueText: null,
  contentCopyButton: null,
  contentActionWrap: null,
  rootValue: null,
  relativeValue: null,
  relativeSection: null,
  footer: null,
  cancelButton: null,
  setButton: null,
}

let currentContext = null

const DEFAULT_CANCEL_LABEL = 'Cancel'
const DEFAULT_CONFIRM_LABEL = 'Set'

function getConfirmPayload() {
  if (!currentContext) return null
  return {
    label: currentContext.label,
    path: currentContext.path,
    metaPath: currentContext.metaPath,
    rootKey: currentContext.rootKey,
    rootLabel: currentContext.rootLabel,
    relativePath: currentContext.relativePath,
  }
}

async function handleConfirm() {
  if (!fields.setButton) return
  if (!currentContext) {
    closeMetadataSettingsDialog()
    return
  }
  if (fields.setButton.dataset.busy === '1') return
  if (!currentContext.metaPath) {
    showToast('Select a metadata directory first.', { tone: 'danger' })
    return
  }

  const confirmLabel = currentContext.confirmLabel || DEFAULT_CONFIRM_LABEL
  fields.setButton.dataset.busy = '1'
  fields.setButton.disabled = true
  fields.setButton.textContent = `${confirmLabel}…`

  try {
    const payload = getConfirmPayload()
    const handler = currentContext.onConfirm
    if (typeof handler === 'function') {
      const result = await handler(payload)
      if (result && result.ok === false) {
        const message = result.error || 'Unable to update metadata.'
        showToast(message, { tone: 'danger' })
        return
      }
    }
    closeMetadataSettingsDialog()
  } catch (err) {
    const message = err?.message || 'Unable to update metadata.'
    showToast(message, { tone: 'danger' })
  } finally {
    delete fields.setButton.dataset.busy
    if (fields.setButton) {
      fields.setButton.disabled = !currentContext?.metaPath
      fields.setButton.textContent = confirmLabel
    }
  }
}

function ensureDialog() {
  if (overlayEl && surfaceEl && dialogHandle) return

  overlayEl = document.createElement('div')
  overlayEl.className = 'dialog-backdrop'
  overlayEl.hidden = true

  surfaceEl = document.createElement('div')
  surfaceEl.className = 'dialog-surface metadata-settings-dialog'
  overlayEl.appendChild(surfaceEl)

  const header = document.createElement('div')
  header.className = 'dialog-header'

  const titles = document.createElement('div')
  titles.className = 'dialog-header__titles'

  const title = document.createElement('h2')
  title.className = 'dialog-title'
  title.textContent = 'Metadata Settings'
  titles.appendChild(title)

  const subtitle = document.createElement('p')
  subtitle.className = 'dialog-subtitle'
  subtitle.textContent = 'Inspect and copy metadata directories for the current selection.'
  titles.appendChild(subtitle)
  fields.subtitle = subtitle

  header.appendChild(titles)

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'icon-button dialog-close'
  closeButton.setAttribute('aria-label', 'Close metadata settings')
  closeButton.innerHTML = iconMarkup('close-line', { size: 20 })
  closeButton.addEventListener('click', () => {
    if (dialogHandle) dialogHandle.close()
  })
  header.appendChild(closeButton)

  surfaceEl.appendChild(header)

  const dialogContent = document.createElement('div')
  dialogContent.className = 'dialog-content'
  surfaceEl.appendChild(dialogContent)

  const body = document.createElement('div')
  body.className = 'dialog-body metadata-settings__body'

  function createValueSection(labelText, key, copyHint) {
    const section = document.createElement('section')
    section.className = 'metadata-settings__section'

    const labelEl = document.createElement('h3')
    labelEl.className = 'metadata-settings__label'
    labelEl.textContent = labelText
    section.appendChild(labelEl)

    const valueWrap = document.createElement('div')
    valueWrap.className = 'metadata-settings__value'
    valueWrap.dataset.empty = '1'

    const valueText = document.createElement('span')
    valueText.className = 'metadata-settings__value-text'
    valueWrap.appendChild(valueText)

    const actionsWrap = document.createElement('div')
    actionsWrap.className = 'metadata-settings__actions'
    valueWrap.appendChild(actionsWrap)

    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'icon-button metadata-settings__icon-button metadata-settings__copy'
    copyButton.innerHTML = iconMarkup('file-copy-line')
    copyButton.setAttribute('aria-label', copyHint || 'Copy value')
    copyButton.disabled = true
    if (copyHint) {
      copyButton.dataset.hint = copyHint
      copyButton.title = copyHint
    }
    copyButton.addEventListener('click', async () => {
      if (!currentContext) return
      const target = key === 'meta' ? currentContext.metaPath : currentContext.path
      if (!target) return
      const ok = await copyText(target)
      if (ok) {
        const message = key === 'meta' ? 'Metadata directory copied.' : 'Content path copied.'
        showToast(message, { tone: 'success' })
      } else {
        showToast('Clipboard unavailable.', { tone: 'danger' })
      }
    })
    actionsWrap.appendChild(copyButton)

    section.appendChild(valueWrap)
    body.appendChild(section)

    if (key === 'meta') {
      fields.metaValueWrap = valueWrap
      fields.metaValueText = valueText
      fields.metaCopyButton = copyButton
      fields.metaActionWrap = actionsWrap

      const browseButton = document.createElement('button')
      browseButton.type = 'button'
      browseButton.className = 'icon-button metadata-settings__icon-button metadata-settings__browse'
      browseButton.innerHTML = iconMarkup('folder-open-line')
      browseButton.setAttribute('aria-label', 'Select directory from server')
      browseButton.disabled = true
      browseButton.dataset.hint = 'Select directory from server'
      browseButton.title = 'Select directory from server'
      browseButton.addEventListener('click', () => {
        if (!currentContext) return
        openServerDirectorySelector()
      })
      actionsWrap.appendChild(browseButton)
      fields.metaServerButton = browseButton
    } else {
      fields.contentValueWrap = valueWrap
      fields.contentValueText = valueText
      fields.contentCopyButton = copyButton
      fields.contentActionWrap = actionsWrap
    }
  }

  createValueSection('Metadata Directory', 'meta', 'Copy metadata directory')
  createValueSection('Content Path', 'content', 'Copy content path')

  const note = document.createElement('p')
  note.className = 'metadata-settings__meta-note'
  note.textContent =
    'Metadata directories host highlight automation, LaTeX renders, comments, and other workspace artefacts.'
  body.appendChild(note)

  const detailsSection = document.createElement('section')
  detailsSection.className = 'metadata-settings__section'

  const detailsLabel = document.createElement('h3')
  detailsLabel.className = 'metadata-settings__label'
  detailsLabel.textContent = 'Root Details'
  detailsSection.appendChild(detailsLabel)

  const rootValue = document.createElement('div')
  rootValue.className = 'metadata-settings__details'

  const rootLine = document.createElement('div')
  rootLine.innerHTML = '<strong>Root:</strong> <span class="metadata-settings__root-text">Unknown</span>'
  rootValue.appendChild(rootLine)

  const relativeLine = document.createElement('div')
  relativeLine.innerHTML =
    '<strong>Relative metadata:</strong> <span class="metadata-settings__relative-text">—</span>'
  rootValue.appendChild(relativeLine)

  detailsSection.appendChild(rootValue)
  body.appendChild(detailsSection)

  fields.rootValue = rootLine.querySelector('span.metadata-settings__root-text')
  fields.relativeValue = relativeLine.querySelector('span.metadata-settings__relative-text')
  fields.relativeSection = relativeLine

  dialogContent.appendChild(body)

  const footer = document.createElement('div')
  footer.className = 'dialog-footer metadata-settings__footer'

  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'dialog-button dialog-button--subtle'
  cancelButton.textContent = DEFAULT_CANCEL_LABEL
  cancelButton.addEventListener('click', () => {
    closeMetadataSettingsDialog()
  })
  footer.appendChild(cancelButton)

  const setButton = document.createElement('button')
  setButton.type = 'button'
  setButton.className = 'dialog-button metadata-settings__set'
  setButton.textContent = DEFAULT_CONFIRM_LABEL
  setButton.disabled = true
  setButton.addEventListener('click', handleConfirm)
  footer.appendChild(setButton)

  dialogContent.appendChild(footer)

  fields.footer = footer
  fields.cancelButton = cancelButton
  fields.setButton = setButton

  document.body.appendChild(overlayEl)

  dialogHandle = dialogService.register('metadata-settings', {
    overlay: overlayEl,
    surface: surfaceEl,
    allowBackdropClose: true,
    closeDelay: 220,
    initialFocus: () => fields.metaCopyButton || surfaceEl,
    onClose: () => {
      currentContext = null
      if (fields.metaServerButton) fields.metaServerButton.disabled = true
      if (fields.setButton) {
        delete fields.setButton.dataset.busy
        fields.setButton.disabled = true
        fields.setButton.textContent = DEFAULT_CONFIRM_LABEL
      }
    },
  })
}

function copyText(value) {
  if (!value) return Promise.resolve(false)
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(async () => legacyCopy(value))
  }
  return legacyCopy(value)
}

function legacyCopy(value) {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-1000px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return Promise.resolve(ok)
  } catch {
    return Promise.resolve(false)
  }
}

async function openServerDirectorySelector() {
  if (!fields.metaServerButton || !currentContext) return
  if (fields.metaServerButton.dataset.busy === '1') return

  fields.metaServerButton.dataset.busy = '1'
  fields.metaServerButton.disabled = true

  try {
    const pickerModule = await import('./modal.js?v=20250306')
    const openPicker = pickerModule?.openServerDirectoryPicker
    if (typeof openPicker !== 'function') {
      throw new Error('Server picker unavailable.')
    }
    const initialSelection = {
      rootKey: currentContext.rootKey || 'docRoot',
      path: currentContext.relativePath || '',
    }
    const selection = await openPicker({
      title: 'Browse Server Directories',
      confirmLabel: 'Set',
      selectionMode: 'dir',
      initialSelection,
    })
    if (selection && selection.absolutePath) {
      const newPath = selection.absolutePath
      const ok = await copyText(newPath)
      currentContext.metaPath = newPath
      setValue(fields.metaValueText, fields.metaValueWrap, newPath, newPath)
      setCopyState(fields.metaCopyButton, true)
      if (fields.setButton) fields.setButton.disabled = false
      showToast(ok ? 'Directory path copied.' : 'Directory selected.', {
        tone: ok ? 'success' : 'info',
      })
    }
  } catch (err) {
    console.error('[metadata-settings] openServerDirectorySelector failed', err)
    const message = err?.message || 'Unable to open server picker.'
    showToast(message, { tone: 'danger' })
  } finally {
    delete fields.metaServerButton?.dataset.busy
    if (fields.metaServerButton) fields.metaServerButton.disabled = !currentContext
  }
}

function setValue(target, wrap, value, hint) {
  if (!target || !wrap) return
  const safe = value && String(value).trim() ? String(value).trim() : ''
  target.textContent = safe || '—'
  if (hint) {
    target.dataset.hint = hint
    target.title = hint
  } else {
    delete target.dataset.hint
    target.removeAttribute('title')
  }
  wrap.dataset.empty = safe ? '0' : '1'
}

function setCopyState(button, enabled) {
  if (!button) return
  button.disabled = !enabled
}

function updateDetails(context) {
  if (fields.rootValue) {
    const label = context.rootLabel || 'Not mapped'
    const key = context.rootKey ? ` (${context.rootKey})` : ''
    fields.rootValue.textContent = `${label}${key}`.trim()
  }
  if (fields.relativeValue && fields.relativeSection) {
    const relative = context.relativePath || ''
    const relativeMeta = relative ? deriveMetaDirectory(relative) : ''
    if (relativeMeta) {
      fields.relativeValue.textContent = relativeMeta
      fields.relativeSection.hidden = false
    } else {
      fields.relativeValue.textContent = '—'
      fields.relativeSection.hidden = true
    }
  }
}

export function deriveMetaDirectory(path) {
  if (!path) return ''
  let value = String(path).trim()
  if (!value) return ''
  value = value.replace(/[\\/]+$/, '')
  if (!value) return ''
  return value.endsWith('.meta') ? value : `${value}.meta`
}

export function openMetadataSettingsDialog(context = {}) {
  ensureDialog()

  currentContext = {
    label: context.label || '',
    path: context.path || '',
    metaPath: context.metaPath || deriveMetaDirectory(context.path || ''),
    rootKey: context.rootKey || '',
    rootLabel: context.rootLabel || '',
    relativePath: context.relativePath || '',
    onConfirm: typeof context.onConfirm === 'function' ? context.onConfirm : null,
    confirmLabel:
      typeof context.confirmLabel === 'string' && context.confirmLabel.trim()
        ? context.confirmLabel.trim()
        : DEFAULT_CONFIRM_LABEL,
    cancelLabel:
      typeof context.cancelLabel === 'string' && context.cancelLabel.trim()
        ? context.cancelLabel.trim()
        : DEFAULT_CANCEL_LABEL,
  }

  const displayLabel = currentContext.label || currentContext.path || 'Selection'
  if (fields.subtitle) {
    fields.subtitle.textContent = `Metadata for ${displayLabel}`
  }

  if (fields.cancelButton) fields.cancelButton.textContent = currentContext.cancelLabel
  if (fields.setButton) fields.setButton.textContent = currentContext.confirmLabel

  setValue(
    fields.metaValueText,
    fields.metaValueWrap,
    currentContext.metaPath,
    currentContext.metaPath || undefined,
  )
  setCopyState(fields.metaCopyButton, !!currentContext.metaPath)
  if (fields.metaServerButton) fields.metaServerButton.disabled = false
  if (fields.setButton) fields.setButton.disabled = !currentContext.metaPath

  setValue(fields.contentValueText, fields.contentValueWrap, currentContext.path, currentContext.path)
  setCopyState(fields.contentCopyButton, !!currentContext.path)

  updateDetails(currentContext)

  if (dialogHandle) dialogHandle.open()
}

export function closeMetadataSettingsDialog(immediate = false) {
  if (dialogHandle) dialogHandle.close(immediate)
}
