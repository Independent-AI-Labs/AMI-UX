// React-based Select Media Modal
import { humanizeName, normalizeFsPath } from './utils.js'
import { createFileTreeToolkit, normalizeTreeFromApi } from './file-tree.js'
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
  const { useEffect, useRef, useState, useMemo, useCallback } = React
  const { FileTreeSelector } = createFileTreeToolkit(React)
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

  const formatBytes = (value) => {
    const num = Number(value) || 0
    if (num === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let idx = 0
    let val = num
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024
      idx += 1
    }
    const fixed = val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)
    return `${fixed} ${units[idx]}`
  }

  const ensureUploadStyles = (() => {
    let injected = false
    return () => {
      if (injected) return
      injected = true
      const style = document.createElement('style')
      style.textContent = [
        '@keyframes upload-indeterminate { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }',
        '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
      ].join('\n')
      document.head.appendChild(style)
    }
  })()

  function ModalDialog({
    title = '',
    onClose,
    actions = [],
    children,
    minWidth = '380px',
    maxWidth = '95vw',
    contentStyle = {},
    bodyStyle = {},
    footerAlign = 'flex-end',
    allowBackdropClose = true,
  }) {
    const [stage, setStage] = useState('enter')
    const closeTimeoutRef = useRef(null)
    useEffect(() => {
      const id = requestAnimationFrame(() => setStage('open'))
      return () => cancelAnimationFrame(id)
    }, [])

    const closeWithAnimation = useCallback(() => {
      if (stage === 'closing') return
      setStage('closing')
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = window.setTimeout(() => {
        closeTimeoutRef.current = null
        onClose?.()
      }, 240)
    }, [stage, onClose])

    useEffect(() => {
      const handler = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          closeWithAnimation()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [closeWithAnimation])

    useEffect(() => () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }, [])

    const cappedActions = useMemo(() => {
      if (!Array.isArray(actions)) return []
      return actions
        .filter(Boolean)
        .slice(0, 3)
        .map((action, index) => ({
          key: action.key || `action_${index}`,
          label: action.label || `Action ${index + 1}`,
          onClick: action.onClick,
          disabled: !!action.disabled,
          variant: action.variant || (index === 0 ? 'primary' : 'default'),
          type: action.type || 'button',
          style: action.style || null,
        }))
    }, [actions])

    const renderAction = (action) => {
      const isPrimary = action.variant === 'primary'
      const baseStyle = {
        minWidth: 96,
        padding: '8px 16px',
        borderRadius: 10,
        fontWeight: 600,
      }
      const primaryStyle = isPrimary
        ? { background: 'var(--accent)', color: '#0b1324' }
        : { background: 'color-mix(in oklab, var(--panel) 65%, transparent)', color: 'var(--text)' }
      return React.createElement('button', {
        key: action.key,
        className: 'btn',
        onClick: (e) => {
          e.preventDefault()
          if (!action.disabled) action.onClick?.(e)
        },
        disabled: action.disabled,
        type: action.type,
        style: { ...baseStyle, ...primaryStyle, ...(action.style || {}) },
      }, action.label)
    }

    const closeButton = React.createElement('button', {
      className: 'dialog-close',
      onClick: (e) => {
        e.preventDefault()
        closeWithAnimation()
      },
      'aria-label': 'Close dialog',
    }, '×')

    const surfaceStyle = {
      '--dialog-min-width': minWidth,
      '--dialog-max-width': maxWidth,
      ...contentStyle,
    }

    return React.createElement('div', {
      className: 'dialog-backdrop',
      'data-state': stage,
      hidden: stage === 'closed',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget && allowBackdropClose) closeWithAnimation()
      },
    },
      React.createElement('div', {
        className: 'dialog-surface',
        'data-state': stage,
        style: surfaceStyle,
        onMouseDown: (event) => event.stopPropagation(),
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          title ? React.createElement('strong', { style: { fontSize: '16px', flex: 1 } }, title) : React.createElement('span', { style: { flex: 1 } }),
          closeButton,
        ),
        React.createElement('div', { style: { overflowY: 'auto', ...bodyStyle } }, children),
        cappedActions.length
          ? React.createElement('div', { style: { display: 'flex', justifyContent: footerAlign, gap: 10, marginTop: 'auto' } }, cappedActions.map(renderAction))
          : null,
      ),
    )
  }

  function Row({ entry, status, selected, busy, onOpen, onContext, onStart, onStop, upload, onUploadStart, onUploadPause, onUploadResume, onUploadClear }) {
    const isUpload = !!upload
    if (isUpload || busy) ensureUploadStyles()
    const uploadStatus = upload?.status || 'ready'
    const base = entry.path.split('/').pop() || entry.path
    const label = entry.label || (entry.kind === 'file' ? humanizeName(base, 'file') : base)
    const kind = entry.kind
    const [hovered, setHovered] = useState(false)
    const spinner = React.createElement('svg', { viewBox: '0 0 50 50', width: 16, height: 16, style: { marginLeft: 8, animation: 'spin 1s linear infinite' } },
      React.createElement('circle', { cx: 25, cy: 25, r: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeDasharray: '31.4 31.4', strokeLinecap: 'round' })
    )
    const onRowDoubleClick = () => { if (!isUpload) onOpen(entry) }
    const onRowContext = (e) => {
      if (isUpload) return
      e.preventDefault()
      onContext(e, entry)
    }
    const baseBackground = selected
      ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
      : hovered
        ? 'color-mix(in oklab, var(--accent) 6%, transparent)'
        : 'transparent'
    const background = isUpload && (uploadStatus === 'uploading' || uploadStatus === 'checking' || uploadStatus === 'queued')
      ? 'color-mix(in oklab, var(--accent) 10%, transparent)'
      : baseBackground

    const uploadControls = (() => {
      if (!isUpload) return null
      const buttons = []
      const icon = (svg) => React.createElement('span', { dangerouslySetInnerHTML: { __html: svg } })
      const makeButton = (key, svg, title, onClick, disabled = false) => React.createElement('button', {
        key,
        className: 'btn',
        onClick: (e) => { e.stopPropagation(); if (!disabled) onClick?.() },
        title,
        disabled,
        style: { padding: '4px 6px', borderRadius: 999 },
      }, icon(svg))
      const playIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="8 5 19 12 8 19 8 5"/></svg>'
      const pauseIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      const clearIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      const retryIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 4 1 7 4"/><path d="M3 1v6a4 4 0 0 0 4 4h3"/><polyline points="23 20 20 23 17 20"/><path d="M21 23v-6a4 4 0 0 0-4-4h-3"/></svg>'
      if (uploadStatus === 'uploading' || uploadStatus === 'checking' || uploadStatus === 'queued' || uploadStatus === 'finalizing') {
        buttons.push(makeButton('pause', pauseIcon, 'Pause upload', () => onUploadPause?.(upload), uploadStatus === 'finalizing'))
      } else if (uploadStatus === 'paused') {
        buttons.push(makeButton('resume', playIcon, 'Resume upload', () => onUploadResume?.(upload)))
        buttons.push(makeButton('clear', clearIcon, 'Remove from queue', () => onUploadClear?.(upload)))
      } else if (uploadStatus === 'error') {
        buttons.push(makeButton('retry', retryIcon, 'Retry upload', () => onUploadStart?.(upload)))
        buttons.push(makeButton('clear', clearIcon, 'Remove from queue', () => onUploadClear?.(upload)))
      } else if (uploadStatus === 'ready') {
        buttons.push(makeButton('start', playIcon, 'Start upload', () => onUploadStart?.(upload)))
        buttons.push(makeButton('clear', clearIcon, 'Remove from queue', () => onUploadClear?.(upload)))
      }
      return React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } }, ...buttons)
    })()

    const serveControls = (() => {
      if (isUpload) return null
      const isStarting = status === 'starting'
      const isOn = status === 'running'
      const onClick = (e) => { e.stopPropagation(); if (isStarting) return; (isOn ? onStop : onStart)(entry) }
      if (isStarting) {
        return React.createElement('span', { className: 'muted', title: 'Starting…', style: { display: 'inline-flex', alignItems: 'center' } }, spinner)
      }
      const svg = isOn
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="8 5 19 12 8 19 8 5"/></svg>'
      return React.createElement('button', {
        className: 'btn', onClick, title: isOn ? 'Stop serving' : 'Start serving',
        style: { padding: '4px 6px', borderRadius: 999 }
      }, React.createElement('span', { dangerouslySetInnerHTML: { __html: svg } }))
    })()

    const totalBytes = upload?.totalBytes || 0
    const uploadedBytes = upload?.uploadedBytes || 0
    const explicitProgress = typeof upload?.progress === 'number' && Number.isFinite(upload.progress) ? Math.max(0, Math.min(1, upload.progress)) : null
    const derivedProgress = totalBytes > 0 ? Math.max(0, Math.min(1, uploadedBytes / totalBytes)) : null
    const progressValue = isUpload ? (explicitProgress ?? derivedProgress) : null
    const showProgressBar = isUpload || busy
    const progressBar = showProgressBar
      ? React.createElement('div', {
        style: {
          marginTop: 6,
          height: 6,
          borderRadius: 999,
          background: 'color-mix(in oklab, var(--border) 70%, transparent)',
          overflow: 'hidden',
        }
      }, React.createElement('div', {
        style: (isUpload && progressValue != null)
          ? {
            width: `${Math.max(progressValue, 0.02) * 100}%`,
            height: '100%',
            borderRadius: 999,
            background: 'var(--accent)',
            transition: 'width 160ms ease',
          }
          : {
            width: '40%',
            minWidth: '90px',
            height: '100%',
            borderRadius: 999,
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, var(--accent) 50%, rgba(255,255,255,0.12) 100%)',
            backgroundSize: '200% 100%',
            animation: 'upload-indeterminate 1s linear infinite',
            opacity: 0.9,
          }
      })) : null

    let statusText = ''
    let statusColor = 'var(--muted)'
    if (isUpload) {
      const pct = progressValue != null ? `${Math.round(progressValue * 100)}%` : ''
      if (uploadStatus === 'ready') statusText = 'Ready to upload'
      else if (uploadStatus === 'paused') statusText = 'Upload paused'
      else if (uploadStatus === 'uploading' || uploadStatus === 'checking' || uploadStatus === 'queued') statusText = pct ? `Uploading ${pct}` : 'Uploading…'
      else if (uploadStatus === 'finalizing') statusText = 'Finalizing…'
      else if (uploadStatus === 'done') { statusText = 'Upload complete'; statusColor = 'var(--ok)' }
      else if (uploadStatus === 'error') { statusText = upload?.error || 'Upload failed'; statusColor = '#ef4444' }
    } else if (busy) {
      statusText = 'Working…'
    }

    const detailParts = []
    if (isUpload) {
      const fileCount = upload?.files?.length || 0
      if (fileCount) detailParts.push(`${fileCount} item${fileCount === 1 ? '' : 's'}`)
      if (totalBytes) detailParts.push(formatBytes(totalBytes))
    } else {
      const meta = entry?.metrics || entry?.meta || {}
      const itemValue = typeof meta.items === 'number' ? meta.items : (typeof meta.itemCount === 'number' ? meta.itemCount : null)
      const bytesValue = typeof meta.bytes === 'number' ? meta.bytes : (typeof meta.size === 'number' ? meta.size : null)
      if (itemValue != null) detailParts.push(`${itemValue} item${itemValue === 1 ? '' : 's'}`)
      if (bytesValue != null) detailParts.push(formatBytes(bytesValue))
      if (meta.truncated) detailParts.push('Partial scan')
    }

    return React.createElement('div', {
      className: 'row',
      onDoubleClick: onRowDoubleClick,
      onContextMenu: onRowContext,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
        borderBottom: '1px solid var(--border)', cursor: 'default',
        background,
      }
    },
      React.createElement(Icon, { name: kind === 'dir' ? 'folder' : (kind === 'app' ? 'app' : 'file') }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' } },
            React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 } }, label),
            (!isUpload && status === 'running') && React.createElement('span', { className: 'serve-dot', title: 'Served' }),
          ),
          isUpload ? uploadControls : serveControls,
          (!isUpload && busy) && spinner,
          (isUpload && (uploadStatus === 'uploading' || uploadStatus === 'checking' || uploadStatus === 'queued' || uploadStatus === 'finalizing')) && spinner,
        ),
        isUpload
          ? React.createElement(React.Fragment, null,
            progressBar,
            statusText && React.createElement('div', { style: { color: statusColor, fontSize: 12, marginTop: 6 } }, statusText),
            detailParts.length ? React.createElement('div', { style: { color: 'var(--muted)', fontSize: 12, marginTop: 4 } }, detailParts.join(' • ')) : null,
          )
          : React.createElement(React.Fragment, null,
            progressBar,
            statusText && React.createElement('div', { style: { color: statusColor, fontSize: 12, marginTop: 6 } }, statusText),
            entry.path ? React.createElement('div', { style: { color: 'var(--muted)', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, entry.path) : null,
            detailParts.length ? React.createElement('div', { style: { color: 'var(--muted)', fontSize: 12, marginTop: entry.path ? 2 : 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, detailParts.join(' • ')) : null,
          ),
      ),
    )
  }

  async function readEntryTree(entry, prefix = '') {
    if (!entry) return []
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject))
      const rel = prefix ? `${prefix}/${file.name}` : file.name
      return [{ file, rel }]
    }
    if (entry.isDirectory) {
      const dirPath = prefix ? `${prefix}/${entry.name}` : entry.name
      const reader = entry.createReader()
      const files = []
      await new Promise((resolve, reject) => {
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (!entries.length) return resolve(null)
            for (const child of entries) {
              const nested = await readEntryTree(child, dirPath)
              files.push(...nested)
            }
            readBatch()
          }, reject)
        }
        readBatch()
      })
      return files
    }
    return []
  }

  function uniqueRoots(files) {
    const set = new Set()
    files.forEach(({ rel, file }) => {
      const input = rel || file?.name || ''
      if (!input) return
      const root = input.split('/')[0]
      if (root) set.add(root)
    })
    return Array.from(set)
  }

  async function gatherFromDataTransfer(dt) {
    const out = []
    if (!dt) return out
    const items = dt.items
    if (items && items.length) {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (!item) continue
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null
        if (entry) {
          const files = await readEntryTree(entry)
          out.push(...files)
        } else if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) out.push({ file, rel: file.name })
        }
      }
    }
    if (!out.length && dt.files && dt.files.length) {
      for (let i = 0; i < dt.files.length; i += 1) {
        const file = dt.files[i]
        if (!file) continue
        out.push({ file, rel: file.name })
      }
    }
    return out
  }

  function filesFromFileList(list) {
    const out = []
    if (!list || !list.length) return out
    for (let i = 0; i < list.length; i += 1) {
      const f = list[i]
      if (!f) continue
      out.push({ file: f, rel: f.webkitRelativePath || f.name })
    }
    return out
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
      mkItem('del', 'Remove from Directory', onDeleteLib, false),
      mkItem('deld', 'Delete from Disk', onDeleteDisk, false),
    )
  }

  function DestinationModal({ selection, directories, rootOptions = [], resolveRoot, onClose, onStage, validateFolderName }) {
    const { files = [] } = selection || {}
    const fileCount = files.length
    const totalBytes = files.reduce((sum, entry) => sum + (entry?.file?.size || 0), 0)
    const [treeRoots, setTreeRoots] = useState([])
    const [loadingTree, setLoadingTree] = useState(true)
    const [treeError, setTreeError] = useState('')
    const [selectedDetail, setSelectedDetail] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
      let alive = true
      setLoadingTree(true)
      setTreeError('')
      const load = async () => {
        const accum = []
        const seenAbs = new Set()
        const usedKeys = new Set()
        if (Array.isArray(rootOptions)) {
          for (const opt of rootOptions) {
            if (!opt || !opt.key) continue
            if (usedKeys.has(opt.key)) continue
            usedKeys.add(opt.key)
            try {
              const query = opt.key === 'docRoot' ? '' : `?root=${encodeURIComponent(opt.key)}`
              const res = await fetch(`/api/tree${query}`)
              if (!res.ok) throw new Error('failed')
              const data = await res.json()
              const normalized = normalizeTreeFromApi(data, { rootKey: opt.key, label: opt.label || opt.key, rootAbsolute: opt.path, writable: opt.writable !== false })
              if (normalized) {
                accum.push(normalized)
                const normAbs = normalizeFsPath(normalized.absolutePath)
                if (normAbs) seenAbs.add(normAbs)
              }
            } catch {
              // ignore individual root failures
            }
          }
        }
        const extras = Array.isArray(directories) ? directories : []
        extras.forEach((dir) => {
          if (!dir || typeof dir.path !== 'string') return
          const normalizedAbs = normalizeFsPath(dir.path)
          if (normalizedAbs && seenAbs.has(normalizedAbs)) return
          const mapping = typeof resolveRoot === 'function' ? resolveRoot(dir.path) : null
          if (mapping && accum.some((root) => root.key === mapping.root)) {
            if (normalizedAbs) seenAbs.add(normalizedAbs)
            return
          }
          const safeBase = (normalizedAbs || dir.path || '').replace(/[^a-zA-Z0-9]+/g, '_') || 'dir'
          let key = `standalone_${safeBase}`
          let suffix = 1
          while (usedKeys.has(key)) {
            key = `standalone_${safeBase}_${suffix += 1}`
          }
          usedKeys.add(key)
          accum.push({
            key,
            label: dir.label || dir.path,
            absolutePath: dir.path,
            writable: true,
            node: {
              name: dir.label || (dir.path.split(/[\\/]/).pop() || 'Directory'),
              path: '',
              type: 'dir',
              absolutePath: dir.path,
              children: [],
            },
          })
          if (normalizedAbs) seenAbs.add(normalizedAbs)
        })
        if (!accum.length && alive) {
          setTreeError('No destinations available.')
        }
        if (alive) setTreeRoots(accum)
      }
      load().catch(() => {
        if (alive) {
          setTreeRoots([])
          setTreeError('Failed to load directories.')
        }
      }).finally(() => {
        if (alive) setLoadingTree(false)
      })
      return () => { alive = false }
    }, [directories, rootOptions, resolveRoot])

    useEffect(() => {
      if (!selectedDetail && treeRoots.length) {
        const first = treeRoots[0]
        if (first) setSelectedDetail({ rootKey: first.key, path: '', node: first.node, root: first })
      }
    }, [treeRoots, selectedDetail])

    const handleSelectionChange = (payload) => {
      if (!payload) {
        setSelectedDetail(null)
        return
      }
      setSelectedDetail({ rootKey: payload.rootKey, path: payload.node.path || '', node: payload.node, root: payload.root })
      setError('')
    }

    const handleCreateRequest = (payload) => {
      if (!payload) return
      setError('')
      onStage({
        kind: 'new',
        rootKey: payload.rootKey,
        parentPath: payload.parentPath || '',
        parentAbsolute: payload.parentAbsolute || '',
        name: payload.name,
        absolutePath: payload.absolutePath || '',
      })
    }

    const stageDisabled = loadingTree || !selectedDetail || selectedDetail.node.type !== 'dir' || selectedDetail.root?.writable === false

    function handleStage() {
      if (stageDisabled) {
        setError('Select a destination folder.')
        return
      }
      setError('')
      onStage({
        kind: 'existing',
        rootKey: selectedDetail.rootKey,
        relativePath: selectedDetail.node.path || '',
        absolutePath: selectedDetail.node.absolutePath || '',
        rootLabel: selectedDetail.root?.label || '',
      })
    }

    const loadingMessage = loadingTree ? React.createElement('div', { className: 'muted', style: { fontSize: '13px' } }, 'Loading directories…') : null

    const hasWritableRoots = treeRoots.some((root) => root && root.writable !== false)
    const selectedRootWritable = selectedDetail?.root?.writable !== false

    const body = React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'muted', style: { fontSize: '13px', marginBottom: 6 } }, `${fileCount} item${fileCount === 1 ? '' : 's'} • ${formatBytes(totalBytes)}`),
      loadingMessage || React.createElement(FileTreeSelector, {
        roots: treeRoots,
        selectionMode: 'dir',
        selected: selectedDetail ? { rootKey: selectedDetail.rootKey, path: selectedDetail.path } : null,
        onSelectionChange: handleSelectionChange,
        allowCreate: !loadingTree && (selectedRootWritable || (!selectedDetail && hasWritableRoots)),
        onCreateRequest: handleCreateRequest,
        validateName: validateFolderName,
        onErrorMessage: (msg) => setError(msg || ''),
      }),
      (!loadingTree && treeError) && React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, treeError),
      error && React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, error),
    )

    return React.createElement(ModalDialog, {
      title: 'Choose Destination',
      onClose,
      actions: [{ key: 'stage', label: 'Stage', onClick: handleStage, disabled: stageDisabled, variant: 'primary' }],
      maxWidth: '92vw',
      bodyStyle: { display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 },
      contentStyle: { maxWidth: '92vw' },
    }, body)
  }

  function ServerContentModal({ rootOptions = [], onClose, onConfirm }) {
    const effectiveRoots = useMemo(() => {
      const list = Array.isArray(rootOptions) ? rootOptions.filter((opt) => opt && opt.key) : []
      if (!list.length) return []
      const repo = list.find((opt) => opt.key === 'repoRoot')
      if (repo) return [repo]
      const filtered = list.filter((opt) => opt.key !== 'uploads' && opt.key !== 'docRoot')
      if (filtered.length) return filtered
      return list
    }, [rootOptions])
    const [treeRoots, setTreeRoots] = useState([])
    const [loadingTree, setLoadingTree] = useState(true)
    const [treeError, setTreeError] = useState('')
    const [selectedDetail, setSelectedDetail] = useState(null)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
      let alive = true
      setLoadingTree(true)
      setTreeError('')
      const load = async () => {
        const accum = []
        const usedKeys = new Set()
        if (Array.isArray(effectiveRoots)) {
          for (const opt of effectiveRoots) {
            if (!opt || !opt.key) continue
            if (usedKeys.has(opt.key)) continue
            usedKeys.add(opt.key)
            try {
              const query = opt.key === 'docRoot' ? '' : `?root=${encodeURIComponent(opt.key)}`
              const res = await fetch(`/api/tree${query}`)
              if (!res.ok) throw new Error('failed')
              const data = await res.json()
              const normalized = normalizeTreeFromApi(data, { rootKey: opt.key, label: opt.label || opt.key, rootAbsolute: opt.path, writable: opt.writable !== false })
              if (normalized) accum.push(normalized)
            } catch {
              // ignore individual root failures
            }
          }
        }
        if (!accum.length && alive) setTreeError('No server paths available.')
        if (alive) setTreeRoots(accum)
      }
      load().catch(() => {
        if (alive) {
          setTreeRoots([])
          setTreeError('Failed to load server tree.')
        }
      }).finally(() => {
        if (alive) setLoadingTree(false)
      })
      return () => { alive = false }
    }, [effectiveRoots])

    useEffect(() => {
      if (!selectedDetail && treeRoots.length) {
        const first = treeRoots[0]
        if (first) setSelectedDetail({ rootKey: first.key, path: '', node: first.node, root: first })
      }
    }, [treeRoots, selectedDetail])

    const handleSelectionChange = (payload) => {
      if (!payload) {
        setSelectedDetail(null)
        return
      }
      setSelectedDetail({ rootKey: payload.rootKey, path: payload.node.path || '', node: payload.node, root: payload.root })
      setError('')
    }

    const handleAdd = async () => {
      if (!selectedDetail || !selectedDetail.node) {
        setError('Select an item to add.')
        return
      }
      const abs = selectedDetail.node.absolutePath || ''
      if (!abs) {
        setError('Unable to determine path for selection.')
        return
      }
      setSubmitting(true)
      setError('')
      try {
        const result = onConfirm ? await onConfirm(selectedDetail) : { ok: true }
        if (result && result.ok === false) {
          setError(result.error || 'Failed to add to library.')
          setSubmitting(false)
          return
        }
      } catch (err) {
        setError(err?.message || 'Failed to add to library.')
        setSubmitting(false)
        return
      }
      setSubmitting(false)
      onClose()
    }

    const loadingMessage = loadingTree ? React.createElement('div', { className: 'muted', style: { fontSize: '13px' } }, 'Loading server files…') : null

    const body = React.createElement(React.Fragment, null,
      loadingMessage || React.createElement(FileTreeSelector, {
        roots: treeRoots,
        selectionMode: 'any',
        selected: selectedDetail ? { rootKey: selectedDetail.rootKey, path: selectedDetail.path } : null,
        onSelectionChange: handleSelectionChange,
        allowCreate: false,
      }),
      (!loadingTree && treeError) && React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, treeError),
      error && React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, error),
    )

    const actions = [{ key: 'add', label: submitting ? 'Adding…' : 'Add', onClick: handleAdd, disabled: submitting || !selectedDetail, variant: 'primary' }]

    return React.createElement(ModalDialog, {
      title: 'Add From Server',
      onClose,
      actions,
      bodyStyle: { display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 },
    }, body)
  }

  function Drawer({ onClose }) {
    const [entries, setEntries] = useState([])
    const [loadingEntries, setLoadingEntries] = useState(true)
    const [filter, setFilter] = useState('')
    const [menu, setMenu] = useState(null)
    const [servingMap, setServingMap] = useState(new Map())
    const [selectedId, setSelectedId] = useState(null)
    const [busyId, setBusyId] = useState(null)
    const [toast, setToast] = useState(null)
    const [uploadJobs, setUploadJobs] = useState([])
    const uploadJobsRef = useRef([])
    const uploadControllers = useRef(new Map())
    const [dropActive, setDropActive] = useState(false)
    const [rootOptions, setRootOptions] = useState([])
    const [uploadRoot, setUploadRoot] = useState('docRoot')
    const [pendingSelection, setPendingSelection] = useState(null)
    const [serverPickerOpen, setServerPickerOpen] = useState(false)
    const [noResultsToken, setNoResultsToken] = useState(0)
    const fileSelectRef = useRef(null)
    const dirSelectRef = useRef(null)
    const prevNoResultsRef = useRef(false)
    const closeTimerRef = useRef(null)
    const [isVisible, setIsVisible] = useState(false)
    const writableRootOptions = useMemo(() => {
      if (!Array.isArray(rootOptions)) return []
      return rootOptions.filter((opt) => opt && opt.writable !== false)
    }, [rootOptions])
    const rootOptionMap = useMemo(() => {
      const map = new Map()
      if (Array.isArray(rootOptions)) {
        rootOptions.forEach((opt) => { if (opt && opt.key) map.set(opt.key, opt) })
      }
      return map
    }, [rootOptions])
    const activeRoot = rootOptionMap.get(uploadRoot) || null
    useEffect(() => {
      const raf = requestAnimationFrame(() => setIsVisible(true))
      return () => cancelAnimationFrame(raf)
    }, [])
    useEffect(() => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }, [])
    const requestClose = useCallback(() => {
      if (closeTimerRef.current) return
      setIsVisible(false)
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        try { onClose?.() } catch {}
      }, 220)
    }, [onClose])
    useEffect(() => {
      const handler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          requestClose()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [requestClose])
    useEffect(() => {
      let alive = true
      ;(async () => {
        setLoadingEntries(true)
        await fetchEntries(() => alive)
        if (alive) setLoadingEntries(false)
      })()
      return () => { alive = false }
    }, [])
    useEffect(() => { uploadJobsRef.current = uploadJobs }, [uploadJobs])
    useEffect(() => {
      let alive = true
      ;(async () => {
        try {
          const r = await fetch('/api/media/list')
          const data = r.ok ? await r.json() : { roots: [] }
          if (!alive) return
          const list = Array.isArray(data.roots) ? data.roots.filter((item) => item && typeof item.path === 'string' && item.path) : []
          setRootOptions(list)
          const writableList = list.filter((item) => item && item.writable !== false)
          const hasCurrent = writableList.some((item) => item.key === uploadRoot)
          if (!hasCurrent) {
            const preferred = writableList.find((item) => item.key === 'docRoot')
              || writableList.find((item) => item.key === 'uploads')
              || writableList[0]
              || list.find((item) => item.key === 'docRoot')
              || list.find((item) => item.key === 'uploads')
              || list[0]
            if (preferred) setUploadRoot(preferred.key)
          }
        } catch {
          if (alive) setRootOptions([])
        }
      })()
      return () => { alive = false }
    }, [uploadRoot])

    async function fetchEntries(shouldSet = () => true) {
      try {
        const r = await fetch('/api/library')
        const j = r.ok ? await r.json() : { entries: [] }
        const list = Array.isArray(j.entries) ? j.entries : []
        if (shouldSet()) setEntries(list)
        return list
      } catch {
        if (shouldSet()) setEntries([])
        return []
      }
    }
    function updateJob(id, patch) {
      setUploadJobs((prev) => prev.map((job) => {
        if (job.id !== id) return job
        const next = typeof patch === 'function' ? patch(job) : patch
        return { ...job, ...next }
      }))
    }
    function verifyJobFiles(job) {
      if (!job || !Array.isArray(job.files) || !job.files.length) return false
      if (!Array.isArray(job.meta) || job.meta.length !== job.files.length) return false
      for (let i = 0; i < job.files.length; i += 1) {
        const entry = job.files[i]
        const meta = job.meta[i]
        const file = entry?.file
        if (!(file instanceof File)) return false
        if (!meta) return false
        if (file.size !== meta.size) return false
        if (file.lastModified !== meta.lastModified) return false
        if ((entry.rel || file.name || '') !== (meta.rel || meta.name || '')) return false
      }
      return true
    }
    async function handleUploadInfo(info) {
      if (!info) return
      const files = Array.isArray(info.files) ? info.files : []
      const rootAbsolute = typeof info.rootAbsolute === 'string' ? info.rootAbsolute : ''
      const rootRelative = typeof info.rootRelative === 'string' ? info.rootRelative : ''
      const rootKey = typeof info.rootKey === 'string' ? info.rootKey : ''
      const rootLabel = typeof info.rootLabel === 'string' ? info.rootLabel : ''
      const rootBaseAbsolute = typeof info.rootBaseAbsolute === 'string' ? info.rootBaseAbsolute : ''
      const rootBaseRelative = typeof info.rootBaseRelative === 'string' ? info.rootBaseRelative : ''
      const defaultPath = rootAbsolute || rootRelative || rootBaseAbsolute || rootBaseRelative || `files/uploads/${info.uploadedAt}`
      const joinPaths = (base, rel) => {
        if (!base) return rel || ''
        if (!rel) return base
        const sep = base.includes('\\') ? '\\' : '/'
        const baseClean = base.replace(/[\\/]+$/, '')
        const relClean = String(rel).replace(/^[\\/]+/, '').replace(/[\\/]+/g, sep)
        return `${baseClean}${sep}${relClean}`
      }
      let libraryPath = defaultPath
      let createdEntryId = null
      if (files.length === 1) {
        const file = files[0] || {}
        const absoluteFilePath = typeof file.absolutePath === 'string' ? file.absolutePath : ''
        const repoFilePath = typeof file.path === 'string' ? file.path : ''
        const relFilePath = typeof file.relativePath === 'string' ? file.relativePath : ''
        const name = (file.name || '').toString().split('/').pop() || file.name || 'file'
        const label = humanizeName(name, 'file')
        const targetPath = absoluteFilePath || joinPaths(rootAbsolute, relFilePath) || repoFilePath || defaultPath
        if (targetPath) {
          try {
            const res = await fetch('/api/library', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: targetPath, label, kind: 'file' }),
            })
            if (res.ok) {
              const posted = await res.json().catch(() => null)
              if (posted?.id) createdEntryId = posted.id
              libraryPath = targetPath
            }
          } catch {}
        }
      } else {
        const targetPath = rootAbsolute || rootRelative || defaultPath
        if (targetPath) {
          try {
            const dirPayload = { path: targetPath, kind: 'dir' }
            if (rootKey === 'docRoot' && rootLabel) {
              dirPayload.label = rootLabel
            }
            const res = await fetch('/api/library', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(dirPayload),
            })
            if (res.ok) {
              const posted = await res.json().catch(() => null)
              if (posted?.id) createdEntryId = posted.id
              libraryPath = targetPath
            }
          } catch {}
        }
      }
      let refreshed = []
      try {
        setLoadingEntries(true)
        refreshed = await fetchEntries()
      } finally {
        setLoadingEntries(false)
      }
      setFilter('')
      if (createdEntryId) {
        setSelectedId(createdEntryId)
      } else {
        setSelectedId(null)
        if (libraryPath && Array.isArray(refreshed)) {
          const target = normalizeFsPath(libraryPath)
          const match = refreshed.find((entry) => typeof entry?.path === 'string' && normalizeFsPath(entry.path) === target)
          if (match?.id) setSelectedId(match.id)
        }
      }
    }

    async function addServerSelection(detail) {
      if (!detail || !detail.node) {
        return { ok: false, error: 'Select an item.' }
      }
      const absPath = detail.node.absolutePath || ''
      if (!absPath) {
        return { ok: false, error: 'Unable to determine path.' }
      }
      try {
        const res = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: absPath }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          const message = err?.error || 'Failed to add to library.'
          return { ok: false, error: message }
        }
      } catch {
        return { ok: false, error: 'Failed to add to library.' }
      }
      let refreshed = []
      try {
        setLoadingEntries(true)
        refreshed = await fetchEntries()
      } finally {
        setLoadingEntries(false)
      }
      setFilter('')
      if (Array.isArray(refreshed)) {
        const target = normalizeFsPath(absPath)
        const match = refreshed.find((entry) => typeof entry?.path === 'string' && normalizeFsPath(entry.path) === target)
        if (match?.id) setSelectedId(match.id)
      }
      setToast({ kind: 'ok', text: 'Added to Library.' })
      return { ok: true }
    }
    function summarizeUpload(files, totalBytes) {
      const uploadedBytes = files.reduce((sum, item) => sum + Math.min(item.uploaded || 0, item.size || 0), 0)
      const progress = totalBytes > 0 ? Math.min(1, uploadedBytes / totalBytes) : 0
      return { uploadedBytes, progress }
    }

    function toPosixPath(str) {
      return typeof str === 'string' ? str.replace(/\\/g, '/') : ''
    }

    function commonDirectory(paths) {
      const normalized = paths.map(toPosixPath).filter((p) => p)
      if (!normalized.length) return ''
      let prefix = normalized[0]
      for (const current of normalized.slice(1)) {
        let i = 0
        const limit = Math.min(prefix.length, current.length)
        while (i < limit && prefix[i] === current[i]) i += 1
        prefix = prefix.slice(0, i)
        if (!prefix) return ''
      }
      const lastSlash = prefix.lastIndexOf('/')
      if (lastSlash <= 0) return ''
      return prefix.slice(0, lastSlash)
    }

    function aggregateUploadResults(job, payloads) {
      if (!job || !Array.isArray(payloads) || payloads.length === 0) return null
      const uniqueFiles = new Map()
      const absolutePaths = []
      const repoPaths = []
      const relativeInputs = []
      const uploadedAtValues = []
      let fallbackAbsolute = ''
      let fallbackRelative = ''
      const rootKeys = new Set()
      let fallbackRootKey = typeof job?.root === 'string' ? job.root : ''
      let rootLabel = typeof job?.rootLabel === 'string' ? job.rootLabel : ''
      let rootBaseAbsolute = ''
      let rootBaseRelative = ''
      for (const item of payloads) {
        const data = item || {}
        const files = Array.isArray(data.files) ? data.files : []
        for (const file of files) {
          if (!file) continue
          const key = file.absolutePath || file.path || file.relativePath || file.name
          if (!key || uniqueFiles.has(key)) continue
          uniqueFiles.set(key, file)
          if (typeof file.absolutePath === 'string') absolutePaths.push(file.absolutePath)
          if (typeof file.path === 'string') repoPaths.push(file.path)
          if (typeof file.relativePath === 'string') relativeInputs.push(file.relativePath)
        }
        if (typeof data.rootAbsolute === 'string' && !fallbackAbsolute) {
          fallbackAbsolute = data.rootAbsolute
        }
        if (typeof data.rootRelative === 'string' && !fallbackRelative) {
          fallbackRelative = data.rootRelative
        }
        if (typeof data.rootKey === 'string') {
          rootKeys.add(data.rootKey)
        }
        if (!rootLabel && typeof data.rootLabel === 'string') {
          rootLabel = data.rootLabel
        }
        if (!rootBaseAbsolute && typeof data.rootBaseAbsolute === 'string') {
          rootBaseAbsolute = data.rootBaseAbsolute
        }
        if (!rootBaseRelative && typeof data.rootBaseRelative === 'string') {
          rootBaseRelative = data.rootBaseRelative
        }
        if (typeof data.uploadedAt === 'number' && Number.isFinite(data.uploadedAt)) {
          uploadedAtValues.push(data.uploadedAt)
        }
      }
      if (uniqueFiles.size === 0) return null
      const files = Array.from(uniqueFiles.values())
      let rootAbsolute = commonDirectory(absolutePaths)
      if (!rootAbsolute) rootAbsolute = toPosixPath(fallbackAbsolute)
      let rootRelative = commonDirectory(repoPaths)
      if (!rootRelative) {
        rootRelative = commonDirectory(relativeInputs)
      }
      if (!rootRelative && fallbackRelative) {
        rootRelative = toPosixPath(fallbackRelative)
      }
      const uploadedAt = uploadedAtValues.length ? Math.min(...uploadedAtValues) : Date.now()
      const isDirJob = !!job && job.kind === 'dir'
      const effectiveKind = (isDirJob || files.length > 1) ? 'dir' : 'file'
      const rootKey = rootKeys.size === 1 ? Array.from(rootKeys)[0] : (fallbackRootKey || '')
      if (!rootLabel && fallbackRootKey && typeof job?.rootLabel === 'string') {
        rootLabel = job.rootLabel
      }
      return {
        files,
        rootAbsolute,
        rootRelative,
        rootKey,
        rootLabel,
        rootBaseAbsolute,
        rootBaseRelative,
        uploadedAt: uploadedAt ?? Date.now(),
        jobKind: effectiveKind,
      }
    }

    function getJobSnapshot(id) {
      const jobs = uploadJobsRef.current || []
      return jobs.find((item) => item.id === id) || null
    }

    function buildTargetPath(prefix, rel, fallbackName) {
      const cleanPrefix = (prefix || '').replace(/^[\\/]+/, '').replace(/[\\/]+$/, '')
      const rawRel = (rel || fallbackName || '').toString()
      const cleanRel = rawRel.replace(/^[\\/]+/, '')
      if (cleanPrefix && cleanRel) return `${cleanPrefix}/${cleanRel}`
      if (cleanPrefix) return cleanPrefix
      return cleanRel
    }

    async function fetchUploadStatus(rootKey, targetPath, size, intent) {
      const params = new URLSearchParams({ path: targetPath, size: String(size || 0) })
      if (rootKey) params.set('root', rootKey)
      if (intent) params.set('intent', intent)
      const res = await fetch(`/api/upload?${params.toString()}`)
      if (!res.ok) {
        const message = res.status === 409 ? 'Upload conflict with existing file.' : 'Failed to fetch upload status.'
        throw new Error(message)
      }
      const data = await res.json().catch(() => null)
      if (!data || typeof data !== 'object') throw new Error('Invalid status response.')
      return data
    }

    async function uploadFile(jobId, fileIndex) {
      const snapshot = getJobSnapshot(jobId)
      if (!snapshot) return { kind: 'cancelled' }
      const fileEntry = snapshot.files[fileIndex]
      if (!fileEntry) return { kind: 'cancelled' }
      const rootKey = snapshot.root || 'uploads'
      const intent = (fileEntry.uploaded || 0) > 0 ? 'resume' : 'replace'
      const targetPath = buildTargetPath(snapshot.prefix, fileEntry.rel, fileEntry.file?.name)
      if (!targetPath) {
        return { kind: 'error', error: 'Unable to determine target path.' }
      }

      updateJob(jobId, (job) => {
        if (!job) return job
        const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'checking', error: null } : f)
        return { ...job, status: 'checking', files }
      })

      let statusData
      try {
        statusData = await fetchUploadStatus(rootKey, targetPath, fileEntry.size, intent)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch upload status.'
        updateJob(jobId, (job) => {
          if (!job) return job
          const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'error', error: message } : f)
          return { ...job, status: 'error', error: message, files, processing: false }
        })
        return { kind: 'error', error: message }
      }

      const offset = Number(statusData.offset) || 0
      const alreadyComplete = !!statusData.complete && offset >= fileEntry.size

      if (alreadyComplete) {
        updateJob(jobId, (job) => {
          if (!job) return job
          const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'done', uploaded: f.size, error: null } : f)
          const summary = summarizeUpload(files, job.totalBytes)
          return { ...job, files, ...summary }
        })
        return { kind: 'skipped', data: statusData }
      }

      const liveJob = getJobSnapshot(jobId)
      if (!liveJob) return { kind: 'cancelled' }
      if (liveJob.pauseRequested || liveJob.status === 'paused') {
        return { kind: 'paused' }
      }

      if (!(fileEntry.file instanceof File)) {
        const message = 'File blob unavailable.'
        updateJob(jobId, (job) => {
          if (!job) return job
          const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'error', error: message } : f)
          return { ...job, status: 'error', error: message, files, processing: false }
        })
        return { kind: 'error', error: message }
      }

      updateJob(jobId, (job) => {
        if (!job) return job
        const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'uploading', uploaded: offset, error: null } : f)
        const summary = summarizeUpload(files, job.totalBytes)
        return { ...job, status: 'uploading', files, ...summary }
      })

      return await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        uploadControllers.current.set(jobId, { xhr, fileIndex })

        const chunk = fileEntry.file.slice(offset)
        const totalSize = fileEntry.size || fileEntry.file.size || 0

        xhr.upload.onprogress = (event) => {
          const loaded = event.loaded || 0
          const absolute = Math.min(totalSize, offset + loaded)
          updateJob(jobId, (job) => {
            if (!job) return job
            const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, uploaded: absolute } : f)
            const summary = summarizeUpload(files, job.totalBytes)
            return { ...job, files, ...summary }
          })
        }

        xhr.onerror = () => {
          uploadControllers.current.delete(jobId)
          const message = 'Upload failed. Check your connection.'
          updateJob(jobId, (job) => {
            if (!job) return job
            const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'error', error: message } : f)
            return { ...job, status: 'error', error: message, files, processing: false }
          })
          resolve({ kind: 'error', error: message })
        }

        xhr.onabort = () => {
          uploadControllers.current.delete(jobId)
          const snapshotAfter = getJobSnapshot(jobId)
          const isPause = snapshotAfter?.pauseRequested
          updateJob(jobId, (job) => {
            if (!job) return job
            const files = job.files.map((f, idx) => {
              if (idx !== fileIndex) return f
              return { ...f, status: isPause ? 'paused' : 'error', uploaded: Math.min(f.uploaded || 0, totalSize) }
            })
            const summary = summarizeUpload(files, job.totalBytes)
            return {
              ...job,
              files,
              ...summary,
              status: isPause ? 'paused' : 'error',
              error: isPause ? null : 'Upload interrupted.',
              pauseRequested: false,
              processing: isPause ? false : job.processing,
            }
          })
          resolve(isPause ? { kind: 'paused' } : { kind: 'error', error: 'Upload interrupted.' })
        }

        xhr.onreadystatechange = () => {
          if (xhr.readyState !== XMLHttpRequest.DONE) return
          uploadControllers.current.delete(jobId)
          if (xhr.status >= 200 && xhr.status < 300) {
            let data = null
            try { data = JSON.parse(xhr.responseText || '{}') } catch {}
            if (!data || typeof data !== 'object') {
              const message = 'Unexpected server response.'
              updateJob(jobId, (job) => {
                if (!job) return job
                const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'error', error: message } : f)
                return { ...job, status: 'error', error: message, files, processing: false }
              })
              resolve({ kind: 'error', error: message })
              return
            }
            const serverOffset = Number(data.offset || totalSize)
            const completed = !!data.complete
            updateJob(jobId, (job) => {
              if (!job) return job
              const files = job.files.map((f, idx) => {
                if (idx !== fileIndex) return f
                return {
                  ...f,
                  status: completed ? 'done' : 'pending',
                  uploaded: Math.min(totalSize, serverOffset),
                  error: null,
                }
              })
              const summary = summarizeUpload(files, job.totalBytes)
              return { ...job, files, ...summary }
            })
            resolve({ kind: completed ? 'success' : 'partial', data })
          } else {
            const message = `Upload failed (${xhr.status})`
            updateJob(jobId, (job) => {
              if (!job) return job
              const files = job.files.map((f, idx) => idx === fileIndex ? { ...f, status: 'error', error: message } : f)
              return { ...job, status: 'error', error: message, files, processing: false }
            })
            resolve({ kind: 'error', error: message })
          }
        }

        const params = new URLSearchParams({ path: targetPath, size: String(totalSize) })
        params.set('root', rootKey)
        xhr.open('PUT', `/api/upload?${params.toString()}`)
        xhr.setRequestHeader('X-Upload-Offset', String(offset))
        xhr.send(chunk)
      })
    }

    async function runUploadSequence(jobId) {
      const completedPayloads = []
      const locallyCompleted = new Set()
      while (true) {
        const job = getJobSnapshot(jobId)
        if (!job) return
        if (job.pauseRequested || job.status === 'paused') {
          updateJob(jobId, (current) => {
            if (!current) return current
            return { ...current, status: 'paused', pauseRequested: false, processing: false }
          })
          return
        }
        if (job.status === 'error') {
          updateJob(jobId, (current) => (current ? { ...current, processing: false } : current))
          return
        }
        const nextIndex = job.files.findIndex((f, idx) => f.status !== 'done' && !locallyCompleted.has(idx))
        if (nextIndex === -1) {
          let finalizeFailed = false
          if (completedPayloads.length) {
            updateJob(jobId, (current) => (current ? { ...current, status: 'finalizing' } : current))
            try {
              const latestSnapshot = getJobSnapshot(jobId) || job
              const aggregated = aggregateUploadResults(latestSnapshot, completedPayloads)
              if (aggregated) {
                await handleUploadInfo(aggregated)
              }
            } catch (err) {
              console.error('[upload] finalize failed', err)
              finalizeFailed = true
            }
          }
          if (finalizeFailed) {
            updateJob(jobId, (current) => (current ? { ...current, status: 'error', error: 'Failed to register content.', processing: false } : current))
            return
          }
          updateJob(jobId, (current) => {
            if (!current) return current
            const summary = summarizeUpload(current.files, current.totalBytes)
            return { ...current, status: 'done', processing: false, pauseRequested: false, ...summary }
          })
          setToast({ kind: 'ok', text: 'Upload complete' })
          setTimeout(() => { removeUploadJob(jobId) }, 800)
          return
        }
        const outcome = await uploadFile(jobId, nextIndex)
        if (outcome.kind === 'success') {
          locallyCompleted.add(nextIndex)
          completedPayloads.push({ ...outcome.data })
          continue
        }
        if (outcome.kind === 'partial') {
          updateJob(jobId, (current) => (current ? { ...current, status: 'uploading' } : current))
          continue
        }
        if (outcome.kind === 'skipped') {
          locallyCompleted.add(nextIndex)
          updateJob(jobId, (current) => {
            if (!current) return current
            const summary = summarizeUpload(current.files, current.totalBytes)
            return { ...current, status: 'uploading', ...summary }
          })
          continue
        }
        if (outcome.kind === 'paused' || outcome.kind === 'cancelled') {
          updateJob(jobId, (current) => (current ? { ...current, status: 'paused', pauseRequested: false, processing: false } : current))
          return
        }
        if (outcome.kind === 'error') {
          updateJob(jobId, (current) => (current ? { ...current, status: 'error', error: outcome.error || 'Upload failed.', processing: false } : current))
          return
        }
      }
    }

    function enqueueUpload(files, { prefix = '', autoStart = true, root: explicitRoot, rootLabel: explicitLabel } = {}) {
      const cleaned = Array.isArray(files) ? files.filter((item) => item && item.file) : []
      if (!cleaned.length) return null
      let root = explicitRoot || uploadRoot || 'uploads'
      let rootInfo = rootOptionMap.get(root) || null
      if (!rootInfo || rootInfo.writable === false) {
        const writableFallback = writableRootOptions.find((opt) => opt && opt.key === root)
          || writableRootOptions.find((opt) => opt && opt.key === 'uploads')
          || writableRootOptions[0]
        if (writableFallback) {
          root = writableFallback.key
          rootInfo = writableFallback
        } else if (rootOptionMap.has('uploads')) {
          root = 'uploads'
          rootInfo = rootOptionMap.get(root) || null
        }
      }
      const resolvedRootLabel = explicitLabel || (rootInfo?.label || (root === 'docRoot' ? 'Doc Root' : root))
      const id = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const totalBytes = cleaned.reduce((sum, entry) => sum + (entry.file?.size || 0), 0)
      const roots = uniqueRoots(cleaned)
      const stagingLabel = roots.length === 1 ? roots[0] : `${cleaned.length} items`
      const label = stagingLabel || (cleaned[0]?.file?.name || 'Upload')
      const prefixClean = prefix.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '')
      const pathDisplay = `[${resolvedRootLabel}] ${prefixClean ? `${prefixClean.replace(/[\\]+/g, '/')}/` : ''}${label}`
      const meta = cleaned.map(({ file, rel }) => ({
        rel,
        size: file?.size || 0,
        lastModified: file?.lastModified || 0,
        name: file?.name || '',
      }))
      const fileStates = cleaned.map(({ file, rel }) => ({
        file,
        rel,
        size: file?.size || 0,
        uploaded: 0,
        status: 'pending',
        error: null,
      }))
      const job = {
        id,
        kind: cleaned.length === 1 ? 'file' : 'dir',
        path: pathDisplay,
        label,
        status: autoStart ? 'queued' : 'ready',
        progress: 0,
        files: fileStates,
        prefix,
        root,
        rootLabel: resolvedRootLabel,
        totalBytes,
        uploadedBytes: 0,
        error: null,
        createdAt: Date.now(),
        meta,
        processing: false,
        pauseRequested: false,
      }
      setUploadJobs((prev) => [...prev, job])
      if (autoStart) {
        setTimeout(() => { startUploadJob(id) }, 0)
      }
      return id
    }

    function removeUploadJob(id) {
      const ctrl = uploadControllers.current.get(id)
      if (ctrl?.xhr && typeof ctrl.xhr.abort === 'function') {
        try { ctrl.xhr.abort() } catch {}
      }
      uploadControllers.current.delete(id)
      setUploadJobs((prev) => prev.filter((job) => job.id !== id))
    }

    function pauseUploadJob(id) {
      updateJob(id, (job) => {
        if (!job || job.status === 'done') return job
        return { ...job, pauseRequested: true }
      })
      const ctrl = uploadControllers.current.get(id)
      if (ctrl?.xhr && typeof ctrl.xhr.abort === 'function') {
        try { ctrl.xhr.abort() } catch {}
      } else {
        updateJob(id, (job) => {
          if (!job) return job
          return { ...job, status: 'paused', pauseRequested: false, processing: false }
        })
      }
    }

    function resumeUploadJob(id) {
      updateJob(id, (job) => {
        if (!job) return job
        const status = job.status === 'paused' ? 'queued' : job.status
        return { ...job, status, pauseRequested: false }
      })
      setTimeout(() => { startUploadJob(id) }, 0)
    }

    function startUploadJob(id) {
      const job = getJobSnapshot(id)
      if (!job) return
      if (job.processing) return
      if (!verifyJobFiles(job)) {
        updateJob(id, { status: 'error', error: 'Files changed or are no longer available.', processing: false })
        return
      }
      updateJob(id, (current) => {
        if (!current) return current
        return {
          ...current,
          status: current.status === 'paused' ? 'uploading' : 'checking',
          error: null,
          pauseRequested: false,
          processing: true,
        }
      })
      runUploadSequence(id).catch((err) => {
        console.error('[upload] sequence failed', err)
        updateJob(id, (current) => (current ? { ...current, status: 'error', error: 'Upload failed.', processing: false } : current))
      })
    }
    const trimmedFilter = filter.trim()
    const filtered = entries.filter(e => !trimmedFilter || (e.path.toLowerCase().includes(trimmedFilter.toLowerCase()) || (e.label||'').toLowerCase().includes(trimmedFilter.toLowerCase())))
    const noResultsActive = !!trimmedFilter && filtered.length === 0 && !uploadJobs.length
    const directoryOptions = useMemo(() => {
      const seen = new Set()
      const list = []
      const addOption = (path, label) => {
        if (typeof path !== 'string' || !path) return
        const normalized = normalizeFsPath(path)
        if (!normalized || seen.has(normalized)) return
        seen.add(normalized)
        list.push({ path, label: label || path })
      }
      const writableRoots = writableRootOptions
        .map((opt) => ({
          key: opt.key,
          label: opt.label || opt.key,
          base: normalizeFsPath(opt.path),
        }))
        .filter((opt) => opt.base)

      const docRootOpt = writableRootOptions.find((opt) => opt && opt.key === 'docRoot') || null
      if (docRootOpt) addOption(docRootOpt.path, docRootOpt.label || 'Doc Root')

      const writableKeys = new Set(writableRoots.map((opt) => opt.key))

      entries
        .filter((entry) => entry && entry.kind === 'dir' && typeof entry.path === 'string')
        .sort((a, b) => {
          const left = (a.label || a.path || '').toLowerCase()
          const right = (b.label || b.path || '').toLowerCase()
          if (left < right) return -1
          if (left > right) return 1
          return 0
        })
        .forEach((entry) => {
          const normalized = normalizeFsPath(entry.path)
          if (!normalized) return
          const owningRoot = writableRoots.find((root) => normalized === root.base || normalized.startsWith(`${root.base}/`))
          if (!owningRoot) return
          if (!writableKeys.has(owningRoot.key)) return
          const base = entry.path.split('/').pop() || entry.path
          const label = entry.label || humanizeName(base, 'dir')
          addOption(entry.path, label)
        })

      writableRootOptions
        .filter((opt) => opt && opt.key && opt.key !== 'docRoot')
        .forEach((opt) => addOption(opt.path, opt.label || opt.key))

      return list
    }, [entries, writableRootOptions])

    useEffect(() => {
      if (noResultsActive && !prevNoResultsRef.current) {
        setNoResultsToken(Date.now())
      }
      prevNoResultsRef.current = noResultsActive
    }, [noResultsActive])

    function validateFolderNameInput(name) {
      const trimmed = (name || '').trim()
      if (!trimmed) return { ok: false, error: 'Folder name is required.' }
      if (trimmed === '.' || trimmed === '..') return { ok: false, error: 'Folder name is invalid.' }
      if (/[\\/]/.test(trimmed)) return { ok: false, error: 'Folder name cannot contain slashes.' }
      return { ok: true, value: trimmed }
    }

    function deriveRootForAbsolutePath(absPath) {
      const normalized = normalizeFsPath(absPath)
      if (!normalized) return null
      let best = null
      for (const opt of writableRootOptions) {
        if (!opt || !opt.path || !opt.key) continue
        const base = normalizeFsPath(opt.path)
        if (!base) continue
        if (normalized === base || normalized.startsWith(`${base}/`)) {
          const prefixRaw = normalized === base ? '' : normalized.slice(base.length + 1)
          const prefix = prefixRaw.replace(/^\/+/, '')
          if (!best || base.length > best.baseLength) {
            best = {
              root: opt.key,
              prefix,
              rootLabel: opt.label || opt.key,
              baseLength: base.length,
            }
          }
        }
      }
      if (!best) return null
      return { root: best.root, prefix: best.prefix, rootLabel: best.rootLabel }
    }

    function stageSelectionAt(choice) {
      const files = pendingSelection?.files || []
      if (!files.length) {
        setPendingSelection(null)
        return
      }
      if (!choice) {
        setPendingSelection(null)
        return
      }
      let rootKey = uploadRoot
      let rootLabel = activeRoot?.label || uploadRoot
      let prefix = ''

      const finish = () => {
        const normalizedPrefix = normalizeFsPath(prefix)
        const id = enqueueUpload(files, { prefix: normalizedPrefix, autoStart: false, root: rootKey, rootLabel })
        if (id) {
          setUploadRoot(rootKey)
          setToast({ kind: 'ok', text: `Staged ${files.length} item${files.length === 1 ? '' : 's'}.` })
        } else {
          setToast({ kind: 'err', text: 'Failed to stage files.' })
        }
        setPendingSelection(null)
      }

      if (choice.kind === 'existing') {
        if (choice.rootKey && typeof choice.relativePath === 'string') {
          rootKey = choice.rootKey
          const base = rootOptionMap.get(rootKey) || null
          rootLabel = choice.rootLabel || base?.label || rootKey
          prefix = choice.relativePath
          finish()
          return
        }
        const pathInput = choice.absolutePath || choice.path
        if (!pathInput) {
          setToast({ kind: 'err', text: 'No destination path provided.' })
          setPendingSelection(null)
          return
        }
        const mapping = deriveRootForAbsolutePath(pathInput)
        if (!mapping) {
          setToast({ kind: 'err', text: 'Unable to resolve destination path.' })
          setPendingSelection(null)
          return
        }
        rootKey = mapping.root
        rootLabel = mapping.rootLabel
        prefix = mapping.prefix
        finish()
        return
      }

      if (choice.kind === 'new') {
        const validation = validateFolderNameInput(choice.name)
        if (!validation.ok) {
          setToast({ kind: 'err', text: validation.error })
          return
        }
        const folderName = validation.value
        if (choice.rootKey) {
          rootKey = choice.rootKey
          const baseRoot = rootOptionMap.get(rootKey) || null
          rootLabel = baseRoot?.label || choice.rootLabel || rootKey
          const parentPath = normalizeFsPath(choice.parentPath || '')
          prefix = parentPath ? `${parentPath}/${folderName}` : folderName
          finish()
          return
        }
        const parentAbs = choice.parentAbsolute || choice.absolutePath || ''
        if (parentAbs) {
          const mapping = deriveRootForAbsolutePath(parentAbs)
          if (!mapping) {
            setToast({ kind: 'err', text: 'Unable to resolve destination path.' })
            setPendingSelection(null)
            return
          }
          rootKey = mapping.root
          rootLabel = mapping.rootLabel
          const parentPrefix = normalizeFsPath(mapping.prefix || '')
          prefix = parentPrefix ? `${parentPrefix}/${folderName}` : folderName
          finish()
          return
        }
        const fallback = writableRootOptions.find((opt) => opt && opt.key === 'docRoot')
          || writableRootOptions.find((opt) => opt && opt.key === uploadRoot)
          || writableRootOptions[0]
          || rootOptions.find((opt) => opt && opt.key === 'docRoot')
          || activeRoot
          || rootOptions[0]
        if (!fallback) {
          setToast({ kind: 'err', text: 'No destination roots configured.' })
          setPendingSelection(null)
          return
        }
        rootKey = fallback.key
        rootLabel = fallback.label || fallback.key
        prefix = folderName
        finish()
        return
      }

      setToast({ kind: 'err', text: 'Unsupported destination type.' })
      setPendingSelection(null)
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

    async function openEntry(e) {
      onSelect?.(e)
      requestClose()
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

    function triggerFilePicker() {
      try { fileSelectRef.current?.click() } catch {}
    }

    function triggerDirectoryPicker() {
      try { dirSelectRef.current?.click() } catch {}
    }

    function openDestinationPrompt(files) {
      if (!files || !files.length) return
      setPendingSelection({ files, id: `selection-${Date.now()}` })
    }

    function handleFileInputChange(e) {
      const collected = filesFromFileList(e?.target?.files)
      if (collected.length) {
        openDestinationPrompt(collected)
      }
      if (e?.target) e.target.value = ''
    }

    function handleDirInputChange(e) {
      const collected = filesFromFileList(e?.target?.files)
      if (collected.length) {
        openDestinationPrompt(collected)
      }
      if (e?.target) e.target.value = ''
    }

    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' } },
        React.createElement('div', {
          onClick: requestClose,
          style: {
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 220ms ease',
          },
        }),
        React.createElement('div', {
          style: {
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '560px',
            maxWidth: '95vw',
            background: 'var(--panel)',
            color: 'var(--text)',
            borderLeft: '1px solid var(--border)',
            boxShadow: '0 0 30px rgba(0,0,0,0.4)',
            pointerEvents: (!closeTimerRef.current && isVisible) ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column',
            transform: isVisible ? 'translateX(0)' : 'translateX(36px)',
            opacity: isVisible ? 1 : 0,
            transition: 'transform 220ms ease, opacity 220ms ease',
            willChange: 'transform, opacity',
          },
        },
          React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--border)' } },
            React.createElement('strong', null, 'Content Directory'),
            React.createElement('input', { placeholder: 'Filter…', value: filter, onChange: (e) => setFilter(e.target.value), style: { marginLeft: 'auto', flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' } }),
            React.createElement('button', { className: 'btn', onClick: triggerFilePicker, title: 'Select files to upload', 'aria-label': 'Select files' },
              React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>' } })
            ),
            React.createElement('button', { className: 'btn', onClick: triggerDirectoryPicker, title: 'Select folder to upload', 'aria-label': 'Select folder' },
              React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h5l2 2h9a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h5l2 2"></path><path d="M12 12v5"></path><path d="M9.5 14.5 12 17l2.5-2.5"></path></svg>' } })
            ),
            React.createElement('button', {
              className: 'btn',
              onClick: () => setServerPickerOpen(true),
              title: 'Add from server',
              'aria-label': 'Add from server'
            },
              React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"></rect><rect x="2" y="13" width="20" height="8" rx="2"></rect><line x1="6" y1="7" x2="6.01" y2="7"></line><line x1="6" y1="17" x2="6.01" y2="17"></line><line x1="10" y1="7" x2="10.01" y2="7"></line><line x1="10" y1="17" x2="10.01" y2="17"></line></svg>' } })
            ),
            React.createElement('button', { className: 'btn', onClick: requestClose, title: 'Close', 'aria-label': 'Close' },
              React.createElement('span', { dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' } })
            ),
            React.createElement('input', { type: 'file', ref: fileSelectRef, multiple: true, onChange: handleFileInputChange, style: { display: 'none' } }),
            React.createElement('input', { type: 'file', ref: dirSelectRef, multiple: true, onChange: handleDirInputChange, webkitdirectory: 'webkitdirectory', mozdirectory: 'mozdirectory', directory: 'directory', style: { display: 'none' } }),
        ),
        React.createElement('div', {
          style: {
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            border: dropActive ? '1px dashed var(--accent)' : '1px solid transparent',
            borderRadius: 10,
            transition: 'border 120ms ease, background 120ms ease',
            background: dropActive ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : 'transparent',
          },
          onDragOver: (e) => { e.preventDefault(); setDropActive(true) },
          onDragEnter: (e) => { e.preventDefault(); setDropActive(true) },
          onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false)
          },
          onDrop: async (e) => {
            e.preventDefault()
            setDropActive(false)
            const collected = await gatherFromDataTransfer(e.dataTransfer)
            if (!collected.length) {
              setToast({ kind: 'err', text: 'No files detected from drop.' })
              return
            }
            openDestinationPrompt(collected)
          },
        },
          ...uploadJobs.map((job) => React.createElement(Row, {
            key: job.id,
            entry: { id: job.id, path: job.path, label: job.label, kind: job.kind },
            status: job.status,
            selected: false,
            busy: job.status === 'uploading' || job.status === 'checking',
            onOpen: () => {},
            onContext: () => {},
            onStart: () => {},
            onStop: () => {},
            upload: job,
            onUploadStart: () => startUploadJob(job.id),
            onUploadPause: () => pauseUploadJob(job.id),
            onUploadResume: () => resumeUploadJob(job.id),
            onUploadClear: () => removeUploadJob(job.id),
          })),
          (loadingEntries && !uploadJobs.length)
            ? React.createElement('div', {
              className: 'loading-indicator loading-indicator--compact drawer-loading',
              style: { justifyContent: 'center' },
            },
              React.createElement('span', { className: 'loading-indicator__spinner', 'aria-hidden': 'true' }),
              React.createElement('span', null, 'Loading content…'),
            )
            : filtered.length
            ? filtered.map((e) => React.createElement(Row, {
              key: e.id,
              entry: e,
              status: servingMap.get(e.id) || 'idle',
              selected: selectedId === e.id,
              busy: busyId === e.id,
              onOpen: openEntry,
              onContext: ctx,
              onStart: startServing,
              onStop: stopServing,
            }))
            : (!uploadJobs.length && trimmedFilter
              ? React.createElement('div', {
                key: noResultsToken || 0,
                className: 'no-results-blur',
                style: {
                  margin: 'auto',
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                },
              },
                React.createElement('div', { style: { fontSize: 16, fontWeight: 600 } }, `No results for "${trimmedFilter}".`),
                React.createElement('div', {
                  style: {
                    marginTop: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                },
                  React.createElement('span', {
                    style: { display: 'inline-flex', width: 60, height: 60, color: 'var(--accent)' },
                    dangerouslySetInnerHTML: {
                      __html: '<svg viewBox="0 0 80 80" width="60" height="60" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M40 12v32"></path><polyline points="28 36 40 48 52 36"></polyline><path d="M18 50h44"></path><path d="M16 56l4 12h40l4-12"></path><path d="M20 72h40"></path><animateTransform attributeName="transform" type="translate" values="0 0; 0 3; 0 0" dur="1.1s" repeatCount="indefinite"/></svg>'
                    }
                  })
                ),
                React.createElement('div', {
                  style: {
                    marginTop: 14,
                    fontSize: 15,
                  },
                }, 'Drag files & folders here to add content.'),
              )
              : null),
        ),
        toast && React.createElement('div', { style: { padding: '8px 10px', borderTop: '1px solid var(--border)', background: toast.kind === 'ok' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: 'var(--text)' } }, toast.text),
        ),
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
      }),
      pendingSelection && React.createElement(DestinationModal, {
        selection: pendingSelection,
        directories: directoryOptions,
        rootOptions: writableRootOptions,
        resolveRoot: deriveRootForAbsolutePath,
        onClose: () => setPendingSelection(null),
        onStage: stageSelectionAt,
        validateFolderName: validateFolderNameInput,
      }),
      serverPickerOpen && React.createElement(ServerContentModal, {
        rootOptions,
        onClose: () => setServerPickerOpen(false),
        onConfirm: addServerSelection,
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
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '1000'
  document.body.appendChild(overlay)
  const root = ReactDOM.createRoot(overlay)
  const onClose = () => { try { root.unmount(); overlay.remove() } catch {} }
  root.render(React.createElement(Drawer, { onClose }))
}
