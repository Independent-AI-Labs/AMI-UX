import { icon } from './icon-pack.js?v=20250306'

const DEFAULT_TIMEOUT = 3600
const DISMISS_TIMEOUT = 220
const STACK_GAP = 12
const TEXTURE_KEY = '__cmsToastTexture__'

const TONE_META = {
  success: { className: 'toast-message--success', icon: 'checkbox-circle-line' },
  info: { className: 'toast-message--info', icon: 'information-line' },
  danger: { className: 'toast-message--danger', icon: 'close-circle-line' },
  warning: { className: 'toast-message--warning', icon: 'alert-line' },
}

let counter = 0

function ensureBody(doc) {
  if (!doc) return null
  if (doc.body) return doc.body
  doc.addEventListener(
    'DOMContentLoaded',
    () => {
      if (doc.body) layoutToasts(doc)
    },
    { once: true },
  )
  return null
}

function renderIcon(doc, glyph, size = 28) {
  const span = doc.createElement('span')
  span.className = 'toast-message__icon'
  span.setAttribute('aria-hidden', 'true')
  span.innerHTML = icon(glyph, { size })
  return span
}

function renderDismissButton(doc, dismiss) {
  const btn = doc.createElement('button')
  btn.type = 'button'
  btn.className = 'toast-message__dismiss'
  btn.setAttribute('aria-label', 'Dismiss notification')
  btn.innerHTML = icon('close-line', { size: 24 })
  btn.addEventListener('click', (event) => {
    event.preventDefault()
    dismiss()
  })
  return btn
}

function scheduleVisibility(toast, doc, onVisible) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('is-visible')
        layoutToasts(doc)
        onVisible?.()
      })
    })
  } else {
    setTimeout(() => {
      toast.classList.add('is-visible')
      layoutToasts(doc)
      onVisible?.()
    }, 16)
  }
}

function layoutToasts(doc) {
  if (!doc) return
  const toasts = Array.from(
    doc.querySelectorAll('.toast-message[data-toast-active="1"]'),
  ).sort((a, b) => {
    const ao = Number.parseInt(a.dataset.toastOrder || '0', 10)
    const bo = Number.parseInt(b.dataset.toastOrder || '0', 10)
    return ao - bo
  })
  let offset = 0
  for (const toast of toasts) {
    toast.style.setProperty('--toast-offset', `${offset}px`)
    const rect = toast.getBoundingClientRect()
    const height = rect.height || toast.offsetHeight || 0
    offset += height + STACK_GAP
  }
}

function createToastTexture(doc) {
  try {
    const canvas = doc.createElement('canvas')
    canvas.width = 720
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(14, 18, 28, 0.45)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.globalCompositeOperation = 'lighter'

    const swirl = ctx.createRadialGradient(canvas.width * 0.35, canvas.height * 0.25, 0, canvas.width * 0.35, canvas.height * 0.25, canvas.width * 0.85)
    swirl.addColorStop(0, 'rgba(122, 162, 247, 0.55)')
    swirl.addColorStop(0.55, 'rgba(122, 162, 247, 0.18)')
    swirl.addColorStop(1, 'rgba(122, 162, 247, 0)')
    ctx.fillStyle = swirl
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const glow = ctx.createRadialGradient(canvas.width * 0.78, canvas.height * 0.9, 0, canvas.width * 0.78, canvas.height * 0.9, canvas.width * 0.9)
    glow.addColorStop(0, 'rgba(162, 195, 255, 0.55)')
    glow.addColorStop(0.45, 'rgba(162, 195, 255, 0.2)')
    glow.addColorStop(1, 'rgba(162, 195, 255, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.globalCompositeOperation = 'source-over'

    const rim = ctx.createLinearGradient(0, 0, 0, canvas.height)
    rim.addColorStop(0, 'rgba(255, 255, 255, 0.08)')
    rim.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)')
    rim.addColorStop(1, 'rgba(255, 255, 255, 0.08)')
    ctx.fillStyle = rim
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.globalCompositeOperation = 'destination-out'
    const mask = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      canvas.height * 0.05,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.65,
    )
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)')
    mask.addColorStop(0.55, 'rgba(0, 0, 0, 0)')
    mask.addColorStop(0.78, 'rgba(0, 0, 0, 0.45)')
    mask.addColorStop(1, 'rgba(0, 0, 0, 1)')
    ctx.fillStyle = mask
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.globalCompositeOperation = 'source-over'

    return canvas.toDataURL('image/png')
  } catch (err) {
    console.error('toast texture generation failed', err)
    return null
  }
}

function ensureToastTexture(doc) {
  if (!doc) return null
  if (doc[TEXTURE_KEY]) return doc[TEXTURE_KEY]
  const url = createToastTexture(doc)
  if (url) doc[TEXTURE_KEY] = url
  return url
}

export function showToast(message, options = {}) {
  const content = typeof message === 'string' ? message.trim() : ''
  if (!content) return null
  const doc = options.document || document
  const body = ensureBody(doc)
  if (!body) {
    setTimeout(() => showToast(content, options), 30)
    return null
  }

  const tone = options.tone && TONE_META[options.tone] ? options.tone : 'info'
  const meta = TONE_META[tone]
  const toast = doc.createElement('div')
  toast.className = `toast-message ${meta.className}`
  toast.setAttribute('role', 'alert')
  const order = ++counter
  toast.dataset.toastId = `${Date.now().toString(36)}-${order}`
  toast.dataset.toastOrder = `${order}`
  toast.dataset.toastActive = '1'

  const label = doc.createElement('span')
  label.className = 'toast-message__label'
  label.textContent = content

  const dismiss = () => {
    if (toast.classList.contains('is-hiding')) return
    toast.classList.remove('is-visible')
    toast.classList.add('is-hiding')
    clearTimeout(timerRef.id)
    const remove = () => {
      toast.dataset.toastActive = '0'
      if (toast.parentElement) toast.parentElement.removeChild(toast)
      layoutToasts(doc)
    }
    setTimeout(remove, DISMISS_TIMEOUT)
  }

  toast.appendChild(renderIcon(doc, meta.icon))
  toast.appendChild(label)
  toast.appendChild(renderDismissButton(doc, dismiss))

  const texture = ensureToastTexture(doc)
  if (texture) toast.style.setProperty('--toast-texture', `url("${texture}")`)

  const timerRef = { id: 0 }
  const startTimer = () => {
    const duration = Number.isFinite(options.duration) ? options.duration : DEFAULT_TIMEOUT
    if (duration <= 0) return
    timerRef.id = setTimeout(dismiss, duration)
  }

  const clearTimer = () => {
    if (timerRef.id) {
      clearTimeout(timerRef.id)
      timerRef.id = 0
    }
  }

  toast.addEventListener('mouseenter', clearTimer)
  toast.addEventListener('mouseleave', startTimer)
  toast.addEventListener('focusin', clearTimer)
  toast.addEventListener('focusout', startTimer)

  body.appendChild(toast)
  layoutToasts(doc)
  scheduleVisibility(toast, doc, startTimer)

  return { dismiss }
}

export function _layoutToastsForTesting(doc = document) {
  layoutToasts(doc)
}
