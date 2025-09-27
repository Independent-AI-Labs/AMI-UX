import { createTabStrip } from './tab-strip.js?v=20250321'

const TOGGLE_KEY_CODE = 'Backquote'
const PROMPT_SEQUENCE = '\u001b[38;5;117mami\u001b[0m\u001b[38;5;240m ~ \u001b[0m'

function isEditableTarget(target) {
  if (!target) return false
  if (target instanceof window.HTMLInputElement || target instanceof window.HTMLTextAreaElement) return true
  if (target instanceof window.HTMLSelectElement) return true
  if (typeof target.isContentEditable === 'boolean' && target.isContentEditable) return true
  return false
}

export function initShellConsole() {
  const doc = window.document
  const container = doc.getElementById('shellConsole')
  const viewport = doc.getElementById('shellConsoleViewport')
  const tabsRoot = doc.getElementById('shellConsoleTabs')
  if (!container || !viewport || !tabsRoot) return
  if (container.dataset.shellConsoleInit === '1') return
  container.dataset.shellConsoleInit = '1'

  const consoleState = {
    sessions: [],
    activeId: null,
  }

  let sessionCounter = 0
  let open = false
  let term = null
  let suppressCapture = false
  let tabStrip = null

  function getActiveSession() {
    if (!consoleState.activeId) return null
    return consoleState.sessions.find((s) => s.id === consoleState.activeId) || null
  }

  function ensureTabStrip() {
    if (tabStrip) return tabStrip
    tabStrip = createTabStrip(tabsRoot, {
      showAddButton: true,
      addButtonLabel: '+',
      addButtonTitle: 'New console tab',
      onAdd: () => {
        addSession({ activate: true })
      },
      onSelect: (id) => {
        if (!id || consoleState.activeId === id) return
        consoleState.activeId = id
        syncTabs()
        if (term) renderActiveSession()
      },
      onClose: (id) => {
        closeSession(id)
      },
      onReorder: (order) => {
        reorderSessions(order)
      },
    })
    return tabStrip
  }

  function addSession({ activate = true } = {}) {
    sessionCounter += 1
    const session = {
      id: `console-${sessionCounter}`,
      label: `Console ${sessionCounter}`,
      output: '',
      input: '',
      initialized: false,
    }
    consoleState.sessions.push(session)
    if (activate || !consoleState.activeId) {
      consoleState.activeId = session.id
    }
    syncTabs()
    if (term && consoleState.activeId === session.id) renderActiveSession({ reset: true })
    return session
  }

  function closeSession(id) {
    if (consoleState.sessions.length <= 1) return
    const index = consoleState.sessions.findIndex((s) => s.id === id)
    if (index === -1) return
    const removedActive = consoleState.sessions[index].id === consoleState.activeId
    consoleState.sessions.splice(index, 1)
    if (removedActive) {
      const fallback = consoleState.sessions[index] || consoleState.sessions[index - 1] || consoleState.sessions[0]
      consoleState.activeId = fallback ? fallback.id : null
    }
    syncTabs()
    if (term) renderActiveSession({ reset: true })
  }

  function reorderSessions(order) {
    if (!Array.isArray(order) || order.length === 0) return
    const map = new Map(consoleState.sessions.map((session) => [session.id, session]))
    const reordered = []
    order.forEach((id) => {
      const session = map.get(id)
      if (!session) return
      reordered.push(session)
      map.delete(id)
    })
    map.forEach((session) => reordered.push(session))
    const currentKey = consoleState.sessions.map((s) => s.id).join('|')
    const nextKey = reordered.map((s) => s.id).join('|')
    if (currentKey === nextKey) return
    consoleState.sessions = reordered
    if (!consoleState.sessions.some((s) => s.id === consoleState.activeId)) {
      consoleState.activeId = consoleState.sessions[0]?.id || null
    }
    syncTabs()
    if (term) renderActiveSession()
  }

  function syncTabs() {
    const strip = ensureTabStrip()
    if (!strip) return
    const allowClose = consoleState.sessions.length > 1
    const tabs = consoleState.sessions.map((session) => ({
      id: session.id,
      label: session.label,
      leadingHTML: '',
      trailingHTML: '',
      closable: allowClose,
      classes: ['console-tab'],
    }))
    strip.setState({ tabs, activeId: consoleState.activeId })
  }

  function ensureDefaultSession() {
    if (!consoleState.sessions.length) {
      addSession({ activate: true })
    } else {
      syncTabs()
    }
  }

  function emitToTerminal(text) {
    if (!term) return
    const session = getActiveSession()
    if (!session) return
    term.write(text)
    if (!suppressCapture) session.output += text
  }

  function writePrompt() {
    if (!term) return
    const session = getActiveSession()
    if (!session) return
    emitToTerminal(PROMPT_SEQUENCE)
  }

  function writeSessionBanner(session) {
    if (!term || !session) return
    emitToTerminal(`\u001b[38;5;81m${session.label}\u001b[0m — UI preview\r\n`)
  }

  function renderActiveSession({ reset = false } = {}) {
    if (!term) return
    const session = getActiveSession()
    if (!session) return
    suppressCapture = true
    try {
      term.reset()
    } finally {
      suppressCapture = false
    }
    if (reset || !session.initialized) {
      session.output = ''
      session.input = ''
      session.initialized = true
      writeSessionBanner(session)
      writePrompt()
      return
    }
    if (session.output) {
      suppressCapture = true
      try {
        term.write(session.output)
      } finally {
        suppressCapture = false
      }
    } else {
      writeSessionBanner(session)
      writePrompt()
    }
  }

  function ensureTerminal() {
    if (term) return term
    if (typeof window.Terminal !== 'function') {
      console.warn('[shell-console] Terminal library is not available yet')
      return null
    }

    term = new window.Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        'Montserrat, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.22,
      letterSpacing: 1,
      rows: 18,
      theme: {
        background: '#0d111c',
        foreground: '#f9fbff',
        cursor: '#7aa2f7',
        cursorAccent: '#0d111c',
        selection: 'rgba(122, 162, 247, 0.32)',
      },
    })
    term.open(viewport)
    renderActiveSession({ reset: true })

    term.onData((data) => {
      if (!term || !data) return
      const session = getActiveSession()
      if (!session) return

      if (data === '\r') {
        emitToTerminal('\r\n')
        const trimmed = session.input.trim()
        if (trimmed.length) {
          emitToTerminal(`\u001b[38;5;238m(no execution): ${trimmed}\u001b[0m\r\n`)
        }
        session.input = ''
        writePrompt()
        return
      }

      if (data === '\u0003') {
        emitToTerminal('^C\r\n')
        session.input = ''
        writePrompt()
        return
      }

      if (data === '\u007f') {
        if (session.input.length > 0) {
          session.input = session.input.slice(0, -1)
          emitToTerminal('\b \b')
        }
        return
      }

      if (data.startsWith('\u001b')) return

      emitToTerminal(data)
      session.input += data
    })

    return term
  }

  function setOpen(next) {
    const desired = typeof next === 'boolean' ? next : !open
    if (desired === open) return
    open = desired
    container.classList.toggle('shell-console--open', open)
    container.setAttribute('aria-hidden', open ? 'false' : 'true')
    doc.body.classList.toggle('shell-console-active', open)
    if (open) {
      const instance = ensureTerminal()
      if (instance) {
        setTimeout(() => {
          instance.focus()
          try {
            instance.scrollToBottom?.()
          } catch {}
        }, 20)
      }
    } else {
      try {
        if (doc.activeElement instanceof HTMLElement) doc.activeElement.blur()
      } catch {}
    }
  }

  function handleKeyDown(event) {
    if (event.defaultPrevented) return

    if (
      event.code === TOGGLE_KEY_CODE &&
      event.ctrlKey &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault()
      if (open) setOpen(false)
      return
    }

    if (
      event.code === TOGGLE_KEY_CODE &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      setOpen(!open)
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  ensureDefaultSession()

  doc.addEventListener('keydown', handleKeyDown, true)
  window.addEventListener('resize', () => {
    if (!term) return
    try {
      term.refresh(0, term.rows - 1)
    } catch {}
  })

  container.addEventListener('click', (event) => {
    if (!open) return
    if (event.target === container) setOpen(false)
  })

  window.__amiShellConsole = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    addSession: () => addSession({ activate: true }),
  }
}
