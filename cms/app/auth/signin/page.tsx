import '../styles.css'

import { redirect } from 'next/navigation'
import Link from 'next/link'

import { auth } from '@ami/auth/server'

import { SignInForm } from './SignInForm'

export default async function SignInPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const session = await auth()
  const callback = typeof searchParams?.callbackUrl === 'string' ? searchParams?.callbackUrl : '/'
  const prefill = typeof searchParams?.prefill === 'string' ? searchParams.prefill : null
  if (session?.user) {
    redirect(callback || '/')
  }

  const errorParam = typeof searchParams?.error === 'string' ? searchParams.error : null

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
