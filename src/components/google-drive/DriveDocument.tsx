'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DocumentEditor from '@/components/document-editor'
import { exportDocx } from '@/components/document-editor/exportDocx'
import { DriveSource, importedHtmlToDocument, validateDriveDocument } from '@/lib/drive-document'
import { driveDraftKey } from './useDriveSave'
import { normalizeImportedDocument } from '@/lib/normalize-imported-document'
import type { Agency, DocumentState, Signer } from '@/types'
import { importDocx } from '@/lib/import-docx'

type Loaded = { source: DriveSource; state: DocumentState; imported: boolean }
type Draft = { state: DocumentState; version: string }

export default function DriveDocument({ fileId, agencies, signers, documentCount }: { fileId: string; agencies: Agency[]; signers: Signer[]; documentCount: number }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState(false)
  const [restored, setRestored] = useState(false)
  const [revision, setRevision] = useState(0)
  const [original, setOriginal] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/drive/file/${encodeURIComponent(fileId)}${original ? '?source=1' : ''}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể mở file Drive.')
      const importedState = data.docx ? await importDocx(Uint8Array.from(atob(data.docx), char => char.charCodeAt(0)).buffer, data.source.name) : data.state ? validateDriveDocument(data.state) : await importedHtmlToDocument(data.html, data.source.name)
      const state = normalizeImportedDocument(importedState)
      if (controller.signal.aborted) return
      setLoaded({ source: data.source, state, imported: Boolean(data.imported) || JSON.stringify(state) !== JSON.stringify(importedState) })
      setError('')
      try {
        const saved = localStorage.getItem(driveDraftKey(data.source))
        if (saved) {
          const parsed = JSON.parse(saved)
          setDraft({ state: normalizeImportedDocument(validateDriveDocument(parsed.state)), version: parsed.version })
        }
      } catch { /* An invalid recovery copy never replaces the file from Drive. */ }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không thể mở file.') })
    return () => controller.abort()
  }, [fileId, revision, original])

  if (editing && loaded) return <DocumentEditor initialData={loaded.state} driveSource={loaded.source} driveInitialDirty={restored || loaded.imported} agencies={agencies} signers={signers} documentCount={documentCount} />

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f5f8] p-6 text-[#1a1f36]">
    <section className="w-full max-w-xl space-y-4 rounded-xl border border-[#dde1ef] bg-white p-6 shadow-sm">
      <Link href="/drive" className="text-sm text-blue-700">← Google Drive cá nhân</Link>
      {!loaded && !error && <p role="status">Đang nhập tài liệu từ Google Drive...</p>}
      {error && <div role="alert" className="space-y-3 text-sm text-red-700"><p>{error}</p><a href="/api/drive/connect" className="mr-4 underline">Kết nối lại Drive</a><button onClick={() => setRevision(value => value + 1)} className="underline">Thử lại</button></div>}
      {loaded && <>
        <h1 className="break-words text-lg font-bold">{loaded.source.name}</h1>
        <p className="text-sm leading-relaxed">Tự động chuẩn hóa các đoạn nội dung theo mẫu Nghị định 30. Các đoạn căn giữa, đầu văn bản, nơi nhận/chữ ký, các bảng và dòng đơn vị tính giữ định dạng gốc. Khổ trang và lề gốc được giữ để bảo toàn bố cục các phần này. Hãy kiểm tra bản xem trước.</p>
        {!original && <button className="text-sm font-semibold text-blue-700 underline" onClick={() => { setLoaded(null); setDraft(null); setOriginal(true); setRevision(value => value + 1) }}>Đọc lại file trên Drive và chuẩn hóa</button>}
        <p className="text-sm leading-relaxed text-slate-600">Chỉ khi bạn bấm “Lưu vào Google Drive”, bản đã chuẩn hóa và các chỉnh sửa mới được ghi vào file gốc. Tên file và thư mục được giữ nguyên. Bản nháp khôi phục được giữ trên thiết bị. Ảnh trong ô bảng hiện được đặt ngay sau bảng; nhận xét và các thành phần Word nâng cao chưa được bảo toàn. Kiểm tra bản xem trước trước khi lưu.</p>
        {draft && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p>Có bản nháp trên thiết bị. {draft.version === loaded.source.version ? 'Bạn có thể khôi phục, tiếp tục chỉnh sửa và bấm Lưu khi hoàn tất.' : 'File trên Drive đã có phiên bản mới. Có thể tải bản nháp để đối chiếu trước khi sửa bản mới.'}</p>
          <button className="mr-4 font-semibold text-blue-700 underline" onClick={() => { void exportDocx(draft.state) }}>Tải bản nháp DOCX</button>
          {draft.version === loaded.source.version && <button className="font-semibold text-blue-700 underline" onClick={() => { setLoaded({ ...loaded, state: draft.state }); setRestored(true); setEditing(true) }}>Khôi phục và tiếp tục chỉnh sửa</button>}
        </div>}
        <button className="w-full rounded-lg bg-[#1a56b0] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800" onClick={() => setEditing(true)}>Mở trong trình soạn thảo</button>
      </>}
    </section>
  </main>
}
