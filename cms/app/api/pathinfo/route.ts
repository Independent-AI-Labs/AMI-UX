import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { repoRoot } from '../../lib/store'
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

function isPathWithinBoundary(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const input = url.searchParams.get('path') || ''
  if (!input) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const candidate = path.isAbsolute(input) ? input : path.resolve(repoRoot, input)

  if (!isPathWithinBoundary(repoRoot, candidate)) {
    console.warn(`[pathinfo] Path rejected (outside boundary): ${input} -> ${candidate}`)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const stat = await fs.stat(candidate).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      console.warn(`[pathinfo] Path not found: ${candidate}`)
    } else if (err.code === 'EACCES') {
      console.error(`[pathinfo] Permission denied: ${candidate}`)
    } else {
      console.error(`[pathinfo] Error accessing path ${candidate}: ${err.message}`)
    }
    return null
  })

  if (!stat) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const abs = candidate
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
  } catch (error) {
    const err = error as Error
    console.error(`[pathinfo] Unexpected error processing ${abs}: ${err.message}`)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
})
