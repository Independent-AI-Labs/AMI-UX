import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

type Config = { docRoot: string, allowed?: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadConfig(): Promise<Config> {
  // Attempt to load runtime config from data/config.json; fallback to env
  const dataPath = path.resolve(process.cwd(), 'data/config.json')
  try {
    const raw = await fs.readFile(dataPath, 'utf8')
    const cfg = JSON.parse(raw)
    return {
      docRoot: cfg.docRoot || process.env.DOC_ROOT || '../../../AMI-REACH/social',
      allowed: cfg.allowed || process.env.ALLOWED_EXTENSIONS || '.md,.csv,.txt'
    }
  } catch {
    return {
      docRoot: process.env.DOC_ROOT || '../../../AMI-REACH/social',
      allowed: process.env.ALLOWED_EXTENSIONS || '.md,.csv,.txt'
    }
  }
}

type Node = {
  name: string
  path: string
  type: 'dir' | 'file'
  children?: Node[]
}

async function getAllowed(): Promise<string[]> {
  const cfg = await loadConfig()
  return (cfg.allowed || '.md,.csv,.txt').split(',').map(s => s.trim().toLowerCase())
}

const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules'])

async function statSafe(p: string) {
  try { return await fs.stat(p) } catch { return null }
}

async function readDirTree(dirAbs: string, rel: string = ''): Promise<Node[]> {
  const entries = await fs.readdir(dirAbs, { withFileTypes: true })
  const nodes: Node[] = []

  for (const ent of entries) {
    const name = ent.name
    if (name.startsWith('.')) continue
    if (ent.isDirectory() && IGNORED_DIRS.has(name)) continue

    const childRel = path.posix.join(rel, name)
    const childAbs = path.join(dirAbs, name)

    if (ent.isDirectory()) {
      const children = await readDirTree(childAbs, childRel)
      if (children.length > 0) {
        nodes.push({ name, path: childRel, type: 'dir', children })
      }
    } else if (ent.isFile()) {
      const ext = path.extname(name).toLowerCase()
      if (ALLOWED.includes(ext)) {
        nodes.push({ name, path: childRel, type: 'file' })
      }
    }
  }

  // sort: dirs first, then files; alpha
  nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
  return nodes
}

export async function GET() {
  const cfg = await loadConfig()
  const ALLOWED = await getAllowed()
  const rootAbs = path.resolve(process.cwd(), cfg.docRoot)
  const st = await statSafe(rootAbs)
  if (!st || !st.isDirectory()) {
    return NextResponse.json({ error: 'DOC_ROOT not found', docRoot: cfg.docRoot }, { status: 500 })
  }
  async function readDirTreeWithAllowed(dirAbs: string, rel: string = ''): Promise<Node[]> {
    const entries = await fs.readdir(dirAbs, { withFileTypes: true })
    const nodes: Node[] = []
    const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules'])
    for (const ent of entries) {
      const name = ent.name
      if (name.startsWith('.')) continue
      if (ent.isDirectory() && IGNORED_DIRS.has(name)) continue
      const childRel = path.posix.join(rel, name)
      const childAbs = path.join(dirAbs, name)
      if (ent.isDirectory()) {
        const children = await readDirTreeWithAllowed(childAbs, childRel)
        if (children.length > 0) nodes.push({ name, path: childRel, type: 'dir', children })
      } else if (ent.isFile()) {
        const ext = path.extname(name).toLowerCase()
        if (ALLOWED.includes(ext)) nodes.push({ name, path: childRel, type: 'file' })
      }
    }
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    return nodes
  }
  const tree = await readDirTreeWithAllowed(rootAbs)
  // Root-level: move Introduction/README to the top if present
  try {
    const idx = tree.findIndex((ch: any) => ch.type === 'file' && ['readme.md', 'introduction.md', 'intro.md'].includes(String(ch.name || '').toLowerCase()))
    if (idx > 0) {
      const intro = tree.splice(idx, 1)[0]
      tree.unshift(intro)
    }
  } catch {}
  const payload: Node = { name: path.basename(rootAbs), path: '', type: 'dir', children: tree }
  return NextResponse.json({ ...payload, docRoot: cfg.docRoot })
}
