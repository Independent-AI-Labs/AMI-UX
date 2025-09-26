import { createRequire } from 'module'
import { authConfig } from './config'

type AuthExports = {
  auth: (...args: any[]) => any
  handlers: { GET: (...args: any[]) => Promise<Response>; POST: (...args: any[]) => Promise<Response> }
  signIn: (...args: any[]) => Promise<any>
  signOut: (...args: any[]) => Promise<any>
}

function deriveStubUserId(email: string): string {
  const safeEmail = email.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < safeEmail.length; i += 1) {
    hash = (hash * 31 + safeEmail.charCodeAt(i)) >>> 0
  }
  const slug = hash.toString(36).padStart(8, '0')
  return `user-${slug}`
}

function createStubAuth(): AuthExports {
  const guestEmail = (process.env.AMI_GUEST_EMAIL || 'guest@ami.local').toLowerCase()
  const guestName = process.env.AMI_GUEST_NAME || 'Guest AMI Account'
  const guestUserId = deriveStubUserId(guestEmail)
  const stubSession = {
    user: {
      id: guestUserId,
      email: guestEmail,
      name: guestName,
      image: null,
      roles: ['guest'],
      groups: [],
      tenantId: null,
      metadata: {
        accountType: 'guest',
        managedBy: 'stub-auth',
      },
    },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  }

  const csrfToken = 'stub-csrf-token'

  const jsonResponse = (payload: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(payload), {
      status: init.status ?? 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(init.headers || {}),
      },
    })

  const handleGet = async (request: Request) => {
    const url = new URL(request.url)
    const pathname = url.pathname
    if (pathname.endsWith('/session')) {
      return jsonResponse(stubSession)
    }
    if (pathname.endsWith('/csrf')) {
      return jsonResponse({ csrfToken, cookie: csrfToken })
    }
    if (pathname.endsWith('/providers')) {
      return jsonResponse({
        credentials: {
          id: 'credentials',
          name: 'AMI Credentials',
          type: 'credentials',
          signinUrl: '/auth/signin',
          callbackUrl: url.searchParams.get('callbackUrl') || '/',
        },
      })
    }
    if (pathname.includes('/signin')) {
      return jsonResponse({ url: url.searchParams.get('callbackUrl') || '/' })
    }
    if (pathname.endsWith('/signout')) {
      return jsonResponse({ url: url.searchParams.get('callbackUrl') || '/' })
    }
    return jsonResponse({ ok: true })
  }

  const handlePost = async (request: Request) => {
    const url = new URL(request.url)
    const pathname = url.pathname
    if (pathname.endsWith('/signout')) {
      const body = await request.clone().text().catch(() => '')
      const params = new URLSearchParams(body)
      const callbackUrl = params.get('callbackUrl') || url.searchParams.get('callbackUrl') || '/'
      return jsonResponse({ url: callbackUrl })
    }
    if (pathname.includes('/signin')) {
      const body = await request.clone().text().catch(() => '')
      const params = new URLSearchParams(body)
      const callbackUrl = params.get('callbackUrl') || url.searchParams.get('callbackUrl') || '/'
      return jsonResponse({ url: callbackUrl, status: 'stub' })
    }
    return jsonResponse({ ok: true })
  }

  const stubbedAuth = (...args: any[]) => {
    if (args.length === 0) {
      return Promise.resolve(stubSession)
    }

    const [firstArg] = args

    if (typeof firstArg === 'function') {
      const handler = firstArg
      return async (...handlerArgs: any[]) => {
        const [req] = handlerArgs
        if (req && typeof req === 'object') {
          ;(req as any).auth = stubSession
        }
        return handler(...handlerArgs)
      }
    }

    const req = firstArg
    if (req && typeof req === 'object') {
      ;(req as any).auth = stubSession
    }
    return Promise.resolve(stubSession)
  }

  return {
    auth: stubbedAuth,
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
    signIn: async () => ({ ok: true, url: '/' }),
    signOut: async () => ({ ok: true, url: '/' }),
  }
}

let authExports: AuthExports

try {
  const require = createRequire(import.meta.url)
  const mod = require('next-auth')
  const factory = (mod as any).default ?? mod
  authExports = factory(authConfig)
} catch (err) {
  console.warn('[ux/auth] next-auth module unavailable, falling back to stub auth implementation.', err)
  authExports = createStubAuth()
}

export const { auth, handlers, signIn, signOut } = authExports

export const { GET: authGetHandler, POST: authPostHandler } = handlers
