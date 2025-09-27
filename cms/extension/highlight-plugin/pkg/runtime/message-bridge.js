import { acknowledgeParentMessage, messageChannel } from '../../message-channel.js'

export function setupMessageBridge(options) {
  const targetWindow = options?.targetWindow || (typeof window !== 'undefined' ? window : null)
  if (!targetWindow) return () => {}

  const ui = options.ui
  const manager = options.manager

  const listener = (event) => {
    const data = event?.data
    if (!data || data.type !== 'highlightSettings') return

    let status = 'ignored'
    try {
      if (data.action === 'open') {
        status = ui?.open() ? 'opened' : 'closed'
      } else if (data.action === 'close') {
        ui?.close()
        status = 'closed'
      } else {
        status = ui?.toggle() ? 'opened' : 'closed'
      }
    } catch (err) {
      status = 'error'
      if (data.channel === messageChannel.CHANNEL && data.requestId != null) {
        acknowledgeParentMessage(data, { status: 'error', error: err?.message || String(err) })
      }
      console.warn('highlightSettings handler failed', err)
      return
    }

    if (data.channel === messageChannel.CHANNEL && data.requestId != null) {
      acknowledgeParentMessage(data, { status })
    }
  }

  targetWindow.addEventListener('message', listener)

  // Immediately publish current settings so host buttons can sync aria state
  if (options?.notifyInitialState && targetWindow.parent && targetWindow.parent !== targetWindow) {
    try {
      targetWindow.parent.postMessage(
        {
          type: 'highlightSettingsState',
          status: ui?.isOpen() ? 'opened' : 'closed',
          settings: manager ? manager.getSettings() : null,
        },
        '*',
      )
    } catch {}
  }

  return () => targetWindow.removeEventListener('message', listener)
}
