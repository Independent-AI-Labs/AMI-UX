// API helpers

export async function fetchConfig() {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function setDocRoot(pathStr) {
  // Robust retry: Next.js dev can transiently respond with a placeholder
  // HTML ("missing required error components, refreshing...") during an
  // initial compile/hot-reload window. Retry a few times before surfacing.
  const maxAttempts = 5
  const baseBody = { docRoot: pathStr }
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

export async function fetchTree() {
  const res = await fetch('/api/tree')
  if (!res.ok) throw new Error('Failed to fetch tree')
  return res.json()
}

export async function fetchFile(relPath) {
  const res = await fetch('/api/file?path=' + encodeURIComponent(relPath))
  if (!res.ok) throw new Error('Failed to fetch file ' + relPath)
  return res.text()
}
