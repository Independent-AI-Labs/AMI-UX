import { promises as fs } from 'fs'
import path from 'path'

export type RuntimeConfig = {
  docRoot: string
  allowed?: string | null
}

const DEFAULT_DOC_ROOT = process.env.DOC_ROOT || 'docs'

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
    const cfg = JSON.parse(raw) as { docRoot?: unknown; allowed?: unknown }
    const docRoot = sanitizeString(cfg.docRoot) || DEFAULT_DOC_ROOT
    const allowed = sanitizeString(cfg.allowed) ?? envAllowed
    return { docRoot, allowed }
  } catch {
    return { docRoot: DEFAULT_DOC_ROOT, allowed: envAllowed }
  }
}
