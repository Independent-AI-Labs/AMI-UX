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
function createIframe(
  container,
  src,
  { sandbox = 'allow-scripts allow-same-origin', title = 'Visualizer' } = {},
) {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative; height: calc(100vh - 2.75rem); background: transparent;'
  const iframe = document.createElement('iframe')
  iframe.src = src
  if (title) iframe.setAttribute('aria-label', title)
  iframe.sandbox = sandbox
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write')
  iframe.style.cssText = 'width:100%;height:100%;border:0; background: transparent;'
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
    let path = sel.path || ''
    let rel = path
    let root = 'docRoot'
    const idx = rel.indexOf('files/uploads/')
    if (idx !== -1) {
      rel = rel.slice(idx + 'files/uploads/'.length)
      root = 'uploads'
    } else if (rel.startsWith('/')) {
      try {
        const r = await fetch('/api/config')
        const cfg = r.ok ? await r.json() : null
        const docRoot = cfg?.docRoot || ''
        if (docRoot && rel.startsWith(docRoot)) {
          const cut = docRoot.endsWith('/') ? docRoot.length : (docRoot + '/').length
          rel = rel.slice(cut)
          root = 'docRoot'
        }
      } catch {}
    }
    const url = `/api/media?${new URLSearchParams({ path: rel, mode: 'A', root }).toString()}`
    const { wrapper } = createIframe(container, url, {
      sandbox: 'allow-scripts allow-same-origin',
      title: 'HTML (A)',
    })
    return {
      unmount: () => {
        try {
          wrapper.remove()
        } catch {}
      },
    }
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
    let path = sel.path || ''
    let rel = path
    let root = 'docRoot'
    const idx = rel.indexOf('files/uploads/')
    if (idx !== -1) {
      rel = rel.slice(idx + 'files/uploads/'.length)
      root = 'uploads'
    } else if (rel.startsWith('/')) {
      try {
        const r = await fetch('/api/config')
        const cfg = r.ok ? await r.json() : null
        const docRoot = cfg?.docRoot || ''
        if (docRoot && rel.startsWith(docRoot)) {
          const cut = docRoot.endsWith('/') ? docRoot.length : (docRoot + '/').length
          rel = rel.slice(cut)
          root = 'docRoot'
        }
      } catch {}
    }
    const url = `/api/media?${new URLSearchParams({ path: rel, mode: 'B', root }).toString()}`
    const { wrapper } = createIframe(container, url, {
      sandbox: 'allow-scripts allow-same-origin',
      title: 'HTML+JS (B)',
    })
    return {
      unmount: () => {
        try {
          wrapper.remove()
        } catch {}
      },
    }
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
    div.style.cssText = 'padding:1rem;'
    div.textContent = `Selected Next.js app: ${path}`
    container.innerHTML = ''
    container.appendChild(div)
    return {
      unmount: () => {
        try {
          div.remove()
        } catch {}
      },
    }
  },
}
