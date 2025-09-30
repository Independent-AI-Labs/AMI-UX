export const HINT_ATTR = 'data-hint'
export const HINT_TONE_ATTR = 'data-hint-tone'

function normaliseText(value) {
  if (value == null) return ''
  const str = typeof value === 'string' ? value : String(value)
  return str.trim()
}

export function setHint(element, text, options = {}) {
  if (!element || typeof element !== 'object') return element
  const normalised = normaliseText(text)
  try {
    if (typeof element.removeAttribute === 'function') element.removeAttribute('title')
  } catch {}
  if (!normalised) {
    try {
      if (element.dataset) {
        delete element.dataset.hint
        delete element.dataset.hintTone
      } else {
        element.removeAttribute?.(HINT_ATTR)
        element.removeAttribute?.(HINT_TONE_ATTR)
      }
      if (options.clearAriaLabel && typeof element.removeAttribute === 'function') {
        element.removeAttribute('aria-label')
      }
    } catch {}
    return element
  }
  try {
    if (element.dataset) {
      element.dataset.hint = normalised
      if (options.tone) element.dataset.hintTone = options.tone
      else delete element.dataset.hintTone
    } else {
      element.setAttribute?.(HINT_ATTR, normalised)
      if (options.tone) element.setAttribute?.(HINT_TONE_ATTR, options.tone)
      else element.removeAttribute?.(HINT_TONE_ATTR)
    }
    if (
      typeof element.getAttribute !== 'function' ||
      !element.getAttribute('aria-label') ||
      options.replaceAriaLabel
    ) {
      element.setAttribute?.('aria-label', normalised)
    }
  } catch {}
  return element
}

export function withHintProps(text, props = {}, options = {}) {
  const next = props ? { ...props } : {}
  if ('title' in next) delete next.title
  const normalised = normaliseText(text)
  if (!normalised) {
    delete next[HINT_ATTR]
    delete next[HINT_TONE_ATTR]
    if (options.clearAriaLabel) delete next['aria-label']
    return next
  }
  next[HINT_ATTR] = normalised
  if (options.tone) next[HINT_TONE_ATTR] = options.tone
  else delete next[HINT_TONE_ATTR]
  if (!next['aria-label'] || options.replaceAriaLabel) next['aria-label'] = normalised
  return next
}
