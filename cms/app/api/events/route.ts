import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import chokidar from 'chokidar'

type Config = { docRoot: string, allowed?: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadConfig(): Promise<Config> {
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

export async function GET() {
  const cfg = await loadConfig()
  const allowed = (cfg.allowed || '.md,.csv,.txt').split(',').map(s => s.trim().toLowerCase())
  const docRootAbs = path.resolve(process.cwd(), cfg.docRoot)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const send = (event: any) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Stream already closed; mark closed to stop future sends
          closed = true
        }
      }

      // initial hello
      send({ type: 'hello', docRoot: cfg.docRoot })

      // watch content
      const watcher = chokidar.watch(docRootAbs, {
        ignoreInitial: true,
        ignored: [/(^|\/)\./, '**/node_modules/**', '**/.git/**', '**/.next/**'],
        persistent: true,
      })

      const onFs = (type: string) => (p: string) => {
        const ext = path.extname(p).toLowerCase()
        const isDir = type === 'addDir' || type === 'unlinkDir'
        if (isDir || allowed.includes(ext)) {
          const rel = path.relative(docRootAbs, p)
          send({ type, path: rel, isDir })
        }
      }

      watcher
        .on('add', onFs('add'))
        .on('change', onFs('change'))
        .on('unlink', onFs('unlink'))
        .on('addDir', onFs('addDir'))
        .on('unlinkDir', onFs('unlinkDir'))

      // watch config as well
      const configPath = path.resolve(process.cwd(), 'data/config.json')
      const configWatcher = chokidar.watch(configPath, { ignoreInitial: true, persistent: true })
      configWatcher.on('change', () => send({ type: 'config' }))

      const keepalive = setInterval(() => { send({ type: 'ping' }) }, 25000)

      // cleanup when stream is closed
      const close = async () => {
        if (closed) return
        closed = true
        clearInterval(keepalive)
        try { await watcher.close() } catch {}
        try { await configWatcher.close() } catch {}
        try { controller.close() } catch {}
      }

      // Since we don't have direct access to the request, rely on garbage collection; keep it safe
      // Provide a timeout safety valve to prevent orphaned watchers
      const ttl = setTimeout(close, 1000 * 60 * 60) // 1 hour
      // On stream cancel, cleanup
      // @ts-ignore
      controller.signal?.addEventListener?.('abort', close)
    }
  })

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
