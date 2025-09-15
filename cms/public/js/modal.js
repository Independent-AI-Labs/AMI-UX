// React-based Select Media Modal
import { humanizeName } from './utils.js'
async function ensureReact() {
  if (window.React && window.ReactDOM) return { React: window.React, ReactDOM: window.ReactDOM }
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.crossOrigin = 'anonymous'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  // Use CDN consistent with other libs in this app
  await load('https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js')
  await load('https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js')
  return { React: window.React, ReactDOM: window.ReactDOM }
}

// Overhauled: openSelectMediaModal now opens a Library drawer
export async function openSelectMediaModal({ onSelect } = {}) {
  const { React, ReactDOM } = await ensureReact()
  const { useEffect, useMemo, useRef, useState } = React
  // Icons
  const Icon = ({ name }) => {
    const paths = {
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
      folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z"></path>',
      app: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 20V4"><\/path>'
    }
    const svg = paths[name] || paths.file
    return React.createElement('span', { dangerouslySetInnerHTML: { __html: `<svg class="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>` } })
  }

  function Row({ entry, status, selected, busy, onOpen, onContext, onStart, onStop }) {
    const base = entry.path.split('/').pop() || entry.path
    const label = entry.label || (entry.kind === 'file' ? humanizeName(base, 'file') : base)
    const kind = entry.kind
    // Controls: fast, compact buttons with optimistic UI
    const controls = (() => {
      const isStarting = status === 'starting'
      const isOn = status === 'running'
      const onClick = (e) => { e.stopPropagation(); if (isStarting) return; (isOn ? onStop : onStart)(entry) }
      if (isStarting) {
        return React.createElement('span', { className: 'muted', title: 'Starting…', style: { display: 'inline-flex', alignItems: 'center' } },
          React.createElement('svg', { viewBox: '0 0 50 50', width: 16, height: 16, style: { animation: 'spin 1s linear infinite' } },
            React.createElement('circle', { cx: 25, cy: 25, r: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeDasharray: '31.4 31.4', strokeLinecap: 'round' })
          )
        )
      }
      const svg = isOn
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="8 5 19 12 8 19 8 5"/></svg>'
      return React.createElement('button', {
        className: 'btn', onClick, title: isOn ? 'Stop serving' : 'Start serving',
        style: { padding: '4px 6px', borderRadius: 999 }
      }, React.createElement('span', { dangerouslySetInnerHTML: { __html: svg } }))
    })()
    const [hovered, setHovered] = useState(false)
    const spinner = React.createElement('svg', { viewBox: '0 0 50 50', width: 16, height: 16, style: { marginLeft: 8, animation: 'spin 1s linear infinite' } },
      React.createElement('circle', { cx: 25, cy: 25, r: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeDasharray: '31.4 31.4', strokeLinecap: 'round' })
    )
    return React.createElement('div', {
      className: 'row',
      onDoubleClick: () => onOpen(entry),
      onContextMenu: (e) => { e.preventDefault(); onContext(e, entry) },
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
        borderBottom: '1px solid var(--border)', cursor: 'default',
        background: selected ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : (hovered ? 'color-mix(in oklab, var(--accent) 6%, transparent)' : 'transparent')
      }
    },
      React.createElement(Icon, { name: kind === 'dir' ? 'folder' : (kind === 'app' ? 'app' : 'file') }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 } }, label),
          controls,
          busy && spinner,
        ),
        React.createElement('div', { style: { color: 'var(--muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, entry.path),
      ),
    )
  }

  function ContextMenu({ x, y, serving, onClose, onPick, onStart, onStop, onRename, onCopyPath, onDeleteLib, onDeleteDisk }) {
    const startDisabled = !!serving
    const stopDisabled = !serving
    const vpW = window.innerWidth || 1200
    const vpH = window.innerHeight || 800
    const left = Math.min(x, vpW - 220)
    const top = Math.min(y, vpH - 180)
    const mkItem = (key, label, action, disabled = false) => React.createElement(
      'div',
      {
        key,
        className: 'ctx',
        onClick: (e) => { e.stopPropagation(); if (!disabled) { action(); onClose() } },
        style: { padding: '8px 10px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }
      },
      label,
    )
    return React.createElement('div', {
      className: 'media-ctx',
      style: {
        position: 'fixed', left, top, zIndex: 1002,
        background: 'var(--panel)', color: 'var(--text)',
        border: '1px solid var(--border)', borderRadius: 6, minWidth: 220,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        pointerEvents: 'auto'
      },
      onContextMenu: (e) => e.preventDefault(),
    },
      mkItem('open', 'Open', onPick),
      mkItem('start', 'Start Serving', onStart, startDisabled),
      mkItem('stop', 'Stop Serving', onStop, stopDisabled),
      mkItem('rename', 'Rename…', onRename, false),
      mkItem('copy', 'Copy Path', onCopyPath, false),
      React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 0' } }),
      mkItem('del', 'Delete from Library', onDeleteLib, false),
      mkItem('deld', 'Delete from Disk', onDeleteDisk, false),
    )
  }

  function Drawer({ onClose }) {
    const [entries, setEntries] = useState([])
    const [filter, setFilter] = useState('')
    const [menu, setMenu] = useState(null)
    const [servingMap, setServingMap] = useState(new Map())
    const [selectedId, setSelectedId] = useState(null)
    const [busyId, setBusyId] = useState(null)
    const [toast, setToast] = useState(null)
    useEffect(() => { let alive = true; (async () => { const r = await fetch('/api/library'); const j = r.ok ? await r.json() : { entries: [] }; if (alive) setEntries(j.entries || []) })(); return () => { alive = false } }, [])
    const filtered = entries.filter(e => !filter || (e.path.toLowerCase().includes(filter.toLowerCase()) || (e.label||'').toLowerCase().includes(filter.toLowerCase())))

    async function addExisting() {
      const p = prompt('Enter absolute or repo-relative path:')
      if (!p) return
      const r = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) })
      if (r.ok) {
        const j = await fetch('/api/library').then(r => r.json()).catch(() => ({ entries: [] }))
        setEntries(j.entries || [])
      } else alert('Failed to add')
    }

    // Close context menu on Escape or click outside
    useEffect(() => {
      if (!menu) return
      const onKey = (e) => { if (e.key === 'Escape') setMenu(null) }
      const onClick = (e) => {
        const t = e.target
        const inMenu = t && typeof t.closest === 'function' && t.closest('.media-ctx')
        if (!inMenu) setMenu(null)
      }
      window.addEventListener('keydown', onKey)
      window.addEventListener('mousedown', onClick)
      return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
    }, [menu])

    // Toast auto-dismiss
    useEffect(() => {
      let t = null
      if (toast) t = setTimeout(() => setToast(null), 2000)
      return () => { if (t) clearTimeout(t) }
    }, [toast])

    // Serving poller
    useEffect(() => {
      let alive = true
      const tick = async () => { if (!alive) return; await refreshServing() }
      refreshServing()
      const h = setInterval(tick, 5000)
      return () => { alive = false; clearInterval(h) }
    }, [])

    async function refreshServing() {
      try {
        const r = await fetch('/api/serve')
        const j = r.ok ? await r.json() : { instances: [] }
        const map = new Map()
        ;(j.instances || []).forEach(i => { map.set(i.entryId, i.status || 'running') })
        setServingMap(map)
      } catch { setServingMap(new Map()) }
    }

    async function uploadNew() {
      const tmp = document.createElement('input')
      tmp.type = 'file'
      tmp.multiple = true
      tmp.onchange = async () => {
        const fd = new FormData()
        Array.from(tmp.files || []).forEach(f => fd.append('file', f, (f && f.webkitRelativePath) ? f.webkitRelativePath : f.name))
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const j = up.ok ? await up.json() : null
        if (j) {
          const files = Array.isArray(j.files) ? j.files : []
          if (files.length === 1) {
            const file = files[0]
            const path = String(file.path || '')
            const name = String(file.name || '')
            const label = humanizeName(name, 'file')
            await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, label, kind: 'file' }) })
          } else {
            const path = `files/uploads/${j.uploadedAt}`
            await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })
          }
          const j2 = await fetch('/api/library').then(r => r.json()).catch(() => ({ entries: [] }))
          setEntries(j2.entries || [])
        }
      }
      tmp.click()
    }

    async function openEntry(e) {
      onSelect?.(e)
      onClose()
    }

    function ctx(e, entry) {
      e.preventDefault()
      setSelectedId(entry.id)
      setMenu({ x: e.clientX, y: e.clientY, entry })
      refreshServing()
    }

    function updateServing(id, status) {
      setServingMap((prev) => { const next = new Map(prev); next.set(id, status); return next })
    }
    async function startServing(entry) {
      // Optimistic update for snappy UX
      updateServing(entry.id, 'starting')
      try {
        const r = await fetch('/api/serve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId: entry.id }) })
        if (!r.ok) throw new Error('start failed')
        updateServing(entry.id, 'running')
        setToast({ kind: 'ok', text: 'Serving started' })
      } catch {
        updateServing(entry.id, 'stopped')
        setToast({ kind: 'err', text: 'Failed to start' })
      }
    }
    async function stopServing(entry) {
      updateServing(entry.id, 'stopped')
      try {
        const list = await fetch('/api/serve').then(r => r.json()).catch(() => ({ instances: [] }))
        const inst = (list.instances || []).find((i) => i.entryId === entry.id)
        if (!inst) return
        await fetch(`/api/serve/${inst.id}`, { method: 'DELETE' })
        setToast({ kind: 'ok', text: 'Serving stopped' })
      } catch {
        updateServing(entry.id, 'running')
        setToast({ kind: 'err', text: 'Failed to stop' })
      }
    }
    async function delLib(entry) {
      setBusyId(entry.id)
      try { await fetch(`/api/library/${entry.id}`, { method: 'DELETE' }); setEntries((ents) => ents.filter((x) => x.id !== entry.id)); setToast({ kind: 'ok', text: 'Removed from Library' }) }
      catch { setToast({ kind: 'err', text: 'Failed to remove' }) }
      finally { setBusyId(null) }
    }
    async function delDisk(entry) {
      if (!confirm('Delete files from disk?')) return
      setBusyId(entry.id)
      try { await fetch(`/api/library/${entry.id}/delete`, { method: 'POST' }); setEntries((ents) => ents.filter((x) => x.id !== entry.id)); setToast({ kind: 'ok', text: 'Deleted from disk' }) }
      catch { setToast({ kind: 'err', text: 'Failed to delete' }) }
      finally { setBusyId(null) }
    }

    return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' } },
      React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto' } }),
      React.createElement('div', { style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '560px', maxWidth: '95vw', background: 'var(--panel)', color: 'var(--text)', borderLeft: '1px solid var(--border)', boxShadow: '0 0 30px rgba(0,0,0,0.4)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--border)' } },
          React.createElement('strong', null, 'Media Library'),
          React.createElement('input', { placeholder: 'Filter…', value: filter, onChange: (e) => setFilter(e.target.value), style: { marginLeft: 'auto', flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' } }),
          React.createElement('button', { className: 'btn', onClick: uploadNew, title: 'Upload New', 'aria-label': 'Upload New' },
            React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' } })
          ),
          React.createElement('button', { className: 'btn', onClick: addExisting, title: 'Add Existing', 'aria-label': 'Add Existing' },
            React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="9" x2="12" y2="15"></line><line x1="9" y1="12" x2="15" y2="12"></line></svg>' } })
          ),
          React.createElement('button', { className: 'btn', onClick: onClose, title: 'Close', 'aria-label': 'Close' },
            React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' } })
          ),
        ),
        React.createElement('div', { style: { flex: 1, overflow: 'auto' } },
          ...filtered.map((e) => React.createElement(Row, {
            key: e.id, entry: e,
            status: servingMap.get(e.id) || 'idle', selected: selectedId === e.id, busy: busyId === e.id,
            onOpen: openEntry, onContext: ctx,
            onStart: startServing, onStop: stopServing,
          })),
        ),
        toast && React.createElement('div', { style: { padding: '8px 10px', borderTop: '1px solid var(--border)', background: toast.kind === 'ok' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: 'var(--text)' } }, toast.text),
      ),
      menu && React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 1001, pointerEvents: 'auto' }, onClick: () => setMenu(null) }),
      menu && React.createElement(ContextMenu, {
        x: menu.x, y: menu.y,
        serving: (servingMap.get(menu.entry.id) || 'stopped') === 'running',
        onClose: () => setMenu(null),
        onPick: () => openEntry(menu.entry),
        onStart: async () => { await startServing(menu.entry); await refreshServing() },
        onStop: async () => { await stopServing(menu.entry); await refreshServing() },
        onRename: async () => {
          const cur = menu.entry.label || ''
          const next = prompt('New label:', cur)
          if (next == null) return
          await fetch(`/api/library/${menu.entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: next }) })
          const j = await fetch('/api/library').then(r => r.json()).catch(() => ({ entries: [] }))
          setEntries(j.entries || [])
        },
        onCopyPath: async () => {
          const p = menu.entry.path
          try { await navigator.clipboard.writeText(p) } catch {}
        },
        onDeleteLib: () => delLib(menu.entry),
        onDeleteDisk: () => delDisk(menu.entry),
      })
    )
  }

  function RecentTab({ onPick }) {
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState([])
    useEffect(() => {
      let alive = true
      ;(async () => {
        try {
          const r = await fetch('/api/config')
          const cfg = r.ok ? await r.json() : {}
          if (!alive) return
          setItems(Array.isArray(cfg.recents) ? cfg.recents : [])
        } catch { setItems([]) }
        setLoading(false)
      })()
      return () => { alive = false }
    }, [])
    if (loading) return React.createElement('div', { className: 'muted' }, 'Loading…')
    if (!items.length) return React.createElement('div', { className: 'muted' }, 'No recent entries.')
    return React.createElement(
      'div',
      null,
      ...items.map((e, i) => React.createElement('button', {
        key: i,
        className: 'btn',
        style: { display: 'block', width: '100%', textAlign: 'left', margin: '6px 0' },
        title: e.path,
        onClick: () => onPick(e),
      }, `[${e.mode || e.type}] ${e.path}`)),
    )
  }

  function PathsTab({ onPick }) {
    const [loading, setLoading] = useState(true)
    const [roots, setRoots] = useState([])
    useEffect(() => {
      let alive = true
      ;(async () => {
        try {
          const r = await fetch('/api/media/list')
          const data = r.ok ? await r.json() : { roots: [] }
          if (!alive) return
          setRoots(Array.isArray(data.roots) ? data.roots : [])
        } catch { setRoots([]) }
        setLoading(false)
      })()
      return () => { alive = false }
    }, [])
    if (loading) return React.createElement('div', { className: 'muted' }, 'Loading…')
    return React.createElement(
      'div',
      null,
      React.createElement('div', { className: 'muted', style: { marginBottom: '6px' } }, 'Roots'),
      ...roots.map((e, i) => React.createElement('button', {
        key: i,
        className: 'btn',
        style: { display: 'block', width: '100%', textAlign: 'left', margin: '6px 0' },
        title: e.path,
        onClick: () => onPick({ type: 'dir', path: e.path, mode: 'C' }),
      }, `[dir] ${[e.label || '', e.path].filter(Boolean).join(' ')}`)),
    )
  }

  function UploadTab({ onPick }) {
    const filesRef = useRef(null)
    const dirRef = useRef(null)
    const prefixRef = useRef(null)
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState(null)
    useEffect(() => {
      // Ensure directory picking works across browsers
      if (dirRef.current) {
        try { dirRef.current.setAttribute('webkitdirectory', '') } catch {}
        try { dirRef.current.setAttribute('directory', '') } catch {}
      }
    }, [])
    async function onSubmit(e) {
      e.preventDefault()
      const files = filesRef.current?.files
      const dir = dirRef.current?.files
      const prefix = prefixRef.current?.value || ''
      if ((!files || !files.length) && (!dir || !dir.length)) return
      const fd = new FormData()
      if (prefix) fd.set('prefix', prefix)
      const add = (list) => { if (!list) return; for (let i = 0; i < list.length; i++) { const f = list[i]; fd.append('file', f, (f && f.webkitRelativePath) ? f.webkitRelativePath : f.name) } }
      add(files); add(dir)
      setBusy(true)
      setResult({ kind: 'info', text: 'Uploading…' })
      try {
        const r = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!r.ok) throw new Error('bad')
        const data = await r.json()
        setResult({ kind: 'ok', uploadedAt: data.uploadedAt })
      } catch {
        setResult({ kind: 'err', text: 'Upload failed.' })
      } finally { setBusy(false) }
    }
    return React.createElement(
      'form',
      { onSubmit },
      React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        React.createElement('input', { type: 'file', multiple: true, ref: filesRef }),
        React.createElement('label', { className: 'muted' }, 'or'),
        React.createElement('input', { type: 'file', ref: dirRef }),
        React.createElement('input', { type: 'text', ref: prefixRef, placeholder: 'Optional prefix folder', style: { flex: 1, padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '6px' } }),
        React.createElement('button', { className: 'btn', type: 'submit', disabled: busy }, busy ? 'Uploading…' : 'Upload'),
      ),
      React.createElement('div', { style: { marginTop: '12px' } },
        result?.kind === 'info' && React.createElement('div', { className: 'muted' }, result.text),
        result?.kind === 'err' && React.createElement('div', { className: 'muted' }, result.text),
        result?.kind === 'ok' && React.createElement('button', {
          className: 'btn',
          onClick: (e) => { e.preventDefault(); onPick({ type: 'dir', path: `files/uploads/${result.uploadedAt}`, mode: 'C' }) },
        }, 'View uploaded folder'),
      ),
    )
  }

  function EnterTab({ onPick }) {
    const inputRef = useRef(null)
    const [info, setInfo] = useState({ kind: 'idle' })
    async function validate() {
      const p = (inputRef.current?.value || '').trim()
      if (!p) return
      setInfo({ kind: 'info', text: 'Checking…' })
      try {
        const r = await fetch(`/api/pathinfo?path=${encodeURIComponent(p)}`)
        if (!r.ok) throw new Error('bad')
        const meta = await r.json()
        const type = meta.type
        let mode = 'C'
        if (type === 'file') mode = meta.hasJs ? 'B' : 'A'
        if (type === 'app') mode = 'D'
        setInfo({ kind: 'ok', type, mode, hasJs: !!meta.hasJs, path: p })
      } catch { setInfo({ kind: 'err', text: 'Not found or unsupported.' }) }
    }
    return React.createElement(
      'div',
      null,
      React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        React.createElement('input', { type: 'text', ref: inputRef, placeholder: 'Enter absolute or repo-relative path', style: { flex: 1, padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '6px' } }),
        React.createElement('button', { className: 'btn', onClick: validate }, 'Validate'),
      ),
      React.createElement('div', { style: { marginTop: '12px' }, className: 'muted' },
        info.kind === 'info' && info.text,
        info.kind === 'err' && info.text,
        info.kind === 'ok' && React.createElement(React.Fragment, null,
          `Type: ${info.type}${info.hasJs ? ' (has JS)' : ''} `,
          React.createElement('button', { className: 'btn', onClick: () => onPick({ type: info.type, path: info.path, mode: info.mode }) }, 'Select')
        ),
      ),
    )
  }

  // Mount modal
  const overlay = document.createElement('div')
  document.body.appendChild(overlay)
  const root = ReactDOM.createRoot(overlay)
  const onClose = () => { try { root.unmount(); overlay.remove() } catch {} }
  root.render(React.createElement(Drawer, { onClose }))
}
