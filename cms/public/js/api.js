// API helpers

export async function fetchConfig() {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function setDocRoot(pathStr) {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docRoot: pathStr }),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error('Failed to set doc root: ' + msg)
  }
  return res.json()
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

