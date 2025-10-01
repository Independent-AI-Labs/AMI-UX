// React-based Select Media Modal
import { humanizeName, normalizeFsPath } from './utils.js'
import { createFileTreeToolkit, normalizeTreeFromApi } from './file-tree.js'
import { createDrawerChrome } from './drawer-chrome.js?v=20250306'
import { deriveMetaDirectory, openMetadataSettingsDialog } from './metadata-settings.js?v=20250306'
import { icon as iconMarkup, spinnerIcon as spinnerIconMarkup } from './icon-pack.js?v=20250306'
import { showToast } from './toast-manager.js?v=20250306'
import { dialogService } from './dialog-service.js?v=20250306'
import { openCreateDirectoryDialog } from './create-directory-dialog.js?v=20250306'
import { ensureReact as ensureReactRuntime } from './react-loader.js?v=20250306'

export { ensureReactRuntime as ensureReact }

const MODAL_CLOSE_DELAY = 260
const DRAWER_CLOSE_DELAY = 260

function createModalDialogFactory(React) {
  const { useEffect, useRef, useCallback, useMemo } = React

  return function ModalDialog({
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
    const overlayRef = useRef(null)
    const surfaceRef = useRef(null)
    const dialogHandleRef = useRef(null)
    const closeCallbackRef = useRef(onClose)
    const idRef = useRef(null)

    if (!idRef.current) {
      idRef.current = `react-modal-${Math.random().toString(36).slice(2)}`
    }

    useEffect(() => {
      closeCallbackRef.current = onClose
    }, [onClose])

    useEffect(() => {
      // allowBackdropClose is captured on mount; changing it mid-flight would require tearing
      // down the controller, which also dispatches close events. Treat it as static here.
      const overlayEl = overlayRef.current
      const surfaceEl = surfaceRef.current
      if (!overlayEl || !surfaceEl) return

      const dialogId = idRef.current
      const handle = dialogService.register(dialogId, {
        overlay: overlayEl,
        surface: surfaceEl,
        allowBackdropClose,
        closeDelay: MODAL_CLOSE_DELAY,
        onClose: () => {
          closeCallbackRef.current?.()
        },
      })
      dialogHandleRef.current = handle
      handle.open()

      return () => {
        dialogService.unregister(dialogId)
        dialogHandleRef.current = null
      }
    }, [])

    const requestClose = useCallback(
      (immediate = false) => {
        const handle = dialogHandleRef.current
        if (handle) {
          handle.close(immediate)
        } else {
          closeCallbackRef.current?.()
        }
      },
      [],
    )

    const normalizedActions = useMemo(() => {
      if (!Array.isArray(actions)) return []
      return actions
        .filter(Boolean)
        .slice(0, 4)
        .map((action, index) => ({
          key: action.key || `action_${index}`,
          label: action.label || `Action ${index + 1}`,
          onClick: action.onClick,
          disabled: !!action.disabled,
          variant:
            action.variant || (action.dismiss
              ? 'subtle'
              : index === 0
                ? 'primary'
                : 'subtle'),
          type: action.type || 'button',
          dismiss: action.dismiss === true,
          style: action.style || null,
          fullWidth: action.fullWidth || false,
          placement:
            action.placement === 'start' || action.placement === 'end'
              ? action.placement
              : action.dismiss
                ? 'start'
                : 'end',
        }))
    }, [actions])

    let endPlacementInjected = false
    const renderAction = (action) => {
      const variant = action.variant || 'primary'
      const classes = ['dialog-button']
      if (variant === 'danger') classes.push('dialog-button--danger')
      else if (variant === 'ghost') classes.push('dialog-button--ghost')
      else if (variant === 'outline') classes.push('dialog-button--outline')
      else if (variant !== 'primary') classes.push('dialog-button--subtle')
      if (action.fullWidth) classes.push('dialog-button--wide')
      const label = String(action.label || '').trim() || 'Action'
      const inlineStyle = action.style ? { ...action.style } : {}
      if (action.placement === 'end' && !action.fullWidth) {
        if (!endPlacementInjected) {
          endPlacementInjected = true
          if (
            inlineStyle.marginLeft === undefined &&
            inlineStyle.marginInlineStart === undefined &&
            inlineStyle.marginInlineEnd === undefined
          ) {
            inlineStyle.marginLeft = 'auto'
          }
        }
      }
      const styleProp = Object.keys(inlineStyle).length ? inlineStyle : undefined
      return React.createElement(
        'button',
        {
          key: action.key,
          className: classes.join(' '),
          onClick: (event) => {
            if (action.disabled) return
            const result = action.onClick ? action.onClick(event, requestClose) : null
            if (action.dismiss || result === 'close') requestClose()
          },
          disabled: action.disabled,
          type: action.type,
          style: styleProp,
        },
        label,
      )
    }

    const surfaceStyle = {
      '--dialog-min-width': minWidth,
      '--dialog-max-width': maxWidth,
      ...contentStyle,
    }

    return React.createElement(
      'div',
      {
        className: 'dialog-backdrop',
        ref: overlayRef,
      },
      React.createElement(
        'div',
        {
          className: 'dialog-surface',
          ref: surfaceRef,
          style: surfaceStyle,
          onMouseDown: (event) => event.stopPropagation(),
        },
        React.createElement(
          'div',
          { className: 'dialog-header' },
          React.createElement(
            'div',
            { className: 'dialog-header__titles' },
            React.createElement('h2', { className: 'dialog-title' }, title || 'Select Item'),
          ),
          React.createElement(
            'button',
            {
              className: 'icon-button dialog-close',
              onClick: (event) => {
                event.preventDefault()
                requestClose()
              },
              'aria-label': 'Close dialog',
              type: 'button',
              dangerouslySetInnerHTML: { __html: iconMarkup('close-line', { size: 20 }) },
            },
          ),
        ),
        React.createElement(
          'div',
          {
            className: 'dialog-content',
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              ...contentStyle,
            },
          },
          React.createElement(
            'div',
            {
              className: 'dialog-body',
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                ...bodyStyle,
              },
            },
            children,
          ),
          normalizedActions.length
            ? React.createElement(
                'div',
                {
                  className: 'dialog-footer',
                  style: {
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: footerAlign,
                    gap: 10,
                    paddingTop: 12,
                  },
                },
                normalizedActions.map(renderAction),
              )
            : null,
        ),
      ),
    )
  }
}

function createServerDirectoryModalFactory(React, { ModalDialog, FileTreeSelector }) {
  const { useMemo, useState, useEffect, useRef, useCallback } = React

  const findNodeInTree = (node, targetPath) => {
    if (!node) return null
    const normalizedTarget = normalizeFsPath(targetPath || '')
    const nodePath = normalizeFsPath(node.path || '')
    if (nodePath === normalizedTarget) return node
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = findNodeInTree(child, normalizedTarget)
        if (found) return found
      }
    }
    return null
  }

  return function ServerDirectoryModal({
    title = 'Select Directory',
    confirmLabel = 'Set',
    rootOptions = [],
    selectionMode = 'dir',
    initialSelection = null,
    onClose,
    onConfirm,
  }) {
    const effectiveRoots = useMemo(() => {
      const list = Array.isArray(rootOptions) ? rootOptions.filter((opt) => opt && opt.key) : []
      if (!list.length) return []
      const withWritableHint = list.map((opt) => ({
        ...opt,
        writable: opt.writable !== false,
      }))
      const writableRoots = withWritableHint.filter((opt) => opt.writable)
      if (writableRoots.length) {
        return writableRoots.sort((a, b) => {
          const weight = (value) => {
            if (value.key === 'docRoot') return 0
            if (value.key === 'uploads') return 1
            return 2
          }
          return weight(a) - weight(b)
        })
      }
      return withWritableHint
    }, [rootOptions])

    const [treeRoots, setTreeRoots] = useState([])
    const [loadingTree, setLoadingTree] = useState(true)
    const [treeError, setTreeError] = useState('')
    const [selectedDetail, setSelectedDetail] = useState(null)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [creating, setCreating] = useState(false)
    const [reloadToken, setReloadToken] = useState(0)

    const pendingSelectionRef = useRef(null)

    useEffect(() => {
      let alive = true
      setLoadingTree(true)
      setTreeError('')
      const load = async () => {
        const accum = []
        const usedKeys = new Set()
        for (const opt of effectiveRoots) {
          if (!opt || !opt.key) continue
          if (usedKeys.has(opt.key)) continue
          usedKeys.add(opt.key)
          try {
            const query = opt.key === 'docRoot' ? '' : `?root=${encodeURIComponent(opt.key)}`
            const res = await fetch(`/api/tree${query}`)
            if (!res.ok) throw new Error('failed')
            const data = await res.json()
            const normalized = normalizeTreeFromApi(data, {
              rootKey: opt.key,
              label: opt.label || opt.key,
              rootAbsolute: opt.path,
              writable: opt.writable !== false,
            })
            if (normalized) accum.push(normalized)
          } catch {
            // ignore individual root failures
          }
        }
        if (alive) {
          if (!accum.length) setTreeError('No server paths available.')
          setTreeRoots(accum)
        }
      }
      load()
        .catch(() => {
          if (alive) {
            setTreeRoots([])
            setTreeError('Failed to load server tree.')
          }
        })
        .finally(() => {
          if (alive) setLoadingTree(false)
        })
      return () => {
        alive = false
      }
    }, [effectiveRoots, reloadToken])

    const resolveSelection = useCallback(
      (target) => {
        if (!target) return null
        const root = treeRoots.find((item) => item && item.key === target.rootKey)
        if (!root) return null
        const node = findNodeInTree(root.node, target.path || '') || null
        if (!node) return null
        return {
          rootKey: root.key,
          path: node.path || '',
          node,
          root,
        }
      },
      [treeRoots],
    )

    useEffect(() => {
      if (!treeRoots.length) return
      if (pendingSelectionRef.current) {
        const resolved = resolveSelection(pendingSelectionRef.current)
        if (resolved) {
          setSelectedDetail(resolved)
          pendingSelectionRef.current = null
          return
        }
      }
      if (!selectedDetail && initialSelection) {
        const resolved = resolveSelection(initialSelection)
        if (resolved) {
          setSelectedDetail(resolved)
          return
        }
      }
      if (!selectedDetail && treeRoots.length) {
        const first = treeRoots[0]
        if (first && first.node) {
          setSelectedDetail({ rootKey: first.key, path: first.node.path || '', node: first.node, root: first })
        }
      }
    }, [treeRoots, selectedDetail, initialSelection, resolveSelection])

    const handleSelectionChange = useCallback((payload) => {
      if (!payload) {
        setSelectedDetail(null)
        return
      }
      setSelectedDetail({
        rootKey: payload.rootKey,
        path: payload.node.path || '',
        node: payload.node,
        root: payload.root,
      })
      setError('')
    }, [])

    const handleCreateDirectory = useCallback(async () => {
      if (!selectedDetail?.node || selectedDetail.node.type !== 'dir') {
        setError('Select a directory to create inside.')
        return
      }
      if (selectedDetail.root?.writable === false) {
        setError('Selected directory is read-only.')
        return
      }
      setError('')
      const baseLabel = selectedDetail.root?.label || selectedDetail.rootKey
      const parentDisplay = selectedDetail.node.path
        ? `${baseLabel}/${selectedDetail.node.path}`
        : baseLabel
      const result = await openCreateDirectoryDialog({
        title: 'Create Directory',
        description: `Create inside ${parentDisplay}.`,
        placeholder: 'Directory name',
        ariaLabel: 'Directory name',
        validate: (name) => {
          const trimmed = (name || '').trim()
          if (!trimmed) return { ok: false, error: 'Folder name is required.' }
          if (trimmed === '.' || trimmed === '..') return { ok: false, error: 'Folder name is invalid.' }
          if (/[\\/]/.test(trimmed)) return { ok: false, error: 'Folder name cannot contain slashes.' }
          return { ok: true, value: trimmed }
        },
      })
      if (!result || result.ok === false) return
      const folderName = result.name
      if (!folderName) return
      setCreating(true)
      try {
        const payload = {
          root: selectedDetail.rootKey,
          parent: selectedDetail.node.path || '',
          name: folderName,
        }
        const response = await fetch('/api/tree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || 'Failed to create directory.')
        }
        const basePath = selectedDetail.node.path || ''
        const sanitizedBase = basePath ? basePath.replace(/[\\/]+$/g, '') : ''
        const fallbackPath = sanitizedBase ? `${sanitizedBase}/${folderName}` : folderName
        pendingSelectionRef.current = {
          rootKey: data.rootKey || selectedDetail.rootKey,
          path: data.path || fallbackPath,
        }
        setReloadToken((value) => value + 1)
        showToast('Directory created.', { tone: 'success' })
      } catch (creationError) {
        setError(creationError?.message || 'Failed to create directory.')
      } finally {
        setCreating(false)
      }
    }, [selectedDetail])

    const confirmDisabled = useMemo(() => {
      if (!selectedDetail) return true
      const type = selectedDetail.node?.type
      if (selectionMode === 'dir') return type !== 'dir'
      if (selectionMode === 'file') return type !== 'file'
      return false
    }, [selectedDetail, selectionMode])

    const handleSubmit = useCallback(async () => {
      if (confirmDisabled || !selectedDetail) {
        setError('Select a valid item.')
        return
      }
      setSubmitting(true)
      setError('')
      try {
        const detail = {
          rootKey: selectedDetail.rootKey,
          rootLabel: selectedDetail.root?.label || selectedDetail.rootKey,
          path: selectedDetail.node?.path || '',
          absolutePath: selectedDetail.node?.absolutePath || '',
          type: selectedDetail.node?.type || 'dir',
        }
        if (onConfirm) {
          const result = await onConfirm(detail)
          if (result && result.ok === false) {
            setError(result.error || 'Action failed.')
            setSubmitting(false)
            return
          }
        }
        onClose?.()
      } catch (submitError) {
        setError(submitError?.message || 'Action failed.')
        setSubmitting(false)
        return
      }
      setSubmitting(false)
    }, [confirmDisabled, onConfirm, onClose, selectedDetail])

    const actions = useMemo(
      () => [
        {
          key: 'cancel',
          label: 'Cancel',
          onClick: (_event, requestClose) => {
            if (typeof requestClose === 'function') requestClose()
          },
          variant: 'subtle',
          dismiss: true,
        },
        {
          key: 'confirm',
          label: submitting ? `${confirmLabel}…` : confirmLabel,
          onClick: handleSubmit,
          disabled: submitting || confirmDisabled,
          variant: 'primary',
        },
      ],
      [confirmLabel, confirmDisabled, handleSubmit, submitting],
    )

    const canCreate = !!(
      selectedDetail &&
      selectedDetail.node?.type === 'dir' &&
      selectedDetail.root?.writable !== false &&
      !creating
    )

    const toolbar = React.createElement(
      'div',
      { className: 'server-directory-modal__toolbar' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'dialog-button dialog-button--subtle',
          onClick: handleCreateDirectory,
          disabled: !canCreate,
        },
        creating ? 'Creating…' : 'New Folder',
      ),
    )

    const body = React.createElement(
      React.Fragment,
      null,
      toolbar,
      loadingTree
        ? React.createElement('div', { className: 'muted', style: { fontSize: '13px' } }, 'Loading server files…')
        : React.createElement(FileTreeSelector, {
            roots: treeRoots,
            selectionMode,
            selected: selectedDetail
              ? { rootKey: selectedDetail.rootKey, path: selectedDetail.path }
              : null,
            onSelectionChange: handleSelectionChange,
            allowCreate: false,
          }),
      !loadingTree && treeError
        ? React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, treeError)
        : null,
      error ? React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, error) : null,
    )

    return React.createElement(
      ModalDialog,
      {
        title,
        onClose,
        actions,
        bodyStyle: { display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 },
      },
      body,
    )
  }
}

// Overhauled: openSelectMediaModal now opens a Library drawer
export async function openSelectMediaModal({ onSelect } = {}) {
  const { React, ReactDOM } = await ensureReactRuntime()
  const { useEffect, useRef, useState, useMemo, useCallback } = React
  const { FileTreeSelector } = createFileTreeToolkit(React)
  const { DrawerHeader, DrawerListItem } = createDrawerChrome(React)
  const ModalDialogComponent = createModalDialogFactory(React)
  const ServerDirectoryModal = createServerDirectoryModalFactory(React, {
    ModalDialog: ModalDialogComponent,
    FileTreeSelector,
  })

  const ICONS = {
    file: iconMarkup('file-3-line'),
    folder: iconMarkup('folder-3-line'),
    app: iconMarkup('window-2-line'),
    play: iconMarkup('play-circle-line'),
    pause: iconMarkup('pause-circle-line'),
    stop: iconMarkup('stop-circle-line'),
    retry: iconMarkup('refresh-line'),
    clear: iconMarkup('delete-bin-6-line'),
  }

  const spinnerIcon = spinnerIconMarkup()

  const joinWithBullet = (nodes) => {
    const filtered = (Array.isArray(nodes) ? nodes : []).filter(Boolean)
    if (!filtered.length) return null
    if (filtered.length === 1) return filtered[0]
    const children = []
    filtered.forEach((node, index) => {
      if (index > 0) {
        children.push(
          React.createElement(
            'span',
            { key: `sep-${index}`, className: 'drawer-list-item__separator', 'aria-hidden': 'true' },
            '•',
          ),
        )
      }
      if (React.isValidElement(node)) {
        children.push(React.cloneElement(node, { key: `node-${index}` }))
      } else {
        children.push(node)
      }
    })
    return React.createElement(React.Fragment, null, ...children)
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
        '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
      ].join('\n')
      document.head.appendChild(style)
    }
  })()

  function Row({
    entry,
    status,
    selected,
    busy,
    onOpen,
    onContext,
    onStart,
    onStop,
    upload,
    onUploadStart,
    onUploadPause,
    onUploadResume,
    onUploadClear,
  }) {
    const isUpload = !!upload
    if (isUpload || busy) ensureUploadStyles()

    const uploadStatus = upload?.status || 'ready'
    const kind = upload?.kind || entry?.kind || 'file'
    const icon = kind === 'dir' ? ICONS.folder : kind === 'app' ? ICONS.app : ICONS.file

    const pathValue = entry?.path || ''
    const metaPathValue = pathValue ? deriveMetaDirectory(pathValue) : ''
    const pathNode = metaPathValue
      ? React.createElement(
          'span',
          {
            className: 'drawer-list-item__path',
            'data-hint': metaPathValue,
            'data-hint-tone': 'info',
            title: metaPathValue,
          },
          pathValue,
        )
      : pathValue || null
    const base = pathValue.split('/').pop() || pathValue
    const label =
      upload?.label ||
      entry?.label ||
      (kind === 'file' ? humanizeName(base, 'file') : base) ||
      pathValue ||
      'Untitled item'

    let statusText = ''
    let statusTone = 'muted'
    const detailParts = []

    let progressValue = null
    let progressIndeterminate = false

    if (isUpload) {
      const fileCount = upload?.files?.length || 0
      const totalBytes = upload?.totalBytes || 0
      if (fileCount) detailParts.push(`${fileCount} item${fileCount === 1 ? '' : 's'}`)
      if (totalBytes) detailParts.push(formatBytes(totalBytes))

      const uploadedBytes = upload?.uploadedBytes || 0
      const explicitProgress =
        typeof upload?.progress === 'number' && Number.isFinite(upload.progress)
          ? Math.max(0, Math.min(1, upload.progress))
          : null
      const derivedProgress =
        totalBytes > 0 ? Math.max(0, Math.min(1, uploadedBytes / totalBytes)) : null
      progressValue = explicitProgress ?? derivedProgress

      if (uploadStatus === 'ready') {
        statusText = 'Ready to upload'
      } else if (uploadStatus === 'paused') {
        statusText = 'Upload paused'
      } else if (uploadStatus === 'error') {
        statusText = upload?.error || 'Upload failed'
        statusTone = 'danger'
      } else if (uploadStatus === 'done') {
        statusText = 'Upload complete'
        statusTone = 'success'
      } else if (uploadStatus === 'finalizing') {
        statusText = 'Finalizing…'
      } else if (uploadStatus === 'checking') {
        statusText = 'Checking files…'
      } else if (uploadStatus === 'queued') {
        statusText = 'Queued for upload'
      } else if (uploadStatus === 'uploading') {
        statusText = progressValue != null ? `Uploading ${Math.round(progressValue * 100)}%` : 'Uploading…'
      }

      if (
        progressValue == null &&
        ['uploading', 'checking', 'queued', 'finalizing'].includes(uploadStatus)
      ) {
        progressIndeterminate = true
      }
    } else {
      const meta = entry?.metrics || entry?.meta || {}
      const itemValue =
        typeof meta.items === 'number'
          ? meta.items
          : typeof meta.itemCount === 'number'
            ? meta.itemCount
            : null
      if (itemValue != null) detailParts.push(`${itemValue} item${itemValue === 1 ? '' : 's'}`)
      const bytesValue =
        typeof meta.bytes === 'number'
          ? meta.bytes
          : typeof meta.size === 'number'
            ? meta.size
            : null
      if (bytesValue != null) detailParts.push(formatBytes(bytesValue))
      if (meta.truncated) detailParts.push('Partial scan')
      if (status === 'starting') statusText = 'Starting…'
      if (busy) statusText = statusText || 'Working…'
      progressIndeterminate = busy
    }

    const detailLine = detailParts.length ? detailParts.join(' • ') : null
    let statusColor = null
    if (statusTone === 'danger') statusColor = '#ef4444'
    else if (statusTone === 'success') statusColor = 'var(--ok)'
    else if (statusTone === 'info') statusColor = 'var(--accent)'

    const statusNode = statusText
      ? React.createElement('span', { style: statusColor ? { color: statusColor } : undefined }, statusText)
      : null

    const normalizeLine = (value) => {
      if (!value) return null
      if (typeof value === 'string' && !value.trim()) return null
      return value
    }

    let primaryLine = null
    let secondaryLine = null

    if (isUpload) {
      const displayPath = pathNode || pathValue
      primaryLine =
        normalizeLine(statusNode) ||
        normalizeLine(detailLine) ||
        normalizeLine(displayPath) ||
        'Queued upload'
      const secondaryParts = []
      if (detailLine && detailLine !== primaryLine) secondaryParts.push(detailLine)
      if (displayPath && displayPath !== primaryLine) secondaryParts.push(displayPath)
      secondaryLine = joinWithBullet(secondaryParts)
    } else {
      const displayPath = pathNode || pathValue
      primaryLine = normalizeLine(displayPath) || normalizeLine(statusNode) || normalizeLine(detailLine)
      const secondaryParts = []
      if (statusNode && primaryLine !== statusNode) secondaryParts.push(statusNode)
      if (detailLine && detailLine !== primaryLine) secondaryParts.push(detailLine)
      secondaryLine = joinWithBullet(secondaryParts)
    }

    const actions = []
    if (isUpload) {
      if (['uploading', 'checking', 'queued', 'finalizing'].includes(uploadStatus)) {
        actions.push({
          key: 'pause',
          icon: ICONS.pause,
          label: 'Pause upload',
          onClick: () => onUploadPause?.(upload),
          disabled: uploadStatus === 'finalizing',
          variant: 'ghost',
        })
      } else if (uploadStatus === 'paused') {
        actions.push({
          key: 'resume',
          icon: ICONS.play,
          label: 'Resume upload',
          onClick: () => onUploadResume?.(upload),
          variant: 'accent',
        })
        actions.push({
          key: 'clear',
          icon: ICONS.clear,
          label: 'Remove from queue',
          onClick: () => onUploadClear?.(upload),
          variant: 'danger',
        })
      } else if (uploadStatus === 'error') {
        actions.push({
          key: 'retry',
          icon: ICONS.retry,
          label: 'Retry upload',
          onClick: () => onUploadStart?.(upload),
          variant: 'accent',
        })
        actions.push({
          key: 'clear',
          icon: ICONS.clear,
          label: 'Remove from queue',
          onClick: () => onUploadClear?.(upload),
          variant: 'danger',
        })
      } else if (uploadStatus === 'ready') {
        actions.push({
          key: 'start',
          icon: ICONS.play,
          label: 'Start upload',
          onClick: () => onUploadStart?.(upload),
          variant: 'accent',
        })
        actions.push({
          key: 'clear',
          icon: ICONS.clear,
          label: 'Remove from queue',
          onClick: () => onUploadClear?.(upload),
          variant: 'danger',
        })
      } else if (uploadStatus === 'done') {
        actions.push({
          key: 'clear',
          icon: ICONS.clear,
          label: 'Remove from queue',
          onClick: () => onUploadClear?.(upload),
          variant: 'ghost',
        })
      }
    } else {
      if (status === 'starting') {
        actions.push({
          key: 'starting',
          icon: spinnerIcon,
          label: 'Starting…',
          disabled: true,
          variant: 'accent',
        })
      } else {
        const isRunning = status === 'running'
        actions.push({
          key: 'serve-toggle',
          icon: isRunning ? ICONS.stop : ICONS.play,
          label: isRunning ? 'Stop serving' : 'Start serving',
          onClick: () => (isRunning ? onStop?.(entry) : onStart?.(entry)),
          variant: isRunning ? 'danger' : 'accent',
          disabled: busy,
        })
      }
    }

    const showProgressBar = isUpload || busy
    let footer = null
    if (showProgressBar) {
      const barClasses = ['drawer-list-item__progress-bar']
      if (progressIndeterminate || progressValue == null) barClasses.push('is-indeterminate')
      footer = React.createElement(
        'div',
        { className: 'drawer-list-item__progress' },
        React.createElement('div', {
          className: barClasses.join(' '),
          style:
            progressValue != null
              ? { width: `${Math.max(progressValue, 0.02) * 100}%` }
              : undefined,
        }),
      )
    }

    const subtitles = [normalizeLine(primaryLine), normalizeLine(secondaryLine)].filter(Boolean)

    return React.createElement(DrawerListItem, {
      key: entry.id,
      icon,
      title: label,
      active: !isUpload && status === 'running',
      subtitles,
      actions,
      selected,
      footer,
      onDoubleClick: isUpload ? undefined : () => onOpen(entry),
      onContextMenu: isUpload ? undefined : (event) => onContext(event, entry),
    })
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

  function ContextMenu({
    x,
    y,
    serving,
    onClose,
    onPick,
    onStart,
    onStop,
    onRename,
    onCopyPath,
    onMeta,
    onDeleteLib,
    onDeleteDisk,
  }) {
    const startDisabled = !!serving
    const stopDisabled = !serving
    const metadataDisabled = typeof onMeta !== 'function'
    const vpW = window.innerWidth || 1200
    const vpH = window.innerHeight || 800
    const left = Math.min(x, vpW - 220)
    const top = Math.min(y, vpH - 180)
    const mkItem = (key, label, action, disabled = false) =>
      React.createElement(
        'div',
        {
          key,
          className: 'ctx',
          onClick: (e) => {
            e.stopPropagation()
            if (!disabled) {
              action()
              onClose()
            }
          },
          style: {
            padding: '8px 10px',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          },
        },
        label,
      )
    return React.createElement(
      'div',
      {
        className: 'media-ctx',
        style: {
          position: 'fixed',
          left,
          top,
          zIndex: 1603,
          background: 'var(--panel)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          minWidth: 220,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
        },
        onContextMenu: (e) => e.preventDefault(),
      },
      mkItem('open', 'Open', onPick),
      mkItem('start', 'Start Serving', onStart, startDisabled),
      mkItem('stop', 'Stop Serving', onStop, stopDisabled),
      mkItem('rename', 'Rename…', onRename, false),
      mkItem('copy', 'Copy Path', onCopyPath, false),
      mkItem('meta', 'Metadata Settings…', onMeta, metadataDisabled),
      React.createElement('div', {
        style: { height: 1, background: 'var(--border)', margin: '4px 0' },
      }),
      mkItem('del', 'Remove from Directory', onDeleteLib, false),
      mkItem('deld', 'Delete from Disk', onDeleteDisk, false),
    )
  }

  function DestinationModal({
    selection,
    directories,
    rootOptions = [],
    resolveRoot,
    onClose,
    onStage,
    validateFolderName,
  }) {
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
              const normalized = normalizeTreeFromApi(data, {
                rootKey: opt.key,
                label: opt.label || opt.key,
                rootAbsolute: opt.path,
                writable: opt.writable !== false,
              })
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
            key = `standalone_${safeBase}_${(suffix += 1)}`
          }
          usedKeys.add(key)
          accum.push({
            key,
            label: dir.label || dir.path,
            absolutePath: dir.path,
            writable: true,
            node: {
              name: dir.label || dir.path.split(/[\\/]/).pop() || 'Directory',
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
      load()
        .catch(() => {
          if (alive) {
            setTreeRoots([])
            setTreeError('Failed to load directories.')
          }
        })
        .finally(() => {
          if (alive) setLoadingTree(false)
        })
      return () => {
        alive = false
      }
    }, [directories, rootOptions, resolveRoot])

    useEffect(() => {
      if (!selectedDetail && treeRoots.length) {
        const first = treeRoots[0]
        if (first)
          setSelectedDetail({ rootKey: first.key, path: '', node: first.node, root: first })
      }
    }, [treeRoots, selectedDetail])

    const handleSelectionChange = (payload) => {
      if (!payload) {
        setSelectedDetail(null)
        return
      }
      setSelectedDetail({
        rootKey: payload.rootKey,
        path: payload.node.path || '',
        node: payload.node,
        root: payload.root,
      })
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

    const stageDisabled =
      loadingTree ||
      !selectedDetail ||
      selectedDetail.node.type !== 'dir' ||
      selectedDetail.root?.writable === false

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

    const loadingMessage = loadingTree
      ? React.createElement(
          'div',
          { className: 'muted', style: { fontSize: '13px' } },
          'Loading directories…',
        )
      : null

    const hasWritableRoots = treeRoots.some((root) => root && root.writable !== false)
    const selectedRootWritable = selectedDetail?.root?.writable !== false

    const body = React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'div',
        { className: 'muted', style: { fontSize: '13px', marginBottom: 6 } },
        `${fileCount} item${fileCount === 1 ? '' : 's'} • ${formatBytes(totalBytes)}`,
      ),
      loadingMessage ||
        React.createElement(FileTreeSelector, {
          roots: treeRoots,
          selectionMode: 'dir',
          selected: selectedDetail
            ? { rootKey: selectedDetail.rootKey, path: selectedDetail.path }
            : null,
          onSelectionChange: handleSelectionChange,
          allowCreate:
            !loadingTree && (selectedRootWritable || (!selectedDetail && hasWritableRoots)),
          onCreateRequest: handleCreateRequest,
          validateName: validateFolderName,
          onErrorMessage: (msg) => setError(msg || ''),
        }),
      !loadingTree &&
        treeError &&
        React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, treeError),
      error && React.createElement('div', { style: { color: '#ef4444', fontSize: '12px' } }, error),
    )

    return React.createElement(
      ModalDialogComponent,
      {
        title: 'Choose Destination',
        onClose,
        actions: [
          {
            key: 'stage',
            label: 'Stage',
            onClick: handleStage,
            disabled: stageDisabled,
            variant: 'primary',
          },
        ],
        maxWidth: '92vw',
        bodyStyle: { display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 },
        contentStyle: { maxWidth: '92vw' },
      },
      body,
    )
  }

  function Drawer({ onClose }) {
    const [entries, setEntries] = useState([])
    const [loadingEntries, setLoadingEntries] = useState(true)
    const [filter, setFilter] = useState('')
    const [menu, setMenu] = useState(null)
    const [servingMap, setServingMap] = useState(new Map())
    const [selectedId, setSelectedId] = useState(null)
    const [busyId, setBusyId] = useState(null)
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
    const overlayRef = useRef(null)
    const surfaceRef = useRef(null)
    const drawerHandleRef = useRef(null)
    const closeCallbackRef = useRef(onClose)
    const drawerIdRef = useRef(null)

    if (!drawerIdRef.current) {
      drawerIdRef.current = `content-drawer-${Math.random().toString(36).slice(2)}`
    }
    const writableRootOptions = useMemo(() => {
      if (!Array.isArray(rootOptions)) return []
      return rootOptions.filter((opt) => opt && opt.writable !== false)
    }, [rootOptions])
    const rootOptionMap = useMemo(() => {
      const map = new Map()
      if (Array.isArray(rootOptions)) {
        rootOptions.forEach((opt) => {
          if (opt && opt.key) map.set(opt.key, opt)
        })
      }
      return map
    }, [rootOptions])
    const activeRoot = rootOptionMap.get(uploadRoot) || null
    useEffect(() => {
      closeCallbackRef.current = onClose
    }, [onClose])
    useEffect(() => {
      const overlayEl = overlayRef.current
      const surfaceEl = surfaceRef.current
      if (!overlayEl || !surfaceEl) return

      const dialogId = drawerIdRef.current
      const handle = dialogService.register(dialogId, {
        overlay: overlayEl,
        surface: surfaceEl,
        allowBackdropClose: true,
        closeDelay: DRAWER_CLOSE_DELAY,
        onClose: () => {
          closeCallbackRef.current?.()
        },
      })
      drawerHandleRef.current = handle
      handle.open()

      return () => {
        dialogService.unregister(dialogId)
        drawerHandleRef.current = null
      }
    }, [])
    const requestClose = useCallback(
      (immediate = false) => {
        const handle = drawerHandleRef.current
        if (handle) {
          handle.close(immediate)
        } else {
          closeCallbackRef.current?.()
        }
      },
      [],
    )
    useEffect(() => {
      let alive = true
      ;(async () => {
        setLoadingEntries(true)
        await fetchEntries(() => alive)
        if (alive) setLoadingEntries(false)
      })()
      return () => {
        alive = false
      }
    }, [])
    useEffect(() => {
      uploadJobsRef.current = uploadJobs
    }, [uploadJobs])
    useEffect(() => {
      let alive = true
      ;(async () => {
        try {
          const r = await fetch('/api/media/list')
          const data = r.ok ? await r.json() : { roots: [] }
          if (!alive) return
          const list = Array.isArray(data.roots)
            ? data.roots.filter((item) => item && typeof item.path === 'string' && item.path)
            : []
          setRootOptions(list)
          const writableList = list.filter((item) => item && item.writable !== false)
          const hasCurrent = writableList.some((item) => item.key === uploadRoot)
          if (!hasCurrent) {
            const preferred =
              writableList.find((item) => item.key === 'docRoot') ||
              writableList.find((item) => item.key === 'uploads') ||
              writableList[0] ||
              list.find((item) => item.key === 'docRoot') ||
              list.find((item) => item.key === 'uploads') ||
              list[0]
            if (preferred) setUploadRoot(preferred.key)
          }
        } catch {
          if (alive) setRootOptions([])
        }
      })()
      return () => {
        alive = false
      }
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
      setUploadJobs((prev) =>
        prev.map((job) => {
          if (job.id !== id) return job
          const next = typeof patch === 'function' ? patch(job) : patch
          return { ...job, ...next }
        }),
      )
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
      const rootBaseAbsolute =
        typeof info.rootBaseAbsolute === 'string' ? info.rootBaseAbsolute : ''
      const rootBaseRelative =
        typeof info.rootBaseRelative === 'string' ? info.rootBaseRelative : ''
      const defaultPath =
        rootAbsolute ||
        rootRelative ||
        rootBaseAbsolute ||
        rootBaseRelative ||
        `files/uploads/${info.uploadedAt}`
      const joinPaths = (base, rel) => {
        if (!base) return rel || ''
        if (!rel) return base
        const sep = base.includes('\\') ? '\\' : '/'
        const baseClean = base.replace(/[\\/]+$/, '')
        const relClean = String(rel)
          .replace(/^[\\/]+/, '')
          .replace(/[\\/]+/g, sep)
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
        const targetPath =
          absoluteFilePath || joinPaths(rootAbsolute, relFilePath) || repoFilePath || defaultPath
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
          const match = refreshed.find(
            (entry) => typeof entry?.path === 'string' && normalizeFsPath(entry.path) === target,
          )
          if (match?.id) setSelectedId(match.id)
        }
      }
    }

    async function addServerSelection(detail) {
      const absPath = detail?.absolutePath || detail?.node?.absolutePath || ''
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
        const match = refreshed.find(
          (entry) => typeof entry?.path === 'string' && normalizeFsPath(entry.path) === target,
        )
        if (match?.id) setSelectedId(match.id)
      }
      showToast('Added to Library.', { tone: 'success' })
      return { ok: true }
    }
    function summarizeUpload(files, totalBytes) {
      const uploadedBytes = files.reduce(
        (sum, item) => sum + Math.min(item.uploaded || 0, item.size || 0),
        0,
      )
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
      const effectiveKind = isDirJob || files.length > 1 ? 'dir' : 'file'
      const rootKey = rootKeys.size === 1 ? Array.from(rootKeys)[0] : fallbackRootKey || ''
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
        const message =
          res.status === 409
            ? 'Upload conflict with existing file.'
            : 'Failed to fetch upload status.'
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
        const files = job.files.map((f, idx) =>
          idx === fileIndex ? { ...f, status: 'checking', error: null } : f,
        )
        return { ...job, status: 'checking', files }
      })

      let statusData
      try {
        statusData = await fetchUploadStatus(rootKey, targetPath, fileEntry.size, intent)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch upload status.'
        updateJob(jobId, (job) => {
          if (!job) return job
          const files = job.files.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'error', error: message } : f,
          )
          return { ...job, status: 'error', error: message, files, processing: false }
        })
        return { kind: 'error', error: message }
      }

      const offset = Number(statusData.offset) || 0
      const alreadyComplete = !!statusData.complete && offset >= fileEntry.size

      if (alreadyComplete) {
        updateJob(jobId, (job) => {
          if (!job) return job
          const files = job.files.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'done', uploaded: f.size, error: null } : f,
          )
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
          const files = job.files.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'error', error: message } : f,
          )
          return { ...job, status: 'error', error: message, files, processing: false }
        })
        return { kind: 'error', error: message }
      }

      updateJob(jobId, (job) => {
        if (!job) return job
        const files = job.files.map((f, idx) =>
          idx === fileIndex ? { ...f, status: 'uploading', uploaded: offset, error: null } : f,
        )
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
            const files = job.files.map((f, idx) =>
              idx === fileIndex ? { ...f, uploaded: absolute } : f,
            )
            const summary = summarizeUpload(files, job.totalBytes)
            return { ...job, files, ...summary }
          })
        }

        xhr.onerror = () => {
          uploadControllers.current.delete(jobId)
          const message = 'Upload failed. Check your connection.'
          updateJob(jobId, (job) => {
            if (!job) return job
            const files = job.files.map((f, idx) =>
              idx === fileIndex ? { ...f, status: 'error', error: message } : f,
            )
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
              return {
                ...f,
                status: isPause ? 'paused' : 'error',
                uploaded: Math.min(f.uploaded || 0, totalSize),
              }
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
            try {
              data = JSON.parse(xhr.responseText || '{}')
            } catch {}
            if (!data || typeof data !== 'object') {
              const message = 'Unexpected server response.'
              updateJob(jobId, (job) => {
                if (!job) return job
                const files = job.files.map((f, idx) =>
                  idx === fileIndex ? { ...f, status: 'error', error: message } : f,
                )
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
              const files = job.files.map((f, idx) =>
                idx === fileIndex ? { ...f, status: 'error', error: message } : f,
              )
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
        const nextIndex = job.files.findIndex(
          (f, idx) => f.status !== 'done' && !locallyCompleted.has(idx),
        )
        if (nextIndex === -1) {
          let finalizeFailed = false
          if (completedPayloads.length) {
            updateJob(jobId, (current) =>
              current ? { ...current, status: 'finalizing' } : current,
            )
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
            updateJob(jobId, (current) =>
              current
                ? {
                    ...current,
                    status: 'error',
                    error: 'Failed to register content.',
                    processing: false,
                  }
                : current,
            )
            return
          }
          updateJob(jobId, (current) => {
            if (!current) return current
            const summary = summarizeUpload(current.files, current.totalBytes)
            return {
              ...current,
              status: 'done',
              processing: false,
              pauseRequested: false,
              ...summary,
            }
          })
          showToast('Upload complete', { tone: 'success' })
          setTimeout(() => {
            removeUploadJob(jobId)
          }, 800)
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
          updateJob(jobId, (current) =>
            current
              ? { ...current, status: 'paused', pauseRequested: false, processing: false }
              : current,
          )
          return
        }
        if (outcome.kind === 'error') {
          updateJob(jobId, (current) =>
            current
              ? {
                  ...current,
                  status: 'error',
                  error: outcome.error || 'Upload failed.',
                  processing: false,
                }
              : current,
          )
          return
        }
      }
    }

    function enqueueUpload(
      files,
      { prefix = '', autoStart = true, root: explicitRoot, rootLabel: explicitLabel } = {},
    ) {
      const cleaned = Array.isArray(files) ? files.filter((item) => item && item.file) : []
      if (!cleaned.length) return null
      let root = explicitRoot || uploadRoot || 'uploads'
      let rootInfo = rootOptionMap.get(root) || null
      if (!rootInfo || rootInfo.writable === false) {
        const writableFallback =
          writableRootOptions.find((opt) => opt && opt.key === root) ||
          writableRootOptions.find((opt) => opt && opt.key === 'uploads') ||
          writableRootOptions[0]
        if (writableFallback) {
          root = writableFallback.key
          rootInfo = writableFallback
        } else if (rootOptionMap.has('uploads')) {
          root = 'uploads'
          rootInfo = rootOptionMap.get(root) || null
        }
      }
      const resolvedRootLabel =
        explicitLabel || rootInfo?.label || (root === 'docRoot' ? 'Doc Root' : root)
      const id = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const totalBytes = cleaned.reduce((sum, entry) => sum + (entry.file?.size || 0), 0)
      const roots = uniqueRoots(cleaned)
      const stagingLabel = roots.length === 1 ? roots[0] : `${cleaned.length} items`
      const label = stagingLabel || cleaned[0]?.file?.name || 'Upload'
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
        setTimeout(() => {
          startUploadJob(id)
        }, 0)
      }
      return id
    }

    function removeUploadJob(id) {
      const ctrl = uploadControllers.current.get(id)
      if (ctrl?.xhr && typeof ctrl.xhr.abort === 'function') {
        try {
          ctrl.xhr.abort()
        } catch {}
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
        try {
          ctrl.xhr.abort()
        } catch {}
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
      setTimeout(() => {
        startUploadJob(id)
      }, 0)
    }

    function startUploadJob(id) {
      const job = getJobSnapshot(id)
      if (!job) return
      if (job.processing) return
      if (!verifyJobFiles(job)) {
        updateJob(id, {
          status: 'error',
          error: 'Files changed or are no longer available.',
          processing: false,
        })
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
        updateJob(id, (current) =>
          current
            ? { ...current, status: 'error', error: 'Upload failed.', processing: false }
            : current,
        )
      })
    }
    const trimmedFilter = filter.trim()
    const filtered = entries.filter(
      (e) =>
        !trimmedFilter ||
        e.path.toLowerCase().includes(trimmedFilter.toLowerCase()) ||
        (e.label || '').toLowerCase().includes(trimmedFilter.toLowerCase()),
    )
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
          const owningRoot = writableRoots.find(
            (root) => normalized === root.base || normalized.startsWith(`${root.base}/`),
          )
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
      if (trimmed === '.' || trimmed === '..')
        return { ok: false, error: 'Folder name is invalid.' }
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
        const id = enqueueUpload(files, {
          prefix: normalizedPrefix,
          autoStart: false,
          root: rootKey,
          rootLabel,
        })
        if (id) {
          setUploadRoot(rootKey)
          showToast(`Staged ${files.length} item${files.length === 1 ? '' : 's'}.`, {
            tone: 'success',
          })
        } else {
          showToast('Failed to stage files.', { tone: 'danger' })
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
          showToast('No destination path provided.', { tone: 'danger' })
          setPendingSelection(null)
          return
        }
        const mapping = deriveRootForAbsolutePath(pathInput)
        if (!mapping) {
          showToast('Unable to resolve destination path.', { tone: 'danger' })
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
          showToast(validation.error, { tone: 'danger' })
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
            showToast('Unable to resolve destination path.', { tone: 'danger' })
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
        const fallback =
          writableRootOptions.find((opt) => opt && opt.key === 'docRoot') ||
          writableRootOptions.find((opt) => opt && opt.key === uploadRoot) ||
          writableRootOptions[0] ||
          rootOptions.find((opt) => opt && opt.key === 'docRoot') ||
          activeRoot ||
          rootOptions[0]
        if (!fallback) {
          showToast('No destination roots configured.', { tone: 'danger' })
          setPendingSelection(null)
          return
        }
        rootKey = fallback.key
        rootLabel = fallback.label || fallback.key
        prefix = folderName
        finish()
        return
      }

      showToast('Unsupported destination type.', { tone: 'danger' })
      setPendingSelection(null)
    }

    // Close context menu on Escape or click outside
    useEffect(() => {
      if (!menu) return
      const onKey = (e) => {
        if (e.key === 'Escape') setMenu(null)
      }
      const onClick = (e) => {
        const t = e.target
        const inMenu = t && typeof t.closest === 'function' && t.closest('.media-ctx')
        if (!inMenu) setMenu(null)
      }
      window.addEventListener('keydown', onKey)
      window.addEventListener('mousedown', onClick)
      return () => {
        window.removeEventListener('keydown', onKey)
        window.removeEventListener('mousedown', onClick)
      }
    }, [menu])

    // Toast auto-dismiss

    // Serving poller
    useEffect(() => {
      let alive = true
      const tick = async () => {
        if (!alive) return
        await refreshServing()
      }
      refreshServing()
      const h = setInterval(tick, 5000)
      return () => {
        alive = false
        clearInterval(h)
      }
    }, [])

    async function refreshServing() {
      try {
        const r = await fetch('/api/serve')
        const j = r.ok ? await r.json() : { instances: [] }
        const map = new Map()
        ;(j.instances || []).forEach((i) => {
          map.set(i.entryId, i.status || 'running')
        })
        setServingMap(map)
      } catch {
        setServingMap(new Map())
      }
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
      setServingMap((prev) => {
        const next = new Map(prev)
        next.set(id, status)
        return next
      })
    }
    async function startServing(entry) {
      // Optimistic update for snappy UX
      updateServing(entry.id, 'starting')
      try {
        const r = await fetch('/api/serve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: entry.id }),
        })
        if (!r.ok) throw new Error('start failed')
        updateServing(entry.id, 'running')
        showToast('Serving started', { tone: 'success' })
      } catch {
        updateServing(entry.id, 'stopped')
        showToast('Failed to start', { tone: 'danger' })
      }
    }
    async function stopServing(entry) {
      updateServing(entry.id, 'stopped')
      try {
        const list = await fetch('/api/serve')
          .then((r) => r.json())
          .catch(() => ({ instances: [] }))
        const inst = (list.instances || []).find((i) => i.entryId === entry.id)
        if (!inst) return
        await fetch(`/api/serve/${inst.id}`, { method: 'DELETE' })
        showToast('Serving stopped', { tone: 'success' })
      } catch {
        updateServing(entry.id, 'running')
        showToast('Failed to stop', { tone: 'danger' })
      }
    }
    async function delLib(entry) {
      setBusyId(entry.id)
      try {
        await fetch(`/api/library/${entry.id}`, { method: 'DELETE' })
        setEntries((ents) => ents.filter((x) => x.id !== entry.id))
        showToast('Removed from Library', { tone: 'success' })
      } catch {
        showToast('Failed to remove', { tone: 'danger' })
      } finally {
        setBusyId(null)
      }
    }
    async function delDisk(entry) {
      if (!confirm('Delete files from disk?')) return
      setBusyId(entry.id)
      try {
        await fetch(`/api/library/${entry.id}/delete`, { method: 'POST' })
        setEntries((ents) => ents.filter((x) => x.id !== entry.id))
        showToast('Deleted from disk', { tone: 'success' })
      } catch {
        showToast('Failed to delete', { tone: 'danger' })
      } finally {
        setBusyId(null)
      }
    }

    function triggerFilePicker() {
      try {
        fileSelectRef.current?.click()
      } catch {}
    }

    function triggerDirectoryPicker() {
      try {
        dirSelectRef.current?.click()
      } catch {}
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

    const drawerContent = React.createElement(
      'div',
      { className: 'drawer-shell content-drawer-shell' },
      React.createElement(DrawerHeader, {
        title: 'Content Directory',
        description: 'Serve, upload, and manage workspace resources without leaving the shell.',
        onClose: requestClose,
        closeLabel: 'Close content directory',
        filter: {
          placeholder: 'Filter…',
          ariaLabel: 'Filter content',
          value: filter,
          onChange: (event) => setFilter(event.target.value),
        },
        actions: [
          {
            key: 'upload-files',
            label: 'Select files to upload',
            icon: iconMarkup('upload-2-line'),
            onClick: triggerFilePicker,
          },
          {
            key: 'upload-folder',
            label: 'Select folder to upload',
            icon: iconMarkup('folder-add-line'),
            onClick: triggerDirectoryPicker,
          },
          {
            key: 'server-source',
            label: 'Add from server',
            icon: iconMarkup('server-line'),
            onClick: () => setServerPickerOpen(true),
          },
        ],
      }),
      React.createElement('input', {
        type: 'file',
        ref: fileSelectRef,
        multiple: true,
        onChange: handleFileInputChange,
        style: { display: 'none' },
      }),
      React.createElement('input', {
        type: 'file',
        ref: dirSelectRef,
        multiple: true,
        onChange: handleDirInputChange,
        webkitdirectory: 'webkitdirectory',
        mozdirectory: 'mozdirectory',
        directory: 'directory',
        style: { display: 'none' },
      }),
      React.createElement(
        'div',
        {
          className: `drawer-list drawer-list--droppable content-drawer__list${dropActive ? ' is-drop-active' : ''}`,
          'data-drop-state': dropActive ? 'active' : 'idle',
          onDragOver: (e) => {
            e.preventDefault()
            setDropActive(true)
          },
          onDragEnter: (e) => {
            e.preventDefault()
            setDropActive(true)
          },
          onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false)
          },
          onDrop: async (e) => {
            e.preventDefault()
            setDropActive(false)
            const collected = await gatherFromDataTransfer(e.dataTransfer)
            if (!collected.length) {
              showToast('No files detected from drop.', { tone: 'warning' })
              return
            }
            openDestinationPrompt(collected)
          },
        },
        ...uploadJobs.map((job) =>
          React.createElement(Row, {
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
          }),
        ),
        loadingEntries && !uploadJobs.length
          ? React.createElement(
              'div',
              {
                className: 'loading-indicator loading-indicator--compact drawer-loading',
                style: { justifyContent: 'center' },
              },
              React.createElement('span', {
                className: 'loading-indicator__spinner',
                'aria-hidden': 'true',
              }),
              React.createElement('span', null, 'Loading content…'),
            )
          : filtered.length
            ? filtered.map((entry) =>
                React.createElement(Row, {
                  key: entry.id,
                  entry,
                  status: servingMap.get(entry.id) || 'idle',
                  selected: selectedId === entry.id,
                  busy: busyId === entry.id,
                  onOpen: openEntry,
                  onContext: ctx,
                  onStart: startServing,
                  onStop: stopServing,
                }),
              )
            : !uploadJobs.length && trimmedFilter
              ? React.createElement(
                  'div',
                  {
                    key: noResultsToken || 0,
                    className: 'no-results-blur',
                    style: {
                      margin: 'auto',
                      padding: '40px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                    },
                  },
                  React.createElement(
                    'div',
                    { style: { fontSize: 16, fontWeight: 600 } },
                    `No results for "${trimmedFilter}".`,
                  ),
                  React.createElement(
                    'div',
                    {
                      style: {
                        marginTop: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    },
                    React.createElement('span', {
                      style: {
                        display: 'inline-flex',
                        width: 60,
                        height: 60,
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      },
                      dangerouslySetInnerHTML: {
                        __html: iconMarkup('upload-cloud-2-line', { size: 56 }),
                      },
                    }),
                  ),
                  React.createElement(
                    'div',
                    {
                      style: {
                        marginTop: 14,
                        fontSize: 15,
                      },
                    },
                    'Drag files & folders here to add content.',
                  ),
                )
              : null,
      ),
    )

    const surfaceNode = React.createElement(
      'div',
      {
        className: 'drawer-surface content-drawer-surface',
        ref: surfaceRef,
      },
      drawerContent,
    )

    const overlayNode = React.createElement(
      'div',
      {
        className:
          'dialog-backdrop dialog-backdrop--right account-drawer-backdrop content-drawer-backdrop',
        ref: overlayRef,
      },
      surfaceNode,
    )

    const portalChildren = [
      overlayNode,
      menu &&
        React.createElement('div', {
          style: { position: 'fixed', inset: 0, zIndex: 1602, pointerEvents: 'auto' },
          onClick: () => setMenu(null),
        }),
      menu &&
        React.createElement(ContextMenu, {
          x: menu.x,
          y: menu.y,
          serving: (servingMap.get(menu.entry.id) || 'stopped') === 'running',
          onClose: () => setMenu(null),
          onPick: () => openEntry(menu.entry),
          onStart: async () => {
            await startServing(menu.entry)
            await refreshServing()
          },
          onStop: async () => {
            await stopServing(menu.entry)
            await refreshServing()
          },
          onRename: async () => {
            const cur = menu.entry.label || ''
            const next = prompt('New label:', cur)
            if (next == null) return
            await fetch(`/api/library/${menu.entry.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label: next }),
            })
            const j = await fetch('/api/library')
              .then((r) => r.json())
              .catch(() => ({ entries: [] }))
            setEntries(j.entries || [])
          },
          onCopyPath: async () => {
            const p = menu.entry.path
            try {
              await navigator.clipboard.writeText(p)
            } catch {}
          },
          onMeta: () => {
            const entryPath = menu.entry.path || ''
            if (!entryPath) return
            const metaPath = deriveMetaDirectory(entryPath)
            const mapping = deriveRootForAbsolutePath(entryPath)
            openMetadataSettingsDialog({
              label: menu.entry.label || entryPath.split(/[\\/]/).pop() || entryPath,
              path: entryPath,
              metaPath,
              rootKey: mapping?.root || '',
              rootLabel: mapping?.rootLabel || '',
              relativePath: mapping?.prefix || '',
            })
          },
          onDeleteLib: () => delLib(menu.entry),
          onDeleteDisk: () => delDisk(menu.entry),
        }),
      pendingSelection &&
        React.createElement(DestinationModal, {
          selection: pendingSelection,
          directories: directoryOptions,
          rootOptions: writableRootOptions,
          resolveRoot: deriveRootForAbsolutePath,
          onClose: () => setPendingSelection(null),
          onStage: stageSelectionAt,
          validateFolderName: validateFolderNameInput,
        }),
      serverPickerOpen &&
        React.createElement(ServerDirectoryModal, {
          title: 'Add From Server',
          confirmLabel: 'Add',
          selectionMode: 'any',
          rootOptions,
          onClose: () => setServerPickerOpen(false),
          onConfirm: addServerSelection,
        }),
    ].filter(Boolean)

    return React.createElement(React.Fragment, null, portalChildren)
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
        } catch {
          setItems([])
        }
        setLoading(false)
      })()
      return () => {
        alive = false
      }
    }, [])
    if (loading) return React.createElement('div', { className: 'muted' }, 'Loading…')
    if (!items.length)
      return React.createElement('div', { className: 'muted' }, 'No recent entries.')
    return React.createElement(
      'div',
      null,
      ...items.map((e, i) =>
        React.createElement(
          'button',
          {
            key: i,
            className: 'dialog-button dialog-button--list',
            style: { margin: '6px 0' },
            title: e.path,
            onClick: () => onPick(e),
          },
          `[${(e.mode || e.type || '').toUpperCase()}] ${e.path}`,
        ),
      ),
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
        } catch {
          setRoots([])
        }
        setLoading(false)
      })()
      return () => {
        alive = false
      }
    }, [])
    if (loading) return React.createElement('div', { className: 'muted' }, 'Loading…')
    return React.createElement(
      'div',
      null,
      React.createElement('div', { className: 'muted', style: { marginBottom: '6px' } }, 'Roots'),
      ...roots.map((e, i) =>
        React.createElement(
          'button',
          {
            key: i,
            className: 'dialog-button dialog-button--list',
            style: { margin: '6px 0' },
            title: e.path,
            onClick: () => onPick({ type: 'dir', path: e.path, mode: 'C' }),
          },
          `[DIR] ${[e.label || '', e.path].filter(Boolean).join(' ')}`,
        ),
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
      } catch {
        setInfo({ kind: 'err', text: 'Not found or unsupported.' })
      }
    }
    return React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        React.createElement('input', {
          type: 'text',
          ref: inputRef,
          placeholder: 'Enter absolute or repo-relative path',
          style: {
            flex: 1,
            padding: '6px 8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            borderRadius: '6px',
          },
        }),
        React.createElement('button', { className: 'dialog-button', onClick: validate }, 'Validate'),
      ),
      React.createElement(
        'div',
        { style: { marginTop: '12px' }, className: 'muted' },
        info.kind === 'info' && info.text,
        info.kind === 'err' && info.text,
        info.kind === 'ok' &&
          React.createElement(
            React.Fragment,
            null,
            `Type: ${info.type}${info.hasJs ? ' (has JS)' : ''} `,
              React.createElement(
                'button',
                {
                  className: 'dialog-button dialog-button--subtle',
                  onClick: () => onPick({ type: info.type, path: info.path, mode: info.mode }),
                },
                'Select',
              ),
          ),
      ),
    )
  }

  // Mount modal
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.zIndex = '1600'
  document.body.appendChild(overlay)
  const root = ReactDOM.createRoot(overlay)
  const onClose = () => {
    try {
      root.unmount()
      overlay.remove()
    } catch {}
  }
  root.render(React.createElement(Drawer, { onClose }))
}

export async function openServerDirectoryPicker(options = {}) {
  const {
    title = 'Select Directory',
    confirmLabel = 'Select',
    selectionMode = 'dir',
    rootOptions = null,
    initialSelection = null,
  } = options

  const { React, ReactDOM } = await ensureReactRuntime()
  const { FileTreeSelector } = createFileTreeToolkit(React)
  const ModalDialogComponent = createModalDialogFactory(React)
  const ServerDirectoryModal = createServerDirectoryModalFactory(React, {
    ModalDialog: ModalDialogComponent,
    FileTreeSelector,
  })

  let effectiveRoots = Array.isArray(rootOptions) ? rootOptions : null
  if (!effectiveRoots || !effectiveRoots.length) {
    try {
      const res = await fetch('/api/media/list')
      const data = res.ok ? await res.json() : { roots: [] }
      effectiveRoots = Array.isArray(data.roots) ? data.roots : []
    } catch {
      effectiveRoots = []
    }
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = '1700'
    document.body.appendChild(overlay)

    const root = ReactDOM.createRoot(overlay)
    let settled = false

    const finalize = (result) => {
      if (settled) return
      settled = true
      try {
        root.unmount()
      } catch {}
      try {
        overlay.remove()
      } catch {}
      resolve(result)
    }

    const handleConfirm = async (detail) => {
      finalize(detail || null)
      return { ok: true }
    }

    root.render(
      React.createElement(ServerDirectoryModal, {
        title,
        confirmLabel,
        selectionMode,
        rootOptions: effectiveRoots || [],
        initialSelection,
        onClose: () => finalize(null),
        onConfirm: handleConfirm,
      }),
    )
  })
}
