const REACT_SRC = 'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js'
const REACT_DOM_SRC = 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js'

function loadScript(doc, src) {
  return new Promise((resolve, reject) => {
    const node = doc.createElement('script')
    node.src = src
    node.crossOrigin = 'anonymous'
    node.onload = () => resolve()
    node.onerror = reject
    doc.head.appendChild(node)
  })
}

export async function ensureReact(globalThisArg = typeof window !== 'undefined' ? window : undefined) {
  const globalObj = globalThisArg || {}
  const doc = globalObj.document
  if (!doc) throw new Error('React loader requires a document context')
  if (globalObj.React && globalObj.ReactDOM) {
    return { React: globalObj.React, ReactDOM: globalObj.ReactDOM }
  }
  await loadScript(doc, REACT_SRC)
  await loadScript(doc, REACT_DOM_SRC)
  if (!globalObj.React || !globalObj.ReactDOM) {
    throw new Error('Failed to load React runtime')
  }
  return { React: globalObj.React, ReactDOM: globalObj.ReactDOM }
}
