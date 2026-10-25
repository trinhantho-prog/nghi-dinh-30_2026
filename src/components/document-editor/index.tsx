'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocumentState, Agency, Signer } from '@/types'
import { useDocumentReducer } from './useDocumentReducer'
import Sidebar from './Sidebar'
import EditorWorkspace from './EditorWorkspace'
import { createDocxBlob, exportDocx } from './exportDocx'
import { saveAs } from 'file-saver'
import { chooseSaveFile, docxFilename, writeSaveFile } from '@/lib/local-file'
import { saveDocument, saveVersion, deleteVersion } from '@/lib/actions/documents'
import { saveBrowserDocument, saveBrowserVersion, deleteBrowserVersion } from '@/lib/storage/browser-documents'
import MainContentEditor from './MainContentEditor'
import { readAIConfig } from '@/lib/ai-config'
import type { DriveSource } from '@/lib/drive-document'
import { useDriveAutosave } from '@/components/google-drive/useDriveAutosave'

interface DocVersion {
  id: string
  created_at: string
  snapshot: DocumentState
}

interface DocumentEditorProps {
  storageMode?: 'browser' | 'cloud'
  documentId?: string
  initialData?: Partial<DocumentState>
  initialVersions?: DocVersion[]
  agencies: Agency[]
  signers: Signer[]
  documentCount: number
  driveSource?: DriveSource
  driveInitialDirty?: boolean
  localFileName?: string
}

export default function DocumentEditor({
  storageMode = 'cloud',
  documentId,
  initialData,
  initialVersions = [],
  agencies,
  signers,
  documentCount,
  driveSource,
  driveInitialDirty,
  localFileName,
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
  const [saveError, setSaveError] = useState('')
  const [savedState, setSavedState] = useState(initialData ? JSON.stringify(mergedInitial) : '')
  const [fileSaving, setFileSaving] = useState(false)
  const [fileError, setFileError] = useState('')
  const [savedFileState, setSavedFileState] = useState('')
  const [savedFileName, setSavedFileName] = useState(localFileName || '')
  const fileDirty = Boolean(localFileName) && savedFileState !== JSON.stringify(state)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const currentDocIdRef = useRef<string | undefined>(documentId)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const editorRef = useRef<HTMLDivElement>(null)
  const drive = useDriveAutosave(state, driveSource, driveInitialDirty)

  const persistDocument = useCallback((snapshot: DocumentState) => {
    const request = saveQueueRef.current.catch(() => {}).then(async () => {
      const id = storageMode === 'browser'
        ? saveBrowserDocument(snapshot, currentDocIdRef.current)
        : await saveDocument(snapshot, currentDocIdRef.current)
      const isNew = !currentDocIdRef.current
      currentDocIdRef.current = id
      setSavedState(JSON.stringify(snapshot))
      setSaveError('')
      // Keep this editor mounted while adopting the saved URL, including on Vercel.
      if (isNew) window.history.replaceState(null, '', `/documents/${id}`)
      return id
    })
    saveQueueRef.current = request
    return request
  }, [storageMode])

  // Auto-save debounce 1.5s
  useEffect(() => {
    if (driveSource || localFileName) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try { await persistDocument(state) }
      catch { setSaveError('Chưa lưu được văn bản. Hãy kiểm tra kết nối hoặc dung lượng trình duyệt, rồi bấm Lưu để thử lại.') }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  }, [state, driveSource, localFileName, persistDocument])

  useEffect(() => {
    if (!fileDirty && (driveSource || localFileName || savedState === JSON.stringify(state))) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [fileDirty, driveSource, localFileName, savedState, state])


  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSaveVersion() {
    if (localFileName) { await handleSaveAs(); return }
    if (driveSource) { await drive.flush(); return }
    setIsSaving(true)
    try {
      // 1. Always save the document first so it persists in DB (Supabase / local DB)
      clearTimeout(saveTimerRef.current)
      const id = await persistDocument(state)

      const activeDocId = id || currentDocIdRef.current
      if (!activeDocId) {
        showToast('Không thể lưu văn bản')
        return
      }

      if (versions.length >= 99) {
        showToast('Đã lưu văn bản. Đạt giới hạn 99 phiên bản.')
        return
      }

      // 2. Save version snapshot
      const newVersion = storageMode === 'browser' ? saveBrowserVersion(activeDocId, state) : await saveVersion(activeDocId, state)
      if (newVersion) {
        setVersions(prev => [newVersion, ...prev])
        showToast('Đã lưu văn bản & phiên bản ✓')
      } else {
        showToast('Đã lưu văn bản ✓')
      }
    } catch {
      setSaveError('Không lưu được văn bản hoặc phiên bản. Vui lòng thử lại hoặc dùng File Save As để lưu bản Word.')
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
    try {
      if (storageMode === 'browser') deleteBrowserVersion(versionId)
      else await deleteVersion(versionId)
      setVersions(prev => prev.filter(v => v.id !== versionId))
      showToast('Đã xóa phiên bản')
    } catch { setSaveError('Không xóa được phiên bản. Vui lòng thử lại.') }
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
      const { provider: activeProvider, apiKey } = readAIConfig()

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
        throw new Error(err.error || 'Có lỗi khi chạy AI Nâng cấp Nội dung')
      }

      const data = await res.json()
      setCopilotResult(data.suggestion)
    } catch (err: unknown) {
      setCopilotError(err instanceof Error ? err.message : 'Có lỗi không xác định')
    } finally {
      setCopilotLoading(false)
    }
  }

  async function handleNewDocument() {
    if (fileDirty && !window.confirm('Có thay đổi chưa lưu vào máy. Bạn có muốn tạo văn bản mới?')) return
    if (localFileName) { router.push('/documents/new'); return }
    if (driveSource) {
      if (await drive.flush()) router.push('/documents/new')
      return
    }
    clearTimeout(saveTimerRef.current)
    try { await persistDocument(state) }
    catch { setSaveError('Chưa lưu được văn bản hiện tại. Vui lòng bấm Lưu để thử lại trước khi tạo văn bản mới.'); return }
    currentDocIdRef.current = undefined
    setSavedState('')
    dispatch({ type: 'RESET', initialConfig: defaultConfig })
    setVersions([])
    router.push('/documents/new')
  }

  async function handleExportDocx() {
    await exportDocx(state)
  }

  async function handleSaveAs() {
    if (fileSaving) return
    setFileSaving(true)
    setFileError('')
    const snapshot = JSON.stringify(state)
    try {
      const suggestedName = savedFileName || state.docSummary || 'van-ban'
      const selection = chooseSaveFile(suggestedName)
      if (selection) {
        const handle = await selection
        await writeSaveFile(handle, await createDocxBlob(state))
        if (handle.name) setSavedFileName(handle.name)
        setSavedFileState(snapshot)
        showToast('Đã lưu file Word vào máy ✓')
      } else {
        const name = window.prompt('Tên file Word cần lưu (trình duyệt sẽ tải file xuống):', docxFilename(suggestedName))
        if (!name?.trim()) return
        const filename = docxFilename(name)
        saveAs(await createDocxBlob(state), filename)
        setSavedFileName(filename)
        // A download does not confirm that the browser finished saving the file.
        showToast('Đã gửi file Word tới trình tải xuống. Kiểm tra file đã tải.')
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setFileError(error instanceof Error ? error.message : 'Không thể lưu file. Vui lòng thử lại.')
    } finally { setFileSaving(false) }
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden" onInputCapture={drive.markEdited} onClickCapture={async event => {
      drive.markEdited()
      if (driveSource || localFileName || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const link = (event.target as HTMLElement).closest('a')
      if (!link || !link.getAttribute('href')?.startsWith('/') || link.target === '_blank') return
      event.preventDefault()
      event.stopPropagation()
      clearTimeout(saveTimerRef.current)
      try { await persistDocument(state); router.push(link.getAttribute('href')!) }
      catch { setSaveError('Chưa lưu được văn bản. Vui lòng thử lưu lại trước khi rời trang.') }
    }} onPasteCapture={drive.markEdited}>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-700">
        <Link href="/dashboard" className="font-semibold text-blue-700">← Văn bản</Link>
        <Link href="/documents/local" className="rounded border border-slate-300 px-3 py-2 font-semibold">Mở file từ máy</Link>
        <button disabled={fileSaving} onClick={() => { void handleSaveAs() }} className="rounded bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{fileSaving ? 'Đang lưu file...' : 'File Save As'}</button>
        {localFileName && <span role="status" className="min-w-0 flex-1 break-words">{localFileName} · {fileDirty ? 'Chưa lưu bản chỉnh sửa vào máy' : 'Đã lưu vào máy'}</span>}
        <Link href="/profile" className="ml-auto font-semibold text-blue-700">Hồ sơ người dùng</Link>
        {!driveSource && !localFileName && <span role="status">{saveError ? 'Chưa lưu được' : savedState === JSON.stringify(state) ? (storageMode === 'browser' ? 'Đã lưu trên trình duyệt' : 'Đã lưu vào tài khoản') : 'Đang chờ lưu…'}</span>}
        {fileError && <p role="alert" className="w-full text-red-700">{fileError}</p>}
      </div>
      {driveSource && <div className="shrink-0 border-b border-blue-200 bg-blue-50 px-5 py-2 text-xs text-[#1a1f36]">
        <div className="flex flex-wrap items-center gap-3"><strong className="mr-auto">Google Drive: {driveSource.name}</strong><span role="status">{drive.status}</span><button className="font-semibold text-blue-700 underline" onClick={() => { void drive.flush() }}>Lưu ngay / Thử lại</button><button className="font-semibold text-blue-700 underline" onClick={async () => { if (await drive.flush()) router.push('/drive') }}>← Về Drive</button></div>
        {drive.error && <p role="alert" className="mt-1 text-red-700">{drive.error} <a className="underline" href="/api/drive/connect" target="_blank" rel="noopener noreferrer">Kết nối lại Drive</a> · <button className="underline" onClick={() => window.location.reload()}>Mở lại bản trên Drive</button> · Có thể xuất DOCX để giữ bản đang sửa.</p>}
        {drive.warning && <p role="alert" className="mt-1 text-amber-800">{drive.warning}</p>}
      </div>}
      <EditorWorkspace state={state} sidebar={
      state.sourceLayout && !state.sourceSections ? <div className="flex h-full flex-col gap-4 overflow-auto border-r border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <h2 className="font-bold text-blue-800">Giữ bố cục file gốc</h2>
        <p>Khổ trang, lề, đầu trang, chữ ký và định dạng bảng được lấy từ tài liệu đã mở.</p>
        <p>Chỉnh sửa đầu trang, nội dung và chữ ký trực tiếp trong các đoạn văn và ô bảng ở phần soạn thảo.</p>
        <button onClick={handleSaveVersion} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">{driveSource ? 'Lưu Google Drive' : 'File Save As'}</button>
        <button onClick={handleNewDocument} className="rounded border border-slate-300 px-4 py-2">Tạo văn bản mới theo mẫu</button>
      </div> : <Sidebar
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
        isDriveDocument={Boolean(driveSource)}
        isLocalDocument={Boolean(localFileName)}
      />
      }>
          <div className="px-5 py-3 bg-white/60 border-b border-[#c8d0e8] shrink-0">
            <h2 className="text-sm font-bold text-[#1a56b0]">4. Nội dung chính</h2>
          </div>
          <MainContentEditor state={state} editorRef={editorRef} onChange={blocks => dispatch({ type: 'SET_CONTENT_BLOCKS', blocks })} />

          {state.mainContent?.trim() && (
            <div className="p-4 bg-[#f8fafc] border-t border-[#c8d0e8] shrink-0 space-y-3 shadow-inner">
              <div className="flex items-center gap-1.5 text-[#1e293b]">
                <span className="text-sm">⚡</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">AI Nâng cấp Nội dung</span>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={copilotInstruction}
                  onChange={e => setCopilotInstruction(e.target.value)}
                  placeholder="Yêu cầu AI viết thêm ý, sửa đổi hoặc viết ngắn gọn các ý..."
                  className="min-w-0 flex-1 px-3 py-2 border-[1.5px] border-[#dde1ef] rounded-lg text-xs bg-white text-[#1a1f36] focus:outline-none focus:border-[#1a56b0] focus:ring-2 focus:ring-[#1a56b0]/10"
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
      </EditorWorkspace>

      {/* Toast */}
      {saveError && <div role="alert" className="fixed bottom-16 right-6 z-50 max-w-md rounded-xl bg-red-50 p-4 text-sm text-red-700 shadow-lg">{saveError}</div>}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1f36] text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
