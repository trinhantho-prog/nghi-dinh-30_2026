'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { selectDocumentStorage } from '@/lib/actions/document-storage-mode'

export function DocumentStorageModeButton({ browser = false }: { browser?: boolean }) {
  // A real form also works before hydration or when a JS chunk fails to load.
  return <form action={selectDocumentStorage.bind(null, browser ? 'cloud' : 'browser')}><button type="submit" className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
    {browser ? 'Mở kho tài khoản' : 'Dùng kho trên trình duyệt này'}
  </button></form>
}

export default function DocumentStorageRecovery({ message, setupRequired = false, retry }: {
  message: string; setupRequired?: boolean; retry?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12 text-slate-900">
    <section className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold">Chưa mở được kho văn bản</h1>
      <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">{message}</p>
      <p className="text-sm leading-relaxed">Bạn có thể thử lại hoặc tiếp tục soạn thảo với kho trên thiết bị này. Văn bản trên tài khoản không bị xóa hay chuyển sang kho cục bộ.</p>
      {setupRequired && <details className="rounded-lg border border-slate-200 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Hướng dẫn thiết lập kho tài khoản</summary>
        <p className="mt-3 leading-relaxed">Trong Supabase SQL Editor, kiểm tra schema trong supabase-schema.sql đã được cài đặt, sau đó chạy migrations/20261025_document_workspace.sql từ mã nguồn dự án. Nếu schema đã có, không chạy lại lệnh tạo bảng. Sau khi hoàn tất, bấm Thử lại.</p>
      </details>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={() => startTransition(() => { router.refresh(); retry?.() })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Đang tải…' : 'Thử lại'}</button>
        <DocumentStorageModeButton />
        <Link href="/profile" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Hồ sơ / Đăng nhập</Link>
      </div>
    </section>
  </main>
}
