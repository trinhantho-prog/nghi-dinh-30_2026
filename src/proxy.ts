import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLocalMode = request.cookies.get('local_mode')?.value === 'true'

  let supabaseResponse = NextResponse.next({ request })
  let user = null

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    console.warn('Proxy Supabase check error, switching to offline tolerance:', error)
  }

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    if (user || isLocalMode) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Protected routes — allow if authenticated OR in Local Mode
  if (!user && !isLocalMode) {
    // If Supabase is unreachable and not in local mode, default to local mode for a smooth experience
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('local_mode', 'true', { path: '/', maxAge: 60 * 60 * 24 * 365 })
    return response
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
