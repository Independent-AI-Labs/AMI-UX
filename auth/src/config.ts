import { createRequire } from 'module'
import type { AuthConfig } from 'next-auth'

import { dataOpsClient } from './dataops-client'
import { getAuthSecret, shouldTrustHost } from './env'
import type { AuthenticatedUser, SessionToken } from './types'

function loadCredentialsProvider() {
  try {
    const require = createRequire(import.meta.url)
    const mod = require('next-auth/providers/credentials')
    return (mod as any).default ?? mod
  } catch (err) {
    console.warn('[ux/auth] next-auth credentials provider unavailable, using stub provider.', err)
    return function stubCredentials(options: any) {
      return {
        id: 'credentials',
        name: 'Credentials',
        type: 'credentials',
        authorize: options.authorize,
        credentials: options.credentials ?? {},
      }
    }
  }
}

const Credentials = loadCredentialsProvider()

function mapToSessionToken(user: AuthenticatedUser): SessionToken {
  return {
    userId: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    roles: user.roles,
    groups: user.groups,
    tenantId: user.tenantId ?? null,
    metadata: user.metadata ?? {},
  }
}

export const authConfig: AuthConfig = {
  secret: getAuthSecret(),
  trustHost: shouldTrustHost(),
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 12, // 12 hours
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: {
          type: 'email',
          label: 'Email',
          placeholder: 'name@example.com',
        },
        password: {
          type: 'password',
          label: 'Password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }
        const email = credentials.email.toLowerCase()
        const verification = await dataOpsClient.verifyCredentials({
          email,
          password: credentials.password,
        })
        if (!verification.user) {
          return null
        }
        const ensured = await dataOpsClient.ensureUser(verification.user)
        return {
          id: ensured.id,
          email: ensured.email,
          name: ensured.name ?? undefined,
          image: ensured.image ?? undefined,
          roles: ensured.roles,
          groups: ensured.groups,
          tenantId: ensured.tenantId,
          metadata: ensured.metadata ?? {},
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Allow sign-in only when roles/groups arrays are present (enforced by ensureUser)
      if (!user?.email) return false
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        const mapped = mapToSessionToken(user as AuthenticatedUser)
        token.sub = mapped.userId
        token.email = mapped.email
        token.name = mapped.name ?? undefined
        token.picture = mapped.image ?? undefined
        token.roles = mapped.roles
        token.groups = mapped.groups
        token.tenantId = mapped.tenantId ?? undefined
        token.metadata = mapped.metadata ?? {}
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        id: token.sub as string,
        email: token.email as string,
        name: (token.name as string | null | undefined) ?? null,
        image: (token.picture as string | null | undefined) ?? null,
        roles: (token.roles as string[] | undefined) ?? [],
        groups: (token.groups as string[] | undefined) ?? [],
        tenantId: (token.tenantId as string | null | undefined) ?? null,
        metadata: (token.metadata as Record<string, unknown> | undefined) ?? {},
      }
      return session
    },
  },
  events: {
    async signOut(message) {
      console.info('[ux/auth] signOut', message.token?.sub)
    },
  },
}
