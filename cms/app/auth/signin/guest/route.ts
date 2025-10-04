import { handleGuestSignIn } from './guest-handler'

export async function POST(request: Request) {
  return handleGuestSignIn(request)
}
