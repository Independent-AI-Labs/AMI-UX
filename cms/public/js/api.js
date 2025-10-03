// API helpers

export async function fetchConfig() {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function fetchTree(rootKey, options = {}) {
  if (!rootKey) throw new Error('rootKey is required')
  const params = new URLSearchParams({ root: rootKey })
  if (options.mode) params.set('mode', options.mode)
  if (options.path) params.set('path', options.path)
  const url = `/api/tree?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch tree')
  return res.json()
}

export async function fetchTreeChildren(rootKey, path = '') {
  return fetchTree(rootKey, { mode: 'children', path })
}

export async function fetchFile(relPath, rootKey, options = {}) {
  if (!rootKey) throw new Error('rootKey is required')
  const params = new URLSearchParams({ path: relPath, root: rootKey })
  const res = await fetch('/api/file?' + params.toString())
  if (!res.ok) throw new Error('Failed to fetch file ' + relPath)
  const format = options.format || 'text'
  switch (format) {
    case 'json':
      return res.json()
    case 'blob':
      return res.blob()
    case 'arrayBuffer':
      return res.arrayBuffer()
    default:
      return res.text()
  }
}

export async function fetchLibrary() {
  const res = await fetch('/api/library')
  if (!res.ok) throw new Error('Failed to fetch library')
  return res.json()
}
