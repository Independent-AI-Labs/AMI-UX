import { promises as fs } from 'fs'
import path from 'path'

export type RuntimeConfig = {
  contentRoot: string
  allowed?: string | null
}

const DEFAULT_CONTENT_ROOT = process.env.CONTENT_ROOT || 'docs'

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const dataPath = path.resolve(process.cwd(), 'data/config.json')
  const envAllowed = sanitizeString(process.env.ALLOWED_EXTENSIONS)

  try {
    const raw = await fs.readFile(dataPath, 'utf8')
    const cfg = JSON.parse(raw) as { contentRoot?: unknown; allowed?: unknown }
    const contentRoot = sanitizeString(cfg.contentRoot) || DEFAULT_CONTENT_ROOT
    const allowed = sanitizeString(cfg.allowed) ?? envAllowed
    return { contentRoot, allowed }
  } catch {
    return { contentRoot: DEFAULT_CONTENT_ROOT, allowed: envAllowed }
  }
}
