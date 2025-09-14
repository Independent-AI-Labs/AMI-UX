import { NextResponse } from 'next/server'
import { listServed, listLibrary } from '../../../../lib/store'
import path from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csp(headers: Headers) {
  headers.set('X-Frame-Options', 'SAMEORIGIN')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')
}

async function proxyToPort(port: number, subpath: string, req: Request) {
  const url = new URL(req.url)
  const qs = url.search
  const upstream = `http://127.0.0.1:${port}/${subpath}${qs}`
  const r = await fetch(upstream, { method: req.method, headers: req.headers as any, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.blob().catch(() => undefined) })
  const headers = new Headers(r.headers)
  csp(headers)
  return new NextResponse(r.body, { status: r.status, headers })
}

function guessMime(p: string) {
  const ext = p.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'html': return 'text/html; charset=utf-8'
    case 'css': return 'text/css; charset=utf-8'
    case 'js': return 'text/javascript; charset=utf-8'
    case 'json': return 'application/json; charset=utf-8'
    case 'svg': return 'image/svg+xml'
    case 'png': return 'image/png'
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'txt': case 'md': return 'text/plain; charset=utf-8'
    default: return 'application/octet-stream'
  }
}

export async function GET(req: Request, { params }: { params: { id: string, path?: string[] } }) {
  const id = params.id
  const p = (params.path || []).join('/')
  const served = await listServed()
  const inst = served.find((s) => s.id === id)
  if (!inst) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const entries = await listLibrary()
  const entry = entries.find((e) => e.id === inst.entryId)
  if (!entry) return NextResponse.json({ error: 'entry missing' }, { status: 404 })

  if (inst.kind === 'app' && inst.port) {
    return proxyToPort(inst.port, p, req)
  }

  if (inst.kind === 'file') {
    const base = path.dirname(entry.path)
    const target = p ? path.resolve(base, p) : entry.path
    if (!target.startsWith(base)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    try {
      const data = await fs.readFile(target)
      const headers = new Headers({ 'Content-Type': guessMime(target) })
      csp(headers)
      return new NextResponse(data, { headers })
    } catch { return NextResponse.json({ error: 'not found' }, { status: 404 }) }
  }
  if (inst.kind === 'dir') {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Docs</title></head><body style="margin:0; height:100vh; background:#111;"><iframe id="d" src="/doc.html?embed=1" style="border:0;width:100%;height:100%"></iframe><script>window.addEventListener('load',function(){try{document.getElementById('d').contentWindow.postMessage({type:'setDocRoot',path:${JSON.stringify(entry.path)}},'*')}catch(e){}})</script></body></html>`
    const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' })
    csp(headers)
    return new NextResponse(html, { headers })
  }
  return NextResponse.json({ error: 'unsupported' }, { status: 400 })
}

