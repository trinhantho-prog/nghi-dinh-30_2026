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
  'cong-van': 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/25',
  'bao-cao': 'bg-[#AF52DE]/10 text-[#AF52DE] border-[#AF52DE]/25',
  'thong-bao': 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/25',
  'ke-hoach': 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/25',
  'bien-ban': 'bg-[#FF2D55]/10 text-[#FF2D55] border-[#FF2D55]/25',
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

  // Bright, premium glowing organic gradient mimicking modern iOS wallpapers
  const dashboardBg = {
    background: `radial-gradient(circle at 10% 20%, rgba(255, 45, 85, 0.12) 0%, transparent 40%),
                 radial-gradient(circle at 90% 10%, rgba(0, 122, 255, 0.15) 0%, transparent 40%),
                 radial-gradient(circle at 50% 90%, rgba(175, 82, 222, 0.1) 0%, transparent 50%),
                 radial-gradient(circle at 80% 80%, rgba(255, 204, 0, 0.08) 0%, transparent 35%),
                 #f4f5f8`
  }

  return (
    <div style={dashboardBg} className="min-h-screen font-sans antialiased text-[#1d1d1f]">
      {/* Sleek Top nav with frosted glass effect */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-[#e0e0e0]/40 px-8 py-3.5 flex items-center justify-between transition-all duration-300">
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-[#1d1d1f] tracking-tight flex items-center gap-1.5">
            <span className="text-lg">📄</span> Thể thức văn bản
          </h1>
          <p className="text-[10px] text-[#7a7a7a] tracking-wide uppercase font-bold mt-0.5">{tenantName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/10">
            {documentCount}/99 văn bản
          </span>
          <Link 
            href="/settings" 
            className="text-xs bg-white/60 border border-[#e0e0e0] hover:bg-white text-[#1d1d1f] px-4 py-2 rounded-full font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-sm shadow-black/5"
          >
            Cài đặt
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-xs bg-white/60 border border-[#FF3B30]/20 hover:bg-[#FF3B30]/5 text-[#FF3B30] px-4 py-2 rounded-full font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-sm shadow-black/5">
              Đăng xuất
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Sleek Apple Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
              Danh sách văn bản
            </h2>
            <p className="text-sm text-[#7a7a7a] mt-1 font-medium">Quản lý và soạn thảo các văn bản chuẩn mực</p>
          </div>
          <Link
            href="/documents/new"
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#007AFF] via-[#0A84FF] to-[#0056B3] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-95 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-md shadow-[#007AFF]/25"
          >
            <span className="text-base font-bold leading-none">+</span>
            Văn bản mới
          </Link>
        </div>

        {/* Document list or Empty State */}
        {documents.length === 0 ? (
          <div className="text-center py-20 bg-white/80 backdrop-blur-md rounded-[24px] border border-white/50 shadow-lg shadow-black/[0.03]">
            <div className="text-6xl mb-5 filter drop-shadow-md">📁</div>
            <p className="text-[#1d1d1f] font-semibold text-lg mb-1.5">Chưa có văn bản nào</p>
            <p className="text-sm text-[#7a7a7a] max-w-sm mx-auto leading-relaxed">
              Bắt đầu chuẩn hóa các văn bản hành chính bằng cách bấm nút <span className="font-semibold text-[#007AFF]">&quot;Văn bản mới&quot;</span> ở trên.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className="bg-white/75 backdrop-blur-md rounded-[20px] shadow-sm border border-white/60 hover:border-[#007AFF]/35 hover:bg-white/90 hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex items-center justify-between p-5">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${DOC_TYPE_COLORS[doc.doc_type] || 'bg-gray-100/80 text-gray-600 border-gray-200'}`}>
                        {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[#1d1d1f] group-hover:text-[#007AFF] transition-colors duration-200 text-base leading-snug truncate">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-[#7a7a7a] mt-1.5 flex items-center gap-1.5">
                      <span className="opacity-60 text-sm leading-none">🕒</span>
                      <span>Cập nhật: <span className="font-semibold text-[#333]">{new Date(doc.updated_at).toLocaleString('vi-VN')}</span></span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-xs bg-[#007AFF] text-white px-5 py-2.5 rounded-full font-semibold hover:bg-[#0066cc] hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-sm shadow-[#007AFF]/20"
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
