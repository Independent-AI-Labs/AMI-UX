import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

import { withSession } from '../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Cfg = { docRoot: string }

async function loadCfg(): Promise<Cfg> {
  const p = path.resolve(process.cwd(), 'data/config.json')
  try {
    const raw = await fs.readFile(p, 'utf8')
    const cfg = JSON.parse(raw)
    return { docRoot: cfg.docRoot || process.env.DOC_ROOT || 'docs' }
  } catch {
    return { docRoot: process.env.DOC_ROOT || 'docs' }
  }
}

function withinRoot(rootAbs: string, targetAbs: string) {
  const rel = path.relative(rootAbs, targetAbs)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
}

const ALLOWED = new Set(Object.keys(MIME))

function buildCspHeader({ allowInlineScript = false }: { allowInlineScript?: boolean }) {
  const scriptSrc = allowInlineScript ? "'self' 'unsafe-inline'" : "'self'"
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "img-src 'self' data:",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export const GET = withSession(async ({ request }) => {
  const url = new URL(request.url)
  const rel = url.searchParams.get('path') || ''
  const rootParam = url.searchParams.get('root') || 'docRoot'
  const mode = url.searchParams.get('mode') || ''
  if (!rel) return new NextResponse('Missing path', { status: 400 })

  const { docRoot } = await loadCfg()
  const cwd = process.cwd()
  const roots: Record<string, string> = {
    docRoot: path.resolve(cwd, docRoot),
    uploads: path.resolve(cwd, 'files/uploads'),
  }
  const rootAbs = roots[rootParam] || roots.docRoot
  const targetAbs = path.resolve(rootAbs, rel)
  if (!withinRoot(rootAbs, targetAbs)) return new NextResponse('Forbidden', { status: 403 })

  const ext = path.extname(targetAbs).toLowerCase()
  if (!ALLOWED.has(ext)) return new NextResponse('Unsupported type', { status: 415 })

  try {
    const st = await fs.stat(targetAbs)
    const etag = `W/"${st.size}-${Number(st.mtimeMs).toString(16)}"`
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      const h304 = new Headers({
        ETag: etag,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      })
      return new NextResponse(null, { status: 304, headers: h304 })
    }

    // Read raw file; if HTML, decode string respecting BOM
    const raw = await fs.readFile(targetAbs)
    let body: string | Buffer = raw
    let type = MIME[ext] || 'application/octet-stream'

    if (ext === '.html' || ext === '.htm') {
      let text = ''
      if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
        // UTF-16 LE
        text = raw.slice(2).toString('utf16le')
      } else if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
        // UTF-16 BE -> swap and decode
        const swapped = Buffer.allocUnsafe(raw.length - 2)
        for (let i = 2; i + 1 < raw.length; i += 2) {
          swapped[i - 2] = raw[i + 1]
          swapped[i - 1] = raw[i]
        }
        text = swapped.toString('utf16le')
      } else if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
        // UTF-8 BOM
        text = raw.slice(3).toString('utf8')
      } else {
        text = raw.toString('utf8')
      }

      // Heuristic for Cocoa-exported HTML: body contains entity-encoded snippet
      function extractEncodedBodyText(src: string): string {
        const m = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
        if (!m) return ''
        let inner = m[1]
        inner = inner.replace(/<\/(?:p|span)(?:\s[^>]*)?>/gi, '')
        inner = inner.replace(/<(?:p|span)(?:\s[^>]*)?>/gi, '')
        inner = inner.replace(/<br\s*\/?>(\r?\n)?/gi, '')
        inner = inner.replace(/\u00a0/g, ' ')
        return inner
      }
      function decodeEntities(s: string): string {
        return s
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      }
      const encoded = extractEncodedBodyText(text)
      const looksEncoded = /&lt;.*?&gt;/.test(encoded)
      let transformed = ''
      if (looksEncoded) {
        const decoded = decodeEntities(encoded)
        // Only accept if decoding yields real tags
        if (
          /<\s*style[\s>]/i.test(decoded) ||
          /<\s*div[\s>]/i.test(decoded) ||
          /<\s*section[\s>]/i.test(decoded)
        ) {
          transformed = decoded
        }
      }

      if (transformed) {
        // Build minimal document shell to host decoded snippet
        const doc = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Snippet</title>\n</head>\n<body>\n${transformed}\n</body>\n</html>`
        body = doc
      } else {
        // Inject <base> to fix relative asset resolution
        const baseDir = rel.split('/').slice(0, -1).join('/')
        const baseHref = `/api/media/asset/${rootParam}/${baseDir ? baseDir + '/' : ''}`
        if (!/<base\b/i.test(text)) {
          text = text.replace(/<head(\b[^>]*)?>/i, (m) => `${m}\n  <base href=\"${baseHref}\">`)
        }
        body = text
      }

      type = MIME['.html']
    } else {
      // non-HTML: return raw buffer
      body = raw
    }

    const allowInline = mode === 'A'
    const headers = new Headers({
      'Content-Type': type,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Security-Policy': buildCspHeader({ allowInlineScript: allowInline }),
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
    })
    return new NextResponse(body as any, { status: 200, headers })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
})
