#!/usr/bin/env node
// Non-blocking health checks with strict timeouts
// Usage: node scripts/health.mjs [baseUrl]

const BASE = process.argv[2] || 'http://127.0.0.1:3000'
const TIMEOUT_MS = 1500

async function timedFetch(path, opts = {}) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(BASE + path, { ...opts, signal: controller.signal })
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? 'timeout' : (e?.message || 'error') }
  } finally { clearTimeout(t) }
}

async function main() {
  const checks = [
    ['index', '/index.html'],
    ['tree', '/api/tree'],
    ['config', '/api/config'],
    ['media_roots', '/api/media/list'],
  ]
  const results = {}
  for (const [name, path] of checks) {
    results[name] = await timedFetch(path, { method: 'GET' })
  }
  // SSE quick probe: open and abort immediately
  const controller = new AbortController()
  const sseTimer = setTimeout(() => controller.abort(), 500)
  try {
    const res = await fetch(BASE + '/api/events', { signal: controller.signal })
    results.sse = { ok: true, status: res.status }
  } catch (e) {
    results.sse = { ok: false, error: (e && e.name === 'AbortError') ? 'timeout' : (e?.message || 'error') }
  } finally { clearTimeout(sseTimer) }
  console.log(JSON.stringify({ base: BASE, results }, null, 2))
}

main().catch((e) => {
  console.error(JSON.stringify({ base: BASE, error: e?.message || String(e) }))
  process.exit(1)
})

