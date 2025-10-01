export async function ensureReact() {
  if (typeof window !== 'undefined' && window.React && window.ReactDOM) {
    return { React: window.React, ReactDOM: window.ReactDOM }
  }

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.crossOrigin = 'anonymous'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })

  await loadScript('https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js')
  await loadScript('https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js')

  if (!window.React || !window.ReactDOM) {
    throw new Error('Failed to load React runtime')
  }

  return { React: window.React, ReactDOM: window.ReactDOM }
}
