import { NextResponse } from 'next/server'
import { listLibrary, saveLibrary } from '../../../lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const list = await listLibrary()
  const idx = list.findIndex((e) => e.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const current = list[idx]
  list[idx] = { ...current, ...('label' in body ? { label: String(body.label || '') } : {}) }
  await saveLibrary(list)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const list = await listLibrary()
  const next = list.filter((e) => e.id !== id)
  if (next.length === list.length) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await saveLibrary(next)
  return NextResponse.json({ ok: true })
}
