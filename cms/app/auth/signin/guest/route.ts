import { NextResponse } from 'next/server'

import { signIn } from '@ami/auth/server'

import { buildAbsoluteUrl, resolveRequestOrigin } from '../../../lib/request-origin'

function serialiseRelative(base: URL, target: URL): string {
  if (target.origin === base.origin) {
    const suffix = `${target.pathname}${target.search}${target.hash}`
    return suffix || '/index.html'
  }
  return '/index.html'
}

function toRedirectUrl(base: URL, target: string | null | undefined): URL {
  if (!target || target === '/') return new URL('/index.html', base)
  try {
    const resolved = buildAbsoluteUrl(base, target)
    if (resolved.origin !== base.origin) {
      return new URL('/index.html', base)
    }
    return resolved
  } catch {
    return new URL('/index.html', base)
  }
}

function buildFailureRedirect(base: URL, callback: URL, code = 'guest_session_failed'): URL {
  const redirect = new URL('/auth/signin', base)
  redirect.searchParams.set('error', code)
  const callbackValue = serialiseRelative(base, callback)
  if (callbackValue) {
    redirect.searchParams.set('callbackUrl', callbackValue)
  }
  return redirect
}

export async function handleGuestSignIn(request: Request, signInFn: typeof signIn = signIn) {
  const requestUrl = new URL(request.url)
  const origin = resolveRequestOrigin(request)
  const formData = await request.formData().catch(() => null)
  const formCallback = formData?.get('callbackUrl')
  const queryCallback = requestUrl.searchParams.get('callbackUrl')
  const callbackCandidate =
    typeof formCallback === 'string' && formCallback.trim() ? formCallback : queryCallback
  const safeCallback = toRedirectUrl(origin, callbackCandidate)

  try {
    const result = await signInFn('guest', {
      callbackUrl: safeCallback.toString(),
      redirect: false,
    })

    if (!result) {
      return NextResponse.redirect(buildFailureRedirect(origin, safeCallback))
    }

    if (result.error) {
      return NextResponse.redirect(buildFailureRedirect(origin, safeCallback, 'guest_session_failed'))
    }

    if (result.url) {
      return NextResponse.redirect(toRedirectUrl(origin, result.url))
    }

    return NextResponse.redirect(safeCallback)
  } catch (err) {
    console.error('[auth/guest] Failed to start guest session', err)
    return NextResponse.redirect(buildFailureRedirect(origin, safeCallback, 'guest_session_failed'))
  }
}

export async function POST(request: Request) {
  return handleGuestSignIn(request)
}
