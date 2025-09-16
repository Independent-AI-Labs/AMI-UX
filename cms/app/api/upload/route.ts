import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeRel(p: string) {
  // normalize and strip leading slashes
  const norm = p.replace(/^\/+/, '').replace(/\\/g, '/').trim()
  // remove .. segments
  const parts = norm.split('/').filter(seg => seg && seg !== '.' && seg !== '..')
  return parts.join('/')
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid form' }, { status: 400 })

  const ts = Date.now()
  const base = path.resolve(process.cwd(), 'files/uploads', String(ts))
  await fs.mkdir(base, { recursive: true })

  const saved: { name: string, path: string, bytes: number }[] = []

  // Accept multiple fields named 'file'; optional companion 'path' per file, or a common 'prefix'
  const prefix = sanitizeRel(String(form.get('prefix') || ''))

  for (const [key, val] of form.entries()) {
    if (key !== 'file') continue
    const file = val as unknown as File
    if (!file || typeof (file as any).arrayBuffer !== 'function') continue
    const data = Buffer.from(await file.arrayBuffer())
    // best-effort per-file path: allow 'path' next to file or use file.name
    let rel = ''
    // Prefer a per-file provided relative path when present (e.g., webkitRelativePath sent as filename)
    const relCandidate = (file as any).name || form.get('path') || 'file'
    rel = sanitizeRel(String(relCandidate))
    const fullRel = prefix ? `${prefix}/${rel}` : rel
    const dest = path.join(base, fullRel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, data)
    saved.push({ name: (file as any).name || 'file', path: path.relative(path.resolve(process.cwd()), dest), bytes: data.length })
  }

  return NextResponse.json({ ok: true, uploadedAt: ts, files: saved })
}
