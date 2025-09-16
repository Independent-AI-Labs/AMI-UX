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

export async function GET(_req: Request, context: { params: Promise<{ root: string, path?: string[] }> }) {
  const { root, path: pathParts } = await context.params
  const { docRoot } = await loadCfg()
  const cwd = process.cwd()
  const roots: Record<string, string> = {
    docRoot: path.resolve(cwd, docRoot),
    uploads: path.resolve(cwd, 'files/uploads'),
  }
  const baseRoot = roots[root] || roots.docRoot
  const relPath = (pathParts || []).join('/')
  const targetAbs = path.resolve(baseRoot, relPath)
  if (!withinRoot(baseRoot, targetAbs)) return new NextResponse('Forbidden', { status: 403 })
  try {
    const data = await fs.readFile(targetAbs)
    const ext = path.extname(targetAbs).toLowerCase()
    const type = MIME[ext] || 'application/octet-stream'
    const headers = new Headers({
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    const body = new Uint8Array(data)
    return new NextResponse(body, { status: 200, headers })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
