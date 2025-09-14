import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Cfg = { docRoot: string }

async function loadCfg(): Promise<Cfg> {
  const p = path.resolve(process.cwd(), 'data/config.json')
  try {
    const raw = await fs.readFile(p, 'utf8')
    const cfg = JSON.parse(raw)
    return { docRoot: cfg.docRoot || process.env.DOC_ROOT || '../../../AMI-REACH/social' }
  } catch {
    return { docRoot: process.env.DOC_ROOT || '../../../AMI-REACH/social' }
  }
}

function withinRoot(rootAbs: string, targetAbs: string) {
  const rel = path.relative(rootAbs, targetAbs)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
}

const ALLOWED = new Set(Object.keys(MIME))

function buildCspHeader({ allowInlineScript = false }: { allowInlineScript?: boolean }) {
  const scriptSrc = allowInlineScript ? "'self' 'unsafe-inline'" : "'self'"
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "img-src 'self' data:",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rel = url.searchParams.get('path') || ''
  const rootParam = url.searchParams.get('root') || 'docRoot'
  const mode = url.searchParams.get('mode') || ''
  if (!rel) return new NextResponse('Missing path', { status: 400 })

  const { docRoot } = await loadCfg()
  const cwd = process.cwd()
  const roots: Record<string, string> = {
    docRoot: path.resolve(cwd, docRoot),
    uploads: path.resolve(cwd, 'files/uploads'),
  }
  const rootAbs = roots[rootParam] || roots.docRoot
  const targetAbs = path.resolve(rootAbs, rel)
  if (!withinRoot(rootAbs, targetAbs)) return new NextResponse('Forbidden', { status: 403 })

  const ext = path.extname(targetAbs).toLowerCase()
  if (!ALLOWED.has(ext)) return new NextResponse('Unsupported type', { status: 415 })

  try {
    const st = await fs.stat(targetAbs)
    const etag = `W/"${st.size}-${Number(st.mtimeMs).toString(16)}"`
    const ifNoneMatch = req.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      const h304 = new Headers({
        ETag: etag,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      })
      return new NextResponse(null, { status: 304, headers: h304 })
    }
    const data = await fs.readFile(targetAbs)
    const type = MIME[ext] || 'application/octet-stream'
    const allowInline = mode === 'A'
    const headers = new Headers({
      'Content-Type': type,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Security-Policy': buildCspHeader({ allowInlineScript: allowInline }),
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
    })
    return new NextResponse(data, { status: 200, headers })
  } catch (e) {
    return new NextResponse('Not found', { status: 404 })
  }
}
