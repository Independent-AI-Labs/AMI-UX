'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'

type FormError = {
  kind: 'credentials' | 'guest' | 'system'
  message: string
}

type SignInFormProps = {
  callbackUrl?: string
  prefillEmail?: string
  initialErrorCode?: string | null
}

function mapError(code: string | null): FormError | null {
  if (!code) return null
  const trimmed = code.trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  const dictionary: Record<string, FormError> = {
    credentialssignin: {
      kind: 'credentials',
      message: 'Invalid email or password. Check your credentials and try again.',
    },
    guest_session_failed: {
      kind: 'guest',
      message: 'Unable to start a guest session right now. Please try again in a moment.',
    },
    guest_disabled: {
      kind: 'guest',
      message: 'Guest access is currently disabled. Contact an administrator for access.',
    },
  }
  if (dictionary[key]) return dictionary[key]
  if (trimmed.includes(' ')) {
    return { kind: 'system', message: trimmed }
  }
  return {
    kind: 'system',
    message: 'Something went wrong while signing you in. Please try again.',
  }
}

const preferenceKey = 'ami-auth-preferred'

const LOOPBACK_HOSTS = new Set(['0.0.0.0', '::', '::0', '[::]', '[::0]'])

function normalizeRedirectUrl(raw: string | null | undefined, defaultRedirect: string): string {
  if (typeof window === 'undefined') return defaultRedirect
  const origin = window.location.origin
  const safeRedirect = new URL(defaultRedirect || '/', origin)

  if (!raw) return safeRedirect.toString()

  try {
    const candidate = new URL(raw, origin)
    const targetHost = candidate.hostname.trim()
    const current = new URL(origin)

    if (LOOPBACK_HOSTS.has(targetHost) || targetHost.length === 0) {
      candidate.hostname = current.hostname
    }

    candidate.protocol = current.protocol
    if (!candidate.port && current.port) {
      candidate.port = current.port
    }

    if (candidate.hostname !== current.hostname) {
      return safeRedirect.toString()
    }

    return candidate.toString()
  } catch {
    return safeRedirect.toString()
  }
}

function rememberPreference(value: 'credentials' | 'guest' | null) {
  if (typeof window === 'undefined') return
  if (!value) {
    window.localStorage.removeItem(preferenceKey)
    return
  }
  window.localStorage.setItem(preferenceKey, value)
}

export function SignInForm({ callbackUrl, prefillEmail, initialErrorCode }: SignInFormProps) {
  const [formError, setFormError] = useState<FormError | null>(() => mapError(initialErrorCode ?? null))
  const [credentialsPending, startCredentialsTransition] = useTransition()
  const [guestPending, startGuestTransition] = useTransition()

  useEffect(() => {
    setFormError(mapError(initialErrorCode ?? null))
  }, [initialErrorCode])

  const pending = credentialsPending || guestPending
  const effectiveCallback = useMemo(() => {
    if (!callbackUrl || callbackUrl === '/') return '/index.html'
    return callbackUrl
  }, [callbackUrl])

  const continueAsGuest = useCallback(
    (options?: { remember?: boolean; skipPreferenceUpdate?: boolean }) => {
      setFormError(null)
      startGuestTransition(async () => {
        try {
          const result = await signIn('guest', {
            callbackUrl: effectiveCallback,
            redirect: false,
          })

          if (!result) {
            setFormError({ kind: 'guest', message: 'Unable to reach the authentication service.' })
            if (!options?.skipPreferenceUpdate) rememberPreference(null)
            return
          }

          if (result.error) {
            setFormError(
              mapError(result.error) ?? {
                kind: 'guest',
                message: 'Unable to start a guest session. Please try again.',
              },
            )
            if (!options?.skipPreferenceUpdate) rememberPreference(null)
            return
          }

          if (!options?.skipPreferenceUpdate && options?.remember !== false) {
            rememberPreference('guest')
          }

          if (result.url) {
            const nextUrl = normalizeRedirectUrl(result.url, effectiveCallback)
            window.location.href = nextUrl
            return
          }

          setFormError({ kind: 'guest', message: 'Guest session created but no redirect was provided.' })
        } catch (error) {
          console.error('[ux/auth] Guest sign-in failed', error)
          setFormError({ kind: 'guest', message: 'Guest sign-in failed. Please try again.' })
          if (!options?.skipPreferenceUpdate) rememberPreference(null)
        }
      })
    },
    [effectiveCallback],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(preferenceKey)
    if (stored === 'guest') {
      continueAsGuest({ skipPreferenceUpdate: true })
    }
  }, [continueAsGuest])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const formData = new FormData(form)
      const email = String(formData.get('email') || '').trim()
      const password = String(formData.get('password') || '')
      setFormError(null)

      startCredentialsTransition(async () => {
        const result = await signIn('credentials', {
          email,
          password,
          callbackUrl: effectiveCallback,
          redirect: false,
        })

        if (!result) {
          setFormError({ kind: 'system', message: 'Unexpected response from the authentication service.' })
          return
        }

        if (result.error) {
          setFormError(
            mapError(result.error) ?? {
              kind: 'credentials',
              message: 'Invalid email or password. Check your credentials and try again.',
            },
          )
          return
        }

        rememberPreference('credentials')

        if (result.url) {
          const nextUrl = normalizeRedirectUrl(result.url, effectiveCallback)
          window.location.href = nextUrl
          return
        }

        setFormError({ kind: 'system', message: 'Signed in but no redirect URL was provided.' })
      })
    },
    [effectiveCallback],
  )

  const handleGuestButton = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      continueAsGuest({ remember: true })
    },
    [continueAsGuest],
  )

  return (
    <form className="signin-form" onSubmit={handleSubmit} aria-busy={pending}>
      <input type="hidden" name="callbackUrl" value={effectiveCallback} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={prefillEmail || ''}
          autoFocus
          disabled={pending}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={pending}
        />
      </div>
      {formError ? (
        <p role="alert" className="error" data-error-kind={formError.kind} aria-live="polite">
          {formError.message}
        </p>
      ) : null}
      <div className="signin-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {credentialsPending ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          className="btn btn-secondary"
          type="submit"
          formAction="/auth/signin/guest"
          formMethod="post"
          formNoValidate
          onClick={handleGuestButton}
          disabled={pending}
        >
          {guestPending ? 'Starting guest session…' : 'Continue as Guest'}
        </button>
        <p className="guest-hint muted">We’ll remember your guest preference for next time.</p>
      </div>
    </form>
  )
}
