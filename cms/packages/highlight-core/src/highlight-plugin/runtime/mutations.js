import { IGNORE_ATTR, isPluginNode, shouldIgnoreNode } from '../core/dom-utils.js'
import { debugLog } from '../core/debug.js'

const NodeRef = typeof Node !== 'undefined' ? Node : null
const ATTRIBUTE_FILTER = ['class', 'role', IGNORE_ATTR]

function isRelevantNode(node) {
  if (!node || !NodeRef) return false
  if (isPluginNode(node) || shouldIgnoreNode(node)) return false
  return node.nodeType === NodeRef.ELEMENT_NODE || node.nodeType === NodeRef.TEXT_NODE
}

export function observeMutations(manager, contextId, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null)
  if (!doc || !manager) return () => {}

  let scheduled = false
  let pending = []

  const flush = () => {
    scheduled = false
    if (!pending.length) return
    const batch = pending
    pending = []
    const canNotifyContext = typeof manager.notifyContextMutations === 'function'
    const canNotifyAll = typeof manager.notifyAllMutations === 'function'
    debugLog('mutations:flush', { contextId, batch: batch.length })
    try {
      if (contextId && canNotifyContext) manager.notifyContextMutations(contextId, batch)
      else if (!contextId && canNotifyAll) manager.notifyAllMutations(batch)
      else if (contextId) manager.refreshContext(contextId)
      else manager.refreshAll()
    } catch {
      if (contextId) manager.refreshContext(contextId)
      else manager.refreshAll()
    }
  }

  const observer = new MutationObserver((records) => {
    const relevantRecords = []
    for (const record of records) {
      const nodes = []
      if (record.addedNodes && record.addedNodes.length) nodes.push(...record.addedNodes)
      if (record.removedNodes && record.removedNodes.length) nodes.push(...record.removedNodes)
      if (record.type === 'attributes' && record.target) nodes.push(record.target)
      let isRelevant = false
      for (const node of nodes) {
        if (isRelevantNode(node)) {
          isRelevant = true
          break
        }
      }
      if (isRelevant) relevantRecords.push(record)
    }
    if (!relevantRecords.length) return
    pending.push(...relevantRecords)
    if (scheduled) return
    scheduled = true
    debugLog('mutations:schedule', { contextId, batch: relevantRecords.length })
    requestAnimationFrame(flush)
  })

  const root = options.root || doc.body || doc.documentElement
  if (root) {
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ATTRIBUTE_FILTER,
    })
    debugLog('mutations:observe', { contextId, scope: root === doc.body ? 'body' : 'custom' })
  }

  return () => {
    debugLog('mutations:disconnect', { contextId })
    observer.disconnect()
  }
}
