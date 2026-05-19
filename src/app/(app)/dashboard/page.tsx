import { getDocuments, deleteDocument } from '@/lib/actions/documents'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DeleteDocumentButton from './DeleteDocumentButton'

const DOC_TYPE_LABELS: Record<string, string> = {
  'cong-van': 'Công Văn',
  'bao-cao': 'Báo cáo',
  'thong-bao': 'Thông báo',
  'ke-hoach': 'Kế hoạch',
  'bien-ban': 'Biên bản',
}

const DOC_TYPE_COLORS: Record<string, string> = {
  'cong-van': 'bg-blue-100 text-blue-700',
  'bao-cao': 'bg-purple-100 text-purple-700',
  'thong-bao': 'bg-amber-100 text-amber-700',
  'ke-hoach': 'bg-green-100 text-green-700',
  'bien-ban': 'bg-rose-100 text-rose-700',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { documents, documentCount } = await getDocuments()

  const { data: tenant } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(name)')
    .eq('user_id', user.id)
    .single()

  const tenantName = (tenant?.tenants as unknown as { name: string })?.name ?? 'Đơn vị của bạn'

  return (
    <div className="min-h-screen bg-[#dde3ee]">
      {/* Top nav */}
      <nav className="bg-[#1a56b0] text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-base font-bold">📄 Thể thức văn bản</h1>
          <p className="text-xs opacity-75">{tenantName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-75">{documentCount}/99 văn bản</span>
          <Link href="/settings" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md font-semibold transition-colors">
            Cài đặt
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md font-semibold transition-colors">
              Đăng xuất
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#1a1f36]">Danh sách văn bản</h2>
          <Link
            href="/documents/new"
            className="flex items-center gap-2 bg-[#1a56b0] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1345a0] transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span>
            Văn bản mới
          </Link>
        </div>

        {/* Document list */}
        {documents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="text-5xl mb-4">📄</div>
            <p className="text-[#1a1f36] font-semibold mb-1">Chưa có văn bản nào</p>
            <p className="text-sm text-[#6b7597]">Bấm &quot;Văn bản mới&quot; để bắt đầu soạn thảo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-[#dde1ef] hover:border-[#1a56b0] hover:shadow-md transition-all group">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DOC_TYPE_COLORS[doc.doc_type] || 'bg-gray-100 text-gray-600'}`}>
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[#1a1f36] truncate text-sm">{doc.title}</h3>
                    <p className="text-xs text-[#6b7597] mt-0.5">
                      Cập nhật: {new Date(doc.updated_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-sm bg-[#e8f0fe] text-[#1a56b0] px-4 py-1.5 rounded-lg font-semibold hover:bg-[#1a56b0] hover:text-white transition-colors"
                    >
                      Mở →
                    </Link>
                    <DeleteDocumentButton documentId={doc.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
