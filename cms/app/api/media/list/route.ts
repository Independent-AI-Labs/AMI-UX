import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MediaEntry = { type: 'file'|'dir'|'app', path: string, label?: string }

async function statSafe(p: string) {
  try { return await fs.stat(p) } catch { return null }
}

async function loadDocRoot(): Promise<string> {
  const dataPath = path.resolve(process.cwd(), 'data/config.json')
  try {
    const raw = await fs.readFile(dataPath, 'utf8')
    const cfg = JSON.parse(raw)
    return cfg.docRoot || process.env.DOC_ROOT || '../../../AMI-REACH/social'
  } catch {
    return process.env.DOC_ROOT || '../../../AMI-REACH/social'
  }
}

export async function GET() {
  const cwd = process.cwd()
  const docRoot = await loadDocRoot()
  const candidates: MediaEntry[] = []

  // Always include docRoot if it exists
  const docAbs = path.resolve(cwd, docRoot)
  if (await statSafe(docAbs)) candidates.push({ type: 'dir', path: docRoot, label: 'Configured docRoot' })

  // Common roots (best-effort, only if present)
  const common = [
    { p: 'files/uploads', label: 'Uploads' },
    { p: 'docs', label: 'Docs' },
    { p: 'domains', label: 'Domains' },
    { p: 'streams', label: 'Streams' },
  ]
  for (const { p, label } of common) {
    const abs = path.resolve(cwd, p)
    const st = await statSafe(abs)
    if (st?.isDirectory()) candidates.push({ type: 'dir', path: p, label })
  }

  return NextResponse.json({ roots: candidates })
}

