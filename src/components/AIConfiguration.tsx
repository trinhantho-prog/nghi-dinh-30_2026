'use client'

import { useEffect, useState } from 'react'
import { AI_PROVIDERS, AIProvider, readAIConfig } from '@/lib/ai-config'

export default function AIConfiguration() {
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [keys, setKeys] = useState<Record<AIProvider, string>>({ gemini: '', deepseek: '', anthropic: '' })
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setProvider(readAIConfig().provider)
        setKeys(Object.fromEntries(AI_PROVIDERS.map(item => [item.value, localStorage.getItem(item.storageKey) || ''])) as Record<AIProvider, string>)
        setReady(true)
      } catch {
        setMessage('Không thể đọc cấu hình AI. Vui lòng cho phép trình duyệt lưu dữ liệu.')
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  function save() {
    try {
      AI_PROVIDERS.forEach(item => localStorage.setItem(item.storageKey, keys[item.value].trim()))
      localStorage.setItem('ai-active-provider', provider)
      setMessage('Đã lưu cấu hình AI ✓')
    } catch {
      setMessage('Không thể lưu cấu hình AI. Vui lòng kiểm tra quyền lưu dữ liệu của trình duyệt.')
    }
  }

  return (
    <section id="ai-configuration" className="rounded-xl border border-[#dde1ef] bg-white p-5 text-[#1a1f36] shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#7b8abf]">🧠 Cấu hình trí tuệ nhân tạo</h2>
      <fieldset disabled={!ready}>
        <legend className="mb-2 text-xs font-semibold text-[#6b7597]">Chọn AI sử dụng</legend>
        <div className="mb-4 flex flex-wrap gap-2">
          {AI_PROVIDERS.map(item => (
            <label key={item.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${provider === item.value ? 'border-[#1a56b0] bg-blue-50 text-[#1a56b0]' : 'border-[#dde1ef] text-[#6b7597]'}`}>
              <input type="radio" name="ai-provider" value={item.value} checked={provider === item.value} onChange={() => { setProvider(item.value); setMessage('') }} />
              {item.label}
            </label>
          ))}
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[#6b7597]">Nhập API Key riêng (tùy chọn). Để trống Gemini hoặc AI miễn phí để dùng key hệ thống. Cấu hình được lưu trên trình duyệt này và dùng cho các công cụ AI khi soạn thảo.</p>
        <div className="space-y-3">
          {AI_PROVIDERS.map(item => (
            <div key={item.value}>
              <label htmlFor={item.storageKey} className="mb-1 block text-xs font-semibold text-[#6b7597]">{item.keyLabel}</label>
              <input id={item.storageKey} type="password" autoComplete="off" spellCheck={false} value={keys[item.value]} placeholder={item.placeholder}
                onChange={e => { setKeys(previous => ({ ...previous, [item.value]: e.target.value })); setMessage('') }}
                className="w-full rounded-lg border-[1.5px] border-[#dde1ef] bg-white px-3 py-2 text-sm text-[#1a1f36] focus:border-[#1a56b0] focus:outline-none focus:ring-2 focus:ring-[#1a56b0]/10" />
            </div>
          ))}
        </div>
        <button type="button" onClick={save} className="mt-4 w-full rounded-lg bg-[#10b981] py-2.5 text-sm font-semibold text-white hover:bg-[#059669] disabled:opacity-50">Lưu cấu hình AI</button>
      </fieldset>
      <p role="status" className="mt-2 text-xs text-[#1a56b0]">{message}</p>
    </section>
  )
}
