import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { repoRoot } from '../../lib/doc-root'
import { withSession } from '../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function exists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readJson(p: string): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch {
    return null
  }
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const input = url.searchParams.get('path') || ''
  if (!input) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const candidate = path.isAbsolute(input) ? input : path.resolve(repoRoot, input)
  let abs = candidate
  let stat = await fs.stat(abs).catch(() => null)
  if (!stat) {
    const fallback = path.resolve(process.cwd(), input)
    if (fallback !== abs) {
      abs = fallback
      stat = await fs.stat(abs).catch(() => null)
    }
  }
  if (!stat) return NextResponse.json({ error: 'not found' }, { status: 404 })
  try {
    if (stat.isFile()) {
      const ext = path.extname(abs).toLowerCase()
      const base = abs.slice(0, -ext.length)
      const hasJs =
        (await exists(`${base}.js`)) || (await exists(path.join(path.dirname(abs), 'index.js')))
      return NextResponse.json({ type: 'file', hasJs, ext })
    }
    if (stat.isDirectory()) {
      // Next.js app?
      const pkg = await readJson(path.join(abs, 'package.json'))
      const hasNext = !!pkg?.dependencies?.next || !!pkg?.devDependencies?.next
      const hasApp = await exists(path.join(abs, 'app'))
      const hasPages = await exists(path.join(abs, 'pages'))
      if (hasNext && (hasApp || hasPages)) return NextResponse.json({ type: 'app' })
      return NextResponse.json({ type: 'dir' })
    }
    return NextResponse.json({ error: 'unsupported' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
})
