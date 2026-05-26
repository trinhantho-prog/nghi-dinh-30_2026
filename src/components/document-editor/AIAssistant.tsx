'use client'

import { useState, useEffect } from 'react'
import { DocumentState, AIIssue } from '@/types'

interface AIAssistantProps {
  state: DocumentState
  dispatch: (action: { type: 'SET_FIELD'; field: keyof DocumentState; value: string }) => void
  onIssuesChange?: (issues: AIIssue[]) => void
}

type Tab = 'linter' | 'transformer' | 'structure' | 'analyzer'
type Provider = 'gemini' | 'deepseek' | 'anthropic'

interface TransitionPhrase {
  text: string
  desc: string
}

const PART_STARTERS: Record<number, TransitionPhrase[]> = {
  1: [
    { text: 'Căn cứ vào Nghị định số 30/2020/NĐ-CP của Chính phủ về công tác văn thư...', desc: 'Căn cứ pháp lý tiêu chuẩn' },
    { text: 'Thực hiện ý kiến chỉ đạo của Lãnh đạo đơn vị về việc triển khai...', desc: 'Thực hiện chỉ đạo cấp trên' },
    { text: 'Trước tình hình thực tế triển khai nhiệm vụ chuyên môn tại địa bàn...', desc: 'Đánh giá bối cảnh thực tế' },
    { text: 'Nhằm đáp ứng yêu cầu nâng cao hiệu quả công tác quản lý nhà nước...', desc: 'Mục đích nâng cao quản lý' },
  ],
  2: [
    { text: 'Về kết quả đạt được, trong thời gian qua, đơn vị đã tập trung...', desc: 'Liệt kê kết quả nổi bật' },
    { text: 'Cơ bản hoàn thành các chỉ tiêu được giao theo đúng tiến độ, cụ thể...', desc: 'Báo cáo chỉ tiêu đạt được' },
    { text: 'Bên cạnh những kết quả đạt được, công tác vẫn còn một số hạn chế, tồn tại...', desc: 'Nhập đề chỉ ra hạn chế' },
    { text: 'Do một số nguyên nhân khách quan và chủ quan, tiến độ thực hiện...', desc: 'Giải trình nguyên nhân khó khăn' },
  ],
  3: [
    { text: 'Nhằm phát huy kết quả đã đạt được, trong thời gian tới, đơn vị tập trung...', desc: 'Phương hướng phát triển' },
    { text: 'Để khắc phục những vướng mắc, hạn chế nêu trên, đơn vị đề xuất phương án...', desc: 'Đề xuất giải quyết khó khăn' },
    { text: 'Kính trình Lãnh đạo cấp trên xem xét, cho ý kiến chỉ đạo đối với...', desc: 'Kính trình xin ý kiến' },
    { text: 'Kiến nghị các cơ quan ban ngành liên quan chủ động phối hợp chặt chẽ...', desc: 'Kiến nghị phối hợp liên ngành' },
  ],
}

const PROVIDERS: { value: Provider; label: string; placeholder: string; storageKey: string; color: string }[] = [
  { value: 'gemini', label: 'Gemini', placeholder: 'Sử dụng key trả phí của hệ thống hoặc nhập key riêng...', storageKey: 'ai-gemini-key', color: '#3b82f6' },
  { value: 'deepseek', label: 'DeepSeek', placeholder: 'Nhập sk-...', storageKey: 'ai-deepseek-key', color: '#6366f1' },
  { value: 'anthropic', label: 'AI miễn phí', placeholder: 'Nhập API Key Gemini Free (Model: gemini-2.5-flash-lite)...', storageKey: 'ai-anthropic-key', color: '#c97d4e' },
]

export default function AIAssistant({ state, dispatch, onIssuesChange }: AIAssistantProps) {
  const [activeTab, setActiveTab] = useState<Tab>('linter')
  const [provider, setProvider] = useState<Provider>('gemini')
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ gemini: '', deepseek: '', anthropic: '' })
  
  // States cho Linter
  const [linterLoading, setLinterLoading] = useState(false)
  const [linterIssues, setLinterIssues] = useState<AIIssue[]>([])
  const [linterError, setLinterError] = useState('')
  const [fixedIndices, setFixedIndices] = useState<Set<number>>(new Set())

  // States cho Transformer
  const [rawText, setRawText] = useState('')
  const [transformLoading, setTransformLoading] = useState(false)
  const [transformResult, setTransformResult] = useState('')
  const [transformError, setTransformError] = useState('')

  // States cho Cấu trúc 3 phần
  const [activePart, setActivePart] = useState<number>(1)
  const [structurePrompt, setStructurePrompt] = useState('')
  const [structureLoading, setStructureLoading] = useState(false)
  const [structureResult, setStructureResult] = useState('')
  const [structureError, setStructureError] = useState('')

  // States cho Phân tích tài liệu & Tạo mới
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState<string>('')
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [analyzerPrompt, setAnalyzerPrompt] = useState('')
  const [analyzerLoading, setAnalyzerLoading] = useState(false)
  const [analyzerError, setAnalyzerError] = useState('')
  const [analyzerResult, setAnalyzerResult] = useState<Record<string, string> | null>(null)

  // States cho API key editing & saving UI
  const [isEditingKey, setIsEditingKey] = useState<Record<Provider, boolean>>({
    gemini: false,
    deepseek: false,
    anthropic: false
  })

  // Tải API keys từ Local Storage
  useEffect(() => {
    const loaded: Record<Provider, string> = { gemini: '', deepseek: '', anthropic: '' }
    const editing: Record<Provider, boolean> = { gemini: false, deepseek: false, anthropic: false }
    PROVIDERS.forEach(p => {
      const saved = localStorage.getItem(p.storageKey) || ''
      loaded[p.value] = saved
      editing[p.value] = !saved // If key is empty, show input by default
    })
    setTimeout(() => {
      setApiKeys(loaded)
      setIsEditingKey(editing)
    }, 0)
  }, [])

  const handleKeyChange = (val: string) => {
    const updated = { ...apiKeys, [provider]: val }
    setApiKeys(updated)
    const p = PROVIDERS.find(x => x.value === provider)
    if (p) localStorage.setItem(p.storageKey, val.trim())
  }

  // === 1. BỘ QUÉT THỂ THỨC (LINTER) ===
  const runLinter = async () => {
    setLinterLoading(true)
    setLinterError('')
    setFixedIndices(new Set())
    onIssuesChange?.([])

    // 1. Quét cục bộ trước (Client-side linting rules)
    const localIssues: AIIssue[] = []
    
    // Quét thụt dòng thủ công bằng dấu cách/tab
    if (/^[ \t]+/m.test(state.mainContent)) {
      localIssues.push({
        field: 'Nội dung chính',
        type: 'warning',
        description: 'Thụt lề thủ công',
        suggestion: 'Xóa khoảng trắng ở đầu dòng',
        reason: 'Theo Nghị định 30/2020/NĐ-CP, khoảng cách lùi đầu dòng quy định là 1.0 cm hoặc 1.27 cm (được hệ thống tự động căn chỉnh qua CSS). Việc tự ý chèn dấu cách hoặc Tab thủ công ở đầu dòng sẽ gây sai lệch thể thức.'
      } as AIIssue)
    }

    // Quét nhiều dòng trắng liên tiếp
    if (/\n{3,}/.test(state.mainContent)) {
      localIssues.push({
        field: 'Nội dung chính',
        type: 'warning',
        description: 'Dòng trống liên tiếp',
        suggestion: 'Xóa bớt dòng trống thừa',
        reason: 'Có nhiều dòng trống liên tục. Nghị định 30 yêu cầu giãn dòng đồng đều 1.5 lines và khoảng cách đoạn 6pt, không chèn nhiều dòng trống.'
      } as AIIssue)
    }

    // Quét khoảng cách 2 dấu cách liên tiếp
    if (/ {2,}/.test(state.mainContent)) {
      localIssues.push({
        field: 'Nội dung chính',
        type: 'warning',
        description: 'Hai dấu cách liên tiếp',
        suggestion: 'Chuẩn hóa thành 1 khoảng trắng',
        reason: 'Phát hiện lỗi gõ máy chứa nhiều dấu cách liên tiếp.'
      } as AIIssue)
    }

    try {
      // 2. Gọi AI Linter để quét nâng cao (Spelling, Capitalization)
      const key = apiKeys[provider]?.trim()
      const res = await fetch('/api/ai/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentData: state,
          apiKey: key || undefined,
          provider: provider
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Không nhận diện được phản hồi kiểm tra thể thức')
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const serverIssues: AIIssue[] = data.issues || []
      const mergedIssues = [...localIssues, ...serverIssues]
      
      setLinterIssues(mergedIssues)
      onIssuesChange?.(mergedIssues)
    } catch (e: unknown) {
      setLinterError(e instanceof Error ? e.message : 'Có lỗi khi quét thể thức')
      // Vẫn hiển thị các lỗi cục bộ nếu có
      if (localIssues.length > 0) {
        setLinterIssues(localIssues)
        onIssuesChange?.(localIssues)
      }
    } finally {
      setLinterLoading(false)
    }
  }

  const fixLinterIssue = (index: number, issue: AIIssue) => {
    // Tìm key tương ứng trong DocumentState
    let fieldKey: keyof DocumentState | null = null
    if (issue.fieldKey) {
      fieldKey = issue.fieldKey as keyof DocumentState
    } else {
      // Map ngược nếu thiếu fieldKey
      const lower = issue.field.toLowerCase()
      if (lower.includes('chính')) fieldKey = 'mainContent'
      else if (lower.includes('cơ quan ban hành')) fieldKey = 'agencyMain'
      else if (lower.includes('trích yếu')) fieldKey = 'docSummary'
      else if (lower.includes('kính gửi')) fieldKey = 'recipient'
      else if (lower.includes('căn cứ')) fieldKey = 'legalBasis'
      else if (lower.includes('đặt vấn đề')) fieldKey = 'issueStatement'
      else if (lower.includes('kết luận')) fieldKey = 'conclusion'
      else if (lower.includes('nơi nhận')) fieldKey = 'recipientsCc'
    }

    if (!fieldKey) return

    const currentVal = state[fieldKey] as string
    if (!currentVal) return

    let newVal = currentVal
    if (issue.description === 'Thụt lề thủ công') {
      newVal = currentVal.replace(/^[ \t]+/gm, '')
    } else if (issue.description === 'Dòng trống liên tiếp') {
      newVal = currentVal.replace(/\n{3,}/g, '\n\n')
    } else if (issue.description === 'Hai dấu cách liên tiếp') {
      newVal = currentVal.replace(/ {2,}/g, ' ')
    } else {
      // Sửa lỗi chính tả/viết hoa thông thường
      newVal = currentVal.replaceAll(issue.description, issue.suggestion)
    }

    dispatch({ type: 'SET_FIELD', field: fieldKey, value: newVal })
    setFixedIndices(prev => new Set([...prev, index]))
  }

  // === 2. HÀNH CHÍNH HÓA (STYLE TRANSFORMER) ===
  const runTransformer = async () => {
    if (!rawText.trim()) return
    setTransformLoading(true)
    setTransformError('')
    setTransformResult('')
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeys[provider]?.trim() || undefined,
          prompt: rawText.trim(),
          provider: provider,
          mode: 'transform'
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Có lỗi khi xử lý chuyển đổi văn phong')
      }

      const data = await res.json()
      setTransformResult(data.suggestion)
    } catch (e: unknown) {
      setTransformError(e instanceof Error ? e.message : 'Có lỗi không xác định')
    } finally {
      setTransformLoading(false)
    }
  }

  // === 3. CẤU TRÚC BÁO CÁO 3 PHẦN ===
  const generateStructureDraft = async (starterText: string) => {
    setStructureLoading(true)
    setStructureError('')
    setStructureResult('')
    try {
      const userPrompt = `Hãy viết một đoạn văn hành chính bắt đầu chính xác bằng cụm từ: "${starterText}".\nNội dung cần viết dựa trên các ý thô sau: ${structurePrompt || 'Triển khai chi tiết chuyên nghiệp phần nội dung hành chính công vụ.'}`
      
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeys[provider]?.trim() || undefined,
          prompt: userPrompt,
          provider: provider,
          mode: 'structure'
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Có lỗi khi tạo văn bản theo cấu trúc')
      }

      const data = await res.json()
      setStructureResult(data.suggestion)
    } catch (e: unknown) {
      setStructureError(e instanceof Error ? e.message : 'Có lỗi không xác định')
    } finally {
      setStructureLoading(false)
    }
  }

  const handleApplyText = (text: string, append = false) => {
    if (append) {
      const current = state.mainContent ? state.mainContent.trim() + '\n\n' : ''
      dispatch({ type: 'SET_FIELD', field: 'mainContent', value: current + text })
    } else {
      dispatch({ type: 'SET_FIELD', field: 'mainContent', value: text })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setAttachedFile(file)
    setExtractedText('')
    setExtractError('')
    setExtractLoading(true)
    setAnalyzerResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Không thể trích xuất nội dung từ file này')
      }
      
      const data = await res.json()
      setExtractedText(data.text || '')
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi đọc file')
      setAttachedFile(null)
    } finally {
      setExtractLoading(false)
    }
  }

  const runDocumentAnalyzer = async () => {
    if (!extractedText.trim() && !attachedFile) {
      setAnalyzerError('Vui lòng đính kèm tài liệu trước.')
      return
    }
    if (!analyzerPrompt.trim()) {
      setAnalyzerError('Vui lòng nhập yêu cầu soạn thảo văn bản.')
      return
    }
    
    setAnalyzerLoading(true)
    setAnalyzerError('')
    setAnalyzerResult(null)
    
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeys[provider]?.trim() || undefined,
          prompt: analyzerPrompt.trim(),
          docContent: extractedText,
          provider: provider,
          mode: 'analyzer'
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Có lỗi khi phân tích tài liệu')
      }

      const data = await res.json()
      
      // Parse JSON safely
      let parsed: Record<string, string> = {}
      try {
        let cleaned = data.suggestion.trim()
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.substring(7)
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.substring(3)
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.substring(0, cleaned.length - 3)
        }
        cleaned = cleaned.trim()
        parsed = JSON.parse(cleaned)
      } catch (parseErr) {
        console.error('Lỗi parse JSON:', parseErr, data.suggestion)
        throw new Error('Kết quả AI trả về không đúng định dạng cấu trúc JSON hành chính. Vui lòng thử lại!')
      }

      setAnalyzerResult(parsed)
    } catch (e: unknown) {
      setAnalyzerError(e instanceof Error ? e.message : 'Có lỗi không xác định')
    } finally {
      setAnalyzerLoading(false)
    }
  }

  const handleApplyAnalyzerResult = () => {
    if (!analyzerResult) return
    
    Object.entries(analyzerResult).forEach(([key, val]) => {
      if (val && typeof val === 'string') {
        dispatch({ type: 'SET_FIELD', field: key as keyof DocumentState, value: val })
      }
    })
  }

  const inputCls = 'w-full px-3 py-2 border-[1.5px] border-[#dde1ef] rounded-md text-xs font-[inherit] bg-white text-[#1a1f36] focus:outline-none focus:border-[#1a56b0] focus:ring-2 focus:ring-[#1a56b0]/10'

  return (
    <div className="space-y-4">
      {/* 1. Chọn Nhà cung cấp & Cấu hình API Key */}
      <div className="bg-white/80 p-3 rounded-lg border border-[#dde1ef] shadow-sm space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-[0.7rem] font-bold text-[#475569] uppercase tracking-wide">🧠 Cấu hình Trí tuệ nhân tạo</span>
        </div>
        <div className="flex gap-1.5">
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => setProvider(p.value)}
              style={provider === p.value ? { background: p.color, color: 'white', borderColor: p.color } : {}}
              className={`flex-1 py-1 text-[11px] font-bold rounded-md border-[1.5px] border-[#dde1ef] transition-all text-[#6b7597] hover:bg-slate-50`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div>
          {!isEditingKey[provider] && apiKeys[provider] ? (
            <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-md border border-slate-100 mt-1 font-sans">
              <span className="text-[#059669] font-semibold flex items-center gap-1">
                🔒 Đã lưu API Key ({provider === 'anthropic' ? 'Gemini Free' : provider === 'gemini' ? 'Gemini Paid' : 'DeepSeek'})
              </span>
              <button
                onClick={() => setIsEditingKey(prev => ({ ...prev, [provider]: true }))}
                className="text-[10px] text-[#1a56b0] hover:underline font-bold"
              >
                ✏️ Thay đổi
              </button>
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeys[provider]}
                  onChange={e => {
                    const val = e.target.value
                    setApiKeys(prev => ({ ...prev, [provider]: val }))
                  }}
                  placeholder={PROVIDERS.find(p => p.value === provider)!.placeholder}
                  className={`${inputCls} font-mono text-[10px] py-1.5 flex-1`}
                />
                <button
                  onClick={() => {
                    const val = apiKeys[provider].trim()
                    const p = PROVIDERS.find(x => x.value === provider)
                    if (p) {
                      localStorage.setItem(p.storageKey, val)
                    }
                    setIsEditingKey(prev => ({ ...prev, [provider]: false }))
                  }}
                  className="bg-[#10b981] hover:bg-[#059669] text-white font-bold text-[11px] px-3 py-1.5 rounded-md transition-colors"
                >
                  Lưu
                </button>
              </div>
              {provider === 'gemini' && !apiKeys.gemini && (
                <div className="text-[9px] text-[#059669] font-medium">✓ Đã kích hoạt key hệ thống trả phí của máy chủ. Bạn có thể sử dụng trực tiếp không cần cấu hình.</div>
              )}
              {provider === 'anthropic' && !apiKeys.anthropic && (
                <div className="text-[9px] text-[#059669] font-medium">✓ Đã kích hoạt API Gemini 2.5 Flash Lite Free hệ thống. Không cần nhập key.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Menu Tabs Tiêu đề */}
      <div className="flex border-b border-[#dde1ef] gap-1 overflow-x-auto scrollbar-none pb-0.5">
        <button
          onClick={() => setActiveTab('linter')}
          className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'linter' ? 'border-[#3b52bf] text-[#3b52bf]' : 'border-transparent text-[#6b7597] hover:text-[#475569]'
          }`}
        >
          🔍 Thể Thức
        </button>
        <button
          onClick={() => setActiveTab('transformer')}
          className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'transformer' ? 'border-[#3b52bf] text-[#3b52bf]' : 'border-transparent text-[#6b7597] hover:text-[#475569]'
          }`}
        >
          ✍️ Hành Chính
        </button>
        <button
          onClick={() => setActiveTab('structure')}
          className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'structure' ? 'border-[#3b52bf] text-[#3b52bf]' : 'border-transparent text-[#6b7597] hover:text-[#475569]'
          }`}
        >
          📊 Báo Cáo
        </button>
        <button
          onClick={() => setActiveTab('analyzer')}
          className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'analyzer' ? 'border-[#3b52bf] text-[#3b52bf]' : 'border-transparent text-[#6b7597] hover:text-[#475569]'
          }`}
        >
          📁 Phân Tích
        </button>
      </div>

      {/* 3. Nội dung Chi tiết theo Tab */}

      {/* Tab 1: LINTER (QUÉT THỂ THỨC) */}
      {activeTab === 'linter' && (
        <div className="space-y-3 animate-fade-in">
          <button
            onClick={runLinter}
            disabled={linterLoading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold bg-[#3b52bf] text-white hover:bg-[#2e409a] disabled:opacity-60 transition-colors shadow-sm"
          >
            {linterLoading ? '⏳ Đang quét thể thức...' : '🔍 Bắt đầu quét Thể thức & Chính tả'}
          </button>

          {linterError && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {linterError}
            </div>
          )}

          {linterIssues.length > 0 && (
            <div className="bg-white rounded-lg border border-[#dde4f5] shadow-sm overflow-hidden">
              <div className="bg-[#f8fafc] px-3 py-1.5 border-b border-[#e2e8f0] flex justify-between items-center text-[10px] font-bold text-[#475569]">
                <span>Phát hiện {linterIssues.length} vấn đề thể thức</span>
                <span className="bg-red-500 text-white rounded-full px-2 py-0.5">{linterIssues.filter(x => x.type === 'error').length} lỗi</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#f1f5f9]">
                {linterIssues.map((issue, idx) => (
                  <div key={idx} className={`p-3 space-y-1.5 transition-opacity ${fixedIndices.has(idx) ? 'opacity-50 bg-green-50/30' : ''}`}>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-[#1e293b] text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                        📌 {issue.field}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${issue.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                        {issue.type === 'error' ? 'Lỗi nghiêm trọng' : 'Khuyến nghị'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#475569] leading-relaxed">
                      {issue.reason || `Phát hiện lỗi định dạng/chính tả.`}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-red-600 line-through shrink-0 font-mono font-medium">{issue.description}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-green-700 font-bold shrink-0 font-mono bg-green-50 px-1 py-0.5 rounded border border-green-100">{issue.suggestion}</span>
                      
                      {fixedIndices.has(idx) ? (
                        <span className="text-[10px] text-green-600 font-bold ml-auto">✅ Đã sửa</span>
                      ) : (
                        <button
                          onClick={() => fixLinterIssue(idx, issue)}
                          className="text-[10px] bg-[#1a56b0] text-white hover:bg-[#1345a0] px-2.5 py-0.5 rounded font-bold transition-all ml-auto"
                        >
                          Sửa tự động
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!linterLoading && linterIssues.length === 0 && (
            <div className="text-center py-6 text-xs text-[#6b7597] bg-white rounded-lg border border-dashed border-[#dde1ef] font-medium">
              Chưa thực hiện quét hoặc văn bản đã chuẩn thể thức.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: STYLE TRANSFORMER (HÀNH CHÍNH HÓA VĂN BẢN) */}
      {activeTab === 'transformer' && (
        <div className="space-y-3 animate-fade-in">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7597] mb-1">
              Nhập ý kiến thô, văn nói hoặc ghi chép nháp của bạn:
            </label>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={4}
              placeholder="Ví dụ: sếp bảo tuần sau phải nộp xong cái kế hoạch chuyển đổi số để còn gửi lên tỉnh..."
              className={`${inputCls} resize-y leading-relaxed text-xs`}
            />
          </div>

          <button
            onClick={runTransformer}
            disabled={transformLoading || !rawText.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-50 transition-colors shadow-sm"
          >
            {transformLoading ? '⏳ Đang chuyển đổi sang văn phong công vụ...' : '✍️ Chuyển đổi sang Văn phong Công vụ'}
          </button>

          {transformError && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {transformError}
            </div>
          )}

          {transformResult && (
            <div className="bg-white rounded-lg border border-[#c3d0f5] shadow-sm overflow-hidden animate-slide-up">
              <div className="bg-[#f0f4ff] px-3 py-2 flex justify-between items-center border-b border-[#dde4f5] text-[10px] font-bold text-[#3b52bf]">
                <span>✨ Văn bản đã hành chính hóa</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => navigator.clipboard.writeText(transformResult)}
                    className="text-[10px] bg-indigo-100 text-[#4f46e5] px-2 py-1 rounded font-bold hover:bg-indigo-200 transition-colors"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => handleApplyText(transformResult)}
                    className="text-[10px] bg-[#1a56b0] text-white px-2 py-1 rounded font-bold hover:bg-[#1345a0] transition-colors"
                  >
                    Thay thế hoàn toàn
                  </button>
                  <button
                    onClick={() => handleApplyText(transformResult, true)}
                    className="text-[10px] bg-[#059669] text-white px-2 py-1 rounded font-bold hover:bg-[#047857] transition-colors"
                  >
                    + Nối tiếp cuối
                  </button>
                </div>
              </div>
              <div className="p-3 text-xs text-[#374151] whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {transformResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: CẤU TRÚC BÁO CÁO 3 PHẦN */}
      {activeTab === 'structure' && (
        <div className="space-y-3.5 animate-fade-in">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7597] mb-1.5">
              Chọn phần báo cáo bạn muốn viết:
            </label>
            <div className="flex gap-1">
              {[
                { id: 1, label: '1. Căn cứ/Tình hình' },
                { id: 2, label: '2. Kết quả/Hạn chế' },
                { id: 3, label: '3. Nhiệm vụ/Đề xuất' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePart(p.id)
                    setStructureResult('')
                  }}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded border transition-all ${
                    activePart === p.id
                      ? 'bg-[#3b52bf] text-white border-[#3b52bf]'
                      : 'bg-white text-[#6b7597] border-[#dde1ef] hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách từ ngữ chuyển đoạn */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold text-[#475569] uppercase tracking-wide">
              💡 Click để chọn cụm từ chuyển đoạn NĐ 30 chuẩn:
            </span>
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-0.5">
              {PART_STARTERS[activePart].map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => generateStructureDraft(phrase.text)}
                  disabled={structureLoading}
                  className="text-left p-2 bg-white hover:bg-slate-50 rounded border border-[#dde1ef] hover:border-[#b4c6ef] text-[11px] transition-all flex flex-col gap-0.5 active:scale-[0.99]"
                >
                  <span className="text-[#1e293b] text-[11.5px] leading-snug font-normal" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{phrase.text}</span>
                  <span className="text-[9px] text-[#6b7597] italic" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{phrase.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nhập ý thô đi kèm */}
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7597] mb-1">
              Mô tả nhanh ý định của bạn cho đoạn văn (tùy chọn):
            </label>
            <textarea
              value={structurePrompt}
              onChange={e => setStructurePrompt(e.target.value)}
              rows={2}
              placeholder="Ví dụ: báo cáo việc trích nộp đóng BHXH của doanh nghiệp tăng cao 15% so với cùng kỳ..."
              className={`${inputCls} resize-y text-xs`}
            />
            <div className="text-[9px] text-[#9ca3af] mt-0.5">Nếu để trống, AI sẽ tự động tạo cấu trúc mẫu chuẩn mực giúp bạn.</div>
          </div>

          {structureError && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {structureError}
            </div>
          )}

          {structureResult && (
            <div className="bg-white rounded-lg border border-[#c3d0f5] shadow-sm overflow-hidden animate-slide-up">
              <div className="bg-[#f0f4ff] px-3 py-2 flex justify-between items-center border-b border-[#dde4f5] text-[10px] font-bold text-[#3b52bf]">
                <span>📊 Đoạn văn đã dựng theo cấu trúc</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => navigator.clipboard.writeText(structureResult)}
                    className="text-[10px] bg-indigo-100 text-[#4f46e5] px-2 py-1 rounded font-bold hover:bg-indigo-200 transition-colors"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => handleApplyText(structureResult, true)}
                    className="text-[10px] bg-[#059669] text-white px-2 py-1 rounded font-bold hover:bg-[#047857] transition-colors"
                  >
                    + Ghép vào nội dung chính
                  </button>
                </div>
              </div>
              <div className="p-3 text-[11px] text-[#374151] whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed font-normal" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {structureResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: PHÂN TÍCH TÀI LIỆU & TẠO MỚI */}
      {activeTab === 'analyzer' && (
        <div className="space-y-4 animate-fade-in">
          {/* File Upload Zone */}
          {!attachedFile && !extractLoading && (
            <label className="border-2 border-dashed border-[#c3d0f5] hover:border-[#3b52bf] rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/50 hover:bg-[#3b52bf]/5 transition-all duration-200 group active:scale-[0.99]">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".docx,.xlsx,.doc,.xls,.pdf"
                className="hidden"
                disabled={extractLoading}
              />
              <div className="p-3 rounded-full bg-[#3b52bf]/10 group-hover:bg-[#3b52bf]/20 transition-colors">
                <svg className="w-6 h-6 text-[#3b52bf]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-[#1e293b] group-hover:text-[#3b52bf] transition-colors">Kéo thả tài liệu hoặc click để chọn</p>
                <p className="text-[10px] text-[#6b7597] mt-1 font-medium">Hỗ trợ DOCX, XLSX, DOC, XLS, PDF</p>
              </div>
            </label>
          )}

          {/* Text Extracting Indicator */}
          {extractLoading && (
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-[#dde1ef] gap-2.5 animate-pulse">
              <div className="w-8 h-8 rounded-full border-[3px] border-[#3b52bf]/20 border-t-[#3b52bf] animate-spin" />
              <p className="text-[11px] font-bold text-[#475569]">Đang trích xuất nội dung từ file...</p>
            </div>
          )}

          {extractError && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              ⚠️ {extractError}
            </div>
          )}

          {/* Attached File Preview */}
          {attachedFile && !extractLoading && (
            <div className="flex items-center gap-3 p-3 bg-white border border-[#dde1ef] rounded-xl shadow-sm relative overflow-hidden group">
              <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                attachedFile.name.endsWith('.pdf') ? 'bg-red-500' :
                (attachedFile.name.endsWith('.xlsx') || attachedFile.name.endsWith('.xls')) ? 'bg-green-500' : 'bg-blue-500'
              }`} />
              
              <div className="pl-1 shrink-0">
                {attachedFile.name.endsWith('.pdf') ? (
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                ) : (attachedFile.name.endsWith('.xlsx') || attachedFile.name.endsWith('.xls')) ? (
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#1e293b] truncate" title={attachedFile.name}>{attachedFile.name}</p>
                <p className="text-[9px] text-[#6b7597] font-medium mt-0.5">
                  {(attachedFile.size / 1024).toFixed(1)} KB • {extractedText ? 'Đã tải thành công ✓' : 'Chưa đọc được dữ liệu'}
                </p>
              </div>
              
              <button
                onClick={() => {
                  setAttachedFile(null)
                  setExtractedText('')
                  setExtractError('')
                  setAnalyzerResult(null)
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Xóa file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          {/* User Prompt Textarea */}
          <div>
            <label className="block text-[11px] font-bold text-[#6b7597] mb-1.5 flex items-center gap-1">
              📝 Yêu cầu soạn thảo văn bản:
            </label>
            <textarea
              value={analyzerPrompt}
              onChange={e => setAnalyzerPrompt(e.target.value)}
              rows={4}
              placeholder="Nhập hướng dẫn viết văn bản từ file đính kèm...
Ví dụ: Gợi ý viết nội dung file đính kèm theo Chủ đề: 'Phát huy sức mạnh văn hóa con người Đồng Tháp; đề cao trách nhiệm của cán bộ, đảng viên...'"
              className={`${inputCls} resize-y leading-relaxed text-xs`}
            />
          </div>

          {/* Error Message */}
          {analyzerError && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              ⚠️ {analyzerError}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={runDocumentAnalyzer}
            disabled={analyzerLoading || extractLoading || !attachedFile || !analyzerPrompt.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#1a56b0] to-[#3b52bf] text-white hover:from-[#1345a0] hover:to-[#2e409a] disabled:opacity-50 transition-all duration-200 shadow-md transform hover:translate-y-[-1px] active:translate-y-[0px] cursor-pointer"
          >
            {analyzerLoading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <span>⏳ Đang phân tích &amp; Soạn thảo...</span>
              </>
            ) : (
              <>
                <span>⚡ Phân tích &amp; Soạn thảo văn bản</span>
              </>
            )}
          </button>

          {/* Analyzer Suggestion Result Block */}
          {analyzerResult && (
            <div className="bg-white rounded-xl border border-[#c3d0f5] shadow-md overflow-hidden animate-slide-up space-y-0.5">
              <div className="bg-[#f0f4ff] p-3 flex justify-between items-center border-b border-[#dde4f5]">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-[#1a56b0]">✨ Văn bản soạn thảo thành công!</span>
                  <span className="text-[9px] text-[#6b7597] font-medium mt-0.5">Đã tạo cấu trúc văn bản chi tiết</span>
                </div>
                <button
                  onClick={handleApplyAnalyzerResult}
                  className="text-[10px] bg-[#10b981] text-white hover:bg-[#059669] px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1 active:scale-[0.97]"
                >
                  <span>⚡ Áp dụng tất cả</span>
                </button>
              </div>
              
              <div className="p-3 space-y-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
                {/* Thể loại */}
                {analyzerResult.docType && (
                  <div className="pt-2 first:pt-0">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1">Thể loại</span>
                    <span className="text-[10px] font-bold text-[#1e293b] bg-slate-50 px-2 py-1 rounded border border-slate-100 uppercase">{analyzerResult.docType}</span>
                  </div>
                )}
                
                {/* Trích yếu */}
                {analyzerResult.docSummary && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1 font-sans">Trích yếu nội dung</span>
                    <span className="text-xs font-bold text-[#374151] leading-relaxed block" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{analyzerResult.docSummary}</span>
                  </div>
                )}
                
                {/* Kính gửi */}
                {analyzerResult.recipient && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1 font-sans">Kính gửi</span>
                    <span className="text-xs text-[#374151] block font-medium" style={{ fontFamily: '"Times New Roman", Times, serif' }}>{analyzerResult.recipient}</span>
                  </div>
                )}
                
                {/* Căn cứ */}
                {analyzerResult.legalBasis && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1 font-sans">Căn cứ pháp lý</span>
                    <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {analyzerResult.legalBasis}
                    </p>
                  </div>
                )}

                {/* Đặt vấn đề */}
                {analyzerResult.issueStatement && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1 font-sans">Câu đặt vấn đề</span>
                    <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {analyzerResult.issueStatement}
                    </p>
                  </div>
                )}
                
                {/* Nội dung chính */}
                {analyzerResult.mainContent && (
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-1 font-sans">
                      <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold">Nội dung chính</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(analyzerResult.mainContent)}
                        className="text-[9px] bg-slate-100 hover:bg-slate-200 text-[#475569] px-2 py-0.5 rounded font-medium border border-slate-200 transition-colors"
                      >
                        📋 Copy nội dung
                      </button>
                    </div>
                    <p className="text-xs text-[#1e293b] leading-relaxed whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100 max-h-48 overflow-y-auto" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {analyzerResult.mainContent}
                    </p>
                  </div>
                )}
                
                {/* Kết luận */}
                {analyzerResult.conclusion && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1 font-sans">Kết luận / Yêu cầu</span>
                    <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {analyzerResult.conclusion}
                    </p>
                  </div>
                )}

                {/* Nơi nhận */}
                {analyzerResult.recipientsCc && (
                  <div className="pt-2">
                    <span className="text-[9px] uppercase tracking-wide text-[#7b8abf] font-bold block mb-1 font-sans">Nơi nhận</span>
                    <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                      {analyzerResult.recipientsCc}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
