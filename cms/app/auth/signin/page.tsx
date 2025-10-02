import '../styles.css'

import { redirect } from 'next/navigation'
import Link from 'next/link'

import { auth } from '@ami/auth/server'

import { SignInForm } from './SignInForm'

export default async function SignInPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> }) {
  let session = null
  try {
    session = await auth()
  } catch (err) {
    console.warn('[signin] Failed to read session, clearing cookies', err)
  }
  const params = await Promise.resolve(searchParams)
  const rawCallback = typeof params?.callbackUrl === 'string' ? params?.callbackUrl : '/index.html'
  const callback = rawCallback === '/' ? '/index.html' : rawCallback
  const prefill = typeof params?.prefill === 'string' ? params.prefill : null
  if (session?.user) {
    redirect(callback || '/')
  }

  const errorParam = typeof params?.error === 'string' ? params.error : null

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <header>
          <h1>Welcome back!</h1>
          <p className="muted">Sign in to continue to the AMI Data Portal.</p>
        </header>
        <SignInForm callbackUrl={callback} prefillEmail={prefill ?? undefined} initialErrorCode={errorParam} />
        <footer>
          <p className="muted">
            Need access? <Link href="mailto:security@ami" prefetch={false}>Contact security</Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
