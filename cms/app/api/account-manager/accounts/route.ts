import { NextResponse } from 'next/server'

import { auth } from '@ami/auth/server'
import { dataOpsClient } from '@ami/auth/dataops-client'
import type { AuthenticatedUser } from '@ami/auth/types'

import { withSession } from '../../../lib/auth-guard'
import {
  addAccount,
  deriveAccountUserId,
  getAccountSnapshot,
} from '../../../lib/store'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function resolveUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  try {
    const existing = await dataOpsClient.getUserByEmail(email)
    if (existing) return existing
  } catch (err) {
    console.warn('[account-manager] dataOpsClient.getUserByEmail failed', err)
  }

  // Fallback: synthesize minimal user aligned with AuthenticatedUser model.
  const fallbackId = deriveAccountUserId(email)
  return {
    id: fallbackId,
    email,
    name: null,
    image: null,
    roles: [],
    groups: [],
    tenantId: null,
    metadata: { accountSource: 'fallback-local' },
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

  const user = await resolveUserByEmail(emailRaw)
  if (!user) return jsonError('Unable to resolve user for the requested email', 404)

  const { snapshot } = await addAccount({
    provider: providerRaw,
    label: labelRaw ?? null,
    user,
  })

  return NextResponse.json(snapshot, { status: 201 })
})
