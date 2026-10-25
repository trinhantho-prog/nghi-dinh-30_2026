'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfileForm({ profile }: { profile: { email: string; name: string; organization: string; position: string } }) {
  const router = useRouter()
  const [name, setName] = useState(profile.name)
  const [organization, setOrganization] = useState(profile.organization)
  const [position, setPosition] = useState(profile.position)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <>
    <p className="break-words text-sm">Tài khoản Google: <strong>{profile.email}</strong></p>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('')
      try {
        const supabase = createClient()
        if (!supabase) throw new Error('Đăng nhập chưa được cấu hình.')
        const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim(), organization: organization.trim(), position: position.trim() } })
        if (error) throw error
        router.replace('/dashboard?profileSaved=1')
      } catch (error) { setError(error instanceof Error ? error.message : 'Không thể lưu hồ sơ.') }
      finally { setBusy(false) }
    }}>
      <label className="block space-y-1 text-sm"><span>Họ và tên</span><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3" /></label>
      <label className="block space-y-1 text-sm"><span>Cơ quan / đơn vị</span><input maxLength={200} value={organization} onChange={event => setOrganization(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3" /></label>
      <label className="block space-y-1 text-sm"><span>Chức vụ</span><input maxLength={120} value={position} onChange={event => setPosition(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3" /></label>
      <button disabled={busy || !name.trim()} className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
    <form action="/auth/signout" method="post"><button className="text-sm font-semibold text-red-700 underline">Đăng xuất</button></form>
  </>
}
