'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Agency, Signer } from '@/types'
import { saveTenantConfig } from '@/lib/actions/documents'
import { useRouter } from 'next/navigation'

interface Props {
  agencies: Agency[]
  signers: Signer[]
  documentCount: number
}

export default function SettingsClient({ agencies: initAgencies, signers: initSigners, documentCount }: Props) {
  const router = useRouter()
  const [agencies, setAgencies] = useState<Agency[]>(initAgencies)
  const [signers, setSigners] = useState<Signer[]>(initSigners)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function saveConfig() {
    setSaving(true)
    await saveTenantConfig(agencies, signers)
    setSaving(false)
    showToast('Đã lưu cấu hình ✓')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#dde3ee]">
      <nav className="bg-[#1a56b0] text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-base font-bold">⚙️ Cài đặt</h1>
          <p className="text-xs opacity-75">Thể thức văn bản</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md font-semibold transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Usage stats */}
        <div className="bg-white rounded-xl shadow-sm border border-[#dde1ef] p-5">
          <h2 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wide mb-3">Thống kê sử dụng</h2>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-[#1a56b0]">{documentCount}<span className="text-base font-normal text-[#6b7597]">/1000</span></div>
              <div className="text-xs text-[#6b7597]">Văn bản</div>
            </div>
          </div>
        </div>

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
          className="w-full bg-[#1a56b0] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1345a0] disabled:opacity-60 transition-colors cursor-pointer"
        >
          {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
        </button>
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

