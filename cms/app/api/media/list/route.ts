import { NextResponse } from 'next/server'
import { collectMediaRoots } from '../../../lib/media-roots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const roots = await collectMediaRoots()
  const payload = roots.map((root) => ({
    key: root.key,
    label: root.label,
    path: root.path,
    writable: root.writable,
  }))
  return NextResponse.json({ roots: payload })
}
