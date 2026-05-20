'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Agency, Signer } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  tenantId: string
  tenantName: string
  isAdmin: boolean
  agencies: Agency[]
  signers: Signer[]
  memberCount: number
  documentCount: number
}

export default function SettingsClient({ tenantId, tenantName, isAdmin, agencies: initAgencies, signers: initSigners, memberCount, documentCount }: Props) {
  const router = useRouter()
  const [agencies, setAgencies] = useState<Agency[]>(initAgencies)
  const [signers, setSigners] = useState<Signer[]>(initSigners)
  const [saving, setSaving] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function saveConfig() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('tenant_config').upsert({ tenant_id: tenantId, agencies, signers, updated_at: new Date().toISOString() })
    setSaving(false)
    showToast('Đã lưu cấu hình ✓')
    router.refresh()
  }

  async function generateInvite() {
    setGeneratingInvite(true)
    const supabase = createClient()
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('invite_links').insert({ tenant_id: tenantId, code, created_by: user?.id, expires_at: expiresAt })
    setInviteCode(code)
    setGeneratingInvite(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-[#dde3ee]">
      <nav className="bg-[#1a56b0] text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-base font-bold">⚙️ Cài đặt</h1>
          <p className="text-xs opacity-75">{tenantName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md font-semibold transition-colors">
            ← Dashboard
          </Link>
          <button onClick={signOut} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md font-semibold transition-colors">
            Đăng xuất
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Usage stats */}
        <div className="bg-white rounded-xl shadow-sm border border-[#dde1ef] p-5">
          <h2 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wide mb-3">Thống kê sử dụng</h2>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-[#1a56b0]">{documentCount}<span className="text-base font-normal text-[#6b7597]">/99</span></div>
              <div className="text-xs text-[#6b7597]">Văn bản</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1a56b0]">{memberCount}</div>
              <div className="text-xs text-[#6b7597]">Thành viên</div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <>
            {/* Agencies config */}
            <div className="bg-white rounded-xl shadow-sm border border-[#dde1ef] p-5">
              <h2 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wide mb-3">Cơ quan ban hành</h2>
              <div className="space-y-3">
                {agencies.map((a, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input
                        value={a.upper}
                        onChange={e => setAgencies(prev => prev.map((x, j) => j === i ? { ...x, upper: e.target.value } : x))}
                        placeholder="Cơ quan chủ quản"
                        className={inputCls}
                      />
                      <input
                        value={a.main}
                        onChange={e => setAgencies(prev => prev.map((x, j) => j === i ? { ...x, main: e.target.value } : x))}
                        placeholder="Cơ quan ban hành"
                        className={inputCls}
                      />
                      <input
                        value={a.location}
                        onChange={e => setAgencies(prev => prev.map((x, j) => j === i ? { ...x, location: e.target.value } : x))}
                        placeholder="Địa danh"
                        className={inputCls}
                      />
                      <input
                        value={a.suffix ?? ''}
                        onChange={e => setAgencies(prev => prev.map((x, j) => j === i ? { ...x, suffix: e.target.value } : x))}
                        placeholder="Ký hiệu văn bản (vd: /BHXH-CL)"
                        className={inputCls}
                      />
                    </div>
                    <button onClick={() => setAgencies(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 mt-1">✕</button>
                  </div>
                ))}
                <button
                  onClick={() => setAgencies(prev => [...prev, { upper: '', main: '', location: '' }])}
                  className="text-xs text-[#1a56b0] font-semibold hover:underline"
                >
                  + Thêm cơ quan
                </button>
              </div>
            </div>

            {/* Signers config */}
            <div className="bg-white rounded-xl shadow-sm border border-[#dde1ef] p-5">
              <h2 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wide mb-3">Danh sách người ký</h2>
              <div className="space-y-2">
                {signers.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={s.position}
                      onChange={e => setSigners(prev => prev.map((x, j) => j === i ? { ...x, position: e.target.value } : x))}
                      placeholder="Chức vụ"
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      value={s.name}
                      onChange={e => setSigners(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Họ và tên"
                      className={`${inputCls} flex-1`}
                    />
                    <button onClick={() => setSigners(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                <button
                  onClick={() => setSigners(prev => [...prev, { position: 'GIÁM ĐỐC', name: '' }])}
                  className="text-xs text-[#1a56b0] font-semibold hover:underline"
                >
                  + Thêm người ký
                </button>
              </div>
            </div>

            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full bg-[#1a56b0] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1345a0] disabled:opacity-60 transition-colors"
            >
              {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
            </button>

            {/* Invite link */}
            <div className="bg-white rounded-xl shadow-sm border border-[#dde1ef] p-5">
              <h2 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wide mb-3">Mời thành viên</h2>
              {inviteCode ? (
                <div>
                  <p className="text-xs text-[#6b7597] mb-2">Gửi mã này cho đồng nghiệp (hết hạn sau 7 ngày):</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-[#f7f8fc] border border-[#dde1ef] rounded-lg px-4 py-2 text-lg font-mono font-bold text-[#1a56b0] text-center tracking-widest">
                      {inviteCode}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteCode); showToast('Đã sao chép!') }}
                      className="bg-[#e8f0fe] text-[#1a56b0] px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a56b0] hover:text-white transition-colors"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={generateInvite}
                  disabled={generatingInvite}
                  className="w-full bg-[#8b5cf6] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7c3aed] disabled:opacity-60 transition-colors"
                >
                  {generatingInvite ? 'Đang tạo...' : '🔗 Tạo mã mời'}
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1f36] text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border-[1.5px] border-[#dde1ef] rounded-lg text-sm focus:outline-none focus:border-[#1a56b0] focus:ring-2 focus:ring-[#1a56b0]/10'
