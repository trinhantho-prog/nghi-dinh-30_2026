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
  const [state, dispatch] = useDocumentReducer(initialData)
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
      if (id && !currentDocIdRef.current) {
        currentDocIdRef.current = id
        router.replace(`/documents/${id}`, { scroll: false })
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

  function handleNewDocument() {
    currentDocIdRef.current = undefined
    dispatch({ type: 'RESET' })
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
