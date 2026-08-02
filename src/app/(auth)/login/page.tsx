'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const supabase = createClient()
  const router = useRouter()

  async function signInWithGoogle() {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      })
    } catch {
      // Fallback to local mode if OAuth fails
      enterLocalMode()
    }
  }

  function enterLocalMode() {
    document.cookie = 'local_mode=true; path=/; max-age=31536000'
    router.push('/dashboard')
    router.refresh()
  }

  // Bright, premium glowing organic gradient mimicking modern iOS wallpapers
  const loginBg = {
    background: `radial-gradient(circle at 10% 20%, rgba(255, 45, 85, 0.12) 0%, transparent 40%),
                 radial-gradient(circle at 90% 10%, rgba(0, 122, 255, 0.15) 0%, transparent 40%),
                 radial-gradient(circle at 50% 90%, rgba(175, 82, 222, 0.1) 0%, transparent 50%),
                 radial-gradient(circle at 80% 80%, rgba(255, 204, 0, 0.08) 0%, transparent 35%),
                 #f4f5f8`
  }

  return (
    <div style={loginBg} className="min-h-screen flex items-center justify-center font-sans antialiased text-[#1d1d1f] px-6">
      {/* Frosted glassmorphic card container */}
      <div className="bg-white/75 backdrop-blur-md rounded-[28px] border border-white/60 shadow-2xl p-8 w-full max-w-sm transition-all duration-300">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 filter drop-shadow-md">📄</div>
          <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">Thể thức văn bản</h1>
          <p className="text-xs text-[#7a7a7a] tracking-wide font-medium mt-1.5 uppercase">Chuẩn Nghị định 30/2020/NĐ-CP</p>
        </div>

        {error && (
          <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/15 text-[#FF3B30] rounded-xl px-4 py-3 text-xs font-semibold mb-5 text-center leading-relaxed">
            Đăng nhập thất bại. Bạn có thể sử dụng Chế độ Cục bộ bên dưới.
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border border-[#e0e0e0] hover:bg-neutral-50 rounded-full text-sm font-semibold text-[#1d1d1f] hover:border-[#007AFF]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-sm shadow-black/[0.04]"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Đăng nhập với Google
          </button>

          <button
            onClick={enterLocalMode}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#007AFF] text-white hover:bg-[#0062cc] rounded-full text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md shadow-[#007AFF]/20"
          >
            ⚡ Dùng Chế độ Ngoại tuyến (Local Mode)
          </button>
        </div>

        <p className="text-[11px] text-center text-[#7a7a7a] mt-6 leading-relaxed font-medium">
          Chế độ Cục bộ giúp ứng dụng hoạt động 100% không cần kết nối Supabase hay Internet.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
