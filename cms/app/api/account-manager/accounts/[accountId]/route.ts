import { NextResponse } from 'next/server'

import { withSession } from '../../../../lib/auth-guard'
import {
  removeAccount,
  setDefaultAccount,
  touchAccountUsage,
} from '../../../../lib/store'

type RouteContext = {
  params: {
    accountId: string
  }
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export const DELETE = withSession(async ({ context }) => {
  const { params } = context as unknown as RouteContext
  const accountId = params?.accountId
  if (!accountId) return jsonError('Account id missing', 400)

  try {
    const snapshot = await removeAccount(accountId)
    return NextResponse.json(snapshot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove account'
    return jsonError(message, 400)
  }
})

export const PATCH = withSession(async ({ request, context }) => {
  const { params } = context as unknown as RouteContext
  const accountId = params?.accountId
  if (!accountId) return jsonError('Account id missing', 400)

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'set-default') {
    const snapshot = await setDefaultAccount(accountId)
    return NextResponse.json(snapshot)
  }

  if (action === 'touch') {
    const { account, snapshot } = await touchAccountUsage(accountId)
    return NextResponse.json({ account, ...snapshot })
  }

  return jsonError('Unsupported action', 400)
})
