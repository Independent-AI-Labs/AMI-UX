import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

type Config = { docRoot: string, allowed?: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadConfig(): Promise<Config> {
  const dataPath = path.resolve(process.cwd(), 'data/config.json')
  try {
    const raw = await fs.readFile(dataPath, 'utf8')
    const cfg = JSON.parse(raw)
    return {
      docRoot: cfg.docRoot || process.env.DOC_ROOT || '../../../AMI-REACH/social',
      allowed: cfg.allowed || process.env.ALLOWED_EXTENSIONS || '.md,.csv,.txt'
    }
  } catch {
    return {
      docRoot: process.env.DOC_ROOT || '../../../AMI-REACH/social',
      allowed: process.env.ALLOWED_EXTENSIONS || '.md,.csv,.txt'
    }
  }
}

async function getAllowed(): Promise<string[]> {
  const cfg = await loadConfig()
  return (cfg.allowed || '.md,.csv,.txt').split(',').map(s => s.trim().toLowerCase())
}

function withinRoot(rootAbs: string, targetAbs: string) {
  const rel = path.relative(rootAbs, targetAbs)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const relPath = url.searchParams.get('path') || ''
  if (!relPath) return new NextResponse('Missing path', { status: 400 })

  const cfg = await loadConfig()
  const ALLOWED = await getAllowed()
  const rootAbs = path.resolve(process.cwd(), cfg.docRoot)
  const targetAbs = path.resolve(rootAbs, relPath)
  if (!withinRoot(rootAbs, targetAbs)) return new NextResponse('Forbidden', { status: 403 })

  const ext = path.extname(targetAbs).toLowerCase()
  if (!ALLOWED.includes(ext)) return new NextResponse('Unsupported type', { status: 415 })

  try {
    const data = await fs.readFile(targetAbs, 'utf8')
    const type = ext === '.md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8'
    return new NextResponse(data, { status: 200, headers: { 'Content-Type': type } })
  } catch (e) {
    return new NextResponse('Not found', { status: 404 })
  }
}
