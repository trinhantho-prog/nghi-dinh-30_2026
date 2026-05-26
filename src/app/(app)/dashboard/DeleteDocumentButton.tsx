'use client'

import { deleteDocument } from '@/lib/actions/documents'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('Xóa văn bản này?')) return
    setLoading(true)
    await deleteDocument(documentId)
    router.refresh()
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
