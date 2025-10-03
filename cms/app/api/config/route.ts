import { NextResponse } from 'next/server'
import { getConfig, saveConfig, type CmsConfig } from '../../lib/store'
import { withSession } from '../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleGet() {
  const cfg = await getConfig()

  const response = {
    selected: cfg.selected ?? null,
    openTabs: cfg.openTabs ?? [],
    activeTabId: cfg.activeTabId ?? null,
    preferredMode: cfg.preferredMode,
    recents: cfg.recents ?? [],
    allowed: cfg.allowed,
  }
  return NextResponse.json(response)
}

async function handlePost(req: Request) {
  const body = await req.json().catch(() => ({}) as Partial<CmsConfig>)
  const current = await getConfig()
  const next: CmsConfig = { ...current }

  if (body.selected !== undefined) next.selected = body.selected as any
  if (Array.isArray(body.openTabs)) next.openTabs = body.openTabs as any
  if ('activeTabId' in body) next.activeTabId = (body as any).activeTabId ?? null
  if (typeof (body as any).preferredMode === 'string')
    next.preferredMode = (body as any).preferredMode as any
  if (Array.isArray((body as any).recents)) next.recents = (body as any).recents as any
  if (typeof (body as any).allowed === 'string') next.allowed = String((body as any).allowed)

  // Convenience: recentsAdd to push a single entry
  const add = (body as any).recentsAdd
  if (add && typeof add.path === 'string' && typeof add.type === 'string') {
    const cap = 20
    const curr = Array.isArray(next.recents) ? next.recents.slice() : []
    const filtered = curr.filter((r) => r.path !== add.path)
    filtered.unshift({ type: add.type, path: add.path, mode: add.mode })
    next.recents = filtered.slice(0, cap)
  }

  await saveConfig(next)

  return NextResponse.json({ ok: true })
}

export const GET = withSession(async () => handleGet())

export const POST = withSession(async ({ request }) => handlePost(request))

export const PATCH = withSession(async ({ request }) => handlePost(request))
