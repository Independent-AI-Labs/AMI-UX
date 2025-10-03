// PRODUCTION DATA MODELS - ACTIVELY USED BY main.js AND shell.js

import { normalizeFsPath } from './utils.js'

// ============================================================================
// CONTENT ROOT CONTEXT - LIBRARY ENTRIES AS SOURCE OF TRUTH
// ============================================================================

const UPLOADS_MARKER = '/files/uploads'

/**
 * Create content root context from library entry
 */
export function createContextFromLibraryEntry(entry) {
  return {
    rootKey: entry.id,
    path: entry.path,
    absolutePath: entry.path,
    label: entry.label || entry.path.split('/').filter(Boolean).pop() || 'Content',
    focus: '',
  }
}

/**
 * Create content root context from message
 */
export function createContextFromMessage(message) {
  const rootKey = message.rootKey || ''
  const path = message.path || ''
  const label = message.label || (rootKey === 'uploads' ? 'Uploads' : 'Content')
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
 * Derive content root context from a filesystem path
 */
export function deriveContextFromPath(path) {
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

  // Standalone path
  const lastSegment = normalized.split('/').filter(Boolean).pop() || normalized
  return {
    rootKey: '',
    path: normalized,
    absolutePath: normalized,
    label: lastSegment || 'Content',
    focus: '',
  }
}

/**
 * Build subtitle text from content root context
 */
export function buildContextSubtitle(context) {
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
    return 'Explore and inspect structured content.'
  }

  return `Content sourced from ${parts.join(' · ')}`
}

/**
 * Build message to send to content viewer iframe
 */
export function buildContentMessage(context) {
  console.log('[models] buildContentMessage input context:', JSON.stringify(context))
  const msg = {
    type: 'setContentRoot',
    rootKey: context.rootKey,
    path: context.path,
  }

  if (context.label) {
    msg.label = context.label
  }

  if (context.focus) {
    msg.focus = context.focus
  }

  console.log('[models] buildContentMessage output:', JSON.stringify(msg))
  return msg
}
