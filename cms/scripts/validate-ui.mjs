#!/usr/bin/env node
// Headless UI validation for the CMS shell and APIs
// - Validates config persistence (preferredMode, recents, openTabs)
// - Creates library entries for docRoot (dir) and first file; exercises serve workflow
// - Uploads sample files with prefix to verify preserved structure; confirms on disk

import { promises as fs } from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:3000'
const TIMEOUT_MS = 2000
const APP_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function timeoutSignal(ms) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, cancel: () => clearTimeout(t) }
}

async function jf(res) { try { return await res.json() } catch { return null } }

async function get(pathname) {
  const t = timeoutSignal(TIMEOUT_MS)
  try {
    const res = await fetch(BASE + pathname, { signal: t.signal })
    return { status: res.status, json: await jf(res) }
  } catch (e) { return { error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'error') } } finally { t.cancel() }
}

async function post(pathname, body, headers = {}) {
  const t = timeoutSignal(TIMEOUT_MS)
  try {
    const res = await fetch(BASE + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body || {}), signal: t.signal })
    return { status: res.status, json: await jf(res) }
  } catch (e) { return { error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'error') } } finally { t.cancel() }
}

async function postForm(pathname, form) {
  const t = timeoutSignal(TIMEOUT_MS * 2)
  try {
    const res = await fetch(BASE + pathname, { method: 'POST', body: form, signal: t.signal })
    return { status: res.status, json: await jf(res) }
  } catch (e) { return { error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'error') } } finally { t.cancel() }
}

async function main() {
  const out = { base: BASE, steps: {} }

  // 1) Fetch tree and pick sample paths
  const tree = await get('/api/tree')
  out.steps.tree = { ok: tree.status === 200 }
  let firstFile = null
  function findFirstFile(node) {
    if (!node) return null
    if (Array.isArray(node.children)) {
      for (const ch of node.children) {
        if (ch.type === 'file') return ch.path
        const deeper = findFirstFile(ch)
        if (deeper) return deeper
      }
    }
    return null
  }
  firstFile = findFirstFile(tree.json)
  const docRoot = tree.json?.docRoot || ''
  out.steps.sample = { ok: Boolean(docRoot), docRoot, firstFile }

  // 2) Config persistence: preferredMode + recentsAdd + tabs
  const cfgSet = await post('/api/config', {
    preferredMode: 'C',
    recentsAdd: firstFile ? { type: 'file', path: path.resolve(process.cwd(), docRoot, firstFile), mode: 'A' } : undefined,
    openTabs: [
      { id: 't1', entryId: null, kind: 'dir', path: path.resolve(process.cwd(), docRoot), label: 'Docs', servedId: null },
    ],
    activeTabId: 't1',
  })
  const cfgNow = await get('/api/config')
  out.steps.config = { ok: cfgSet.status === 200 && cfgNow.status === 200 && cfgNow.json?.preferredMode === 'C' && Array.isArray(cfgNow.json?.openTabs) && cfgNow.json?.activeTabId === 't1' }

  // 3) Library and serve workflow (dir using docRoot)
  let libId = null
  if (docRoot) {
    // Pass docRoot string directly; server resolves relative to its cwd
    const add = await post('/api/library', { path: docRoot })
    if (add.status === 200 && add.json?.id) libId = add.json.id
    const lib = await get('/api/library')
    const found = (lib.json?.entries || []).find(e => e.id === libId)
    out.steps.library = { ok: Boolean(found), id: libId }
    if (libId) {
      const srv = await post('/api/serve', { entryId: libId })
      const sid = srv.json?.id
      const s1 = await get(`/api/serve/${sid}`)
      const servedIndex = await get(`/api/served/${sid}/`)
      out.steps.serve = { ok: srv.status === 200 && s1.json?.status === 'running' && servedIndex.status === 200, id: sid }
    }
  }

  // 3b) Library + serve for first file if available
  if (docRoot && firstFile) {
    const filePath = path.posix.join(docRoot, firstFile)
    const addF = await post('/api/library', { path: filePath })
    let ok = false
    if (addF.status === 200 && addF.json?.id) {
      const srvF = await post('/api/serve', { entryId: addF.json.id })
      const sidF = srvF.json?.id
      const servedFile = await get(`/api/served/${sidF}/`)
      ok = srvF.status === 200 && servedFile.status === 200
    }
    out.steps.serve_file = { ok }
  }

  // 4) Upload with preserved structure
  const tmp1 = new File([new TextEncoder().encode('alpha')], 'a.txt', { type: 'text/plain' })
  const tmp2 = new File([new TextEncoder().encode('beta')], 'b/b.txt', { type: 'text/plain' })
  const form = new FormData()
  form.append('prefix', 'demo/sub')
  form.append('file', tmp1)
  form.append('file', tmp2)
  const up = await postForm('/api/upload', form)
  let uploadedOk = false
  let uploadOpen = false
  let uploadFilesAnnotated = false
  if (up.status === 200 && Array.isArray(up.json?.files)) {
    // verify on disk
    const root = path.resolve(APP_DIR, 'files', 'uploads', String(up.json.uploadedAt))
    const expect1 = path.join(root, 'demo/sub/a.txt')
    const expect2 = path.join(root, 'demo/sub/b/b.txt')
    try { await fs.stat(expect1); await fs.stat(expect2); uploadedOk = true } catch {}
    uploadFilesAnnotated = up.json.files.every((file) => typeof file.absolutePath === 'string' && file.absolutePath.length > 0)
    if (up.json.rootAbsolute) {
      const added = await post('/api/library', { path: up.json.rootAbsolute })
      if (added.status === 200) {
        const libAfter = await get('/api/library')
        if (libAfter.status === 200) {
          const normalizedTarget = path.resolve(up.json.rootAbsolute)
          const match = (libAfter.json?.entries || []).find((e) => path.resolve(e.path) === normalizedTarget)
          uploadOpen = Boolean(match)
        }
      }
    }
  }
  out.steps.upload = { ok: uploadedOk }
  out.steps.upload_annotated = { ok: uploadFilesAnnotated }
  out.steps.upload_open = { ok: uploadOpen }

  console.log(JSON.stringify(out, null, 2))
  if (!Object.values(out.steps).every(s => s && s.ok)) process.exit(1)
}

main().catch((e) => { console.error(JSON.stringify({ error: e?.message || String(e) })); process.exit(1) })
