// PRODUCTION DATA MODELS - ACTIVELY USED BY main.js AND shell.js

import { normalizeFsPath } from './utils.js'

// ============================================================================
// DOC ROOT CONTEXT - SINGLE SOURCE OF TRUTH
// ============================================================================

const UPLOADS_MARKER = '/files/uploads'

/**
 * Create doc root context from server config
 */
export function createDocRootFromConfig(config) {
  return {
    rootKey: 'docRoot',
    path: config.docRoot || '',
    absolutePath: config.docRootAbsolute || '',
    label: config.docRootLabel || 'Docs',
    focus: '',
  }
}

/**
 * Create doc root context from message
 */
export function createDocRootFromMessage(message) {
  const rootKey = message.rootKey || 'docRoot'
  const path = message.path || ''
  const label = message.label || (rootKey === 'uploads' ? 'Uploads' : 'Docs')
  const focus = message.focus || ''

  return {
    rootKey,
    path,
    absolutePath: path,
    label,
    focus,
  }
}

/**
 * Derive doc root context from a filesystem path
 */
export function deriveDocRootFromPath(path, config) {
  const normalized = normalizeFsPath(path)

  // Check if path is in uploads
  const uploadsIndex = normalized.indexOf(UPLOADS_MARKER)
  if (uploadsIndex !== -1) {
    const uploadsBase = normalized.slice(0, uploadsIndex + UPLOADS_MARKER.length)
    const relativePath = normalized.slice(uploadsBase.length).replace(/^\/+/, '')

    return {
      rootKey: 'uploads',
      path: uploadsBase,
      absolutePath: uploadsBase,
      label: 'Uploads',
      focus: relativePath,
    }
  }

  // Check if path is within configured doc root
  if (config) {
    const docRootNormalized = normalizeFsPath(config.docRootAbsolute || config.docRoot || '')
    if (docRootNormalized) {
      if (normalized === docRootNormalized || normalized.startsWith(`${docRootNormalized}/`)) {
        const relativePath = normalized === docRootNormalized
          ? ''
          : normalized.slice(docRootNormalized.length + 1)

        return {
          rootKey: 'docRoot',
          path: config.docRoot || '',
          absolutePath: config.docRootAbsolute || '',
          label: config.docRootLabel || 'Docs',
          focus: relativePath,
        }
      }
    }
  }

  // Standalone path
  const lastSegment = normalized.split('/').filter(Boolean).pop() || normalized
  return {
    rootKey: 'docRoot',
    path: normalized,
    absolutePath: normalized,
    label: lastSegment || 'Docs',
    focus: '',
  }
}

/**
 * Build subtitle text from doc root context
 */
export function buildDocRootSubtitle(context) {
  if (context.rootKey === 'uploads') {
    return context.label ? `Uploads workspace sourced from ${context.label}` : 'Uploads workspace'
  }

  const parts = []

  if (context.label && context.label !== context.absolutePath) {
    parts.push(context.label)
  }

  if (context.absolutePath && context.absolutePath !== context.label) {
    parts.push(context.absolutePath)
  }

  if (parts.length === 0) {
    return 'Explore and inspect structured documentation.'
  }

  return `Docs sourced from ${parts.join(' · ')}`
}

/**
 * Build message to send to doc viewer iframe
 */
export function buildDocMessage(context) {
  const msg = {
    type: 'setDocRoot',
    rootKey: context.rootKey,
    path: context.path,
  }

  if (context.label) {
    msg.label = context.label
  }

  if (context.focus) {
    msg.focus = context.focus
  }

  return msg
}
