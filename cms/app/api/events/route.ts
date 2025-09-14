import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial hello event
      try { controller.enqueue(encoder.encode(`: connected\n\n`)) } catch {}
      const interval = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ping\n` + `data: ${Date.now()}\n\n`))
        } catch {
          // If enqueue throws, close the stream and stop
          try { controller.close() } catch {}
          closed = true
          clearInterval(interval)
        }
      }, 10000)

      const abort = () => {
        if (closed) return
        closed = true
        clearInterval(interval)
        try { controller.close() } catch {}
      }

      // Best-effort: close on process exit
      try {
        // @ts-ignore
        const signal: AbortSignal | undefined = (globalThis as any).request?.signal || undefined
        if (signal) signal.addEventListener('abort', abort, { once: true })
      } catch {}
    },
    cancel() {
      closed = true
    },
  })

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

