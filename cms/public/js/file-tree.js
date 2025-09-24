import { normalizeFsPath } from './utils.js'

function joinFsPath(base, rel) {
  const baseStr = typeof base === 'string' ? base : ''
  const relStr = typeof rel === 'string' ? rel : ''
  if (!baseStr) return normalizeFsPath(relStr) || relStr
  if (!relStr) return normalizeFsPath(baseStr) || baseStr
  const sep = baseStr.includes('\\') ? '\\' : '/'
  const baseClean = baseStr.replace(/[\\/]+$/, '')
  const relClean = relStr.replace(/^[\\/]+/, '').replace(/[\\/]+/g, sep)
  return `${baseClean}${sep}${relClean}`
}

function cloneNodeWithAbsolute(node, rootAbsolute) {
  if (!node || typeof node !== 'object') return null
  const rel = typeof node.path === 'string' ? node.path : ''
  const abs = joinFsPath(rootAbsolute, rel)
  const next = {
    name: node.name || '',
    path: rel,
    type: node.type === 'dir' ? 'dir' : 'file',
    absolutePath: abs,
  }
  if (Array.isArray(node.children) && node.children.length) {
    next.children = node.children
      .map((child) => cloneNodeWithAbsolute(child, rootAbsolute))
      .filter(Boolean)
  } else {
    next.children = []
  }
  return next
}

export function normalizeTreeFromApi(payload, options = {}) {
  if (!payload || typeof payload !== 'object') return null
  const rootKey = options.rootKey || payload.rootKey || 'docRoot'
  const rootAbsolute = options.rootAbsolute || payload.rootAbsolute || ''
  const rootLabel =
    options.label || payload.label || payload.rootLabel || payload.title || payload.name || rootKey
  const rootWritable = options.writable !== false
  const clonedRoot = cloneNodeWithAbsolute(payload, rootAbsolute)
  if (!clonedRoot) return null
  if (!clonedRoot.name) clonedRoot.name = rootLabel || rootKey
  return {
    key: rootKey,
    label: rootLabel,
    absolutePath: rootAbsolute,
    node: clonedRoot,
    writable: rootWritable,
  }
}

function nodeKey(rootKey, path) {
  const rel = typeof path === 'string' ? path : ''
  const normalized = normalizeFsPath(rel)
  return `${rootKey}::${normalized || '__root__'}`
}

function buildNodeIndex(roots) {
  const index = new Map()
  if (!Array.isArray(roots)) return index
  roots.forEach((root) => {
    if (!root || !root.node) return
    const visit = (node) => {
      if (!node) return
      index.set(nodeKey(root.key, node.path || ''), { root, node })
      if (Array.isArray(node.children)) {
        node.children.forEach(visit)
      }
    }
    visit(root.node)
  })
  return index
}

const ICONS = {
  chevronRight:
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>',
  chevronDown:
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
  folder:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h5.5l2 2H21a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"></path><path d="M2 10.5h20"></path></svg>',
  file: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
}

function isSelectableNode(node, mode) {
  if (!node) return false
  if (mode === 'dir') return node.type === 'dir'
  if (mode === 'file') return node.type === 'file'
  return true
}

export function createFileTreeToolkit(React) {
  const { useMemo, useState, useEffect, useRef, useCallback } = React

  function FileTree({
    roots = [],
    selectionMode = 'dir',
    selected = null,
    onSelect = null,
    onActivate = null,
    disabledPaths = [],
    style = {},
    emptyLabel = 'No items',
  }) {
    const disabledSet = useMemo(() => {
      const set = new Set()
      if (Array.isArray(disabledPaths)) {
        disabledPaths.forEach((p) => {
          const norm = normalizeFsPath(p)
          if (norm) set.add(norm)
        })
      }
      return set
    }, [disabledPaths])

    const [expanded, setExpanded] = useState(() => {
      const next = new Set()
      roots.forEach((root) => {
        if (root?.key) next.add(nodeKey(root.key, root.node?.path || ''))
      })
      return next
    })

    const signature = useMemo(() => {
      return roots
        .map((root) => `${root?.key || 'root'}:${(root?.node?.children || []).length}`)
        .join('|')
    }, [roots])
    const prevSignature = useRef(signature)
    useEffect(() => {
      if (prevSignature.current !== signature) {
        const next = new Set()
        roots.forEach((root) => {
          if (root?.key) next.add(nodeKey(root.key, root.node?.path || ''))
        })
        setExpanded(next)
        prevSignature.current = signature
      }
    }, [signature, roots])

    const selectedKey = selected ? nodeKey(selected.rootKey, selected.path || '') : null

    const toggle = useCallback((rootKey, path) => {
      const key = nodeKey(rootKey, path)
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }, [])

    const handleSelect = useCallback(
      (payload, activate = false) => {
        if (!payload || !payload.node) return
        const norm = normalizeFsPath(payload.node.absolutePath || payload.node.path || '')
        if (norm && disabledSet.has(norm)) return
        if (!isSelectableNode(payload.node, selectionMode)) return
        if (onSelect) onSelect(payload)
        if (activate && onActivate) onActivate(payload)
      },
      [onSelect, onActivate, disabledSet, selectionMode],
    )

    const rows = []
    const renderNode = (root, node, depth = 0) => {
      if (!node) return
      const key = nodeKey(root.key, node.path || '')
      const isDir = node.type === 'dir'
      const isExpanded = isDir && expanded.has(key)
      const isSelected = selectedKey === key
      const selectable =
        isSelectableNode(node, selectionMode) &&
        !disabledSet.has(normalizeFsPath(node.absolutePath || node.path || ''))
      const paddingLeft = 12 + depth * 16
      const arrow = isDir
        ? React.createElement('button', {
            type: 'button',
            onClick: (e) => {
              e.stopPropagation()
              toggle(root.key, node.path || '')
            },
            style: {
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              padding: 0,
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            },
            tabIndex: -1,
            dangerouslySetInnerHTML: {
              __html: isExpanded ? ICONS.chevronDown : ICONS.chevronRight,
            },
          })
        : React.createElement('span', { style: { width: 22, height: 22, display: 'inline-flex' } })
      const icon = React.createElement('span', {
        style: {
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDir ? 'var(--accent)' : 'var(--text)',
        },
        dangerouslySetInnerHTML: { __html: isDir ? ICONS.folder : ICONS.file },
      })
      const label = React.createElement(
        'span',
        {
          style: {
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: depth === 0 ? 600 : 500,
            fontSize: '13px',
          },
          title: node.absolutePath || node.path || '',
        },
        depth === 0 ? root.label || node.name || root.key : node.name || '(unnamed)',
      )
      const row = React.createElement(
        'div',
        {
          key: key,
          role: 'treeitem',
          'aria-level': depth + 1,
          'aria-expanded': isDir ? isExpanded : undefined,
          'aria-selected': isSelected || undefined,
          style: {
            padding: '4px 8px',
            paddingLeft,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: '6px',
            cursor: selectable ? 'pointer' : 'default',
            background: isSelected
              ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
              : 'transparent',
            color: 'var(--text)',
            userSelect: 'none',
          },
          onClick: () => {
            if (selectable) handleSelect({ rootKey: root.key, root, node })
          },
          onDoubleClick: () => {
            if (isDir) toggle(root.key, node.path || '')
            if (selectable) handleSelect({ rootKey: root.key, root, node }, true)
          },
        },
        arrow,
        icon,
        label,
      )
      rows.push(row)
      if (
        isDir &&
        (isExpanded || depth === 0) &&
        Array.isArray(node.children) &&
        node.children.length
      ) {
        node.children.forEach((child) => renderNode(root, child, depth + 1))
      }
    }
    roots.forEach((root) => {
      if (root?.node) {
        renderNode(root, root.node, 0)
      }
    })

    if (!rows.length) {
      rows.push(
        React.createElement(
          'div',
          { key: 'empty', className: 'muted', style: { padding: '8px 12px', fontSize: '13px' } },
          emptyLabel,
        ),
      )
    }

    return React.createElement(
      'div',
      {
        role: 'tree',
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxHeight: '320px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '4px 0',
          background: 'var(--bg)',
          ...style,
        },
      },
      rows,
    )
  }

  function FileTreeSelector({
    roots = [],
    selectionMode = 'dir',
    selected = null,
    onSelectionChange = null,
    allowCreate = false,
    onCreateRequest = null,
    validateName = null,
    createLabel = 'Create folder here',
    newFolderPlaceholder = 'Folder name',
    errorMessage = '',
    onErrorMessage = null,
  }) {
    const [folderName, setFolderName] = useState('')
    const [localError, setLocalError] = useState('')

    useEffect(() => {
      if (errorMessage) setLocalError(errorMessage)
    }, [errorMessage])

    const index = useMemo(() => buildNodeIndex(roots), [roots])
    const selectedKey = selected ? nodeKey(selected.rootKey, selected.path || '') : null
    const selectedEntry = selectedKey ? index.get(selectedKey) || null : null
    const canCreate = allowCreate && selectedEntry && selectedEntry.node.type === 'dir'

    const handleSelect = (payload) => {
      if (onSelectionChange)
        onSelectionChange({
          rootKey: payload.rootKey,
          path: payload.node.path || '',
          node: payload.node,
          root: payload.root,
        })
      setLocalError('')
    }

    const handleCreate = () => {
      if (!canCreate) {
        setLocalError('Select a destination folder first.')
        if (onErrorMessage) onErrorMessage('Select a destination folder first.')
        return
      }
      const raw = folderName || ''
      const trimmed = raw.trim()
      if (!trimmed) {
        setLocalError('Folder name is required.')
        if (onErrorMessage) onErrorMessage('Folder name is required.')
        return
      }
      let validated = trimmed
      if (typeof validateName === 'function') {
        try {
          const result = validateName(trimmed)
          if (!result || result.ok === false) {
            const msg = result?.error || 'Folder name is invalid.'
            setLocalError(msg)
            if (onErrorMessage) onErrorMessage(msg)
            return
          }
          if (result.value) validated = result.value
        } catch {
          setLocalError('Folder name is invalid.')
          if (onErrorMessage) onErrorMessage('Folder name is invalid.')
          return
        }
      }
      if (onCreateRequest) {
        const parentAbs = selectedEntry?.node?.absolutePath || ''
        const parentPath = selectedEntry?.node?.path || ''
        const nextAbs = joinFsPath(parentAbs, validated)
        onCreateRequest({
          rootKey: selectedEntry?.root?.key || selected?.rootKey,
          parentPath,
          parentAbsolute: parentAbs,
          name: validated,
          absolutePath: nextAbs,
          root: selectedEntry?.root || null,
        })
      }
      setFolderName('')
      setLocalError('')
      if (onErrorMessage) onErrorMessage('')
    }

    return React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      React.createElement(FileTree, {
        roots,
        selectionMode,
        selected,
        onSelect: handleSelect,
      }),
      allowCreate &&
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          React.createElement(
            'div',
            { className: 'muted', style: { fontSize: '12px' } },
            'Create a new folder in the selected directory',
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '6px' } },
            React.createElement('input', {
              type: 'text',
              value: folderName,
              placeholder: newFolderPlaceholder,
              onChange: (e) => {
                setFolderName(e.target.value)
                setLocalError('')
                if (onErrorMessage) onErrorMessage('')
              },
              style: {
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
              },
            }),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'btn',
                onClick: handleCreate,
                disabled: !canCreate,
                title: canCreate ? '' : 'Select a directory first',
                style: { whiteSpace: 'nowrap' },
              },
              createLabel,
            ),
          ),
          localError &&
            React.createElement(
              'div',
              { style: { color: '#ef4444', fontSize: '12px' } },
              localError,
            ),
        ),
    )
  }

  return { FileTree, FileTreeSelector, buildNodeIndex }
}
