import { readFile, stat as statFile } from 'fs/promises'
import path from 'path'
import { scryptSync, timingSafeEqual, createHash, randomUUID } from 'crypto'

import { getAllowedEmails, getCredentialsFile, getDataOpsAuthUrl, getInternalToken } from './env'
import type {
  AuthenticatedUser,
  CredentialsPayload,
  DataOpsCredentialRecord,
  VerifyCredentialsResponse,
} from './types'

const DEFAULT_SCRYPT_KEYLEN = 64

class LocalCredentialsStore {
  private cache: { mtimeMs: number; records: DataOpsCredentialRecord[] } | null = null

  constructor(private readonly filePath: string) {}

  async load(): Promise<DataOpsCredentialRecord[]> {
    const abs = path.resolve(process.cwd(), this.filePath)
    const stat = await statFile(abs).catch(() => null)
    if (!stat) return []

    if (this.cache && Math.abs(this.cache.mtimeMs - stat.mtimeMs) < 1) {
      return this.cache.records
    }

    const raw = await readFile(abs, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const allowed = getAllowedEmails()
    const records = parsed
      .filter((entry) => entry && typeof entry.email === 'string')
      .map((entry) => ({
        ...entry,
        email: String(entry.email).toLowerCase(),
        roles: Array.isArray(entry.roles) ? entry.roles.map(String) : [],
        groups: Array.isArray(entry.groups) ? entry.groups.map(String) : [],
        tenantId: entry.tenantId ? String(entry.tenantId) : null,
      }))
      .filter((record) => !allowed || allowed.includes(record.email))

    this.cache = { mtimeMs: stat.mtimeMs, records }
    return records
  }

  async verifyCredentials(payload: CredentialsPayload): Promise<VerifyCredentialsResponse> {
    const records = await this.load()
    const entry = records.find((record) => record.email === payload.email.toLowerCase())
    if (!entry) return { user: null, reason: 'not_found' }
    const ok = await verifyPassword(payload.password, entry.password)
    if (!ok) return { user: null, reason: 'invalid_password' }

    const id = entry.id ?? deriveStableId(entry.email)
    const user: AuthenticatedUser = {
      id,
      email: entry.email,
      name: entry.name ?? null,
      image: entry.image ?? null,
      roles: entry.roles ?? [],
      groups: entry.groups ?? [],
      tenantId: entry.tenantId ?? null,
      metadata: entry.metadata ?? {},
    }
    return { user }
  }

  async getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
    const records = await this.load()
    const entry = records.find((record) => record.email === email.toLowerCase())
    if (!entry) return null
    return {
      id: entry.id ?? deriveStableId(entry.email),
      email: entry.email,
      name: entry.name ?? null,
      image: entry.image ?? null,
      roles: entry.roles ?? [],
      groups: entry.groups ?? [],
      tenantId: entry.tenantId ?? null,
      metadata: entry.metadata ?? {},
    }
  }
}

function deriveStableId(email: string): string {
  const digest = createHash('sha256').update(email).digest('hex')
  return `local-${digest.slice(0, 24)}`
}

async function verifyPassword(password: string, descriptor: string): Promise<boolean> {
  if (!descriptor) return false
  if (descriptor.startsWith('scrypt:')) {
    const [, saltB64, keyB64] = descriptor.split(':')
    if (!saltB64 || !keyB64) return false
    const key = Buffer.from(keyB64, 'base64')
    const derived = scryptSync(password, Buffer.from(saltB64, 'base64'), key.length || DEFAULT_SCRYPT_KEYLEN)
    return timingSafeEqual(key, derived)
  }
  if (descriptor.startsWith('plain:')) {
    return timingSafeEqual(Buffer.from(descriptor.slice('plain:'.length)), Buffer.from(password))
  }
  // Default fallback
  return timingSafeEqual(Buffer.from(descriptor), Buffer.from(password))
}

async function requestJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`DataOps request failed: ${response.status} ${text}`)
  }
  return response.json() as Promise<T>
}

export class DataOpsClient {
  private readonly baseUrl: URL | null
  private readonly token: string | null
  private readonly localStore: LocalCredentialsStore | null

  constructor() {
    this.baseUrl = getDataOpsAuthUrl()
    this.token = getInternalToken()
    const credentialsFile = getCredentialsFile()
    this.localStore = credentialsFile ? new LocalCredentialsStore(credentialsFile) : null
  }

  private makeUrl(pathname: string): string {
    if (!this.baseUrl) throw new Error('DATAOPS_AUTH_URL not configured')
    const url = new URL(pathname, this.baseUrl)
    return url.toString()
  }

  private authHeaders(): Record<string, string> {
    if (!this.token) return {}
    return { Authorization: `Bearer ${this.token}` }
  }

  async verifyCredentials(payload: CredentialsPayload): Promise<VerifyCredentialsResponse> {
    if (this.baseUrl) {
      try {
        return await requestJSON<VerifyCredentialsResponse>(this.makeUrl('/auth/verify'), {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(payload),
        })
      } catch (err) {
        console.error('[ux/auth] Remote credential verification failed, falling back to local store', err)
      }
    }

    if (this.localStore) {
      return this.localStore.verifyCredentials(payload)
    }

    return { user: null, reason: 'unconfigured' }
  }

  async getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
    if (this.baseUrl) {
      try {
        const result = await requestJSON<{ user: AuthenticatedUser | null }>(
          this.makeUrl(`/auth/users/by-email?email=${encodeURIComponent(email)}`),
          {
            method: 'GET',
            headers: this.authHeaders(),
            cache: 'no-store',
          },
        )
        if (result.user) {
          return result.user
        }
      } catch (err) {
        console.error('[ux/auth] Remote getUserByEmail failed, falling back to local store', err)
      }
    }

    if (this.localStore) {
      return this.localStore.getUserByEmail(email)
    }

    return null
  }

  async getUserById(id: string): Promise<AuthenticatedUser | null> {
    if (this.baseUrl) {
      try {
        const result = await requestJSON<{ user: AuthenticatedUser | null }>(
          this.makeUrl(`/auth/users/${encodeURIComponent(id)}`),
          {
            method: 'GET',
            headers: this.authHeaders(),
            cache: 'no-store',
          },
        )
        if (result.user) return result.user
      } catch (err) {
        console.error('[ux/auth] Remote getUserById failed, falling back to local store', err)
      }
    }

    if (!this.localStore) return null
    const records = await this.localStore.load()
    const match = records.find((record) => (record.id ?? deriveStableId(record.email)) === id)
    if (!match) return null
    return {
      id,
      email: match.email,
      name: match.name ?? null,
      image: match.image ?? null,
      roles: match.roles ?? [],
      groups: match.groups ?? [],
      tenantId: match.tenantId ?? null,
      metadata: match.metadata ?? {},
    }
  }

  async ensureUser(user: AuthenticatedUser): Promise<AuthenticatedUser> {
    if (this.baseUrl) {
      try {
        const result = await requestJSON<{ user: AuthenticatedUser }>(this.makeUrl('/auth/users'), {
          method: 'POST',
          headers: {
            ...this.authHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(user),
        })
        return result.user
      } catch (err) {
        console.error('[ux/auth] Failed to upsert user in DataOps', err)
      }
    }

    // Local mode simply returns the provided user
    if (!user.id) {
      return { ...user, id: user.email ? deriveStableId(user.email) : randomUUID() }
    }
    return user
  }
}

export const dataOpsClient = new DataOpsClient()
