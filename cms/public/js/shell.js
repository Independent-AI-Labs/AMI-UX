import { registerVisualizer, detectVisualizer, VisualizerA, VisualizerB, VisualizerD } from './visualizers.js'
import { openSelectMediaModal } from './modal.js'

// Visualizer C: iframe to doc.html embed
const VisualizerC = {
  id: 'C',
  label: 'Docs Directory',
  canHandle: (info) => !info || info.type === 'dir' || !info.type,
  mount: async (container, opts = {}) => {
    const sel = opts?.pathInfo || opts?.selected || {}
    const path = sel.path || ''
    const iframe = document.getElementById('vizFrame')
    if (iframe) iframe.src = '/doc.html?embed=1'
    return { unmount: () => {} }
  },
}

registerVisualizer(VisualizerC)
registerVisualizer(VisualizerA)
registerVisualizer(VisualizerB)
registerVisualizer(VisualizerD)

function setLabels(_vizId, _info) {
  // Intentionally blank: no noisy mode/path in header
  const modeLabel = document.getElementById('modeLabel')
  const pathLabel = document.getElementById('pathLabel')
  if (modeLabel) modeLabel.textContent = ''
  if (pathLabel) pathLabel.textContent = ''
}

async function loadConfig() {
  try { const r = await fetch('/api/config'); if (r.ok) return r.json() } catch {}
  return null
}

const tabsState = { tabs: [], active: null }

async function saveTabs() {
  try {
    const payload = { openTabs: tabsState.tabs.map(({ id, entryId, kind, path, label, servedId, mode }) => ({ id, entryId: entryId || null, kind, path, label: label || null, servedId: servedId || null, mode: mode || undefined })), activeTabId: tabsState.active }
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {}
}

function iconSvg(kind) {
  if (kind === 'dir') return '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z"></path>'
  if (kind === 'app') return '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 20V4"></path>'
  return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>'
}

function renderTabs() {
  const bar = document.getElementById('tabsBar')
  if (!bar) return
  bar.innerHTML = ''
  tabsState.tabs.forEach((t) => {
    const el = document.createElement('button')
    el.className = 'tab' + (tabsState.active === t.id ? ' active' : '')
    el.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconSvg(t.kind)}</svg><span>${(t.label || t.path.split('/').pop() || t.path)}</span>${t.servedId ? '<span class="pill" title="Served">●</span>' : ''}<span class="close" title="Close">×</span>`
    el.addEventListener('click', (e) => { if ((e.target).classList && (e.target).classList.contains('close')) { closeTab(t.id) } else { activateTab(t.id) } })
    bar.appendChild(el)
  })
}

function closeTab(id) {
  const idx = tabsState.tabs.findIndex((x) => x.id === id)
  if (idx === -1) return
  tabsState.tabs.splice(idx, 1)
  if (tabsState.active === id) tabsState.active = tabsState.tabs[0]?.id || null
  renderTabs()
  if (tabsState.active) activateTab(tabsState.active)
  else document.getElementById('vizFrame').src = 'about:blank'
  saveTabs()
}

async function activateTab(id) {
  const tab = tabsState.tabs.find((x) => x.id === id)
  if (!tab) return
  tabsState.active = id
  renderTabs()
  // apply iframe source
  const iframe = document.getElementById('vizFrame')
  let usedServed = false
  if (tab.servedId) {
    try {
      const r = await fetch(`/api/serve/${tab.servedId}`)
      if (r.ok) { const inst = await r.json(); if (inst?.status === 'running') { iframe.src = `/api/served/${tab.servedId}/`; usedServed = true } }
    } catch {}
  }
  if (!usedServed) {
    if (tab.servedId) { tab.servedId = null; renderTabs() }
    if (tab.kind === 'dir') {
      iframe.src = '/doc.html?embed=1'
      setTimeout(() => { try { iframe.contentWindow.postMessage({ type: 'setDocRoot', path: tab.path }, '*') } catch {} }, 50)
    } else if (tab.kind === 'file') {
      const mode = tab.mode || 'A'
      iframe.src = `/api/media?path=${encodeURIComponent(tab.path)}&mode=${mode}`
    } else if (tab.kind === 'app') {
      iframe.src = 'about:blank'
    }
  }
  try {
    const vizId = usedServed ? (tab.kind === 'dir' ? 'C' : tab.kind === 'app' ? 'D' : (tab.mode || '')) : (tab.kind === 'dir' ? 'C' : tab.kind === 'app' ? 'D' : (tab.mode || ''))
    setLabels(vizId, { path: tab.path })
  } catch {}
  saveTabs()
}

async function ensureModeForFile(p) {
  try { const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(p)}`); if (r.ok) { const j = await r.json(); return j.hasJs ? 'B' : 'A' } } catch {}
  return 'A'
}

async function openEntry(entry) {
  // Check if already served
  let servedId = null
  try {
    const r = await fetch('/api/serve'); if (r.ok) { const data = await r.json(); const inst = (data.instances||[]).find((i) => i.entryId === entry.id && i.status === 'running'); if (inst) servedId = inst.id }
  } catch {}
  const tabId = `${entry.id}-${Date.now()}`
  const tab = { id: tabId, entryId: entry.id, kind: entry.kind, path: entry.path, label: entry.label || null, servedId, mode: null }
  if (entry.kind === 'file') tab.mode = await ensureModeForFile(entry.path)
  tabsState.tabs.push(tab)
  activateTab(tabId)
  saveTabs()
}

async function boot() {
  // Theme init
  try {
    const saved = localStorage.getItem('theme')
    const theme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    const icon = document.getElementById('iconTheme')
    if (icon) {
      // crescent for dark (current icon), sun icon swapped in light
      if (theme === 'light') icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
    }
  } catch {}

  const cfg = await loadConfig()
  let pathInfo = null
  if (cfg?.selected && cfg.selected.path) {
    pathInfo = { ...cfg.selected }
    try { const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(cfg.selected.path)}`); if (r.ok) pathInfo.meta = await r.json() } catch {}
  } else {
    pathInfo = { type: 'dir', path: cfg?.docRoot || '' }
  }
  let viz = null
  if (pathInfo?.mode) viz = [VisualizerA, VisualizerB, VisualizerC, VisualizerD].find(v => v.id === pathInfo.mode) || null
  if (!viz) viz = detectVisualizer(pathInfo) || VisualizerC
  // Defer iframe initialization to tabs restoration/seed logic below

  // Search wiring to embedded doc viewer
  const search = document.getElementById('globalSearch')
  if (search) {
    search.addEventListener('input', () => {
      try { document.getElementById('vizFrame')?.contentWindow?.postMessage({ type: 'search', q: search.value }, '*') } catch {}
    })
    window.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus() } })
  }

  // Header buttons: expand/collapse/theme
  document.getElementById('btnExpand')?.addEventListener('click', () => {
    try { document.getElementById('vizFrame')?.contentWindow?.postMessage({ type: 'expandAll' }, '*') } catch {}
  })
  document.getElementById('btnCollapse')?.addEventListener('click', () => {
    try { document.getElementById('vizFrame')?.contentWindow?.postMessage({ type: 'collapseAll' }, '*') } catch {}
  })
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    try {
      const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
      const next = cur === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
      // swap icon
      const icon = document.getElementById('iconTheme')
      if (icon) {
        icon.innerHTML = next === 'light'
          ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
          : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
      }
      document.getElementById('vizFrame')?.contentWindow?.postMessage({ type: 'applyTheme', theme: next }, '*')
    } catch {}
  })

  // Glow effect is always on; no UI toggle.

  // Restore tabs if present, else seed from config/docRoot
  const cfgTabs = await loadConfig()
  if (cfgTabs?.openTabs && Array.isArray(cfgTabs.openTabs) && cfgTabs.openTabs.length) {
    tabsState.tabs = cfgTabs.openTabs.map((t) => ({ id: t.id, entryId: t.entryId || null, kind: t.kind, path: t.path, label: t.label || null, servedId: t.servedId || null, mode: t.mode }))
    tabsState.active = cfgTabs.activeTabId || (tabsState.tabs[0]?.id || null)
    renderTabs()
    if (tabsState.active) activateTab(tabsState.active)
  } else {
    const cfg2 = await loadConfig()
    let p = ''
    let kind = 'dir'
    let mode = undefined
    if (cfg2?.selected && cfg2.selected.path) {
      p = cfg2.selected.path
      try { const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(p)}`); if (r.ok) { const j = await r.json(); if (j.type === 'file') { kind = 'file'; mode = await ensureModeForFile(p) } else if (j.type === 'app') { kind = 'app' } else { kind = 'dir' } } } catch {}
    } else { p = cfg2?.docRoot || ''; kind = 'dir' }
    const tab = { id: `seed-${Date.now()}`, entryId: null, kind, path: p, label: null, servedId: null, mode }
    tabsState.tabs = [tab]
    tabsState.active = tab.id
    renderTabs()
    activateTab(tab.id)
    if (kind === 'dir') { try { await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docRoot: p }) }) } catch {} }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  boot().catch((err) => console.error('boot failed', err))
  const btn = document.getElementById('selectMediaBtn')
  if (btn) btn.addEventListener('click', async () => {
    openSelectMediaModal({ onSelect: async (entry) => {
      if (entry && entry.id) return openEntry(entry)
      if (entry && entry.path) {
        // Fallback for non-library selection: add to library and open
        try { await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: entry.path }) }) } catch {}
        try { const r = await fetch('/api/library'); if (r.ok) { const j = await r.json(); const found = (j.entries||[]).find((e) => e.path === entry.path); if (found) return openEntry(found) } } catch {}
      }
    } })
  })
})
