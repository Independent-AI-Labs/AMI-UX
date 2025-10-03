import { NextResponse } from 'next/server'
import path from 'path'
import crypto from 'crypto'
import { listLibrary, saveLibrary, type LibraryEntry, type LibraryKind } from '../../lib/store'
import { withSession } from '../../lib/auth-guard'
import { promises as fs } from 'fs'
import type { Dirent } from 'fs'

type EntryMetrics = {
  items: number
  bytes: number
  truncated?: boolean
}

const ITEM_LIMIT = 10000

async function computeMetrics(absPath: string, kind: LibraryKind): Promise<EntryMetrics | null> {
  let stat
  try {
    stat = await fs.stat(absPath)
  } catch {
    return null
  }

  if (kind === 'file' || stat.isFile()) {
    return { items: 1, bytes: stat.size }
  }
  if (!stat.isDirectory()) {
    return { items: 1, bytes: stat.size }
  }

  let items = 0
  let bytes = 0
  let truncated = false

  async function walk(dir: string): Promise<void> {
    if (truncated) return
    let entries: Dirent[] = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const dirent of entries) {
      if (truncated) break
      if (dirent.isSymbolicLink()) continue
      const child = path.join(dir, dirent.name)
      if (dirent.isDirectory()) {
        await walk(child)
      } else {
        try {
          const st = await fs.stat(child)
          if (st.isFile()) {
            items += 1
            bytes += st.size
          }
        } catch {
          continue
        }
      }
      if (items >= ITEM_LIMIT) {
        truncated = true
        break
      }
    }
  }

  await walk(absPath)
  return { items, bytes, truncated: truncated || undefined }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function detectKind(absPath: string): Promise<LibraryKind> {
  const st = await fs.stat(absPath)
  if (st.isFile()) return 'file'
  if (st.isDirectory()) {
    try {
      const pkgRaw = await fs.readFile(path.join(absPath, 'package.json'), 'utf8').catch(() => '')
      if (pkgRaw) {
        const pkg = JSON.parse(pkgRaw)
        const hasNext = !!pkg?.dependencies?.next || !!pkg?.devDependencies?.next
        const hasApp = await fs
          .stat(path.join(absPath, 'app'))
          .then(() => true)
          .catch(() => false)
        const hasPages = await fs
          .stat(path.join(absPath, 'pages'))
          .then(() => true)
          .catch(() => false)
        if (hasNext && (hasApp || hasPages)) return 'app'
      }
    } catch {}
    return 'dir'
  }
  throw new Error('Unsupported path')
}

function idFromPath(p: string) {
  return crypto.createHash('sha1').update(p).digest('hex').slice(0, 12)
}

export const GET = withSession(async () => {
  const entries = await listLibrary()
  const augmented = await Promise.all(
    entries.map(async (entry) => {
      const metrics = await computeMetrics(entry.path, entry.kind).catch(() => null)
      return metrics ? { ...entry, metrics } : entry
    }),
  )
  return NextResponse.json({ entries: augmented })
})

export const POST = withSession(async ({ request }) => {
  const body = await request.json().catch(() => null)
  if (!body || !body.path) return NextResponse.json({ error: 'path required' }, { status: 400 })
  const abs = path.resolve(process.cwd(), body.path)
  try {
    const kind: LibraryKind = body.kind || (await detectKind(abs))
    const id = idFromPath(abs)
    const list = await listLibrary()
    if (!list.find((e) => e.id === id)) {
      const entry: LibraryEntry = { id, path: abs, kind, createdAt: Date.now() }
      if (typeof body.label === 'string') entry.label = body.label
      list.push(entry)
      await saveLibrary(list)
    } else {
      // If exists and label provided, update label
      const idx = list.findIndex((e) => e.id === id)
      if (idx !== -1 && typeof body.label === 'string') {
        list[idx] = { ...list[idx], label: body.label }
        await saveLibrary(list)
      }
    }
    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 })
  }
})
