import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { getConfig, saveConfig, type CmsConfig } from '../../lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function defaultDocRoot(): string {
  return process.env.DOC_ROOT || '../../../AMI-REACH/social'
}

export async function GET() {
  const cfg = await getConfig()
  // Ensure stable defaults
  const filled: CmsConfig = {
    docRoot: cfg.docRoot || defaultDocRoot(),
    selected: cfg.selected ?? null,
    openTabs: cfg.openTabs ?? [],
    activeTabId: cfg.activeTabId ?? null,
    preferredMode: cfg.preferredMode,
    recents: cfg.recents ?? [],
  }
  return NextResponse.json(filled)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Partial<CmsConfig>))
  const current = await getConfig()
  const next: CmsConfig = { ...current }

  // Backward-compatible docRoot update (existing UI)
  if (typeof (body as any).docRoot === 'string') {
    const candidate = String((body as any).docRoot)
    // Validate exists and is a directory
    try {
      const abs = path.resolve(process.cwd(), candidate)
      const st = await fs.stat(abs)
      if (!st.isDirectory()) throw new Error('Not a directory')
      next.docRoot = candidate
    } catch (e: any) {
      return NextResponse.json({ error: `Invalid directory: ${e?.message || 'stat failed'}` }, { status: 400 })
    }
  }

  if (body.selected !== undefined) next.selected = body.selected as any
  if (Array.isArray(body.openTabs)) next.openTabs = body.openTabs as any
  if ('activeTabId' in body) next.activeTabId = (body as any).activeTabId ?? null
  if (typeof (body as any).preferredMode === 'string') next.preferredMode = (body as any).preferredMode as any
  if (Array.isArray((body as any).recents)) next.recents = (body as any).recents as any

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

export async function PATCH(req: Request) {
  return POST(req)
}
