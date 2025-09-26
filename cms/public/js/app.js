import './auth-fetch.js'

import {
  registerVisualizer,
  detectVisualizer,
  VisualizerA,
  VisualizerB,
  VisualizerD,
} from './visualizers.js'
import { startCms } from './main.js'

// Wrap current Docs viewer as VisualizerC
const VisualizerC = {
  id: 'C',
  label: 'Docs Directory',
  canHandle: (info) => !info || info.type === 'dir' || !info.type,
  mount: async (_container, _opts = {}) => {
    return startCms()
  },
}

// Register built-ins (C first so it wins as default)
registerVisualizer(VisualizerC)
registerVisualizer(VisualizerA)
registerVisualizer(VisualizerB)
registerVisualizer(VisualizerD)

async function boot() {
  // Load config and determine selection
  let cfg = null
  try {
    const res = await fetch('/api/config')
    if (res.ok) cfg = await res.json()
  } catch {}

  let pathInfo = null
  if (cfg?.selected && cfg.selected.path) {
    pathInfo = { ...cfg.selected }
    // Optionally fetch pathinfo meta for better detection
    try {
      const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(cfg.selected.path)}`)
      if (r.ok) {
        const meta = await r.json()
        pathInfo.meta = meta
      }
    } catch {}
  } else {
    pathInfo = { type: 'dir', path: cfg?.docRoot || '' }
  }

  // Choose visualizer: prefer selected.mode when set
  let viz = null
  if (pathInfo?.mode) {
    const id = pathInfo.mode
    viz = [VisualizerA, VisualizerB, VisualizerC, VisualizerD].find((v) => v.id === id) || null
  }
  if (!viz) viz = detectVisualizer(pathInfo) || VisualizerC

  const handle = await viz.mount(document.body, { pathInfo })
  window.__App__ = { visualizer: viz.id, handle }
  updateStatusPill(viz.id, pathInfo)
}

boot().catch((err) => {
  console.error('Failed to boot app', err)
  const el = document.getElementById('content') || document.body
  if (el) el.textContent = 'Failed to initialize viewer.'
})

// Status pill (basic)
async function updateStatusPill(mode, info) {
  const pill = document.getElementById('statusPill')
  if (!pill) return
  if (mode === 'D' && info?.path) {
    try {
      const r = await fetch(`/api/app/status?path=${encodeURIComponent(info.path)}`)
      if (r.ok) {
        const s = await r.json()
        pill.textContent = s.running ? 'App: Running' : 'App: Not running'
        pill.title = s.message || ''
        return
      }
    } catch {}
    pill.textContent = 'App: Unknown'
  } else {
    // C: show SSE connected later; A/B: static
    pill.textContent = mode ? `Mode ${mode}` : ''
  }
}

// Wire Select Media… button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('selectMediaBtn')
  if (!btn) return
  btn.addEventListener('click', async () => {
    try {
      const mod = await import('./modal.js')
      const openSelectMediaModal = mod && mod.openSelectMediaModal
      if (typeof openSelectMediaModal !== 'function') throw new Error('modal not loaded')
      openSelectMediaModal({
        onSelect: async (entry) => {
          try {
            await fetch('/api/config', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ selected: entry }),
            })
          } catch {}
          location.reload()
        },
      })
    } catch (err) {
      console.error('Failed to open Select Media modal', err)
      alert('Failed to open Select Media modal. See console for details.')
    }
  })
})
