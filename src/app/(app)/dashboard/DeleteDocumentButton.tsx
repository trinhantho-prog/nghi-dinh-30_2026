'use client'

import { deleteDocument } from '@/lib/actions/documents'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteBrowserDocument } from '@/lib/storage/browser-documents'

export default function DeleteDocumentButton({ documentId, storageMode }: { documentId: string; storageMode: 'browser' | 'cloud' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('Xóa văn bản này?')) return
    setLoading(true)
    try {
      if (storageMode === 'browser') deleteBrowserDocument(documentId)
      else await deleteDocument(documentId)
      router.refresh()
    } catch {
      alert('Không xóa được văn bản. Vui lòng kiểm tra kết nối hoặc quyền truy cập và thử lại.')
    } finally { setLoading(false) }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs bg-[#FF3B30]/10 text-[#FF3B30] px-4 py-2 rounded-full font-semibold hover:bg-[#FF3B30] hover:text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-50 shrink-0 shadow-sm shadow-[#FF3B30]/5"
    >
      {loading ? '...' : 'Xóa'}
    </button>
  )
}
