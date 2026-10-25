import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { DRIVE_COOKIE, DRIVE_SCOPE, DRIVE_APP_SCOPE, DRIVE_STATE_COOKIE, driveCookieOptions, sealDriveSession } from '@/lib/google-drive'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const store = await cookies()
  const expected = store.get(DRIVE_STATE_COOKIE)?.value
  store.set(DRIVE_STATE_COOKIE, '', { ...driveCookieOptions, maxAge: 0 })
  function failed() { return NextResponse.redirect(new URL('/drive?error=authorization', url.origin)) }
  if (!expected || expected !== url.searchParams.get('state') || !url.searchParams.get('code')) return failed()
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code')!, client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!, redirect_uri: `${url.origin}/api/drive/callback`, grant_type: 'authorization_code' }) })
    if (!tokenResponse.ok) return failed()
    const token = await tokenResponse.json()
    if (!token.refresh_token || ![DRIVE_SCOPE, DRIVE_APP_SCOPE].every(scope => token.scope?.split(' ').includes(scope))) return failed()
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { cache: 'no-store', headers: { Authorization: `Bearer ${token.access_token}` } })
    if (!profileResponse.ok) return failed()
    const profile = await profileResponse.json()
    const response = NextResponse.redirect(new URL('/drive', url.origin))
    response.cookies.set(DRIVE_COOKIE, sealDriveSession({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000, accountId: profile.sub, email: profile.email }), driveCookieOptions)
    return response
  } catch { return failed() }
}
