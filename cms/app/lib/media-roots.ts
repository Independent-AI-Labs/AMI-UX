import { promises as fs } from 'fs'
import path from 'path'
import { appRoot, repoRoot, uploadsRoot } from './store'

export type MediaRoot = {
  key: string
  label: string
  path: string
  writable: boolean
}

async function pathExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p)
    return stat.isDirectory() || stat.isFile()
  } catch {
    return false
  }
}

export async function collectMediaRoots(): Promise<MediaRoot[]> {
  const roots: MediaRoot[] = []
  const seen = new Set<string>()

  const addRoot = (key: string, label: string, absolutePath: string, writable: boolean) => {
    if (!absolutePath) return
    const normalized = path.resolve(absolutePath)
    if (seen.has(normalized)) return
    seen.add(normalized)
    roots.push({ key, label, path: normalized, writable })
  }

  try {
    await fs.mkdir(uploadsRoot, { recursive: true })
  } catch {}
  if (await pathExists(uploadsRoot)) {
    addRoot('uploads', 'Uploads', uploadsRoot, true)
  }

  if (await pathExists(repoRoot)) {
    const repoWritable = process.env.REPO_ROOT_WRITABLE === 'true'
    addRoot('repoRoot', 'Repository', repoRoot, repoWritable)
  }

  const envRoots = (process.env.MEDIA_ROOTS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  for (let i = 0; i < envRoots.length; i += 1) {
    const raw = envRoots[i]
    if (!raw) continue
    const parts = raw.split('::')
    const pathPart = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const label = parts.length > 1 ? parts.slice(0, -1).join('::') : undefined
    const abs = path.isAbsolute(pathPart) ? pathPart : path.resolve(appRoot, pathPart)
    if (await pathExists(abs)) {
      addRoot(`extra-${i}`, label || abs, abs, false)
    }
  }

  return roots
}

export async function resolveMediaRoot(key: string): Promise<MediaRoot | null> {
  const roots = await collectMediaRoots()
  const found = roots.find((root) => root.key === key)
  if (found) return found

  // Check if key is a library entry ID
  const { listLibrary } = await import('./store')
  const entries = await listLibrary()
  const entry = entries.find((e) => e.id === key)
  if (entry) {
    return {
      key: entry.id,
      label: entry.label || entry.path.split('/').pop() || 'Content',
      path: entry.path,
      writable: true,
    }
  }

  return null
}
