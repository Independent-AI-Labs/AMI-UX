import { NextResponse } from 'next/server'

import { signIn } from '@ami/auth/server'

function toRedirectUrl(base: URL, target: string | null | undefined): URL {
  if (!target) return new URL('/index.html', base)
  if (target === '/') return new URL('/index.html', base)
  try {
    const resolved = new URL(target, base)
    if (resolved.origin !== base.origin) {
      return new URL('/index.html', base)
    }
    return resolved
  } catch {
    return new URL('/index.html', base)
  }
}

function buildFailureRedirect(base: URL, callbackUrl: string | null | undefined, code = 'guest_session_failed'): URL {
  const redirect = new URL('/auth/signin', base)
  redirect.searchParams.set('error', code)
  if (callbackUrl && callbackUrl.trim()) {
    redirect.searchParams.set('callbackUrl', callbackUrl)
  }
  return redirect
}

export async function handleGuestSignIn(request: Request, signInFn: typeof signIn = signIn) {
  const origin = new URL(request.url)
  const formData = await request.formData().catch(() => null)
  const formCallback = formData?.get('callbackUrl')
  const queryCallback = origin.searchParams.get('callbackUrl')
  const callbackUrl = typeof formCallback === 'string' && formCallback.trim() ? formCallback : queryCallback

  try {
    const result = await signInFn('guest', { callbackUrl: callbackUrl || '/index.html', redirect: false })

    if (!result) {
      return NextResponse.redirect(buildFailureRedirect(origin, callbackUrl))
    }

    if (result.error) {
      return NextResponse.redirect(buildFailureRedirect(origin, callbackUrl, 'guest_session_failed'))
    }

    if (result.url) {
      return NextResponse.redirect(toRedirectUrl(origin, result.url))
    }

    return NextResponse.redirect(toRedirectUrl(origin, callbackUrl))
  } catch (err) {
    console.error('[auth/guest] Failed to start guest session', err)
    return NextResponse.redirect(buildFailureRedirect(origin, callbackUrl, 'guest_session_failed'))
  }
}

export async function POST(request: Request) {
  return handleGuestSignIn(request)
}
