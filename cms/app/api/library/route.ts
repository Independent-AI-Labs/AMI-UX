import { NextResponse } from 'next/server'
import path from 'path'
import crypto from 'crypto'
import { listLibrary, saveLibrary, type LibraryEntry, type LibraryKind } from '../../lib/store'
import { promises as fs } from 'fs'

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
        const hasApp = await fs.stat(path.join(absPath, 'app')).then(() => true).catch(() => false)
        const hasPages = await fs.stat(path.join(absPath, 'pages')).then(() => true).catch(() => false)
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

export async function GET() {
  const list = await listLibrary()
  // Include configured docRoot as a virtual entry if not present
  try {
    const cfgPath = path.resolve(process.cwd(), 'data/config.json')
    const raw = await fs.readFile(cfgPath, 'utf8').catch(() => '')
    let docRoot: string | null = null
    if (raw) {
      const cfg = JSON.parse(raw)
      docRoot = (typeof cfg?.docRoot === 'string' && cfg.docRoot) ? cfg.docRoot : null
    }
    if (!docRoot) {
      docRoot = process.env.DOC_ROOT || ''
    }
    if (docRoot) {
      const abs = path.resolve(process.cwd(), docRoot)
      const exists = list.some((e) => path.resolve(e.path) === abs)
      if (!exists) {
        // Validate it exists and classify
        const st = await fs.stat(abs).catch(() => null)
        if (st) {
          const kind: LibraryKind = st.isFile() ? 'file' : 'dir'
          const id = idFromPath(abs)
          const virtual: LibraryEntry = { id, path: abs, kind, createdAt: Date.now(), label: 'Configured docRoot' }
          list.unshift(virtual)
        }
      }
    }
  } catch {}
  return NextResponse.json({ entries: list })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || !body.path) return NextResponse.json({ error: 'path required' }, { status: 400 })
  const abs = path.resolve(process.cwd(), body.path)
  try {
    const kind: LibraryKind = body.kind || await detectKind(abs)
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
}
