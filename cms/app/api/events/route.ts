import { NextResponse } from 'next/server'

import { withSession } from '../../lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withSession(async () => {
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial hello event
      try {
        controller.enqueue(encoder.encode(`: connected\n\n`))
      } catch (err) {
        console.error('[events] Failed to enqueue initial hello event:', err instanceof Error ? err.message : String(err))
      }
      const interval = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ping\n` + `data: ${Date.now()}\n\n`))
        } catch (err) {
          // If enqueue throws, close the stream and stop
          console.warn('[events] Failed to enqueue ping event, closing stream:', err instanceof Error ? err.message : String(err))
          try {
            controller.close()
          } catch (closeErr) {
            console.error('[events] Failed to close controller after enqueue error:', closeErr instanceof Error ? closeErr.message : String(closeErr))
          }
          closed = true
          clearInterval(interval)
        }
      }, 10000)

      const abort = () => {
        if (closed) return
        closed = true
        clearInterval(interval)
        try {
          controller.close()
        } catch (err) {
          console.warn('[events] Failed to close controller on abort:', err instanceof Error ? err.message : String(err))
        }
      }

      // Best-effort: close on process exit
      try {
        // Access experimental abort signal if available (Next.js runtime-specific)
        const signal: AbortSignal | undefined = (globalThis as unknown as { request?: { signal?: AbortSignal } }).request?.signal
        if (signal) signal.addEventListener('abort', abort, { once: true })
      } catch (err) {
        console.warn('[events] Failed to setup abort signal listener:', err instanceof Error ? err.message : String(err))
      }
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
})
