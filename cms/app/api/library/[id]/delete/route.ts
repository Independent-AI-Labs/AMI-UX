import { NextResponse } from 'next/server'
import { listLibrary, saveLibrary } from '../../../../lib/store'
import { withSession } from '../../../../lib/auth-guard'
import path from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function rmrf(p: string) {
  try {
    await fs.rm(p, { recursive: true, force: true })
  } catch {}
}

export const POST = withSession(async ({ context }: { context: { params: Promise<{ id: string }> } }) => {
  const { id } = await context.params
  const entries = await listLibrary()
  const entry = entries.find((e) => e.id === id)
  if (!entry) return NextResponse.json({ error: 'not found' }, { status: 404 })
  // Guard: only allow deletion under files/uploads for now
  const uploadsDir = path.resolve(process.cwd(), 'files/uploads')
  const abs = path.resolve(entry.path)
  if (!abs.startsWith(uploadsDir + path.sep) && abs !== uploadsDir) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  await rmrf(abs)
  // Remove from library
  const next = entries.filter((e) => e.id !== id)
  await saveLibrary(next)
  return NextResponse.json({ ok: true })
})
