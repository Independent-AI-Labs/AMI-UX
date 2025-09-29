(() => {
  try {
    const chromeRoot = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
      ? chrome.runtime.getURL('highlight-plugin/pkg/')
      : null
    const browserRoot = typeof browser !== 'undefined' && browser?.runtime?.getURL
      ? browser.runtime.getURL('highlight-plugin/pkg/')
      : null
    const root = chromeRoot || browserRoot
    if (root) window.__AMI_HIGHLIGHT_ASSET_ROOT__ = root
  } catch {}
})()

import './pkg/bootstrap.js'
