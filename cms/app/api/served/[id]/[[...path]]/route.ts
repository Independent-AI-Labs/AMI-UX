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

export async function GET(req: Request, context: { params: Promise<{ id: string, path?: string[] }> }) {
  const { id, path: pathParts } = await context.params
  const p = (pathParts || []).join('/')
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
      const raw = await fs.readFile(target)
      let data: Buffer | string = raw
      // If this is an HTML, handle Cocoa-exported entity-encoded snippets similarly to /api/media
      const ext = (target.toLowerCase().split('.').pop() || '')
      if (ext === 'html' || ext === 'htm') {
        let text = ''
        // BOM-aware decode
        if (raw.length >= 2 && raw[0] === 0xFF && raw[1] === 0xFE) {
          text = raw.slice(2).toString('utf16le')
        } else if (raw.length >= 2 && raw[0] === 0xFE && raw[1] === 0xFF) {
          const swapped = Buffer.allocUnsafe(raw.length - 2)
          for (let i = 2; i + 1 < raw.length; i += 2) { swapped[i - 2] = raw[i + 1]; swapped[i - 1] = raw[i] }
          text = swapped.toString('utf16le')
        } else if (raw.length >= 3 && raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) {
          text = raw.slice(3).toString('utf8')
        } else {
          text = raw.toString('utf8')
        }
        // Extract potential entity-encoded body and decode
        const m = text.match(/<body[^>]*>([\s\s\S]*?)<\/body>/i)
        if (m) {
          let inner = m[1]
          inner = inner.replace(/<\/(?:p|span)(?:\s[^>]*)?>/gi, '')
          inner = inner.replace(/<(?:p|span)(?:\s[^>]*)?>/gi, '')
          inner = inner.replace(/<br\s*\/?>(\r?\n)?/gi, '')
          inner = inner.replace(/\u00a0/g, ' ')
          if (/&lt;.*?&gt;/.test(inner)) {
            const decoded = inner
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&amp;/g, '&')
              .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
              .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
            if (/<\s*style[\s>]/i.test(decoded) || /<\s*div[\s>]/i.test(decoded) || /<\s*section[\s>]/i.test(decoded)) {
              const shell = `<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Snippet</title>\n</head>\n<body>\n${decoded}\n</body>\n</html>`
              data = shell
            } else {
              data = text
            }
          } else {
            data = text
          }
        } else {
          data = text
        }
      }
      const headers = new Headers({ 'Content-Type': guessMime(target) })
      csp(headers)
      return new NextResponse(typeof data === 'string' ? data : data as any, { headers })
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
