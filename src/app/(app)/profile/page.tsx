import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  let profile: { email: string; name: string; organization: string; position: string } | null = null
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  if (configured) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const metadata = user.user_metadata || {}
      const string = (value: unknown) => typeof value === 'string' ? value : ''
      profile = { email: user.email || '', name: string(metadata.display_name || metadata.full_name || metadata.name), organization: string(metadata.organization), position: string(metadata.position) }
    }
  }
  return <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
    <section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Link href="/dashboard" className="text-sm text-blue-700">← Danh sách văn bản</Link>
      <h1 className="text-2xl font-bold">Hồ sơ người dùng</h1>
      {profile ? <ProfileForm profile={profile} /> : <>
        <p className="text-sm leading-relaxed">Bạn đang sử dụng chế độ chưa đăng nhập. Đăng nhập bằng tài khoản Gmail / Google để tạo và quản lý hồ sơ cá nhân.</p>
        {!configured && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Máy chủ chưa cấu hình Supabase và Google OAuth. Xem mục “Đăng nhập Google và hồ sơ” trong README để kích hoạt.</p>}
        <Link href="/login" className="inline-block rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white">Đăng nhập với Google / Gmail</Link>
      </>}
    </section>
  </main>
}
