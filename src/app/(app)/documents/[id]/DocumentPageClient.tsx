'use client'

import { useEffect, useState } from 'react'
import DocumentEditor from '@/components/document-editor'
import { DocumentState, Agency, Signer } from '@/types'
import Link from 'next/link'

interface DocVersion {
  id: string
  created_at: string
  snapshot: DocumentState
}

interface Props {
  documentId: string
  initialDocument: any
  initialVersions: DocVersion[]
  agencies: Agency[]
  signers: Signer[]
  documentCount: number
}

export default function DocumentPageClient({
  documentId,
  initialDocument,
  initialVersions,
  agencies,
  signers,
  documentCount,
}: Props) {
  const [documentData, setDocumentData] = useState<DocumentState | null>(
    initialDocument?.content ? (initialDocument.content as DocumentState) : null
  )
  const [loading, setLoading] = useState(!initialDocument)

  useEffect(() => {
    if (!initialDocument) {
      // Try to recover from client localStorage if server didn't find it (e.g. Vercel serverless environment)
      try {
        const storedDoc = localStorage.getItem(`doc_${documentId}`)
        if (storedDoc) {
          const parsed = JSON.parse(storedDoc)
          setDocumentData(parsed)
        }
      } catch (e) {
        console.error('Error recovering document from localStorage:', e)
      }
      setLoading(false)
    }
  }, [documentId, initialDocument])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#7a7a7a]">Đang tải văn bản...</p>
        </div>
      </div>
    )
  }

  if (!documentData && !initialDocument) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex items-center justify-center p-6 text-center font-sans antialiased text-[#1d1d1f]">
        <div className="bg-white/80 backdrop-blur-md rounded-[24px] p-8 max-w-md w-full shadow-lg border border-white/60">
          <div className="text-5xl mb-4 filter drop-shadow-sm">📄</div>
          <h3 className="text-xl font-bold text-[#1d1d1f] mb-2 tracking-tight">Không tìm thấy văn bản</h3>
          <p className="text-sm text-[#7a7a7a] mb-6 leading-relaxed">
            Văn bản này không tồn tại trên hệ thống hoặc được lưu trên thiết bị khác.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/documents/new"
              className="w-full bg-[#007AFF] text-white py-2.5 rounded-full text-xs font-semibold hover:bg-[#0066cc] transition-all shadow-sm"
            >
              + Tạo văn bản mới
            </Link>
            <Link
              href="/dashboard"
              className="w-full bg-neutral-100 text-neutral-700 py-2.5 rounded-full text-xs font-semibold hover:bg-neutral-200 transition-all"
            >
              ← Quay về Trang chủ (Dashboard)
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DocumentEditor
      documentId={documentId}
      initialData={documentData || (initialDocument?.content as DocumentState)}
      initialVersions={initialVersions}
      agencies={agencies}
      signers={signers}
      documentCount={documentCount}
    />
  )
}
