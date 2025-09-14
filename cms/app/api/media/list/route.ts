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
  const roots = []
  if (docRootAbs) roots.push({ label: 'Configured docRoot', path: docRootAbs })
  roots.push({ label: 'Uploads', path: uploads })
  return NextResponse.json({ roots })
}
