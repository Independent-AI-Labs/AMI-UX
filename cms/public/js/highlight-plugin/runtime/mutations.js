import { isPluginNode, shouldIgnoreNode } from '../core/dom-utils.js'
import { debugLog } from '../core/debug.js'

const NodeRef = typeof Node !== 'undefined' ? Node : null

function isRelevantNode(node) {
  if (!node || !NodeRef) return false
  if (isPluginNode(node) || shouldIgnoreNode(node)) return false
  return node.nodeType === NodeRef.ELEMENT_NODE || node.nodeType === NodeRef.TEXT_NODE
}

export function observeMutations(manager, contextId, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null)
  if (!doc || !manager) return () => {}

  let scheduled = false
  const observer = new MutationObserver((records) => {
    let relevant = false
    for (const record of records) {
      const nodes = []
      if (record.addedNodes && record.addedNodes.length) nodes.push(...record.addedNodes)
      if (record.removedNodes && record.removedNodes.length) nodes.push(...record.removedNodes)
      for (const node of nodes) {
        if (isRelevantNode(node)) {
          relevant = true
          break
        }
      }
      if (relevant) break
    }
    if (!relevant) return
    if (scheduled) return
    scheduled = true
    debugLog('mutations:schedule', { contextId, batch: records.length })
    requestAnimationFrame(() => {
      scheduled = false
      debugLog('mutations:flush', { contextId })
      if (contextId) manager.refreshContext(contextId)
      else manager.refreshAll()
    })
  })

  const root = options.root || doc.body || doc.documentElement
  if (root) {
    observer.observe(root, { childList: true, subtree: true })
    debugLog('mutations:observe', { contextId, scope: root === doc.body ? 'body' : 'custom' })
  }

  return () => {
    debugLog('mutations:disconnect', { contextId })
    observer.disconnect()
  }
}
