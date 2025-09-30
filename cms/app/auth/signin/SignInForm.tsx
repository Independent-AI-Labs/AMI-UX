'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'

export function SignInForm({ callbackUrl, prefillEmail }: { callbackUrl?: string; prefillEmail?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isGuestPending, setGuestPending] = useState(false)

  const preferenceKey = 'ami-auth-preferred'

  const continueAsGuest = useCallback(
    (options?: { remember?: boolean; skipPreferenceUpdate?: boolean }) => {
      if (typeof window === 'undefined') return
      setError(null)
      setGuestPending(true)
      startTransition(async () => {
        try {
          const result = await signIn('guest', {
            callbackUrl: callbackUrl || '/',
            redirect: false,
          })
          setGuestPending(false)
          if (!result) {
            setError('Unable to reach the authentication service')
            if (!options?.skipPreferenceUpdate) window.localStorage.removeItem(preferenceKey)
            return
          }
          if (result.error) {
            setError(result.error)
            if (!options?.skipPreferenceUpdate) window.localStorage.removeItem(preferenceKey)
            return
          }
          if (!options?.skipPreferenceUpdate && options?.remember !== false) {
            window.localStorage.setItem(preferenceKey, 'guest')
          }
          if (result.url) {
            window.location.href = result.url
          }
        } catch (guestErr) {
          console.error('[ux/auth] Guest sign-in failed', guestErr)
          setError('Guest sign-in failed. Please try again.')
          if (!options?.skipPreferenceUpdate) window.localStorage.removeItem(preferenceKey)
          setGuestPending(false)
        }
      })
    },
    [callbackUrl, preferenceKey, startTransition],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(preferenceKey)
    if (stored === 'guest') {
      continueAsGuest({ skipPreferenceUpdate: true })
    }
  }, [continueAsGuest, preferenceKey])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    setError(null)

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: callbackUrl || '/',
        redirect: false,
      })
      if (!result) {
        setError('Unknown response from server')
        return
      }
      if (result.error) {
        setError(result.error)
        return
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(preferenceKey, 'credentials')
      }
      if (result.url) {
        window.location.href = result.url
      }
    })
  }

  return (
    <form className="signin-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
          defaultValue={prefillEmail || ''}
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <div className="signin-actions">
        <button className="btn" type="submit" disabled={isPending || isGuestPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="btn btn--ghost guest-btn"
          disabled={isPending || isGuestPending}
          onClick={() => continueAsGuest({ remember: true })}
        >
          {isGuestPending ? 'Continuing…' : 'Continue as guest'}
        </button>
        <p className="guest-hint muted">We’ll remember your guest preference for next time.</p>
      </div>
    </form>
  )
}
