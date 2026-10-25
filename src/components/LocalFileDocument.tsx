'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import DocumentEditor from './document-editor'
import { importLocalFile } from '@/lib/local-file'
import type { DocumentState } from '@/types'

export default function LocalFileDocument() {
  const input = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<{ name: string; state: DocumentState } | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (editing && loaded) return <DocumentEditor initialData={loaded.state} localFileName={loaded.name} agencies={[]} signers={[]} documentCount={0} />

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
    <section className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Link href="/dashboard" className="text-sm text-blue-700">← Danh sách văn bản</Link>
      <h1 className="text-xl font-bold">Mở file từ máy tính</h1>
      <p className="text-sm leading-relaxed">Chọn file Word (.docx hoặc .doc), tối đa 20 MB. Sau khi chỉnh sửa, dùng “File Save As” để đặt tên và lưu bản Word (.docx) vào máy tính.</p>
      <p className="text-sm text-slate-600">Tự động chuẩn hóa các đoạn nội dung theo mẫu Nghị định 30. Với file .docx, đầu văn bản, nơi nhận/chữ ký, các bảng và dòng đơn vị tính được giữ định dạng gốc, gồm cỡ chữ, căn lề, độ rộng cột và ô gộp. Khổ trang và lề gốc được giữ để bảo toàn bố cục các phần này. File .doc chỉ nhập nội dung chữ; ảnh trong ô bảng của file .docx được đặt sau bảng. Hãy kiểm tra bản xem trước trước khi lưu.</p>
      <input ref={input} type="file" accept=".docx,.doc" className="sr-only" aria-label="Chọn file Word trên máy tính" disabled={busy} onChange={async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setBusy(true); setError(''); setLoaded(null)
        try { setLoaded({ name: file.name, state: await importLocalFile(file) }) }
        catch (error) { setError(error instanceof Error ? error.message : 'Không thể mở file.') }
        finally { setBusy(false) }
      }} />
      <button disabled={busy} onClick={() => input.current?.click()} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">{busy ? 'Đang đọc file...' : 'Chọn file từ ổ cứng'}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loaded && <div className="space-y-3 border-t pt-4"><p className="break-words text-sm font-semibold">{loaded.name}</p><button onClick={() => setEditing(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Mở trong trình soạn thảo</button></div>}
    </section>
  </main>
}
