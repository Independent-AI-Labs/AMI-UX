// API helpers

export async function fetchConfig() {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function setDocRoot(pathStr, options = {}) {
  // Robust retry: Next.js dev can transiently respond with a placeholder
  // HTML ("missing required error components, refreshing...") during an
  // initial compile/hot-reload window. Retry a few times before surfacing.
  const maxAttempts = 5
  const baseBody = { docRoot: pathStr }
  if (Object.prototype.hasOwnProperty.call(options, 'label')) {
    const label = options.label
    if (label === null) baseBody.docRootLabel = null
    else if (typeof label === 'string' && label.trim()) baseBody.docRootLabel = label.trim()
  }
  let lastText = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    }).catch(() => null)
    if (res && res.ok) return res.json()
    try { lastText = res ? await res.text() : '' } catch { lastText = '' }
    const transient = /missing required error components/i.test(lastText) || (res && res.status >= 500)
    if (attempt < maxAttempts && transient) {
      await new Promise(r => setTimeout(r, 600))
      continue
    }
    break
  }
  throw new Error('Failed to set doc root: ' + lastText)
}

export async function fetchTree(rootKey = 'docRoot') {
  const params = new URLSearchParams()
  if (rootKey && rootKey !== 'docRoot') params.set('root', rootKey)
  const query = params.toString()
  const url = query ? `/api/tree?${query}` : '/api/tree'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch tree')
  return res.json()
}

export async function fetchFile(relPath) {
  const res = await fetch('/api/file?path=' + encodeURIComponent(relPath))
  if (!res.ok) throw new Error('Failed to fetch file ' + relPath)
  return res.text()
}
