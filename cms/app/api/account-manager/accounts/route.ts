import { NextResponse } from 'next/server'

import { auth } from '@ami/auth/server'
import { dataOpsClient } from '@ami/auth/dataops-client'
import type { AuthenticatedUser } from '@ami/auth/types'

import { withSession } from '../../../lib/auth-guard'
import {
  addAccount,
  getAccountSnapshot,
} from '../../../lib/store'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function resolveUserByEmail(email: string): Promise<AuthenticatedUser> {
  try {
    const existing = await dataOpsClient.getUserByEmail(email)
    if (!existing) {
      console.warn('[account-manager] User not found in DataOps or local store', { email })
      throw new Error('USER_NOT_FOUND')
    }
    return existing
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      throw err
    }
    console.error('[account-manager] SECURITY: dataOpsClient.getUserByEmail service failure', { email, error: err })
    throw new Error('USER_SERVICE_UNAVAILABLE')
  }
}

export const GET = async () => {
  const session = await auth()
  const snapshot = await getAccountSnapshot()
  if (session?.user) return NextResponse.json(snapshot)

  const sanitized = {
    ...snapshot,
    accounts: snapshot.accounts.map((account) => ({
      ...account,
      user: {
        email: account.user.email,
        name: account.user.name,
      },
    })),
  }

  return NextResponse.json(sanitized)
}

export const POST = withSession(async ({ request }) => {
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const providerRaw = typeof body.provider === 'string' ? body.provider : ''
  const labelRaw = typeof body.label === 'string' ? body.label : undefined

  if (!emailRaw) return jsonError('Email is required')
  if (!providerRaw) return jsonError('Provider is required')

  try {
    const user = await resolveUserByEmail(emailRaw)

    const { snapshot } = await addAccount({
      provider: providerRaw,
      label: labelRaw ?? null,
      user,
    })

    return NextResponse.json(snapshot, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'USER_NOT_FOUND') {
        return jsonError('User not found. Please ensure the user exists in the authentication system.', 404)
      }
      if (err.message === 'USER_SERVICE_UNAVAILABLE') {
        return jsonError('Authentication service temporarily unavailable. Please try again later.', 503)
      }
    }
    console.error('[account-manager] Unexpected error adding account', { email: emailRaw, error: err })
    return jsonError('An unexpected error occurred', 500)
  }
})
