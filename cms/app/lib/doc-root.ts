import { promises as fs } from 'fs'
import path from 'path'
import { getConfig, repoRoot as storeRepoRoot, type CmsConfig } from './store'

export const repoRoot = storeRepoRoot

export const DEFAULT_DOC_ROOT = 'docs'

export function defaultDocRootLabel(): string {
  return 'Docs'
}

export function deriveDocRootLabel(absPath: string, explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim()
  const base = path.basename(absPath)
  return base || defaultDocRootLabel()
}

export type DocRootInfo = {
  absolute: string
  relative: string
  label: string
}

function resolveDocRootSetting(): string {
  // docRoot comes from ENV, not stored config
  return process.env.DOC_ROOT || DEFAULT_DOC_ROOT
}

export async function loadDocRootInfo(): Promise<DocRootInfo | null> {
  const docRootSetting = resolveDocRootSetting()
  const absolute = path.resolve(repoRoot, docRootSetting)
  const stat = await fs.stat(absolute).catch(() => null)
  if (!stat || !stat.isDirectory()) {
    return null
  }
  const relative = path.relative(repoRoot, absolute) || '.'
  const label = deriveDocRootLabel(absolute, defaultDocRootLabel())
  return { absolute, relative, label }
}
