import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session token if needed
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLocalMode = request.cookies.get('local_mode')?.value === 'true'
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth')
  const isDashboardRoute = path.startsWith('/dashboard') || path === '/'

  // 1. Root path redirect
  if (path === '/') {
    return NextResponse.redirect(new URL(user || isLocalMode ? '/dashboard' : '/login', request.url))
  }

  // 2. Protected dashboard routes: require user session or local mode
  if (isDashboardRoute && !user && !isLocalMode) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Auth pages: redirect to dashboard if already signed in
  if (isAuthRoute && user && !path.startsWith('/auth/callback') && !path.startsWith('/auth/signout')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
