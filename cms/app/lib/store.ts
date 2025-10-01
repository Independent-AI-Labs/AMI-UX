import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import path from 'path'

import type { AuthenticatedUser } from '@ami/auth/types'

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
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json')
const SERVED_FILE = path.join(DATA_DIR, 'served.json')

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
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
      console.error(`[store] JSON parse error in ${filePath}: ${error.message}`)
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
        console.warn(`[store] File not found, using default: ${filePath}`)
        return defaultValue
      }
      console.error(`[store] Required file not found: ${filePath}`)
      throw new Error(`File not found: ${filePath}`)
    }

    if (err.code === 'EACCES') {
      console.error(`[store] Permission denied reading: ${filePath}`)
      throw new Error(`Permission denied: ${filePath}`)
    }

    if (err.code === 'EISDIR') {
      console.error(`[store] Expected file but found directory: ${filePath}`)
      throw new Error(`Path is a directory: ${filePath}`)
    }

    console.error(`[store] Error reading ${filePath}: ${err.message}`)
    throw error
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
  const stored = await readJsonFile<CmsConfig>(CONFIG_FILE, { defaultValue: CONFIG_DEFAULT })
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
  const entries = await readJsonFile<LibraryEntry[]>(LIBRARY_FILE, { defaultValue: [] })
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
  const instances = await readJsonFile<ServeInstance[]>(SERVED_FILE, { defaultValue: [] })
  return Array.isArray(instances) ? instances : []
}

export async function saveServed(instances: ServeInstance[]): Promise<void> {
  await writeJsonFile(SERVED_FILE, Array.isArray(instances) ? instances : [])
}

// ---------------------------------------------------------------------------
// Account manager store (aligned with base/backend/dataops user model)

const ACCOUNT_STORE_VERSION = 1
const ACCOUNT_ID_SEPARATOR = '::'
const GUEST_EMAIL = (process.env.AMI_GUEST_EMAIL || 'guest@ami.local').toLowerCase()
const GUEST_NAME = process.env.AMI_GUEST_NAME || 'Guest AMI Account'
const GUEST_PROVIDER = 'credentials'

export type AccountRecord = {
  id: string
  provider: string
  label?: string | null
  createdAt: string
  lastUsed?: string | null
  user: AuthenticatedUser
}

export type AccountStore = {
  version: number
  defaultAccountId: string
  accounts: AccountRecord[]
  updatedAt: string
}

type AccountStoreSnapshot = {
  accounts: AccountRecord[]
  defaultAccountId: string
  guestAccountId: string
}

type AccountInput = {
  provider: string
  label?: string | null
  user: AuthenticatedUser
}

const ACCOUNT_STORE_DEFAULT: AccountStore = {
  version: ACCOUNT_STORE_VERSION,
  defaultAccountId: buildAccountId(GUEST_PROVIDER, deriveUserId(GUEST_EMAIL)),
  accounts: [],
  updatedAt: new Date(0).toISOString(),
}

function deriveUserId(email: string): string {
  const safeEmail = email.toLowerCase()
  const hash = createHash('sha256').update(safeEmail).digest('hex').slice(0, 24)
  return `user-${hash}`
}

export function deriveAccountUserId(email: string): string {
  return deriveUserId(email)
}

function buildAccountId(provider: string, userId: string): string {
  return `${provider}${ACCOUNT_ID_SEPARATOR}${userId}`
}

function normaliseProvider(provider: unknown): string | null {
  if (typeof provider !== 'string') return null
  const trimmed = provider.trim().toLowerCase()
  if (!trimmed) return null
  return trimmed
}

function normaliseLabel(label: unknown): string | null {
  if (typeof label !== 'string') return null
  const trimmed = label.trim()
  return trimmed || null
}

function cloneMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {}
  try {
    return JSON.parse(JSON.stringify(metadata))
  } catch {
    return {}
  }
}

function normaliseUser(raw: unknown): AuthenticatedUser | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as AuthenticatedUser & Record<string, unknown>
  const emailValue = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : ''
  if (!emailValue) return null
  const idValue = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : deriveUserId(emailValue)
  const nameValue = candidate.name === null ? null : typeof candidate.name === 'string' ? candidate.name : undefined
  const imageValue = candidate.image === null ? null : typeof candidate.image === 'string' ? candidate.image : undefined
  const rolesValue = Array.isArray(candidate.roles) ? candidate.roles.map((role) => String(role)) : []
  const groupsValue = Array.isArray(candidate.groups) ? candidate.groups.map((group) => String(group)) : []
  const tenantValue = candidate.tenantId === null ? null : candidate.tenantId ? String(candidate.tenantId) : null

  const metadataValue = cloneMetadata(candidate.metadata)

  return {
    id: idValue,
    email: emailValue,
    name: nameValue ?? null,
    image: imageValue ?? null,
    roles: rolesValue,
    groups: groupsValue,
    tenantId: tenantValue,
    metadata: metadataValue,
  }
}

function normaliseAccountRecord(raw: unknown): AccountRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const provider = normaliseProvider(source.provider)
  const user = normaliseUser(source.user)
  if (!provider || !user) return null

  const createdAt = typeof source.createdAt === 'string' && source.createdAt ? source.createdAt : new Date().toISOString()
  const lastUsed = typeof source.lastUsed === 'string' ? source.lastUsed : null
  const label = normaliseLabel(source.label)

  return {
    id: buildAccountId(provider, user.id),
    provider,
    label,
    createdAt,
    lastUsed,
    user,
  }
}

function createGuestAccountRecord(): AccountRecord {
  const user: AuthenticatedUser = {
    id: deriveUserId(GUEST_EMAIL),
    email: GUEST_EMAIL,
    name: GUEST_NAME,
    image: null,
    roles: ['guest'],
    groups: [],
    tenantId: null,
    metadata: { accountType: 'guest', managedBy: 'system' },
  }

  return {
    id: buildAccountId(GUEST_PROVIDER, user.id),
    provider: GUEST_PROVIDER,
    label: 'Guest AMI Session',
    createdAt: new Date(0).toISOString(),
    lastUsed: null,
    user,
  }
}

export function getGuestAccountId(): string {
  return createGuestAccountRecord().id
}

export function getGuestAccountRecord(): AccountRecord {
  return createGuestAccountRecord()
}

function ensureGuestAccount(store: AccountStore): AccountStore {
  const guest = createGuestAccountRecord()
  const existing = store.accounts.find((entry) => entry.id === guest.id)
  const accounts = existing
    ? store.accounts.map((entry) => (entry.id === guest.id ? { ...guest, createdAt: entry.createdAt, lastUsed: entry.lastUsed } : entry))
    : [guest, ...store.accounts]

  const defaultAccountId = accounts.some((entry) => entry.id === store.defaultAccountId)
    ? store.defaultAccountId
    : guest.id

  return {
    ...store,
    accounts,
    defaultAccountId,
  }
}

async function loadAccountStore(): Promise<AccountStore> {
  await ensureDataDir()
  const stored = await readJsonFile<AccountStore | null>(ACCOUNTS_FILE, { defaultValue: null })
  const accounted: AccountStore = stored && stored.version === ACCOUNT_STORE_VERSION
    ? {
        version: ACCOUNT_STORE_VERSION,
        defaultAccountId: stored.defaultAccountId,
        accounts: Array.isArray(stored.accounts)
          ? stored.accounts
              .map((record) => normaliseAccountRecord(record))
              .filter((record): record is AccountRecord => Boolean(record))
          : [],
        updatedAt: stored.updatedAt || new Date().toISOString(),
      }
    : { ...ACCOUNT_STORE_DEFAULT }

  const deduped = new Map<string, AccountRecord>()
  for (const record of accounted.accounts) {
    if (!record) continue
    deduped.set(record.id, record)
  }

  const next: AccountStore = {
    version: ACCOUNT_STORE_VERSION,
    defaultAccountId: accounted.defaultAccountId || ACCOUNT_STORE_DEFAULT.defaultAccountId,
    accounts: Array.from(deduped.values()),
    updatedAt: accounted.updatedAt || new Date().toISOString(),
  }

  return ensureGuestAccount(next)
}

async function persistAccountStore(store: AccountStore): Promise<AccountStore> {
  const updated: AccountStore = ensureGuestAccount({
    ...store,
    updatedAt: new Date().toISOString(),
  })
  await writeJsonFile(ACCOUNTS_FILE, updated)
  return updated
}

function snapshotFromStore(store: AccountStore): AccountStoreSnapshot {
  return {
    accounts: store.accounts,
    defaultAccountId: store.defaultAccountId,
    guestAccountId: createGuestAccountRecord().id,
  }
}

export async function getAccountSnapshot(): Promise<AccountStoreSnapshot> {
  const store = await loadAccountStore()
  return snapshotFromStore(store)
}

export async function addAccount(input: AccountInput): Promise<{ account: AccountRecord; snapshot: AccountStoreSnapshot }> {
  const provider = normaliseProvider(input.provider)
  const user = normaliseUser(input.user)
  if (!provider || !user) {
    throw new Error('Invalid account payload')
  }

  const label = normaliseLabel(input.label)
  const store = await loadAccountStore()
  const today = new Date().toISOString()
  const accountId = buildAccountId(provider, user.id)

  const account: AccountRecord = {
    id: accountId,
    provider,
    label,
    createdAt: today,
    lastUsed: null,
    user: {
      ...user,
      metadata: {
        ...user.metadata,
        accountSource: user.metadata?.accountSource ?? 'dataops',
      },
    },
  }

  const existingIndex = store.accounts.findIndex((entry) => entry.id === accountId)
  if (existingIndex >= 0) {
    store.accounts.splice(existingIndex, 1, {
      ...store.accounts[existingIndex],
      label: account.label ?? store.accounts[existingIndex].label ?? null,
      user: account.user,
      provider: account.provider,
    })
  } else {
    store.accounts.push(account)
  }

  const nextStore = await persistAccountStore(store)
  return { account: nextStore.accounts.find((entry) => entry.id === accountId)!, snapshot: snapshotFromStore(nextStore) }
}

export async function removeAccount(accountId: string): Promise<AccountStoreSnapshot> {
  const store = await loadAccountStore()
  const guestId = createGuestAccountRecord().id
  if (accountId === guestId) {
    throw new Error('Guest account cannot be removed')
  }
  const nextAccounts = store.accounts.filter((entry) => entry.id !== accountId)
  const nextStore = await persistAccountStore({
    ...store,
    accounts: nextAccounts,
    defaultAccountId:
      store.defaultAccountId === accountId && nextAccounts.length ? nextAccounts[0].id : store.defaultAccountId,
  })
  return snapshotFromStore(nextStore)
}

export async function setDefaultAccount(accountId: string): Promise<AccountStoreSnapshot> {
  const store = await loadAccountStore()
  const targetExists = store.accounts.some((entry) => entry.id === accountId)
  const guestAccountId = createGuestAccountRecord().id
  const nextStore = await persistAccountStore({
    ...store,
    defaultAccountId: targetExists ? accountId : guestAccountId,
  })
  return snapshotFromStore(nextStore)
}

export async function touchAccountUsage(accountId: string): Promise<{ account: AccountRecord | null; snapshot: AccountStoreSnapshot }> {
  const store = await loadAccountStore()
  const index = store.accounts.findIndex((entry) => entry.id === accountId)
  if (index < 0) {
    return { account: null, snapshot: snapshotFromStore(store) }
  }
  store.accounts[index] = {
    ...store.accounts[index],
    lastUsed: new Date().toISOString(),
  }
  const nextStore = await persistAccountStore(store)
  return {
    account: nextStore.accounts.find((entry) => entry.id === accountId) ?? null,
    snapshot: snapshotFromStore(nextStore),
  }
}

export function decodeAccountId(accountId: string): { provider: string; userId: string } {
  const [provider, userId] = accountId.split(ACCOUNT_ID_SEPARATOR)
  return {
    provider,
    userId,
  }
}
