import createAuthMiddleware, { AUTH_MIDDLEWARE_MATCHER } from '@ami/auth/middleware'

export default createAuthMiddleware({
  publicRoutes: [/^\/public\//],
  signInPath: '/auth/signin',
})

export const config = {
  matcher: AUTH_MIDDLEWARE_MATCHER,
}
