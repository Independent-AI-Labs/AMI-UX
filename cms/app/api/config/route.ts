import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { getConfig, saveConfig, type CmsConfig } from '../../lib/store'
import {
  repoRoot,
  DEFAULT_DOC_ROOT,
  defaultDocRootLabel,
  deriveDocRootLabel,
} from '../../lib/doc-root'
import { withSession } from '../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function defaultDocRoot(): string {
  return process.env.DOC_ROOT || DEFAULT_DOC_ROOT
}

function normalizeDocRootForStorage(absPath: string): string {
  const relative = path.relative(repoRoot, absPath)
  const cleaned = relative ? relative.replace(/\\/g, '/') : '.'
  return cleaned
}

async function handleGet() {
  const cfg = await getConfig()
  // docRoot and docRootLabel come from ENV, not stored config
  const rawDocRoot = defaultDocRoot()
  const docRootAbsolute = path.resolve(repoRoot, rawDocRoot)
  const labelExplicit = defaultDocRootLabel()
  const docRootLabel = deriveDocRootLabel(docRootAbsolute, labelExplicit)

  // Build response with both stored config and server-side config
  const response = {
    docRoot: rawDocRoot,
    docRootLabel,
    docRootAbsolute,
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

  // docRoot and docRootLabel are SERVER-SIDE CONFIG ONLY
  // Set via DOC_ROOT environment variable or in .env.local
  // Client cannot modify these values

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

  // docRoot and docRootLabel come from ENV, not stored config
  const docRoot = defaultDocRoot()
  const docRootAbsolute = path.resolve(repoRoot, docRoot)
  const docRootLabel = deriveDocRootLabel(docRootAbsolute, defaultDocRootLabel())

  return NextResponse.json({
    ok: true,
    docRoot,
    docRootLabel,
    docRootAbsolute,
  })
}

export const GET = withSession(async () => handleGet())

export const POST = withSession(async ({ request }) => handlePost(request))

export const PATCH = withSession(async ({ request }) => handlePost(request))
