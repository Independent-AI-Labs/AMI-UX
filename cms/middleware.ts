import { AUTH_MIDDLEWARE_MATCHER, createAuthMiddleware } from '@ami/auth/middleware'

export default createAuthMiddleware({
  publicRoutes: [/^\/public\//],
  signInPath: '/auth/signin',
})

export const config = {
  matcher: AUTH_MIDDLEWARE_MATCHER,
}
