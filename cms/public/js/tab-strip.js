const DEFAULTS = {
  showAddButton: false,
  addButtonLabel: '+',
  addButtonTitle: 'New tab',
  draggable: true,
  animate: true,
  allowRename: true,
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createTabStrip(root, options = {}) {
  if (!root) throw new Error('createTabStrip requires a root element')

  const opts = { ...DEFAULTS, ...options }
  const state = {
    tabs: [],
    activeId: null,
    draggingId: null,
    renamingId: null,
  }
  let destroyed = false
  let pendingRender = false
  let activeRenameCleanup = null

  root.innerHTML = ''
  root.classList.add('tab-strip')

  const track = document.createElement('div')
  track.className = 'tab-strip__track'
  root.appendChild(track)

  let addButton = null
  if (opts.showAddButton) {
    addButton = document.createElement('button')
    addButton.type = 'button'
    addButton.className = 'tab-strip__add'
    addButton.setAttribute('aria-label', opts.addButtonTitle || 'Add tab')
    addButton.innerHTML = opts.addButtonLabel
    addButton.addEventListener('click', () => {
      if (typeof opts.onAdd === 'function') opts.onAdd()
    })
  }

  function normalizeTab(tab) {
    if (!tab || tab.id === undefined || tab.id === null) {
      throw new Error('Tab definition missing id')
    }
    const normalized = {
      id: String(tab.id),
      label: tab.label ?? '',
      leadingHTML: tab.leadingHTML || '',
      trailingHTML: tab.trailingHTML || '',
      closable: tab.closable !== false,
      closeIcon: tab.closeIcon !== undefined ? tab.closeIcon : '×',
      closeLabel: tab.closeLabel || 'Close',
      classes: Array.isArray(tab.classes) ? tab.classes.filter(Boolean) : [],
      draggable: tab.draggable !== false,
      tooltip: tab.tooltip || '',
      dataset: { ...(tab.dataset || {}) },
      ariaLabel: tab.ariaLabel || null,
    }
    return normalized
  }

  function beginRename(tab, button) {
    if (!opts.allowRename || destroyed) return
    if (!tab || !button) return
    if (button.classList.contains('is-renaming')) return

    if (typeof activeRenameCleanup === 'function') {
      activeRenameCleanup()
    }

    state.renamingId = tab.id
    button.classList.add('is-renaming')
    const previousDraggable = button.draggable
    button.draggable = false
    const closeEl = button.querySelector('.close')
    if (closeEl) closeEl.style.pointerEvents = 'none'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'tab-strip__rename'
    input.value = String(tab.label || '')
    input.setAttribute('aria-label', 'Rename tab')
    button.appendChild(input)

    let finished = false
    let handleKeyFn = null
    let handleBlurFn = null

    const finish = (nextValue, cancelled) => {
      if (finished) return
      finished = true
      if (handleKeyFn) input.removeEventListener('keydown', handleKeyFn)
      if (handleBlurFn) input.removeEventListener('blur', handleBlurFn)
      state.renamingId = null
      activeRenameCleanup = null
      if (button.contains(input)) button.removeChild(input)
      button.classList.remove('is-renaming')
      button.draggable = previousDraggable
      if (closeEl) closeEl.style.pointerEvents = ''

      const originalLabel = String(tab.label || 'Untitled').trim()

      if (cancelled) {
        return
      }

      const trimmed = String(nextValue ?? '').trim()
      if (!trimmed) {
        console.warn('[tab-strip] Label cannot be empty, keeping original label')
        return
      }

      if (trimmed !== tab.label) {
        tab.label = trimmed
        if (typeof opts.onRename === 'function') {
          try {
            opts.onRename(tab.id, trimmed)
          } catch (error) {
            console.error('tab-strip onRename handler failed', error)
          }
        }
        requestRender()
      }
    }

    handleKeyFn = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        finish(input.value, false)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        finish(tab.label, true)
      }
    }

    handleBlurFn = () => finish(input.value, false)

    input.addEventListener('keydown', handleKeyFn)
    input.addEventListener('blur', handleBlurFn)

    activeRenameCleanup = () => {
      if (handleKeyFn) input.removeEventListener('keydown', handleKeyFn)
      if (handleBlurFn) input.removeEventListener('blur', handleBlurFn)
      finish(tab.label, true)
    }

    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }

  function capturePositions() {
    const map = new Map()
    track.querySelectorAll('button.tab[data-tab-id]').forEach((node) => {
      const id = node.dataset.tabId
      if (!id) return
      map.set(id, node.getBoundingClientRect())
    })
    return map
  }

  function animatePositions(previous) {
    if (!previous || previous.size === 0) return
    track.querySelectorAll('button.tab[data-tab-id]').forEach((node) => {
      const id = node.dataset.tabId
      if (!id || !previous.has(id)) return
      const prev = previous.get(id)
      const next = node.getBoundingClientRect()
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
      node.style.transition = 'none'
      node.style.transform = `translate(${dx}px, ${dy}px)`
      requestAnimationFrame(() => {
        node.style.transition = 'transform 220ms cubic-bezier(0.33, 0, 0.2, 1)'
        node.style.transform = 'translate(0px, 0px)'
        const cleanup = (evt) => {
          if (evt.propertyName !== 'transform') return
          node.style.transition = ''
          node.style.transform = ''
          node.removeEventListener('transitionend', cleanup)
        }
        node.addEventListener('transitionend', cleanup)
      })
    })
  }

  function reorderInternal(draggedId, targetId, placeBefore, notify) {
    if (!draggedId || draggedId === targetId) return false
    const tabs = state.tabs
    const fromIndex = tabs.findIndex((t) => t.id === draggedId)
    if (fromIndex === -1) return false
    let insertIndex
    if (!targetId) {
      insertIndex = tabs.length
    } else {
      insertIndex = tabs.findIndex((t) => t.id === targetId)
      if (insertIndex === -1) insertIndex = tabs.length
      else if (!placeBefore) insertIndex += 1
    }
    if (insertIndex === fromIndex || insertIndex === fromIndex + 1) return false
    const [dragged] = tabs.splice(fromIndex, 1)
    if (insertIndex > fromIndex) insertIndex -= 1
    tabs.splice(insertIndex, 0, dragged)
    requestRender()
    if (notify && typeof opts.onReorder === 'function') {
      opts.onReorder(tabs.map((t) => t.id), { draggedId, targetId, placeBefore })
    }
    return true
  }

  function handleRootDragOver(event) {
    if (!state.draggingId) return
    if (event.target !== root && event.target !== track) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  function handleRootDrop(event) {
    if (!state.draggingId) return
    if (event.target !== root && event.target !== track) return
    event.preventDefault()
    reorderInternal(state.draggingId, null, false, true)
    state.draggingId = null
  }

  root.addEventListener('dragover', handleRootDragOver)
  root.addEventListener('drop', handleRootDrop)

  function buildTabHTML(tab) {
    const parts = []
    if (tab.leadingHTML) parts.push(tab.leadingHTML)
    const labelSpan = `<span class="tab__label">${escapeHTML(tab.label)}</span>`
    parts.push(labelSpan)
    if (tab.trailingHTML) parts.push(tab.trailingHTML)
    if (tab.closable) {
      const closeTitle = escapeHTML(tab.closeLabel)
      parts.push(
        `<span class="close" data-hint="${closeTitle}" aria-label="${closeTitle}">${tab.closeIcon}</span>`,
      )
    }
    return parts.join('')
  }

  function commitRender() {
    if (destroyed) return
    const previous = opts.animate ? capturePositions() : null
    track.innerHTML = ''

    state.tabs.forEach((tab) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tab'
      if (tab.classes && tab.classes.length) btn.classList.add(...tab.classes)
      if (state.activeId === tab.id) btn.classList.add('active')
      if (state.draggingId === tab.id) btn.classList.add('dragging')
      btn.dataset.tabId = tab.id
      const tooltipText =
        tab.tooltip != null && tab.tooltip !== undefined && tab.tooltip !== ''
          ? String(tab.tooltip)
          : String(tab.label ?? '')
      if (tooltipText) {
        btn.dataset.hint = tooltipText
        if (!tab.ariaLabel) btn.setAttribute('aria-label', tooltipText)
      } else {
        delete btn.dataset.hint
      }
      btn.removeAttribute('title')
      if (tab.ariaLabel) btn.setAttribute('aria-label', tab.ariaLabel)
      const descriptorData = { ...(tab.dataset || {}) }
      const menuTokens = new Set()
      const flagTokens = new Set()

      const descriptorMenu = descriptorData.menu
      if (descriptorMenu != null) {
        String(descriptorMenu)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((token) => menuTokens.add(token))
        delete descriptorData.menu
      }

      const descriptorMenuFlags = descriptorData.menuFlags
      if (descriptorMenuFlags != null) {
        String(descriptorMenuFlags)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((token) => flagTokens.add(token))
        delete descriptorData.menuFlags
      }

      Object.entries(descriptorData).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        btn.dataset[key] = value
      })

      menuTokens.add('shell-tab')
      flagTokens.add('tab')
      const descriptorKind = descriptorData.tabKind || descriptorData.tabkind || ''
      if (descriptorKind) flagTokens.add(`tab-kind-${descriptorKind}`)
      if (Array.isArray(tab.classes) && tab.classes.includes('served')) flagTokens.add('tab-served')
      if (state.activeId === tab.id) flagTokens.add('tab-active')

      if (menuTokens.size) btn.dataset.menu = Array.from(menuTokens).join(' ')
      if (flagTokens.size) btn.dataset.menuFlags = Array.from(flagTokens).join(' ')
      btn.dataset.menuZone = 'cms-shell-tabs'
      btn.innerHTML = buildTabHTML(tab)

      btn.addEventListener('click', (event) => {
        if (destroyed) return
        const target = event.target
        if (tab.closable && target instanceof HTMLElement && target.closest('.close')) {
          event.preventDefault()
          if (typeof opts.onClose === 'function') opts.onClose(tab.id)
          return
        }
        if (typeof opts.onSelect === 'function') opts.onSelect(tab.id)
      })

      if (typeof opts.onContextMenu === 'function') {
        btn.addEventListener('contextmenu', (event) => {
          if (destroyed) return
          opts.onContextMenu(event, tab.id)
        })
      }

      if (opts.allowRename) {
        btn.addEventListener('dblclick', (event) => {
          if (destroyed) return
          const target = event.target
          if (target instanceof HTMLElement && target.closest('.close')) return
          event.preventDefault()
          event.stopPropagation()
          beginRename(tab, btn)
        })
      }

      if (opts.draggable && tab.draggable) {
        btn.draggable = true
        btn.addEventListener('dragstart', (event) => {
          if (destroyed) return
          const target = event.target
          if (target instanceof HTMLElement && target.closest('.close')) {
            event.preventDefault()
            return
          }
          state.draggingId = tab.id
          event.dataTransfer?.setData('text/plain', tab.id)
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
            try {
              event.dataTransfer.setDragImage(new Image(), 0, 0)
            } catch {}
          }
          btn.classList.add('dragging')
        })
        btn.addEventListener('dragend', () => {
          if (destroyed) return
          state.draggingId = null
          btn.classList.remove('dragging')
          requestRender()
        })
        btn.addEventListener('dragover', (event) => {
          if (!state.draggingId || state.draggingId === tab.id) return
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
          const rect = btn.getBoundingClientRect()
          const offset = event.clientX - rect.left
          const placeBefore = offset < rect.width / 2
          reorderInternal(state.draggingId, tab.id, placeBefore, false)
        })
        btn.addEventListener('drop', (event) => {
          if (!state.draggingId || state.draggingId === tab.id) return
          event.preventDefault()
          const rect = btn.getBoundingClientRect()
          const offset = event.clientX - rect.left
          const placeBefore = offset < rect.width / 2
          reorderInternal(state.draggingId, tab.id, placeBefore, true)
          state.draggingId = null
        })
      }

      track.appendChild(btn)
    })

    if (opts.animate && previous) {
      requestAnimationFrame(() => animatePositions(previous))
    }
  }

  function requestRender() {
    if (destroyed) return
    if (pendingRender) return
    pendingRender = true
    requestAnimationFrame(() => {
      pendingRender = false
      commitRender()
    })

    if (addButton) track.appendChild(addButton)
  }

  function setState(payload = {}) {
    const { tabs = [], activeId = null } = payload
    state.tabs = tabs.map(normalizeTab)
    if (activeId && state.tabs.some((tab) => tab.id === activeId)) {
      state.activeId = activeId
    } else {
      state.activeId = state.tabs[0]?.id || null
    }
    commitRender()
  }

  function destroy() {
    destroyed = true
    root.classList.remove('tab-strip')
    root.innerHTML = ''
    root.removeEventListener('dragover', handleRootDragOver)
    root.removeEventListener('drop', handleRootDrop)
  }

  function getState() {
    return { tabs: state.tabs.map((tab) => ({ ...tab })), activeId: state.activeId }
  }

  return {
    setState,
    getState,
    destroy,
  }
}
