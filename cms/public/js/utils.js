// Utility helpers for CMS UI

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function pathAnchor(relPath) {
  return 'file-' + String(relPath || '').replace(/[^a-zA-Z0-9]+/g, '-')
}

const ACRONYMS = new Map(
  [
    'api','ui','ux','utm','csv','json','yaml','yml','html','css','faq','kpi','okr','id','ids','url','http','https','tls','ssl','sql'
  ].map(k => [k, k.toUpperCase()])
)

function applyAcronyms(word) {
  const lw = String(word || '').toLowerCase()
  if (ACRONYMS.has(lw)) return ACRONYMS.get(lw)
  // Simple plural handling (e.g., ids -> IDs)
  if (lw.endsWith('s')) {
    const base = lw.slice(0, -1)
    if (ACRONYMS.has(base)) return ACRONYMS.get(base) + 's'
  }
  return null
}

export function humanizeName(name, type = 'file') {
  let base = String(name || '')
  if (type === 'file') {
    const dot = base.lastIndexOf('.')
    if (dot > 0) base = base.slice(0, dot)
  }
  base = base.replace(/[_\-]+/g, ' ')
  base = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  base = base.replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1 $2')
  base = base.replace(/\s+/g, ' ').trim()
  base = base
    .split(' ')
    .map((w) => {
      if (!w) return w
      const ac = applyAcronyms(w)
      if (ac) return ac
      return w[0].toUpperCase() + w.slice(1)
    })
    .join(' ')
  return base
}

export function displayName(node) {
  const lname = String(node.name || '').toLowerCase()
  if (node.type === 'file' && lname === 'readme.md') return 'Introduction'
  return humanizeName(node.name, node.type)
}
