import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { loadRuntimeConfig } from '../../lib/runtime-config'
import { getTextFormats, isAllowedTextFormat, type TextFormats } from '../../lib/text-formats'

type Node = {
  name: string
  path: string
  type: 'dir' | 'file'
  children?: Node[]
}

const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules'])

async function statSafe(p: string) {
  try { return await fs.stat(p) } catch { return null }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestedRoot = url.searchParams.get('root') || 'docRoot'
  const rootKey = requestedRoot === 'uploads' ? 'uploads' : 'docRoot'
  const cfg = await loadRuntimeConfig()
  const formats = await getTextFormats(cfg.allowed ?? null)
  const cwd = process.cwd()
  const docRootAbs = path.resolve(cwd, cfg.docRoot)
  let rootAbs = docRootAbs
  if (rootKey === 'uploads') {
    rootAbs = path.resolve(cwd, 'files/uploads')
    await fs.mkdir(rootAbs, { recursive: true }).catch(() => {})
  }
  const st = await statSafe(rootAbs)
  if (!st || !st.isDirectory()) {
    return NextResponse.json({ error: 'DOC_ROOT not found', docRoot: cfg.docRoot }, { status: 500 })
  }
  async function readDirTreeWithAllowed(dirAbs: string, rel: string = '', allowlist: TextFormats = formats): Promise<Node[]> {
    const entries = await fs.readdir(dirAbs, { withFileTypes: true })
    const nodes: Node[] = []
    for (const ent of entries) {
      const name = ent.name
      if (name.startsWith('.')) continue
      if (ent.isDirectory() && IGNORED_DIRS.has(name)) continue
      const childRel = path.posix.join(rel, name)
      const childAbs = path.join(dirAbs, name)
      if (ent.isDirectory()) {
        const children = await readDirTreeWithAllowed(childAbs, childRel, allowlist)
        if (children.length > 0) nodes.push({ name, path: childRel, type: 'dir', children })
      } else if (ent.isFile()) {
        if (isAllowedTextFormat(allowlist, childRel)) nodes.push({ name, path: childRel, type: 'file' })
      }
    }
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    return nodes
  }
  const tree = await readDirTreeWithAllowed(rootAbs, '', formats)
  // Root-level: move Introduction/README to the top if present
  try {
    const idx = tree.findIndex((ch: any) => ch.type === 'file' && ['readme.md', 'introduction.md', 'intro.md'].includes(String(ch.name || '').toLowerCase()))
    if (idx > 0) {
      const intro = tree.splice(idx, 1)[0]
      tree.unshift(intro)
    }
  } catch {}
  const payload: Node = { name: path.basename(rootAbs) || path.basename(docRootAbs), path: '', type: 'dir', children: tree }
  const docRootSetting = rootKey === 'uploads' ? path.relative(cwd, rootAbs) || 'files/uploads' : cfg.docRoot
  return NextResponse.json({ ...payload, docRoot: docRootSetting, rootKey, rootAbsolute: rootAbs })
}
