const ENTITY_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (char) => ENTITY_MAP[char] || char)
}

export function icon(name, options = {}) {
  if (!name || typeof name !== 'string') return ''
  const { spin = false, label = null, className = '', size = null } = options
  const classes = [`ri-${name}`]
  if (spin) classes.push('icon-spin')
  if (className) classes.push(className)
  const attrs = []
  if (label) {
    attrs.push('role="img"')
    attrs.push(`aria-label="${escapeAttr(label)}"`)
  } else {
    attrs.push('aria-hidden="true"')
  }
  if (size) {
    const sizeValue = Number(size)
    if (!Number.isNaN(sizeValue) && sizeValue > 0) {
      const styleValue = `font-size: ${sizeValue}px; line-height: 1;`
      attrs.push(`style="${escapeAttr(styleValue)}"`)
    }
  }
  return `<i class="${classes.join(' ')}" ${attrs.join(' ')}></i>`
}

export function spinnerIcon(options = {}) {
  const { label = null, className = '' } = options
  return icon('loader-4-line', { spin: true, label, className })
}

export function iconOrNull(name, options = {}) {
  const markup = icon(name, options)
  return markup || null
}
