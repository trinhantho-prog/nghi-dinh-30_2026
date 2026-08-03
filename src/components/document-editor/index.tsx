'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentState, Agency, Signer, AIIssue, MainContentBlock } from '@/types'
import { useDocumentReducer } from './useDocumentReducer'
import Sidebar from './Sidebar'
import A4Preview from './A4Preview'
import { exportDocx } from './exportDocx'
import { saveDocument, saveVersion, deleteVersion } from '@/lib/actions/documents'
import { parseTabularText, getEffectiveMainContentBlocks, plainTextToMainContentBlocks } from './mainContentBlocks'

interface DocVersion {
  id: string
  created_at: string
  snapshot: DocumentState
}

interface DocumentEditorProps {
  documentId?: string
  initialData?: Partial<DocumentState>
  initialVersions?: DocVersion[]
  agencies: Agency[]
  signers: Signer[]
  documentCount: number
}

export default function DocumentEditor({
  documentId,
  initialData,
  initialVersions = [],
  agencies,
  signers,
  documentCount,
}: DocumentEditorProps) {
  const router = useRouter()

  const defaultAgency = agencies?.[0]
  const defaultSigner = signers?.[0]

  const defaultConfig: Partial<DocumentState> = {
    ...(defaultAgency ? {
      agencyUpper: defaultAgency.upper,
      agencyMain: defaultAgency.main,
      location: defaultAgency.location,
      docSymbol: defaultAgency.suffix ? defaultAgency.suffix.replace(/^\//, '') : '',
    } : {}),
    ...(defaultSigner ? {
      signPosition: defaultSigner.position,
      signName: defaultSigner.name,
    } : {}),
  }

  const mergedInitial = {
    ...defaultConfig,
    ...initialData,
  }

  const [state, dispatch] = useDocumentReducer(mergedInitial)
  const [versions, setVersions] = useState<DocVersion[]>(initialVersions)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [aiIssues, setAiIssues] = useState<AIIssue[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const currentDocIdRef = useRef<string | undefined>(documentId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-save debounce 1.5s
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const id = await saveDocument(state, currentDocIdRef.current)
      if (id) {
        try {
          localStorage.setItem(`doc_${id}`, JSON.stringify(state))
        } catch (e) {}
        if (!currentDocIdRef.current) {
          currentDocIdRef.current = id
          router.replace(`/documents/${id}`, { scroll: false })
        }
      }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  }, [state])


  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSaveVersion() {
    if (!currentDocIdRef.current) {
      showToast('Lưu văn bản trước khi tạo phiên bản')
      return
    }
    if (versions.length >= 99) {
      showToast('Đã đạt giới hạn 99 phiên bản')
      return
    }
    setIsSaving(true)
    try {
      const newVersion = await saveVersion(currentDocIdRef.current, state)
      if (newVersion) {
        setVersions(prev => [newVersion, ...prev])
        showToast('Đã lưu phiên bản ✓')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLoadVersion(versionId: string) {
    const v = versions.find(v => v.id === versionId)
    if (v) {
      dispatch({ type: 'LOAD', state: v.snapshot })
      showToast('Đã tải phiên bản ✓')
    }
  }

  async function handleDeleteVersion(versionId: string) {
    await deleteVersion(versionId)
    setVersions(prev => prev.filter(v => v.id !== versionId))
    showToast('Đã xóa phiên bản')
  }

  // AI Copilot States
  const [copilotInstruction, setCopilotInstruction] = useState('')
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotResult, setCopilotResult] = useState('')
  const [copilotError, setCopilotError] = useState('')

  async function runAICopilot() {
    if (!copilotInstruction.trim()) return
    setCopilotLoading(true)
    setCopilotError('')
    setCopilotResult('')
    
    try {
      const activeProvider = localStorage.getItem('ai-active-provider') || 'gemini'
      let storageKey = 'ai-gemini-key'
      if (activeProvider === 'deepseek') storageKey = 'ai-deepseek-key'
      else if (activeProvider === 'anthropic') storageKey = 'ai-anthropic-key'
      
      const apiKey = localStorage.getItem(storageKey) || ''
      
      const prompt = `Yêu cầu chỉnh sửa từ người dùng: ${copilotInstruction.trim()}

Nội dung văn bản gốc hiện tại:
"""
${state.mainContent.trim()}
"""

Nhiệm vụ:
Hãy thực hiện yêu cầu chỉnh sửa ở trên đối với nội dung văn bản gốc đã cho.
QUY TẮC PHẠM VI ĐẦU RA PHẢN HỒI (RẤT QUAN TRỌNG):
1. Nếu yêu cầu chỉnh sửa chỉ nhắm vào một mục cụ thể, một đoạn cụ thể, hoặc yêu cầu viết chi tiết/viết thêm/sửa đổi một phần riêng biệt (ví dụ: "viết chi tiết hơn ở riêng mục V", "sửa đoạn 2", "viết thêm mục căn cứ"...): Bạn CHỈ ĐƯỢC PHÉP trả về đúng nội dung chi tiết của riêng phần/mục/đoạn được yêu cầu đó sau khi đã được nâng cấp, gọt giũa và sửa lỗi chính tả theo văn phong hành chính. TUYỆT ĐỐI KHÔNG trả lại toàn bộ văn bản gốc hay sao chép lại các mục khác không liên quan.
2. Nếu yêu cầu chỉnh sửa mang tính tổng thể cho toàn bộ văn bản (ví dụ: "sửa lỗi chính tả cả văn bản", "chuyển cả bài sang văn phong công văn"): Bạn mới được trả lại toàn bộ văn bản đã xử lý.

QUY TẮC ĐỊNH DẠNG ĐẦU RA (BẮT BUỘC):
Khi liệt kê các ý kiến, luận điểm, giải pháp, nhiệm vụ hoặc các biện pháp thực hiện dưới mục/đoạn văn: Bạn BẮT BUỘC phải bắt đầu mỗi ý bằng dấu gạch đầu dòng dạng "- " (ví dụ: "- Thường xuyên tu dưỡng...\\n- Chủ động rà soát..."). TUYỆT ĐỐI KHÔNG bắt đầu bằng số thứ tự 1, 2, 3, 4, 5... để liệt kê các ý này trừ khi người dùng có yêu cầu chỉ đích danh việc đánh số.

Đầu ra viết bằng văn phong công vụ, hành chính, nghiêm túc, chặt chẽ của cơ quan Nhà nước Việt Nam. Kết quả đầu ra CHỈ chứa nội dung văn bản hành chính mới đã được xử lý xong theo đúng phạm vi và định dạng nêu trên, KHÔNG chứa bất kỳ lời dẫn giải thích, lời chào hay định dạng markdown bổ sung bên ngoài nào khác.`

      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          prompt: prompt,
          provider: activeProvider,
          mode: 'transform'
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Có lỗi khi chạy AI Copilot')
      }

      const data = await res.json()
      setCopilotResult(data.suggestion)
    } catch (err: unknown) {
      setCopilotError(err instanceof Error ? err.message : 'Có lỗi không xác định')
    } finally {
      setCopilotLoading(false)
    }
  }

  function handleNewDocument() {
    currentDocIdRef.current = undefined
    dispatch({ type: 'RESET', initialConfig: defaultConfig })
    setVersions([])
    router.push('/documents/new')
  }

  async function handleExportDocx() {
    await exportDocx(state)
  }

  function handleWordDoubleClick(word: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const text = textarea.value
    const index = text.indexOf(word)
    if (index === -1) return
    textarea.focus()
    textarea.setSelectionRange(index, index + word.length)
    const textBefore = text.substring(0, index)
    const linesBefore = (textBefore.match(/\n/g) || []).length
    textarea.scrollTop = Math.max(0, linesBefore * 24 - textarea.clientHeight / 3)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        state={state}
        dispatch={dispatch}
        agencies={agencies.length > 0 ? agencies : [{ upper: state.agencyUpper, main: state.agencyMain, location: state.location }]}
        signers={signers.length > 0 ? signers : [{ position: 'GIÁM ĐỐC', name: '' }, { position: 'PHÓ GIÁM ĐỐC', name: '' }]}
        onSave={handleSaveVersion}
        onNewDocument={handleNewDocument}
        onExportDocx={handleExportDocx}
        versions={versions}
        onLoadVersion={handleLoadVersion}
        onDeleteVersion={handleDeleteVersion}
        isSaving={isSaving}
        documentCount={documentCount}
        onIssuesChange={setAiIssues}
      />

      {/* Workspace: 50% editor | 50% preview */}
      <main className="flex-1 overflow-hidden flex" style={{ background: 'radial-gradient(ellipse at 60% 40%, #d6ddf0 0%, #c8d0e8 100%)' }}>
        {/* Left: Nội dung chính editor */}
        <div className="w-1/2 flex flex-col border-r border-[#c8d0e8] overflow-hidden">
          <div className="px-5 py-3 bg-white/60 border-b border-[#c8d0e8] shrink-0">
            <h2 className="text-sm font-bold text-[#1a56b0]">4. Nội dung chính</h2>
          </div>
          <textarea
            ref={textareaRef}
            value={state.mainContent}
            onChange={e => dispatch({ type: 'SET_FIELD', field: 'mainContent', value: e.target.value })}
            className="flex-1 w-full p-5 resize-none text-[0.9rem] leading-relaxed bg-white/80 focus:outline-none focus:bg-white transition-colors"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            placeholder="Nhập nội dung chính của văn bản..."
          />

          {state.mainContent?.trim() && (
            <div className="p-4 bg-[#f8fafc] border-t border-[#c8d0e8] shrink-0 space-y-3 shadow-inner">
              <div className="flex items-center gap-1.5 text-[#1e293b]">
                <span className="text-sm">⚡</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">AI Copilot - Nâng cấp Nội dung</span>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={copilotInstruction}
                  onChange={e => setCopilotInstruction(e.target.value)}
                  placeholder="Yêu cầu AI viết thêm ý, sửa đổi hoặc viết ngắn gọn các ý..."
                  className="flex-1 px-3 py-2 border-[1.5px] border-[#dde1ef] rounded-lg text-xs bg-white text-[#1a1f36] focus:outline-none focus:border-[#1a56b0] focus:ring-2 focus:ring-[#1a56b0]/10"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !copilotLoading && copilotInstruction.trim()) {
                      runAICopilot()
                    }
                  }}
                />
                <button
                  onClick={runAICopilot}
                  disabled={copilotLoading || !copilotInstruction.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-[#1a56b0] to-[#3b52bf] hover:from-[#1345a0] hover:to-[#2e409a] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-[0.98] shrink-0"
                >
                  {copilotLoading ? '⏳ Đang viết...' : '⚡ Gửi yêu cầu'}
                </button>
              </div>

              {copilotError && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {copilotError}
                </div>
              )}

              {copilotResult && (
                <div className="bg-white rounded-lg border border-[#c3d0f5] shadow-md overflow-hidden animate-slide-up">
                  <div className="bg-[#f0f4ff] p-2 flex justify-between items-center border-b border-[#dde4f5]">
                    <span className="text-[10px] font-bold text-[#3b52bf] flex items-center gap-1">✨ Đề xuất AI</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(copilotResult)
                          showToast('Đã sao chép đề xuất AI vào bộ nhớ tạm ✓')
                        }}
                        className="text-[10px] bg-[#1a56b0] text-white px-3 py-1.5 rounded font-bold hover:bg-[#1345a0] transition-colors flex items-center gap-1 active:scale-[0.97]"
                      >
                        📋 Sao chép
                      </button>
                      <button
                        onClick={() => setCopilotResult('')}
                        className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-semibold hover:bg-slate-200 transition-colors"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                  <div className="p-3 text-xs text-[#374151] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                    {copilotResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Right: A4 Preview */}
        <div className="w-1/2 overflow-y-auto py-10 px-8 flex justify-center">
          <A4Preview state={state} highlightWords={aiIssues.map(i => i.description).filter(d => d && d.length >= 2 && d.length <= 60)} onWordDoubleClick={handleWordDoubleClick} />
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1f36] text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
