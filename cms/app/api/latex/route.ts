import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { withSession } from '../../lib/auth-guard'
import { resolveMediaRoot } from '../../lib/media-roots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const META_SUFFIX = '.meta'
const PDF_NAME = 'render.pdf'
const MANIFEST_NAME = 'manifest.json'
const LOG_NAME = 'compile.log'

function normalizeRelPath(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const withoutLeading = trimmed.replace(/^\/+/, '')
  const normalised = path.posix.normalize(withoutLeading)
  if (!normalised || normalised === '.' || normalised.startsWith('..')) throw new Error('Invalid path')
  return normalised
}

function resolveAbsolute(rootAbs: string, rel: string) {
  const segments = rel.split('/')
  return path.join(rootAbs, ...segments)
}

function withinRoot(rootAbs: string, targetAbs: string) {
  const rel = path.relative(rootAbs, targetAbs)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function statSafe(p: string) {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

async function loadManifest(manifestAbs: string) {
  try {
    const raw = await fs.readFile(manifestAbs, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toJsonResponse(body: unknown, init?: number | ResponseInit) {
  return NextResponse.json(body, typeof init === 'number' ? { status: init } : init)
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const relParam = url.searchParams.get('path') || ''
  const rootParam = url.searchParams.get('root') || 'docRoot'

  if (!relParam) return toJsonResponse({ error: 'Missing path' }, 400)

  let relPath: string
  try {
    relPath = normalizeRelPath(relParam)
  } catch {
    return toJsonResponse({ error: 'Invalid path' }, 400)
  }

  const root = await resolveMediaRoot(rootParam)
  if (!root) return toJsonResponse({ error: 'Unknown root' }, 404)

  const texAbs = resolveAbsolute(root.path, relPath)
  if (!withinRoot(root.path, texAbs)) return toJsonResponse({ error: 'Forbidden' }, 403)

  const texStat = await statSafe(texAbs)
  if (!texStat || !texStat.isFile()) return toJsonResponse({ error: 'Not found' }, 404)

  const metaRel = `${relPath}${META_SUFFIX}`
  const metaAbs = resolveAbsolute(root.path, metaRel)
  const pdfRel = path.posix.join(metaRel, PDF_NAME)
  const pdfAbs = resolveAbsolute(root.path, pdfRel)
  const manifestAbs = path.join(metaAbs, MANIFEST_NAME)

  const manifest = await loadManifest(manifestAbs)
  const pdfStat = await statSafe(pdfAbs)

  const hasPdf = !!pdfStat && pdfStat.isFile()
  const sourceMtime = texStat.mtimeMs
  const pdfMtime = pdfStat?.mtimeMs ?? null

  const headings = Array.isArray(manifest?.headings) ? manifest.headings : []
  const manifestSourceMtime = typeof manifest?.sourceMtime === 'number' ? manifest.sourceMtime : null
  const stale = !hasPdf || !manifestSourceMtime || manifestSourceMtime < sourceMtime

  return toJsonResponse({
    hasPdf,
    stale,
    pdfPath: hasPdf ? pdfRel : null,
    metaPath: metaRel,
    headings,
    sourceMtime,
    pdfMtime,
  })
})

export const POST = withSession(async ({ request }) => {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return toJsonResponse({ error: 'Expected multipart/form-data' }, 415)
  }

  const form = await request.formData()
  const relParam = (form.get('path') || '') as string
  const rootParam = ((form.get('root') || '') as string) || 'docRoot'
  const headingsParam = form.get('headings')
  const logParam = form.get('log')
  const pdfFile = form.get('pdf') as File | null

  if (!relParam) return toJsonResponse({ error: 'Missing path' }, 400)
  if (!pdfFile) return toJsonResponse({ error: 'Missing pdf' }, 400)

  let relPath: string
  try {
    relPath = normalizeRelPath(relParam)
  } catch {
    return toJsonResponse({ error: 'Invalid path' }, 400)
  }

  const root = await resolveMediaRoot(rootParam)
  if (!root) return toJsonResponse({ error: 'Unknown root' }, 404)
  if (!root.writable) return toJsonResponse({ error: 'Root not writable' }, 403)

  const texAbs = resolveAbsolute(root.path, relPath)
  if (!withinRoot(root.path, texAbs)) return toJsonResponse({ error: 'Forbidden' }, 403)

  const texStat = await statSafe(texAbs)
  if (!texStat || !texStat.isFile()) return toJsonResponse({ error: 'Source not found' }, 404)

  const metaRel = `${relPath}${META_SUFFIX}`
  const metaAbs = resolveAbsolute(root.path, metaRel)
  const pdfRel = path.posix.join(metaRel, PDF_NAME)
  const pdfAbs = resolveAbsolute(root.path, pdfRel)
  const manifestAbs = path.join(metaAbs, MANIFEST_NAME)
  const logAbs = path.join(metaAbs, LOG_NAME)

  await fs.mkdir(metaAbs, { recursive: true })

  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
  await fs.writeFile(pdfAbs, pdfBuffer)

  let headings: any[] = []
  if (typeof headingsParam === 'string') {
    try {
      const parsed = JSON.parse(headingsParam)
      if (Array.isArray(parsed)) headings = parsed
    } catch {}
  }

  if (typeof logParam === 'string' && logParam.trim()) {
    await fs.writeFile(logAbs, logParam, 'utf8').catch(async () => {
      try {
        await fs.unlink(logAbs)
      } catch {}
    })
  }

  const updatedManifest = {
    pdfFile: PDF_NAME,
    sourceMtime: texStat.mtimeMs,
    sourceSize: texStat.size,
    updatedAt: new Date().toISOString(),
    headings,
    logFile: typeof logParam === 'string' && logParam.trim() ? LOG_NAME : null,
  }

  await fs.writeFile(manifestAbs, JSON.stringify(updatedManifest, null, 2), 'utf8')

  const pdfStat = await statSafe(pdfAbs)

  return toJsonResponse({
    ok: true,
    pdfPath: pdfRel,
    headings,
    pdfMtime: pdfStat?.mtimeMs ?? null,
  })
})
