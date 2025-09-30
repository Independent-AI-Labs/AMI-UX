import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import type { Dirent } from 'fs'
import path from 'path'
import { loadRuntimeConfig } from '../../lib/runtime-config'
import { getTextFormats, isAllowedTextFormat, type TextFormats } from '../../lib/text-formats'
import { resolveMediaRoot } from '../../lib/media-roots'
import { withSession } from '../../lib/auth-guard'

type TreeNode = {
  name: string
  path: string
  type: 'dir' | 'file'
  children?: TreeNode[]
}

type NodeSummary = {
  name: string
  path: string
  type: 'dir' | 'file'
  hasChildren: boolean
  childCount?: number
}

const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules'])
const INTRO_FILENAMES = ['readme.md', 'readme.mdx', 'introduction.md', 'intro.md']

async function statSafe(p: string) {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

async function opendirSafe(p: string) {
  try {
    return await fs.opendir(p)
  } catch {
    return null
  }
}

function isAllowedEntry(
  dirent: Dirent,
  name: string,
  allowlist: TextFormats | null,
  relPath: string,
  includeEmpty: boolean,
) {
  if (name.startsWith('.')) return false
  if (dirent.isDirectory() && IGNORED_DIRS.has(name)) return false
  if (dirent.isDirectory() && name.endsWith('.meta')) return false
  if (dirent.isDirectory()) return true
  if (!dirent.isFile()) return false
  if (!allowlist) return true
  return isAllowedTextFormat(allowlist, relPath)
}

async function hasVisibleChildren(
  absPath: string,
  allowlist: TextFormats | null,
  includeEmpty: boolean,
  relBase: string,
): Promise<{ hasChildren: boolean; childCount: number }> {
  const dir = await opendirSafe(absPath)
  if (!dir) return { hasChildren: false, childCount: 0 }
  let count = 0
  for await (const dirent of dir) {
    const name = dirent.name
    const rel = relBase ? path.posix.join(relBase, name) : name
    if (!isAllowedEntry(dirent, name, allowlist, rel, includeEmpty)) continue
    if (dirent.isDirectory()) {
      if (includeEmpty) {
        count += 1
        if (count > 0) break
        continue
      }
      const childCheck = await hasVisibleChildren(
        path.join(absPath, name),
        allowlist,
        includeEmpty,
        rel,
      )
      if (childCheck.hasChildren) {
        count += 1
        break
      }
      continue
    }
    count += 1
    if (count > 0) break
  }
  return { hasChildren: count > 0, childCount: count }
}

async function listDirectoryEntries(
  rootAbs: string,
  targetAbs: string,
  baseRel: string,
  allowlist: TextFormats | null,
  includeEmpty: boolean,
): Promise<NodeSummary[]> {
  let entries: Dirent[] = []
  try {
    entries = await fs.readdir(targetAbs, { withFileTypes: true })
  } catch {
    return []
  }
  const summaries: NodeSummary[] = []
  for (const entry of entries) {
    const name = entry.name
    if (name.startsWith('.')) continue
    if (entry.isDirectory() && IGNORED_DIRS.has(name)) continue
    if (entry.isDirectory() && name.endsWith('.meta')) continue
    const childRel = baseRel ? path.posix.join(baseRel, name) : name
    const childAbs = path.join(rootAbs, childRel)
    if (entry.isDirectory()) {
      const { hasChildren, childCount } = await hasVisibleChildren(
        childAbs,
        allowlist,
        includeEmpty,
        childRel,
      )
      if (!hasChildren && !includeEmpty) continue
      summaries.push({
        name,
        path: childRel,
        type: 'dir',
        hasChildren,
        childCount: hasChildren ? childCount : 0,
      })
    } else if (entry.isFile()) {
      if (allowlist && !isAllowedTextFormat(allowlist, childRel)) continue
      summaries.push({ name, path: childRel, type: 'file', hasChildren: false, childCount: 0 })
    }
  }
  summaries.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
  )

  const introIndex = summaries.findIndex((node) => {
    return node.type === 'file' && INTRO_FILENAMES.includes(node.name.toLowerCase())
  })
  if (introIndex > 0) {
    const [introNode] = summaries.splice(introIndex, 1)
    summaries.unshift(introNode)
  }
  return summaries
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const requestedRoot = url.searchParams.get('root') || 'docRoot'
  const rootInfo = await resolveMediaRoot(requestedRoot)

  if (!rootInfo) {
    return NextResponse.json({ error: 'Unknown root' }, { status: 404 })
  }

  const cfg = await loadRuntimeConfig()
  const formats = await getTextFormats(cfg.allowed ?? null)
  const rootAbs = rootInfo.path
  const st = await statSafe(rootAbs)
  if (!st || !st.isDirectory()) {
    return NextResponse.json({ error: 'Root not found', root: rootInfo.key }, { status: 404 })
  }

  const isDocRoot = rootInfo.key === 'docRoot'

  const allowlist = isDocRoot ? formats : null
  const includeEmpty = !isDocRoot
  const mode = url.searchParams.get('mode') || 'full'
  const requestedPath = url.searchParams.get('path') || ''
  const normalizedRel = path.posix
    .normalize(requestedPath.replace(/\\/g, '/'))
    .replace(/^\.\//, '')
  const safeRel = normalizedRel === '.' ? '' : normalizedRel
  const targetAbs = path.join(rootAbs, safeRel)
  const resolved = await statSafe(targetAbs)
  if (!resolved || (!resolved.isDirectory() && !resolved.isFile())) {
    return NextResponse.json({ error: 'Path not found', path: safeRel }, { status: 404 })
  }

  const docRootSetting = isDocRoot ? cfg.docRoot : undefined

  if (mode === 'children') {
    let children: NodeSummary[] = []
    if (resolved.isDirectory()) {
      children = await listDirectoryEntries(rootAbs, targetAbs, safeRel, allowlist, includeEmpty)
    }
    return NextResponse.json({
      rootKey: rootInfo.key,
      rootLabel: rootInfo.label,
      rootAbsolute: rootAbs,
      docRoot: docRootSetting,
      node: {
        name: safeRel ? path.posix.basename(safeRel) : path.basename(rootAbs) || rootInfo.label,
        path: safeRel,
        type: resolved.isDirectory() ? 'dir' : 'file',
        hasChildren: resolved.isDirectory() ? children.length > 0 : false,
        childCount: resolved.isDirectory() ? children.length : 0,
      },
      parentPath: safeRel ? path.posix.dirname(safeRel) : '',
      children,
    })
  }

  async function readDirTreeWithAllowed(
    dirAbs: string,
    rel: string = '',
    allowlist: TextFormats | null = formats,
    includeEmpty = false,
  ): Promise<TreeNode[]> {
    const summaries = await listDirectoryEntries(rootAbs, dirAbs, rel, allowlist, includeEmpty)
    const nodes: TreeNode[] = []
    for (const summary of summaries) {
      if (summary.type === 'dir') {
        const childAbs = path.join(rootAbs, summary.path)
        const children = await readDirTreeWithAllowed(
          childAbs,
          summary.path,
          allowlist,
          includeEmpty,
        )
        nodes.push({ name: summary.name, path: summary.path, type: 'dir', children })
      } else {
        nodes.push({ name: summary.name, path: summary.path, type: 'file' })
      }
    }
    return nodes
  }

  const tree = await readDirTreeWithAllowed(targetAbs, safeRel, allowlist, includeEmpty)
  const payload: TreeNode = {
    name: safeRel ? path.posix.basename(safeRel) : path.basename(rootAbs) || rootInfo.label,
    path: safeRel,
    type: resolved.isDirectory() ? 'dir' : 'file',
    children: tree,
  }

  return NextResponse.json({
    ...payload,
    docRoot: docRootSetting,
    rootKey: rootInfo.key,
    rootAbsolute: rootAbs,
    rootLabel: rootInfo.label,
  })
})
