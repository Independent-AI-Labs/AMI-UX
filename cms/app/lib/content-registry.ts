import { promises as fs } from 'fs'
import path from 'path'
import { uuidv7 } from 'uuidv7'
import { DATA_DIR } from './store'

const CONTENT_REGISTRY_FILE = path.join(DATA_DIR, 'content-registry.json')

type ContentRegistryEntry = {
  uuid: string
  rootKey: string
  path: string
  createdAt: number
  updatedAt: number
}

type ContentRegistry = {
  [key: string]: ContentRegistryEntry
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readRegistry(): Promise<ContentRegistry> {
  try {
    const data = await fs.readFile(CONTENT_REGISTRY_FILE, 'utf8')
    const parsed = JSON.parse(data)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

async function writeRegistry(registry: ContentRegistry): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(CONTENT_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8')
}

function makeContentKey(rootKey: string, contentPath: string): string {
  return `${rootKey}:${contentPath}`
}

/**
 * Get or create a UUID for a piece of content.
 * Content is identified by rootKey + path.
 */
export async function getOrCreateContentUUID(rootKey: string, contentPath: string): Promise<string> {
  const registry = await readRegistry()
  const key = makeContentKey(rootKey, contentPath)

  let entry = registry[key]

  if (!entry) {
    const uuid = uuidv7()
    entry = {
      uuid,
      rootKey,
      path: contentPath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    registry[key] = entry
    await writeRegistry(registry)
  }

  return entry.uuid
}

/**
 * Get content UUID if it exists, otherwise return null.
 */
export async function getContentUUID(rootKey: string, contentPath: string): Promise<string | null> {
  const registry = await readRegistry()
  const key = makeContentKey(rootKey, contentPath)
  return registry[key]?.uuid ?? null
}

/**
 * Update the timestamp for a content entry.
 */
export async function touchContent(rootKey: string, contentPath: string): Promise<void> {
  const registry = await readRegistry()
  const key = makeContentKey(rootKey, contentPath)

  if (registry[key]) {
    registry[key].updatedAt = Date.now()
    await writeRegistry(registry)
  }
}
