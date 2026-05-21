'use client'

import { useEffect, useRef, useState } from 'react'

interface WordImportPanelProps {
  onApply: (text: string) => void
  mainContent?: string
}

type Provider = 'anthropic' | 'gemini' | 'deepseek'

const PROVIDERS: { value: Provider; label: string; placeholder: string; storageKey: string; color: string }[] = [
  { value: 'anthropic', label: 'Claude', placeholder: 'sk-ant-api03-...', storageKey: 'wi-anthropic-key', color: '#c97d4e' },
  { value: 'gemini', label: 'Gemini', placeholder: 'AIza...', storageKey: 'wi-gemini-key', color: '#4285f4' },
  { value: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...', storageKey: 'wi-deepseek-key', color: '#6366f1' },
]

const ACCEPTED = '.docx,.doc,.pdf,.xlsx,.xls'

const REWRITE_PROMPT = `Hãy phân tích cấu trúc đoạn văn của tôi trong mục "Nội dung chính". Sau đó viết lại bằng cách tạo sự biến đổi linh hoạt về độ dài câu.
Hãy xen kẽ:
- Những câu cực ngắn, dồn lực mạnh trong khoảng 3 từ
- Với những câu dài hơn, giàu chiều sâu và phức tạp hơn
Loại bỏ hoàn toàn kiểu đoạn văn đều đều, nhịp điệu lặp lại giống hệt nhau — thứ khiến người đọc nhận ra ngay là văn bản do AI tạo ra.`

export default function WordImportPanel({ onApply, mainContent = '' }: WordImportPanelProps) {
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ anthropic: '', gemini: '', deepseek: '' })
  const [prompt, setPrompt] = useState('')
  const [fileName, setFileName] = useState('')
  const [docContent, setDocContent] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rewriteLoading, setRewriteLoading] = useState(false)
  const [result, setResult] = useState('')
  const [rewriteResult, setRewriteResult] = useState('')
  const [error, setError] = useState('')
  const [rewriteError, setRewriteError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loaded: Record<Provider, string> = { anthropic: '', gemini: '', deepseek: '' }
    for (const p of PROVIDERS) {
      loaded[p.value] = localStorage.getItem(p.storageKey) || ''
    }
    setApiKeys(loaded)
  }, [])

  function setKey(val: string) {
    const updated = { ...apiKeys, [provider]: val }
    setApiKeys(updated)
    localStorage.setItem(PROVIDERS.find(p => p.value === provider)!.storageKey, val.trim())
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setDocContent('')
    setError('')
    setIsParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/ai/extract', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Không đọc được file')
      }
      const data = await res.json()
      setDocContent(data.text)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc file')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleSuggest() {
    const apiKey = apiKeys[provider]
    if (!apiKey.trim() || !prompt.trim()) return
    setLoading(true)
    setError('')
    setResult('')
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), prompt: prompt.trim(), docContent, provider }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Lỗi gọi AI')
      }
      const data = await res.json()
      setResult(data.suggestion)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }

  function clearFile() {
    setFileName('')
    setDocContent('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
  }

  async function handleRewriteContent() {
    const apiKey = apiKeys[provider]
    if (!apiKey.trim()) return
    if (!mainContent.trim()) {
      setRewriteError('Mục "Nội dung chính" đang trống. Vui lòng nhập nội dung trước.')
      return
    }
    setRewriteLoading(true)
    setRewriteError('')
    setRewriteResult('')
    try {
      const userMessage = `Nội dung chính:\n\n${mainContent}\n\n---\n\n${REWRITE_PROMPT}`
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), prompt: userMessage, provider }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Lỗi gọi AI')
      }
      const data = await res.json()
      setRewriteResult(data.suggestion)
    } catch (e: unknown) {
      setRewriteError(e instanceof Error ? e.message : 'Lỗi không xác định')
    } finally {
      setRewriteLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-[0.55rem] border-[1.5px] border-[#dde1ef] rounded-[6px] text-[0.855rem] font-[inherit] bg-white text-[#1a1f36] focus:outline-none focus:border-[#1a56b0] focus:ring-2 focus:ring-[#1a56b0]/10'
  const currentProvider = PROVIDERS.find(p => p.value === provider)!

  return (
    <div className="space-y-3">
      {/* Provider selector */}
      <div>
        <label className="block text-[0.78rem] font-semibold text-[#6b7597] mb-1">Nhà cung cấp AI</label>
        <div className="flex gap-1.5">
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => setProvider(p.value)}
              style={provider === p.value ? { background: p.color, borderColor: p.color, color: 'white' } : {}}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md border-[1.5px] border-[#ddd6fe] transition-all ${
                provider === p.value ? '' : 'text-[#7c3aed] hover:bg-[#f5f3ff]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* File import */}
      <div>
        <label className="block text-[0.78rem] font-semibold text-[#6b7597] mb-1">
          File đính kèm (.docx .doc .pdf .xlsx .xls)
        </label>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 py-[0.55rem] px-3 border-[1.5px] border-dashed border-[#c3d0f5] rounded-[6px] text-xs text-[#3b52bf] hover:bg-[#eef2ff] transition-colors text-left truncate"
          >
            {isParsing ? '⏳ Đang đọc...' : fileName ? `📄 ${fileName}` : '📂 Chọn file'}
          </button>
          {fileName && (
            <button onClick={clearFile} className="shrink-0 text-xs text-red-400 hover:text-red-600 px-1.5 py-1">
              ✕
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={ACCEPTED} onChange={handleFileChange} className="hidden" />
        {docContent && (
          <div className="mt-1 text-[0.7rem] text-[#10b981] font-semibold">
            ✓ Đã đọc {docContent.length.toLocaleString()} ký tự
          </div>
        )}
      </div>

      {/* API Key */}
      <div>
        <label className="block text-[0.78rem] font-semibold text-[#6b7597] mb-1">
          {currentProvider.label} API Key
        </label>
        <input
          type="password"
          value={apiKeys[provider]}
          onChange={e => setKey(e.target.value)}
          placeholder={currentProvider.placeholder}
          className={`${inputCls} font-mono text-[0.78rem]`}
        />
        <div className="text-[0.68rem] text-[#9ca3af] mt-0.5">Lưu tự động theo từng nhà cung cấp</div>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-[0.78rem] font-semibold text-[#6b7597] mb-1">Nhập yêu cầu</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ví dụ: Dựa trên file trên, hãy soạn nội dung báo cáo tình hình thu BHXH quý I..."
          className={`${inputCls} resize-y`}
        />
      </div>

      <button
        onClick={handleSuggest}
        disabled={loading || !apiKeys[provider].trim() || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold bg-[#7c3aed] text-white hover:bg-[#6d28d9] disabled:opacity-50 transition-colors"
      >
        {loading
          ? <><span className="animate-spin inline-block">⏳</span> Đang xử lý...</>
          : <><span>✨</span> Gợi ý nội dung</>
        }
      </button>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white border-[1.5px] border-[#c3d0f5] rounded-lg overflow-hidden">
          <div className="bg-[#f0f4ff] px-3 py-2 flex justify-between items-center border-b border-[#dde4f5]">
            <span className="text-xs font-bold text-[#3b52bf]">Trả lời yêu cầu</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleCopy}
                className="text-xs bg-[#e0e7ff] text-[#3b52bf] px-2 py-1 rounded font-semibold hover:bg-[#c7d2fe] transition-colors"
              >
                📋 Copy
              </button>
              <button
                onClick={() => onApply(result)}
                className="text-xs bg-[#1a56b0] text-white px-2 py-1 rounded font-semibold hover:bg-[#1345a0] transition-colors"
              >
                Áp dụng
              </button>
            </div>
          </div>
          <div className="p-3 text-xs text-[#374151] whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
            {result}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-dashed border-[#ddd6fe] pt-3">
        <div className="text-[0.72rem] font-bold text-[#7c3aed] uppercase tracking-wider mb-2">✏️ Gợi ý chỉnh văn phong</div>

        <button
          onClick={handleRewriteContent}
          disabled={rewriteLoading || !apiKeys[provider].trim()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#7c3aed] to-[#4f46e5] text-white hover:from-[#6d28d9] hover:to-[#4338ca] disabled:opacity-50 transition-all shadow-sm"
        >
          {rewriteLoading
            ? <><span className="animate-spin inline-block">⏳</span> Đang viết lại...</>
            : <>✍️ Gợi ý chỉnh nội dung</>
          }
        </button>
        <div className="text-[0.67rem] text-[#9ca3af] mt-1 leading-snug">
          AI sẽ viết lại "Nội dung chính" với câu ngắn–dài xen kẽ, tránh nhịp đều AI.
        </div>

        {rewriteError && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {rewriteError}
          </div>
        )}

        {rewriteResult && (
          <div className="mt-2 bg-white border-[1.5px] border-[#c3d0f5] rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#f5f3ff] to-[#eef2ff] px-3 py-2 flex justify-between items-center border-b border-[#dde4f5]">
              <span className="text-xs font-bold text-[#7c3aed]">✍️ Nội dung đã viết lại</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => navigator.clipboard.writeText(rewriteResult)}
                  className="text-xs bg-[#ede9fe] text-[#7c3aed] px-2 py-1 rounded font-semibold hover:bg-[#ddd6fe] transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => onApply(rewriteResult)}
                  className="text-xs bg-[#7c3aed] text-white px-2 py-1 rounded font-semibold hover:bg-[#6d28d9] transition-colors"
                >
                  Áp dụng
                </button>
              </div>
            </div>
            <div className="p-3 text-xs text-[#374151] whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
              {rewriteResult}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
