import { NextResponse } from 'next/server'
import { listLibrary, saveLibrary } from '../../../lib/store'
import { withSession } from '../../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = withSession(async ({ request, context }) => {
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const list = await listLibrary()
  const idx = list.findIndex((e) => e.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const current = list[idx]
  list[idx] = { ...current, ...('label' in body ? { label: String(body.label || '') } : {}) }
  await saveLibrary(list)
  return NextResponse.json({ ok: true })
})

export const DELETE = withSession(async ({ context }) => {
  const { id } = await context.params
  const list = await listLibrary()
  const next = list.filter((e) => e.id !== id)
  if (next.length === list.length) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await saveLibrary(next)
  return NextResponse.json({ ok: true })
})
