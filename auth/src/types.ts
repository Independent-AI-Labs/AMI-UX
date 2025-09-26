export type SecurityContext = {
  userId: string
  roles: string[]
  groups: string[]
  tenantId?: string | null
}

export type AuthenticatedUser = {
  id: string
  email: string
  name?: string | null
  image?: string | null
  roles: string[]
  groups: string[]
  tenantId?: string | null
  metadata?: Record<string, unknown>
}

export type CredentialsPayload = {
  email: string
  password: string
}

export type DataOpsCredentialRecord = {
  email: string
  password: string
  id?: string
  name?: string
  image?: string
  roles?: string[]
  groups?: string[]
  tenantId?: string | null
  metadata?: Record<string, unknown>
}

export type VerifyCredentialsResponse = {
  user: AuthenticatedUser | null
  reason?: string
}

export type SessionToken = {
  userId: string
  roles: string[]
  groups: string[]
  tenantId?: string | null
  email: string
  name?: string | null
  image?: string | null
  metadata?: Record<string, unknown>
}
