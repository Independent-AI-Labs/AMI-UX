import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import path from 'path'

const APP_ROOT = path.resolve(process.cwd())

function findRepoRoot(start: string): string {
  let current = start
  const seen = new Set<string>()
  let candidate: string | null = null

  while (!seen.has(current)) {
    seen.add(current)
    const gitDir = path.join(current, '.git')
    if (existsSync(gitDir)) {
      candidate = current
    }
    const parent = path.dirname(current)
    if (!parent || parent === current) break
    current = parent
  }

  return candidate ?? start
}

export const appRoot = APP_ROOT
export const repoRoot = findRepoRoot(APP_ROOT)
export const DATA_DIR = path.join(APP_ROOT, 'data')
export const uploadsRoot = path.join(APP_ROOT, 'files/uploads')

const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json')
const SERVED_FILE = path.join(DATA_DIR, 'served.json')

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath: string, payload: any) {
  await ensureDataDir()
  const contents = JSON.stringify(payload, null, 2)
  await fs.writeFile(filePath, contents, 'utf8')
}

export type RecentEntry = {
  type: string
  path: string
  mode?: string
}

export type CmsConfig = {
  docRoot?: string
  docRootLabel?: string
  selected?: unknown
  openTabs?: unknown[]
  activeTabId?: string | null
  preferredMode?: string
  recents?: RecentEntry[]
  allowed?: string
}

const CONFIG_DEFAULT: CmsConfig = {
  openTabs: [],
  activeTabId: null,
  selected: null,
  recents: [],
}

export async function getConfig(): Promise<CmsConfig> {
  await ensureDataDir()
  const stored = await readJsonFile(CONFIG_FILE, CONFIG_DEFAULT)
  const next: CmsConfig = { ...CONFIG_DEFAULT, ...stored }
  if (!Array.isArray(next.openTabs)) next.openTabs = []
  if (!Array.isArray(next.recents)) next.recents = []
  return next
}

export async function saveConfig(cfg: CmsConfig): Promise<void> {
  const payload: CmsConfig = {
    ...cfg,
    openTabs: Array.isArray(cfg.openTabs) ? cfg.openTabs : [],
    recents: Array.isArray(cfg.recents) ? cfg.recents : [],
  }
  await writeJsonFile(CONFIG_FILE, payload)
}

export type LibraryKind = 'file' | 'dir' | 'app'

export type LibraryEntry = {
  id: string
  path: string
  kind: LibraryKind
  createdAt: number
  label?: string
  metrics?: {
    items: number
    bytes: number
    truncated?: boolean
  }
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  await ensureDataDir()
  const entries = await readJsonFile<LibraryEntry[]>(LIBRARY_FILE, [])
  return Array.isArray(entries) ? entries : []
}

export async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
  await writeJsonFile(LIBRARY_FILE, Array.isArray(entries) ? entries : [])
}

export type ServeStatus = 'starting' | 'running' | 'stopped' | 'error'

export type ServeInstance = {
  id: string
  entryId: string
  kind: LibraryKind
  status: ServeStatus
  port?: number
  updatedAt?: number
}

export async function listServed(): Promise<ServeInstance[]> {
  await ensureDataDir()
  const instances = await readJsonFile<ServeInstance[]>(SERVED_FILE, [])
  return Array.isArray(instances) ? instances : []
}

export async function saveServed(instances: ServeInstance[]): Promise<void> {
  await writeJsonFile(SERVED_FILE, Array.isArray(instances) ? instances : [])
}
