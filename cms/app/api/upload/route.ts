import { NextResponse } from 'next/server'
import { createReadStream, createWriteStream } from 'fs'
import { promises as fs } from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'
import { loadDocRootInfo, repoRoot as sharedRepoRoot } from '../../lib/doc-root'
import { appRoot, uploadsRoot as sharedUploadsRoot } from '../../lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type UploadMeta = {
  size: number
  uploaded: number
  completed: boolean
  hash: string | null
  updatedAt: number
}

const repoRoot = sharedRepoRoot
const uploadsRoot = sharedUploadsRoot

type RootTarget = {
  key: 'uploads' | 'docRoot'
  base: string
  label: string
  metaBase: string
  relativeBase: string
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

async function resolveRootTarget(rootParam: string | null | undefined): Promise<RootTarget> {
  if (rootParam === 'docRoot') {
    const info = await loadDocRootInfo()
    if (!info) throw new Error('DOC_ROOT not found')
    const metaBase = path.resolve(appRoot, 'data/upload-meta/docRoot')
    await ensureDir(metaBase)
    return {
      key: 'docRoot',
      base: info.absolute,
      label: info.label,
      metaBase,
      relativeBase: info.relative,
    }
  }
  const base = uploadsRoot
  const metaBase = path.resolve(base, '.upload-meta')
  await ensureDir(base)
  await ensureDir(metaBase)
  return {
    key: 'uploads',
    base,
    label: 'Uploads',
    metaBase,
    relativeBase: path.relative(repoRoot, base),
  }
}

function sanitizeRel(p: string) {
  const norm = p.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  const parts = norm.split('/').filter((seg) => seg && seg !== '.' && seg !== '..')
  return parts.join('/')
}

function ensureWithinBase(base: string, rel: string) {
  const sanitized = sanitizeRel(rel)
  if (!sanitized) throw new Error('invalid path')
  const full = path.resolve(base, sanitized)
  if (!full.startsWith(base)) throw new Error('invalid path')
  return { sanitized, full }
}

function metaPathFor(target: RootTarget, sanitized: string) {
  const metaPath = path.resolve(target.metaBase, `${sanitized}.json`)
  if (!metaPath.startsWith(target.metaBase)) throw new Error('invalid meta path')
  return metaPath
}

async function readMeta(target: RootTarget, sanitized: string): Promise<UploadMeta | null> {
  try {
    const raw = await fs.readFile(metaPathFor(target, sanitized), 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const size = Number(parsed.size)
    const uploaded = Number(parsed.uploaded)
    const completed = !!parsed.completed
    const hash = typeof parsed.hash === 'string' ? parsed.hash : null
    const updatedAt = Number(parsed.updatedAt) || Date.now()
    if (!Number.isFinite(size) || size < 0) return null
    const safeUploaded = Number.isFinite(uploaded) && uploaded >= 0 ? uploaded : 0
    return { size, uploaded: safeUploaded, completed, hash, updatedAt }
  } catch {
    return null
  }
}

async function writeMeta(target: RootTarget, sanitized: string, meta: UploadMeta) {
  const filePath = metaPathFor(target, sanitized)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(meta, null, 2), 'utf8')
}

async function removeMeta(target: RootTarget, sanitized: string) {
  try {
    await fs.rm(metaPathFor(target, sanitized), { force: true })
  } catch {}
}

async function hashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function summarizeResponse(target: RootTarget, rel: string, absolute: string, meta: UploadMeta) {
  return {
    ok: true,
    complete: meta.completed,
    offset: meta.uploaded,
    uploadedAt: meta.updatedAt,
    rootKey: target.key,
    rootLabel: target.label,
    rootAbsolute: path.dirname(absolute),
    rootRelative: path.relative(repoRoot, path.dirname(absolute)),
    rootBaseAbsolute: target.base,
    rootBaseRelative: target.relativeBase,
    files: meta.completed
      ? [{
          name: path.basename(absolute),
          absolutePath: absolute,
          relativePath: rel,
          path: path.relative(repoRoot, absolute),
          bytes: meta.size,
          hash: meta.hash,
        }]
      : [],
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const relParam = url.searchParams.get('path') || ''
  const sizeParam = url.searchParams.get('size') || ''
  const rootParam = url.searchParams.get('root') || undefined
  const intent = url.searchParams.get('intent') || 'replace'
  const expectedSize = Number(sizeParam)

  if (!relParam) return NextResponse.json({ error: 'path required' }, { status: 400 })
  if (!Number.isFinite(expectedSize) || expectedSize < 0) {
    return NextResponse.json({ error: 'invalid size' }, { status: 400 })
  }

  let target: RootTarget
  try {
    target = await resolveRootTarget(rootParam)
  } catch (err) {
    console.error('[api/upload] resolve root failed:', err)
    const message = rootParam === 'docRoot' ? 'docRoot unavailable' : 'invalid root'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  let resolved
  try {
    resolved = ensureWithinBase(target.base, relParam)
  } catch {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 })
  }

  const { sanitized, full } = resolved
  const meta = await readMeta(target, sanitized)

  let statSize = 0
  try {
    const stat = await fs.stat(full)
    if (stat.isFile()) statSize = stat.size
  } catch {}

  const resume = intent === 'resume'
  const recordedSize = meta?.size ?? expectedSize
  const uploaded = resume ? (meta ? Math.max(meta.uploaded, statSize) : statSize) : 0
  const completed = resume ? (!!meta?.completed && uploaded === recordedSize) : false
  const hash = completed ? meta?.hash ?? null : null

  return NextResponse.json({
    offset: uploaded,
    complete: completed,
    size: recordedSize,
    hash,
    existing: statSize > 0 || !!meta,
  })
}

export async function PUT(req: Request) {
  const url = new URL(req.url)
  const relParam = url.searchParams.get('path') || ''
  const sizeParam = url.searchParams.get('size') || ''
  const rootParam = url.searchParams.get('root') || undefined
  const expectedSize = Number(sizeParam)
  const offsetHeader = req.headers.get('x-upload-offset') || '0'
  const providedOffset = Number(offsetHeader)

  if (!relParam) return NextResponse.json({ error: 'path required' }, { status: 400 })
  if (!Number.isFinite(expectedSize) || expectedSize < 0) {
    return NextResponse.json({ error: 'invalid size' }, { status: 400 })
  }
  if (!Number.isFinite(providedOffset) || providedOffset < 0) {
    return NextResponse.json({ error: 'invalid offset' }, { status: 400 })
  }
  if (!req.body) {
    return NextResponse.json({ error: 'empty body' }, { status: 400 })
  }

  let target: RootTarget
  try {
    target = await resolveRootTarget(rootParam)
  } catch (err) {
    console.error('[api/upload] resolve root failed:', err)
    const message = rootParam === 'docRoot' ? 'docRoot unavailable' : 'invalid root'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  let resolved
  try {
    resolved = ensureWithinBase(target.base, relParam)
  } catch {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 })
  }

  const { sanitized, full } = resolved
  const targetDir = path.dirname(full)
  const metaFilePath = metaPathFor(target, sanitized)
  await fs.mkdir(targetDir, { recursive: true })
  await fs.mkdir(path.dirname(metaFilePath), { recursive: true })

  let meta = await readMeta(target, sanitized)
  if (meta && meta.size !== expectedSize) {
    return NextResponse.json({ error: 'size mismatch' }, { status: 409 })
  }

  if (!meta) {
    meta = { size: expectedSize, uploaded: 0, completed: false, hash: null, updatedAt: Date.now() }
    await writeMeta(target, sanitized, meta)
  }

  if (providedOffset === 0) {
    await fs.writeFile(full, '')
    meta = { size: expectedSize, uploaded: 0, completed: false, hash: null, updatedAt: Date.now() }
    await writeMeta(target, sanitized, meta)
  } else {
    const stat = await fs.stat(full).catch(() => null)
    if (!stat || !stat.isFile()) {
      return NextResponse.json({ error: 'missing partial file' }, { status: 409 })
    }
    if (stat.size !== providedOffset) {
      return NextResponse.json({ error: 'offset mismatch', size: stat.size }, { status: 409 })
    }
  }

  const nodeStream = Readable.fromWeb(req.body as any)
  let chunkBytes = 0
  const counter = new Transform({
    transform(chunk, _enc, callback) {
      chunkBytes += chunk.length
      callback(null, chunk)
    },
  })

  const writeStream = createWriteStream(full, {
    flags: providedOffset === 0 ? 'w' : 'r+',
    start: providedOffset,
  })

  try {
    await pipeline(nodeStream, counter, writeStream)
  } catch (err) {
    console.error('[api/upload] write failed:', err)
    await removeMeta(target, sanitized)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }

  const finalSize = providedOffset + chunkBytes
  if (finalSize > expectedSize) {
    return NextResponse.json({ error: 'exceeds expected size' }, { status: 409 })
  }

  let completed = false
  let fileHash: string | null = meta.hash || null
  if (finalSize === expectedSize) {
    try {
      fileHash = await hashFile(full)
      completed = true
    } catch (err) {
      console.error('[api/upload] hash failed:', err)
      return NextResponse.json({ error: 'hash failed' }, { status: 500 })
    }
  }

  meta = {
    size: expectedSize,
    uploaded: finalSize,
    completed,
    hash: completed ? fileHash : null,
    updatedAt: Date.now(),
  }
  await writeMeta(target, sanitized, meta)

  if (completed) {
    return NextResponse.json(summarizeResponse(target, sanitized, full, meta))
  }

  return NextResponse.json({
    ok: true,
    complete: false,
    offset: finalSize,
    size: expectedSize,
  })
}
