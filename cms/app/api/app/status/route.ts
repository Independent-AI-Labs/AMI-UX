import { NextResponse } from 'next/server'
import { execSync } from 'node:child_process'
import path from 'path'

import { withSession } from '../../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function psGrepApp(appPath: string) {
  try {
    const out = execSync('ps -eo pid,command', { encoding: 'utf8' })
    const lines = out.split(/\n+/).filter(Boolean)
    const needle = path.resolve(appPath)
    const m = lines.find((l) => /next (dev|start)/.test(l) && l.includes(needle))
    if (!m) return { running: false, message: 'No next process found' }
    const pid = m.trim().split(/\s+/, 1)[0]
    return { running: true, pid }
  } catch (e: any) {
    return { running: false, message: e?.message || 'ps failed' }
  }
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const p = url.searchParams.get('path') || ''
  if (!p) return NextResponse.json({ running: false, message: 'path required' }, { status: 400 })
  const s = psGrepApp(p)
  return NextResponse.json(s)
})
