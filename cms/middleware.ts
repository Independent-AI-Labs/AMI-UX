import createAuthMiddleware from '@ami/auth/middleware'

export default createAuthMiddleware({
  publicRoutes: [/^\/public\//],
  signInPath: '/auth/signin',
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/auth|auth|favicon.ico|docs).*)'],
}
