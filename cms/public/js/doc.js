import { startCms } from './main.js?v=20250306'

startCms()
  .then(() => {
    try {
      window.parent?.postMessage?.({ type: 'docReady' }, '*')
    } catch {}
  })
  .catch((err) => {
    const el = document.getElementById('content') || document.body
    if (el) el.textContent = 'Failed to initialize doc viewer.'
    console.error(err)
  })
