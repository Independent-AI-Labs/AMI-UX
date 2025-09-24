import { promises as fs } from 'fs'
import path from 'path'

export type TextFormats = {
  extensions: Set<string>
  basenames: Set<string>
}

const FALLBACK_EXTENSIONS = [
  '.md',
  '.markdown',
  '.mdown',
  '.mdx',
  '.txt',
  '.text',
  '.log',
  '.ini',
  '.cfg',
  '.conf',
  '.json',
  '.jsonl',
  '.csv',
  '.tsv',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.html',
  '.htm',
  '.rst',
  '.tex',
]

const FALLBACK_BASENAMES = [
  'dockerfile',
  'dockerfile.dev',
  'dockerfile.prod',
  'makefile',
  'license',
  'licence',
  'readme',
]

type AllowedList = {
  extensions: Set<string>
  basenames: Set<string>
}

let cachedReference: AllowedList | null = null

function ensureSets(): AllowedList {
  return { extensions: new Set<string>(), basenames: new Set<string>() }
}

function normalizeEntry(value: string, target: AllowedList) {
  const trimmed = value?.trim()
  if (!trimmed) return
  const lower = trimmed.toLowerCase()
  if (!lower) return
  if (lower.startsWith('.')) {
    target.extensions.add(lower)
    return
  }
  target.basenames.add(lower)
  const lastDot = lower.lastIndexOf('.')
  if (lastDot > 0 && lastDot < lower.length - 1) {
    target.extensions.add(lower.slice(lastDot))
  } else if (/^[a-z0-9][a-z0-9+_-]{0,15}$/.test(lower)) {
    target.extensions.add(`.${lower}`)
  }
}

function mergeFallbacks(target: AllowedList) {
  for (const ext of FALLBACK_EXTENSIONS) {
    target.extensions.add(ext)
  }
  for (const name of FALLBACK_BASENAMES) {
    target.basenames.add(name)
  }
}

function parseAllowedList(source?: string | null): AllowedList | null {
  if (!source) return null
  const target = ensureSets()
  source
    .replace(/\s+/g, ',')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => normalizeEntry(entry, target))
  if (!target.extensions.size && !target.basenames.size) return null
  return target
}

async function loadReferenceFromRepo(): Promise<AllowedList> {
  const target = ensureSets()
  const repoPath = path.resolve(process.cwd(), '../../files/res/text_extensions.json')
  try {
    const raw = await fs.readFile(repoPath, 'utf8')
    const data = JSON.parse(raw) as {
      all_extensions?: unknown
      categories?: Record<string, Array<{ ext: string }>>
    }
    if (Array.isArray(data?.all_extensions)) {
      for (const entry of data.all_extensions) {
        if (typeof entry === 'string') normalizeEntry(entry, target)
      }
    } else if (data?.categories) {
      for (const entries of Object.values(data.categories)) {
        if (!Array.isArray(entries)) continue
        for (const item of entries) {
          if (item && typeof item.ext === 'string') normalizeEntry(item.ext, target)
        }
      }
    }
  } catch {
    // Ignore errors and fall back to defaults
  }
  mergeFallbacks(target)
  if (!target.extensions.size && !target.basenames.size) {
    mergeFallbacks(target)
  }
  return target
}

export async function getTextFormats(override?: string | null): Promise<TextFormats> {
  const parsedOverride = parseAllowedList(override)
  if (parsedOverride) return parsedOverride
  if (cachedReference) return cachedReference
  cachedReference = await loadReferenceFromRepo()
  return cachedReference
}

export function isAllowedTextFormat(formats: TextFormats, filePath: string): boolean {
  const lower = filePath.toLowerCase()
  const ext = path.extname(lower)
  if (ext && formats.extensions.has(ext)) return true
  const base = path.basename(lower)
  if (formats.basenames.has(base)) return true
  // Handle compound extensions like ".tar.gz" when catalogued explicitly
  const dotSegments = base.split('.').filter(Boolean)
  if (dotSegments.length > 1) {
    for (let i = 1; i < dotSegments.length; i++) {
      const compoundExt = `.${dotSegments.slice(i).join('.')}`
      if (formats.extensions.has(compoundExt)) return true
    }
  }
  return false
}
