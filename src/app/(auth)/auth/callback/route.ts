import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  try {
    if (code) {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        const cookieStore = await cookies()
        cookieStore.delete('local_mode')
        cookieStore.delete('document_storage')

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: membership } = await supabase
            .from('tenant_members')
            .select('tenant_id')
            .eq('user_id', user.id)
            .maybeSingle()

          return NextResponse.redirect(`${origin}${membership ? '/dashboard' : '/profile'}`)
        }
      }
    }
  } catch { /* OAuth failures return to the login page without enabling local mode. */ }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
