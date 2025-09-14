// Visualizers registry and mode detection
// Modes:
//  A: Single HTML file
//  B: HTML+CSS+JS file set (no server code)
//  C: Directory docs viewer (current)
//  D: Custom Next.js app

const registry = []

export function registerVisualizer(viz) {
  if (!viz || typeof viz.id !== 'string' || typeof viz.canHandle !== 'function') {
    throw new Error('Invalid visualizer')
  }
  registry.push(viz)
}

export function listVisualizers() {
  return [...registry]
}

// Simplified path info for now; later can include fs hints
// pathInfo: { type: 'file'|'dir'|'app'|null, path: string }
export function detectVisualizer(pathInfo) {
  for (const v of registry) {
    try {
      if (v.canHandle(pathInfo)) return v
    } catch {}
  }
  return null
}

// Helper stubs for future modes A/B/D
function createIframe(container, src, { sandbox = 'allow-scripts allow-same-origin', title = 'Visualizer' } = {}) {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative; height: calc(100vh - 44px);'
  const iframe = document.createElement('iframe')
  iframe.src = src
  iframe.title = title
  iframe.sandbox = sandbox
  iframe.style.cssText = 'width:100%;height:100%;border:0; background: #111;'
  wrapper.appendChild(iframe)
  container.innerHTML = ''
  container.appendChild(wrapper)
  return { wrapper, iframe }
}

export const VisualizerA = {
  id: 'A',
  label: 'Single HTML',
  canHandle: (info) => {
    const p = (info?.path || '').toLowerCase()
    return info?.type === 'file' && p.endsWith('.html')
  },
  mount: async (container, opts = {}) => {
    const sel = opts?.pathInfo || opts?.selected || {}
    const path = sel.path || ''
    const url = `/api/media?path=${encodeURIComponent(path)}&mode=A`
    const { wrapper } = createIframe(container, url, { sandbox: 'allow-scripts allow-same-origin', title: 'HTML (A)' })
    return { unmount: () => { try { wrapper.remove() } catch {} } }
  },
}

export const VisualizerB = {
  id: 'B',
  label: 'HTML+JS/CSS',
  canHandle: (info) => {
    const p = (info?.path || '').toLowerCase()
    // Prefer B if meta.hasJs is true
    if (info?.type === 'file' && p.endsWith('.html') && info?.meta?.hasJs) return true
    return false
  },
  mount: async (container, opts = {}) => {
    const sel = opts?.pathInfo || opts?.selected || {}
    const path = sel.path || ''
    const url = `/api/media?path=${encodeURIComponent(path)}&mode=B`
    const { wrapper } = createIframe(container, url, { sandbox: 'allow-scripts allow-same-origin', title: 'HTML+JS (B)' })
    return { unmount: () => { try { wrapper.remove() } catch {} } }
  },
}

export const VisualizerD = {
  id: 'D',
  label: 'Next.js App',
  canHandle: (info) => info?.type === 'app',
  mount: async (container, opts = {}) => {
    // Minimal: show status pill externally; for now just note selected path
    const sel = opts?.pathInfo || opts?.selected || {}
    const path = sel.path || ''
    const div = document.createElement('div')
    div.style.cssText = 'padding:16px;'
    div.textContent = `Selected Next.js app: ${path}`
    container.innerHTML = ''
    container.appendChild(div)
    return { unmount: () => { try { div.remove() } catch {} } }
  },
}
