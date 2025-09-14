import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function exists(p: string) {
  try { await fs.access(p); return true } catch { return false }
}

async function readJson(p: string): Promise<any|null> {
  try { return JSON.parse(await fs.readFile(p, 'utf8')) } catch { return null }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const input = url.searchParams.get('path') || ''
  if (!input) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const abs = path.resolve(process.cwd(), input)
  try {
    const st = await fs.stat(abs)
    if (st.isFile()) {
      const ext = path.extname(abs).toLowerCase()
      const base = abs.slice(0, -ext.length)
      const hasJs = await exists(`${base}.js`) || await exists(path.join(path.dirname(abs), 'index.js'))
      return NextResponse.json({ type: 'file', hasJs, ext })
    }
    if (st.isDirectory()) {
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
}

