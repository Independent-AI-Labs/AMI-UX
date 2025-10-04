import { startCms } from './main.js?v=20251004'
import { initContextMenu } from './context-menu.js'

// Initialize custom context menu in doc viewer
initContextMenu()

function syncDocHeaderHeight() {
  try {
    const root = document.documentElement
    if (!root) return
    const header = document.querySelector('body.doc-viewer > header')
    if (!header) {
      root.style.setProperty('--doc-header-height', '0px')
      return
    }
    const style = window.getComputedStyle(header)
    const isHidden = style.display === 'none' || style.visibility === 'hidden'
    const height = isHidden ? 0 : header.getBoundingClientRect().height
    root.style.setProperty('--doc-header-height', `${Math.round(height)}px`)
  } catch {}
}

syncDocHeaderHeight()

let headerResizeObserver = null
if (typeof ResizeObserver !== 'undefined') {
  const header = document.querySelector('body.doc-viewer > header')
  if (header) {
    headerResizeObserver = new ResizeObserver(() => syncDocHeaderHeight())
    headerResizeObserver.observe(header)
  }
}

window.addEventListener('resize', () => {
  window.requestAnimationFrame(syncDocHeaderHeight)
})

startCms()
  .then(() => {
    console.log('[doc] startCms completed successfully')
  })
  .catch((err) => {
    console.error('[doc] startCms failed:', err)
    const el = document.getElementById('content') || document.body
    if (el) el.textContent = 'Failed to initialize doc viewer.'
  })
  .finally(() => {
    // ALWAYS send docReady, even if startCms failed
    // This ensures the shell can flush pending messages and show errors properly
    try {
      console.log('[doc] Sending docReady to parent')
      window.parent?.postMessage?.({ type: 'docReady' }, '*')
    } catch (e) {
      console.error('[doc] Failed to send docReady:', e)
    }
    syncDocHeaderHeight()
  })

window.addEventListener('beforeunload', () => {
  try {
    if (headerResizeObserver) headerResizeObserver.disconnect()
  } catch {}
})
