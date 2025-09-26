'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'

export function SignInForm({ callbackUrl, prefillEmail }: { callbackUrl?: string; prefillEmail?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      <button className="btn" type="submit" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
