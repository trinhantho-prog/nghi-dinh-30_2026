import { cookies } from 'next/headers'
import { DRIVE_COOKIE, driveConfigured, driveCookieOptions, driveErrorResponse, driveSession, requireSameOrigin } from '@/lib/google-drive'

export async function GET() {
  if (!driveConfigured()) return Response.json({ configured: false, connected: false }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    const session = await driveSession()
    return Response.json({ configured: true, connected: true, email: session.email, accountId: session.accountId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ configured: true, connected: false }, { headers: { 'Cache-Control': 'no-store' } }) }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request)
    ;(await cookies()).set(DRIVE_COOKIE, '', { ...driveCookieOptions, maxAge: 0 })
    return Response.json({ disconnected: true })
  } catch (error) { return driveErrorResponse(error) }
}
