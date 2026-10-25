import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { DRIVE_COOKIE, driveCookieOptions } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error) return NextResponse.json({ error: 'Không thể đăng xuất. Vui lòng thử lại.' }, { status: 503 })
  }
  const store = await cookies()
  store.set('local_mode', '', { path: '/', maxAge: 0 })
  store.set('document_storage', '', { path: '/', maxAge: 0 })
  store.set(DRIVE_COOKIE, '', { ...driveCookieOptions, maxAge: 0 })
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL('/login', origin), { status: 303 })
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/profile', request.nextUrl.origin))
}
