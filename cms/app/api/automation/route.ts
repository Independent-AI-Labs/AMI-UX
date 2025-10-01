import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

import { withSession } from '../../lib/auth-guard'
import { resolveMediaRoot } from '../../lib/media-roots'
import { metadataRoot } from '../../lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const META_SUFFIX = '.meta'
const AUTOMATION_DIRNAME = 'automation'
const GLOBAL_METADATA_ROOT = metadataRoot
const CONFIG_FILE = 'automation.json'
const SCENARIO_META_FILE = 'scenario.json'
const TRIGGER_EXTENSION = '.json'

type AutomationCapabilities = {
  network?: boolean
  plugins?: boolean
  [key: string]: unknown
}

type AutomationConfig = {
  enabled: boolean
  activeScenario: string
  capabilities: AutomationCapabilities
}

type ScenarioRecord = {
  slug: string
  name: string
  path: string
  triggers: TriggerRecord[]
}

type TriggerRecord = {
  id: string
  name: string
  scenario: string
  fileName: string
  [key: string]: unknown
}

type AutomationPayload = {
  ok: boolean
  path: string
  root: string
  metaPath: string
  enabled: boolean
  activeScenario: string
  capabilities: AutomationCapabilities
  scenarios: ScenarioRecord[]
}

function normalizeRelPath(raw: string): string {
  const normalized = path.posix.normalize(raw.replace(/\\/g, '/')).replace(/^\/+/, '')
  if (!normalized || normalized === '.' || normalized.startsWith('..')) throw new Error('invalid path')
  return normalized
}

function withinRoot(rootAbs: string, targetAbs: string): boolean {
  const rel = path.relative(rootAbs, targetAbs)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function defaultConfig(): AutomationConfig {
  return {
    enabled: false,
    activeScenario: 'default',
    capabilities: {
      network: false,
      plugins: false,
    },
  }
}

type ReadJsonOptions<T> = {
  defaultValue?: T
  required?: boolean
}

async function readJsonFile<T>(
  filePath: string,
  options?: ReadJsonOptions<T>
): Promise<T> {
  const { defaultValue, required = false } = options ?? {}

  try {
    const raw = await fs.readFile(filePath, 'utf8')

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (parseError) {
      const error = parseError as Error
      console.error(`[automation] JSON parse error in ${filePath}: ${error.message}`)
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`)
    }

    if (parsed === null || parsed === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue
      }
      throw new Error(`Null or undefined value in ${filePath}`)
    }

    return parsed as T
  } catch (error) {
    const err = error as NodeJS.ErrnoException

    if (err.code === 'ENOENT') {
      if (!required && defaultValue !== undefined) {
        console.warn(`[automation] File not found, using default: ${filePath}`)
        return defaultValue
      }
      console.error(`[automation] Required file not found: ${filePath}`)
      throw new Error(`File not found: ${filePath}`)
    }

    if (err.code === 'EACCES') {
      console.error(`[automation] Permission denied reading: ${filePath}`)
      throw new Error(`Permission denied: ${filePath}`)
    }

    if (err.code === 'EISDIR') {
      console.error(`[automation] Expected file but found directory: ${filePath}`)
      throw new Error(`Path is a directory: ${filePath}`)
    }

    console.error(`[automation] Error reading ${filePath}: ${err.message}`)
    throw error
  }
}

async function writeJsonFile(filePath: string, data: unknown) {
  const dir = path.dirname(filePath)
  await ensureDir(dir)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function slugify(name: string, defaultPrefix = 'scenario'): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `${defaultPrefix}-${Math.random().toString(36).slice(2, 8)}`
}

function safeTriggerFileName(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `${safe || 'trigger'}${TRIGGER_EXTENSION}`
}

async function readAutomationConfig(automationDir: string): Promise<AutomationConfig> {
  const configPath = path.join(automationDir, CONFIG_FILE)
  const config = await readJsonFile<AutomationConfig>(configPath, { defaultValue: defaultConfig() })
  const merged = defaultConfig()
  merged.enabled = config.enabled === true
  merged.activeScenario = typeof config.activeScenario === 'string' && config.activeScenario ? config.activeScenario : 'default'
  merged.capabilities = {
    ...defaultConfig().capabilities,
    ...(config.capabilities && typeof config.capabilities === 'object' ? config.capabilities : {}),
  }
  return merged
}

async function writeAutomationConfig(automationDir: string, config: AutomationConfig) {
  const configPath = path.join(automationDir, CONFIG_FILE)
  await writeJsonFile(configPath, config)
}

async function ensureDefaultScenario(automationDir: string) {
  const defaultDir = path.join(automationDir, 'default')
  await ensureDir(defaultDir)
  const scenarioMetaPath = path.join(defaultDir, SCENARIO_META_FILE)
  const exists = await fs
    .stat(scenarioMetaPath)
    .then((stat) => stat.isFile())
    .catch(() => false)
  if (!exists) {
    await writeJsonFile(scenarioMetaPath, {
      slug: 'default',
      name: 'Default',
      createdAt: Date.now(),
    })
  }
}

async function readScenarioMeta(scenarioDir: string, slug: string) {
  const metaPath = path.join(scenarioDir, SCENARIO_META_FILE)
  const meta = await readJsonFile(metaPath, {
    defaultValue: {
      slug,
      name: slug,
      createdAt: Date.now(),
    },
  })
  if (!meta.slug) meta.slug = slug
  if (!meta.name) meta.name = slug
  return meta
}

async function readTriggerFile(filePath: string, scenario: string): Promise<TriggerRecord | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const id = typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : null
    if (!id) return null
    return {
      ...parsed,
      id,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : id,
      scenario,
      fileName: path.basename(filePath),
    }
  } catch {
    return null
  }
}

async function listScenarios(automationDir: string): Promise<ScenarioRecord[]> {
  const entries = await fs.readdir(automationDir, { withFileTypes: true }).catch(() => [])
  const scenarios: ScenarioRecord[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const slug = entry.name
    if (!slug) continue
    const scenarioDir = path.join(automationDir, slug)
    const meta = await readScenarioMeta(scenarioDir, slug)
    const files = await fs.readdir(scenarioDir).catch(() => [])
    const triggers: TriggerRecord[] = []
    for (const file of files) {
      if (!file.endsWith(TRIGGER_EXTENSION) || file === SCENARIO_META_FILE) continue
      const triggerPath = path.join(scenarioDir, file)
      const trigger = await readTriggerFile(triggerPath, meta.slug)
      if (trigger) triggers.push(trigger)
    }
    scenarios.push({
      slug: meta.slug,
      name: meta.name || meta.slug,
      path: path.join(AUTOMATION_DIRNAME, slug),
      triggers,
    })
  }
  scenarios.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return scenarios
}

async function buildAutomationPayload(rootKey: string, relPath: string, automationDir: string): Promise<AutomationPayload> {
  await ensureDir(automationDir)
  await ensureDefaultScenario(automationDir)
  const config = await readAutomationConfig(automationDir)
  const scenarios = await listScenarios(automationDir)
  let active = config.activeScenario
  if (!scenarios.find((scenario) => scenario.slug === active)) {
    active = scenarios[0]?.slug || 'default'
    config.activeScenario = active
    await writeAutomationConfig(automationDir, config)
  }
  return {
    ok: true,
    root: rootKey,
    path: relPath,
    metaPath: path.posix.join(relPath + META_SUFFIX, AUTOMATION_DIRNAME),
    enabled: !!config.enabled,
    activeScenario: active,
    capabilities: { ...defaultConfig().capabilities, ...config.capabilities },
    scenarios,
  }
}

async function ensureScenarioDir(automationDir: string, name: string): Promise<{ slug: string; dir: string }> {
  const desiredSlug = slugify(name)
  let slug = desiredSlug
  let dir = path.join(automationDir, slug)
  let suffix = 2
  while (true) {
    const exists = await fs
      .stat(dir)
      .then((stat) => stat.isDirectory())
      .catch(() => false)
    if (!exists) break
    slug = `${desiredSlug}-${suffix}`
    dir = path.join(automationDir, slug)
    suffix += 1
  }
  await ensureDir(dir)
  await writeJsonFile(path.join(dir, SCENARIO_META_FILE), {
    slug,
    name: name.trim() || slug,
    createdAt: Date.now(),
  })
  return { slug, dir }
}

async function deleteDirectory(targetDir: string) {
  await fs.rm(targetDir, { recursive: true, force: true })
}

async function deleteTriggerFile(automationDir: string, scenario: string, triggerId: string) {
  const scenarioDir = path.join(automationDir, scenario)
  const files = await fs.readdir(scenarioDir).catch(() => [])
  const targetFile = files.find((file) => file.endsWith(TRIGGER_EXTENSION) && file.startsWith(safeTriggerFileName(triggerId).replace(TRIGGER_EXTENSION, '')))
  if (targetFile) {
    await fs.rm(path.join(scenarioDir, targetFile), { force: true })
    return
  }
  // alternative: delete by id metadata match
  for (const file of files) {
    if (!file.endsWith(TRIGGER_EXTENSION) || file === SCENARIO_META_FILE) continue
    const triggerPath = path.join(scenarioDir, file)
    const trigger = await readTriggerFile(triggerPath, scenario)
    if (trigger && trigger.id === triggerId) {
      await fs.rm(triggerPath, { force: true })
      return
    }
  }
}

async function saveTriggerFile(automationDir: string, scenario: string, trigger: Record<string, unknown>) {
  const scenarioDir = path.join(automationDir, scenario)
  await ensureDir(scenarioDir)
  const metaPath = path.join(scenarioDir, SCENARIO_META_FILE)
  const metaExists = await fs
    .stat(metaPath)
    .then((stat) => stat.isFile())
    .catch(() => false)
  if (!metaExists) {
    await writeJsonFile(metaPath, {
      slug: scenario,
      name: scenario,
      createdAt: Date.now(),
    })
  }
  const id = typeof trigger.id === 'string' ? trigger.id.trim() : ''
  if (!id) throw new Error('invalid trigger id')
  const fileName = safeTriggerFileName(id)
  const filePath = path.join(scenarioDir, fileName)
  const record = {
    ...trigger,
    id,
    scenario,
    updatedAt: Date.now(),
  }
  await writeJsonFile(filePath, record)
}

/**
 * Determine where to store automation metadata for a given path.
 * Prefers global metadata root for new content, uses local .meta for existing.
 */
async function resolveAutomationDir(rootKey: string, relPath: string, rootAbs: string): Promise<string> {
  // Generate both possible paths
  const localMetaAbs = path.join(rootAbs, `${relPath}${META_SUFFIX}`, AUTOMATION_DIRNAME)
  const globalMetaAbs = path.join(GLOBAL_METADATA_ROOT, rootKey, relPath, AUTOMATION_DIRNAME)

  // Check if local .meta exists
  const localExists = await fs.stat(localMetaAbs).then(s => s.isDirectory()).catch(() => false)

  // If local exists, continue using it
  if (localExists) {
    return localMetaAbs
  }

  // Otherwise use global metadata root
  await ensureDir(globalMetaAbs)
  return globalMetaAbs
}

async function readAutomationPayloadForRequest(rootKey: string, relPath: string, rootAbs: string) {
  const automationDir = await resolveAutomationDir(rootKey, relPath, rootAbs)
  await ensureDir(automationDir)
  return buildAutomationPayload(rootKey, relPath, automationDir)
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const relParam = url.searchParams.get('path') || ''
  const rootParam = url.searchParams.get('root') || 'docRoot'
  if (!relParam) return jsonError('Missing path', 400)

  let relPath: string
  try {
    relPath = normalizeRelPath(relParam)
  } catch {
    return jsonError('Invalid path', 400)
  }

  const root = await resolveMediaRoot(rootParam)
  if (!root) return jsonError('Unknown root', 404)

  const targetAbs = path.resolve(root.path, relPath)
  if (!withinRoot(root.path, targetAbs)) return jsonError('Forbidden', 403)

  const payload = await readAutomationPayloadForRequest(root.key, relPath, root.path)
  return NextResponse.json(payload)
})

export const POST = withSession(async ({ request }) => {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return jsonError('Invalid payload', 400)

  const relParam = typeof body.path === 'string' ? body.path : ''
  const rootParam = typeof body.root === 'string' && body.root ? body.root : 'docRoot'
  const action = typeof body.action === 'string' ? body.action : ''
  if (!relParam) return jsonError('Path required', 400)
  if (!action) return jsonError('Action required', 400)

  let relPath: string
  try {
    relPath = normalizeRelPath(relParam)
  } catch {
    return jsonError('Invalid path', 400)
  }

  const root = await resolveMediaRoot(rootParam)
  if (!root) return jsonError('Unknown root', 404)
  if (!root.writable) return jsonError('Root not writable', 403)

  const targetAbs = path.resolve(root.path, relPath)
  if (!withinRoot(root.path, targetAbs)) return jsonError('Forbidden', 403)

  const automationDir = await resolveAutomationDir(root.key, relPath, root.path)
  await ensureDir(automationDir)
  await ensureDefaultScenario(automationDir)

  if (action === 'create-scenario') {
    const rawName = typeof body.name === 'string' ? body.name.trim() : ''
    if (!rawName) return jsonError('Scenario name required', 400)
    await ensureScenarioDir(automationDir, rawName)
  } else if (action === 'delete-scenario') {
    const slug = typeof body.scenario === 'string' ? body.scenario.trim() : ''
    if (!slug) return jsonError('Scenario required', 400)
    const scenarioDir = path.join(automationDir, slug)
    await deleteDirectory(scenarioDir)
    const config = await readAutomationConfig(automationDir)
    if (config.activeScenario === slug) {
      config.activeScenario = 'default'
      await writeAutomationConfig(automationDir, config)
    }
  } else if (action === 'save-trigger') {
    const scenario = typeof body.scenario === 'string' ? body.scenario.trim() : ''
    if (!scenario) return jsonError('Scenario required', 400)
    const trigger = body.trigger && typeof body.trigger === 'object' ? body.trigger : null
    if (!trigger) return jsonError('Trigger payload required', 400)
    await saveTriggerFile(automationDir, scenario, trigger as Record<string, unknown>)
  } else if (action === 'delete-trigger') {
    const scenario = typeof body.scenario === 'string' ? body.scenario.trim() : ''
    const triggerId = typeof body.triggerId === 'string' ? body.triggerId.trim() : ''
    if (!scenario || !triggerId) return jsonError('Scenario and triggerId required', 400)
    await deleteTriggerFile(automationDir, scenario, triggerId)
  } else if (action === 'set-config') {
    const config = await readAutomationConfig(automationDir)
    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
      config.enabled = body.enabled === true
    }
    if (body.capabilities && typeof body.capabilities === 'object') {
      config.capabilities = {
        ...config.capabilities,
        ...(body.capabilities as AutomationCapabilities),
      }
    }
    if (typeof body.activeScenario === 'string' && body.activeScenario.trim()) {
      config.activeScenario = body.activeScenario.trim()
    }
    await writeAutomationConfig(automationDir, config)
  } else if (action === 'set-active-scenario') {
    const slug = typeof body.scenario === 'string' ? body.scenario.trim() : ''
    if (!slug) return jsonError('Scenario required', 400)
    const config = await readAutomationConfig(automationDir)
    config.activeScenario = slug
    await writeAutomationConfig(automationDir, config)
  } else {
    return jsonError('Unknown action', 400)
  }

  const payload = await buildAutomationPayload(root.key, relPath, automationDir)
  return NextResponse.json(payload)
})
