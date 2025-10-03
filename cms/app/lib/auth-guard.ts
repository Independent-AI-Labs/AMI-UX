import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'

import { auth } from '@ami/auth/server'

export type GuardResult =
  | { session: Session }
  | { session: null; response: NextResponse }

export async function requireSession(): Promise<GuardResult> {
  const session = await auth()
  if (!session || !session.user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { session }
}

export function ensureRole(session: Session, role: string): boolean {
  const user = session.user as any
  return user?.roles?.includes(role) ?? false
}

type RouteHandlerArgs<T> = {
  request: Request
  context: T
  session: Session
}

type RouteFactory<T> = (request: Request, context: T) => Promise<Response>
type WithSessionHandler<T> = (params: RouteHandlerArgs<T>) => Promise<Response>

export function withSession<T = unknown>(handler: WithSessionHandler<T>): RouteFactory<T> {
  return async (request: Request, context: T) => {
    const result = await requireSession()
    if (!result.session) return result.response
    const payload: RouteHandlerArgs<T> = {
      request,
      context,
      session: result.session,
    }
    return handler(payload)
  }
}
