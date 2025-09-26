import { NextResponse } from 'next/server'
import { listServed, saveServed } from '../../../lib/store'
import { withSession } from '../../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withSession(async ({ context }) => {
  const { id } = await context.params
  const list = await listServed()
  const inst = list.find((s) => s.id === id)
  if (!inst) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(inst)
})

export const DELETE = withSession(async ({ context }) => {
  const { id } = await context.params
  const list = await listServed()
  const idx = list.findIndex((s) => s.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not found' }, { status: 404 })
  // For file/dir mapping there is no external process; mark as stopped.
  list[idx] = { ...list[idx], status: 'stopped' }
  await saveServed(list)
  return NextResponse.json({ ok: true })
})
