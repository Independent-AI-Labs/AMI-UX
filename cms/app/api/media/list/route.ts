import { NextResponse } from 'next/server'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const cwd = process.cwd()
  const uploads = path.resolve(cwd, 'files/uploads')
  let docRoot = ''
  try {
    const cfg = require('fs').readFileSync(path.resolve(cwd, 'data/config.json'), 'utf8')
    const j = JSON.parse(cfg)
    docRoot = j.docRoot || process.env.DOC_ROOT || ''
  } catch {
    docRoot = process.env.DOC_ROOT || ''
  }
  const docRootAbs = docRoot ? path.resolve(cwd, docRoot) : ''
  const roots: Array<{ label?: string, path: string }> = []
  if (docRootAbs) roots.push({ label: 'Configured docRoot', path: docRootAbs })
  roots.push({ label: 'Uploads', path: uploads })

  // Optional: include repository files directory if present
  const repoFiles = path.resolve(cwd, 'files')
  try { require('fs').statSync(repoFiles); roots.push({ label: 'Repository files/', path: repoFiles }) } catch {}

  // Optional: add extra roots from env MEDIA_ROOTS, comma-separated; each item may be
  //  - /abs/path
  //  - Label::/abs/path
  const extra = (process.env.MEDIA_ROOTS || '').split(',').map(s => s.trim()).filter(Boolean)
  for (const item of extra) {
    const parts = item.split('::')
    const p = parts.length > 1 ? parts.slice(-1)[0] : parts[0]
    const label = parts.length > 1 ? parts.slice(0, -1).join('::') : undefined
    const abs = path.isAbsolute(p) ? p : path.resolve(cwd, p)
    try { require('fs').statSync(abs); roots.push({ label, path: abs }) } catch {}
  }

  return NextResponse.json({ roots })
}
