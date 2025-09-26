import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { loadRuntimeConfig } from '../../lib/runtime-config'
import { getTextFormats, isAllowedTextFormat } from '../../lib/text-formats'
import { resolveMediaRoot } from '../../lib/media-roots'
import { withSession } from '../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function withinRoot(rootAbs: string, targetAbs: string) {
  const rel = path.relative(rootAbs, targetAbs)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const relPath = url.searchParams.get('path') || ''
  if (!relPath) return new NextResponse('Missing path', { status: 400 })

  const cfg = await loadRuntimeConfig()
  const formats = await getTextFormats(cfg.allowed ?? null)
  const rootParam = (url.searchParams.get('root') || 'docRoot') as string
  const allowedRoot = rootParam === 'uploads' ? 'uploads' : 'docRoot'
  const rootInfo = await resolveMediaRoot(allowedRoot)
  if (!rootInfo) return new NextResponse('Root unavailable', { status: 404 })
  const rootAbs = rootInfo.path
  const targetAbs = path.resolve(rootAbs, relPath)
  if (!withinRoot(rootAbs, targetAbs)) return new NextResponse('Forbidden', { status: 403 })

  if (allowedRoot === 'docRoot' && !isAllowedTextFormat(formats, relPath)) {
    return new NextResponse('Unsupported type', { status: 415 })
  }

  try {
    const st = await fs.stat(targetAbs)
    const etag = `W/"${st.size}-${Number(st.mtimeMs).toString(16)}"`
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': 'no-cache' },
      })
    }
    const data = await fs.readFile(targetAbs, 'utf8')
    const ext = path.extname(targetAbs).toLowerCase()
    const type = ext === '.md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8'
    return new NextResponse(data, {
      status: 200,
      headers: { 'Content-Type': type, ETag: etag, 'Cache-Control': 'no-cache' },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
})
