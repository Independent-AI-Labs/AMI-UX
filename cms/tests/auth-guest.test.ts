import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { handleGuestSignIn } from '../app/auth/signin/guest/route'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
function createRequest(pathname: string, init?: RequestInit): Request {
  const options: RequestInit = { method: 'POST', ...init }
  if (options.body instanceof URLSearchParams) {
    options.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.headers || {}),
    }
  }
  return new Request(`http://localhost${pathname}`, options)
}

test('guest route redirects to provider result URL on success', async () => {
  const res = await handleGuestSignIn(createRequest('/auth/signin/guest'), async () => ({ url: '/workspace', error: undefined }))
  assert.ok(res.status >= 300 && res.status < 400)
  assert.equal(res.headers.get('location'), 'http://localhost/workspace')
})

test('guest route falls back to callbackUrl when provider omits redirect', async () => {
  const res = await handleGuestSignIn(
    createRequest('/auth/signin/guest', {
      body: new URLSearchParams({ callbackUrl: '/docs' }),
    }),
    async () => ({ url: null, error: undefined }),
  )

  assert.ok(res.status >= 300 && res.status < 400)
  assert.equal(res.headers.get('location'), 'http://localhost/docs')
})

test('guest route redirects back to sign-in when provider reports an error', async () => {
  const res = await handleGuestSignIn(
    createRequest('/auth/signin/guest?callbackUrl=%2Freturn'),
    async () => ({ url: null, error: 'guest_session_failed' }),
  )

  assert.ok(res.status >= 300 && res.status < 400)
  const location = res.headers.get('location')
  assert.ok(location?.startsWith('http://localhost/auth/signin'))
  assert.ok(location?.includes('error=guest_session_failed'))
  assert.ok(location?.includes('callbackUrl=%2Freturn'))
})

test('guest route handles provider exceptions gracefully', async () => {
  const res = await handleGuestSignIn(
    createRequest('/auth/signin/guest?callbackUrl=%2Fhome'),
    async () => {
      throw new Error('boom')
    },
  )
  assert.ok(res.status >= 300 && res.status < 400)
  const location = res.headers.get('location')
  assert.ok(location?.includes('error=guest_session_failed'))
  assert.ok(location?.includes('callbackUrl=%2Fhome'))
})

test('sign-in form source retains guest CTA action and copy', async () => {
  const sourcePath = path.resolve(__dirname, '../app/auth/signin/SignInForm.tsx')
  const contents = await readFile(sourcePath, 'utf8')
  assert.match(contents, /Continue as Guest/)
  assert.ok(contents.includes('formAction="/auth/signin/guest"'))
})
