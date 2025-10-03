import '../styles.css'

import Link from 'next/link'

export default async function AuthErrorPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const params = await searchParams
  const message = typeof params?.message === 'string' ? params.message : 'Unable to complete authentication.'

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <header>
          <h1>Authentication error</h1>
          <p className="muted">{message}</p>
        </header>
        <Link className="btn" href="/auth/signin">
          Back to sign-in
        </Link>
      </div>
    </div>
  )
}
