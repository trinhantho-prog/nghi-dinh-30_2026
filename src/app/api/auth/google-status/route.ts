import { googleLoginStatus } from '@/lib/google-login-status'

export const runtime = 'nodejs'

export async function GET() {
  const status = await googleLoginStatus()
  return Response.json(status, { status: status.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
