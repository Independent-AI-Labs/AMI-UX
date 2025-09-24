export function connectSSE(state, handlers) {
  try {
    state.sse?.close?.()
  } catch {}
  const es = new EventSource('/api/events')
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'config') {
        handlers.onConfig?.()
        return
      }
      if (
        msg.type === 'add' ||
        msg.type === 'unlink' ||
        msg.type === 'addDir' ||
        msg.type === 'unlinkDir'
      ) {
        handlers.onTreeChange?.()
      } else if (msg.type === 'change' && typeof msg.path === 'string') {
        handlers.onFileChange?.(msg.path)
      }
    } catch {}
  }
  es.onerror = () => {
    setTimeout(() => connectSSE(state, handlers), 3000)
  }
  state.sse = es
  return es
}
