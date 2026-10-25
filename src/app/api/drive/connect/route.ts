import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { DRIVE_SCOPE, DRIVE_APP_SCOPE, DRIVE_STATE_COOKIE, driveConfigured, driveCookieOptions } from '@/lib/google-drive'

export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  if (!driveConfigured()) return NextResponse.redirect(new URL('/drive?error=not_configured', origin))
  const state = randomBytes(32).toString('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, redirect_uri: `${origin}/api/drive/callback`, response_type: 'code', scope: `openid email ${DRIVE_SCOPE} ${DRIVE_APP_SCOPE}`, access_type: 'offline', prompt: 'consent select_account', state }).toString()
  const response = NextResponse.redirect(url)
  response.cookies.set(DRIVE_STATE_COOKIE, state, { ...driveCookieOptions, maxAge: 600 })
  return response
}
