import { getDocument, getDocuments } from '@/lib/actions/documents'

function loadProblem(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const setupRequired = message.includes('20261025_document_workspace.sql') || message.includes('cấu hình cơ sở dữ liệu')
  // Only render our actionable messages, never raw SDK errors or credentials.
  const known = /^(Không đọc được kho văn bản\.|Không tải được danh sách văn bản\.|Không tải được văn bản hoặc lịch sử phiên bản\.|Không xác thực được tài khoản\.|Phiên đăng nhập đã hết hạn\.)/.test(message)
  return {
    message: setupRequired ? 'Kho văn bản của tài khoản chưa sẵn sàng. Cần kiểm tra thiết lập cơ sở dữ liệu Supabase.'
      : known ? message : 'Không tải được dữ liệu tài khoản. Vui lòng thử lại hoặc đăng nhập lại.',
    setupRequired,
  }
}

export async function loadDocumentLibrary() {
  try { return { ok: true as const, data: await getDocuments() } }
  catch (error) { return { ok: false as const, error: loadProblem(error) } }
}

export async function loadSavedDocument(id: string) {
  try { return { ok: true as const, data: await getDocument(id) } }
  catch (error) { return { ok: false as const, error: loadProblem(error) } }
}
