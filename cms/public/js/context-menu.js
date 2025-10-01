// Custom context menu with copy/paste only

let contextMenuInstance = null
let currentTarget = null

function createContextMenu(target) {
  const menu = document.createElement('div')
  menu.className = 'custom-context-menu'
  menu.style.cssText = `
    position: fixed;
    z-index: 99999;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    padding: 4px;
    min-width: 140px;
    display: none;
  `

  const items = [
    { label: 'Copy', action: 'copy', icon: 'file-copy-line' },
    { label: 'Paste', action: 'paste', icon: 'clipboard-line' },
  ]

  // Only add "Copy Link" if target is a link
  const link = target?.closest('a')
  if (link && link.href) {
    items.push({ label: 'Copy Link', action: 'copyLink', icon: 'links-line' })
  }

  items.forEach((item) => {
    const btn = document.createElement('button')
    btn.className = 'context-menu-item'
    btn.dataset.action = item.action
    btn.innerHTML = `
      <i class="ri-${item.icon}"></i>
      <span>${item.label}</span>
    `
    btn.style.cssText = `
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      border-radius: 6px;
      transition: background 0.15s var(--easing-standard);
    `

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'color-mix(in oklab, var(--accent) 15%, transparent)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent'
    })

    btn.addEventListener('click', async () => {
      hideContextMenu()
      await executeAction(item.action, currentTarget)
    })

    menu.appendChild(btn)
  })

  return menu
}

function isEditableElement(element) {
  if (!element) return false
  const tagName = element.tagName?.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') return true
  if (element.isContentEditable) return true
  return false
}

async function executeAction(action, targetElement) {
  try {
    if (action === 'copy') {
      const selection = window.getSelection()
      const text = selection.toString()
      if (text) {
        await navigator.clipboard.writeText(text)
      }
    } else if (action === 'paste') {
      // Only allow paste in editable elements
      if (!isEditableElement(targetElement)) {
        return
      }

      const text = await navigator.clipboard.readText()
      if (!text) return

      // Handle input/textarea elements
      if (targetElement.tagName?.toLowerCase() === 'input' || targetElement.tagName?.toLowerCase() === 'textarea') {
        const start = targetElement.selectionStart
        const end = targetElement.selectionEnd
        const currentValue = targetElement.value
        targetElement.value = currentValue.substring(0, start) + text + currentValue.substring(end)
        targetElement.selectionStart = targetElement.selectionEnd = start + text.length
        targetElement.dispatchEvent(new Event('input', { bubbles: true }))
      }
      // Handle contentEditable elements
      else if (targetElement.isContentEditable) {
        const selection = window.getSelection()
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const textNode = document.createTextNode(text)
          range.insertNode(textNode)
          range.setStartAfter(textNode)
          range.setEndAfter(textNode)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    } else if (action === 'copyLink') {
      const link = targetElement?.closest('a')
      if (link && link.href) {
        await navigator.clipboard.writeText(link.href)
      }
    }
  } catch (err) {
    console.warn('Context menu action failed:', err)
  }
}

function showContextMenu(x, y, target) {
  currentTarget = target

  // Remove old menu and create new one with context-aware items
  if (contextMenuInstance) {
    contextMenuInstance.remove()
  }
  contextMenuInstance = createContextMenu(target)
  document.body.appendChild(contextMenuInstance)

  contextMenuInstance.style.display = 'block'
  contextMenuInstance.style.left = `${x}px`
  contextMenuInstance.style.top = `${y}px`

  const rect = contextMenuInstance.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    contextMenuInstance.style.left = `${window.innerWidth - rect.width - 8}px`
  }
  if (rect.bottom > window.innerHeight) {
    contextMenuInstance.style.top = `${window.innerHeight - rect.height - 8}px`
  }
}

function hideContextMenu() {
  if (contextMenuInstance) {
    contextMenuInstance.style.display = 'none'
  }
}

export function initContextMenu() {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    showContextMenu(e.pageX, e.pageY, e.target)
  })

  document.addEventListener('click', () => {
    hideContextMenu()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu()
    }
  })
}
