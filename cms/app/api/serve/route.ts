import { NextResponse } from 'next/server'
import { listLibrary, listServed, saveServed, type ServeInstance } from '../../lib/store'
import { withSession } from '../../lib/auth-guard'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function idGen() {
  return crypto.randomBytes(6).toString('hex')
}

export const GET = withSession(async () => {
  const list = await listServed()
  return NextResponse.json({ instances: list })
})

export const POST = withSession(async ({ request }) => {
  const body = await request.json().catch(() => null)
  if (!body || !body.entryId)
    return NextResponse.json({ error: 'entryId required' }, { status: 400 })
  const entries = await listLibrary()
  const entry = entries.find((e) => e.id === body.entryId)
  if (!entry) return NextResponse.json({ error: 'entry not found' }, { status: 404 })
  const served = await listServed()
  let inst = served.find((s) => s.entryId === entry.id)
  if (inst && inst.status === 'running') return NextResponse.json({ ok: true, id: inst.id })
  if (!inst) {
    inst = { id: idGen(), entryId: entry.id, kind: entry.kind, status: 'starting' } as ServeInstance
    served.push(inst)
  }
  if (entry.kind === 'app') {
    // Disabled: do not auto-start another Next server for external apps from within CMS.
    // To enable, provide an external runner per-app and call it here.
    inst.status = 'error'
    await saveServed(served)
    return NextResponse.json(
      { error: 'app serving disabled; provide external runner' },
      { status: 501 },
    )
  } else {
    // file/dir: no external process, considered running once mapped
    inst.status = 'running'
    await saveServed(served)
  }
  return NextResponse.json({ ok: true, id: inst.id })
})
