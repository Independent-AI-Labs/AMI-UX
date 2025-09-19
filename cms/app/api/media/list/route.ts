import { NextResponse } from 'next/server'
import path from 'path'
import { loadDocRootInfo, repoRoot as sharedRepoRoot } from '../../../lib/doc-root'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const cwd = sharedRepoRoot
  const uploads = path.resolve(cwd, 'files/uploads')
  const roots: Array<{ key: string, label: string, path: string }> = []

  const docInfo = await loadDocRootInfo().catch(() => null)
  if (docInfo) {
    roots.push({ key: 'docRoot', label: docInfo.label, path: docInfo.absolute })
  }

  roots.push({ key: 'uploads', label: 'Uploads', path: uploads })

  // Optional: include repository files directory if present
  const repoFiles = path.resolve(cwd, 'files')
  try {
    require('fs').statSync(repoFiles)
    roots.push({ key: 'repoFiles', label: 'Repository files/', path: repoFiles })
  } catch {}

  // Optional: add extra roots from env MEDIA_ROOTS, comma-separated; each item may be
  //  - /abs/path
  //  - Label::/abs/path
  const extra = (process.env.MEDIA_ROOTS || '').split(',').map(s => s.trim()).filter(Boolean)
  extra.forEach((item, idx) => {
    const parts = item.split('::')
    const p = parts.length > 1 ? parts.slice(-1)[0] : parts[0]
    const label = parts.length > 1 ? parts.slice(0, -1).join('::') : undefined
    const abs = path.isAbsolute(p) ? p : path.resolve(cwd, p)
    try {
      require('fs').statSync(abs)
      roots.push({ key: `extra-${idx}`, label: label || abs, path: abs })
    } catch {}
  })

  return NextResponse.json({ roots })
}
