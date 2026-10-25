'use server'

import { createClient } from '@/lib/supabase/server'
import type { DocumentState, Agency, Signer } from '@/types'
import type { LocalDocumentRecord, LocalDocVersionRecord } from '@/lib/storage/local-db'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getEditorConfig, saveEditorConfig } from '@/lib/user-editor-config'

async function documentSession() {
  // An explicit device workspace must not depend on Supabase being reachable.
  if ((await cookies()).get('document_storage')?.value === 'browser') return null
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && error.name !== 'AuthSessionMissingError') throw new Error('Không xác thực được tài khoản. Vui lòng kiểm tra kết nối và đăng nhập lại.')
  if (!user) {
    if ((await cookies()).get('local_mode')?.value === 'true') return null
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  }
  return { supabase, user }
}

async function cloudSession() {
  const session = await documentSession()
  if (!session) throw new Error('Văn bản cục bộ phải được lưu trên trình duyệt.')
  const { data, error } = await session.supabase.from('tenant_members').select('tenant_id').eq('user_id', session.user.id).limit(1).maybeSingle()
  if (error) throw new Error('Không đọc được kho văn bản. Vui lòng kiểm tra cấu hình cơ sở dữ liệu.')
  let tenantId = data?.tenant_id
  if (!tenantId) {
    const provision = await session.supabase.rpc('ensure_personal_document_workspace')
    if (provision.error || !provision.data) throw new Error('Kho văn bản chưa được thiết lập. Quản trị viên cần chạy migrations/20261025_document_workspace.sql trong Supabase.')
    tenantId = provision.data
  }
  return { ...session, tenantId: tenantId as string }
}

export async function saveDocument(state: DocumentState, documentId?: string): Promise<string> {
  const { supabase, tenantId, user } = await cloudSession()
  const values = { title: state.docSummary || state.docNumber || 'Văn bản chưa đặt tên', doc_type: state.docType, content: state, updated_at: new Date().toISOString() }
  const result = documentId
    ? await supabase.from('documents').update(values).eq('id', documentId).eq('tenant_id', tenantId).select('id').single()
    : await supabase.from('documents').insert({ ...values, tenant_id: tenantId, created_by: user.id }).select('id').single()
  if (result.error || !result.data) throw new Error('Không thể lưu văn bản vào tài khoản. Vui lòng thử lại; nội dung đang sửa vẫn được giữ trên màn hình.')
  revalidatePath('/dashboard')
  return result.data.id
}

export async function saveVersion(documentId: string, state: DocumentState) {
  const { supabase, tenantId } = await cloudSession()
  const document = await supabase.from('documents').select('id').eq('id', documentId).eq('tenant_id', tenantId).single()
  if (document.error || !document.data) throw new Error('Không tìm thấy văn bản để lưu phiên bản.')
  const existing = await supabase.from('doc_versions').select('id').eq('document_id', documentId).order('created_at', { ascending: true })
  if (existing.error) throw new Error('Không đọc được lịch sử phiên bản.')
  if (existing.data.length >= 99) throw new Error('Đã đạt giới hạn 99 phiên bản.')
  const { data, error } = await supabase.from('doc_versions').insert({ document_id: documentId, snapshot: state }).select('id, created_at, snapshot').single()
  if (error || !data) throw new Error('Đã lưu văn bản nhưng không lưu được phiên bản. Vui lòng thử lại.')
  return data as LocalDocVersionRecord
}

export async function deleteVersion(versionId: string) {
  const { supabase, tenantId } = await cloudSession()
  const version = await supabase.from('doc_versions').select('document_id').eq('id', versionId).single()
  if (version.error || !version.data) throw new Error('Không tìm thấy phiên bản.')
  const document = await supabase.from('documents').select('id').eq('id', version.data.document_id).eq('tenant_id', tenantId).single()
  if (document.error || !document.data) throw new Error('Không có quyền xóa phiên bản này.')
  const { data, error } = await supabase.from('doc_versions').delete().eq('id', versionId).select('id').single()
  if (error || !data) throw new Error('Không thể xóa phiên bản. Vui lòng thử lại.')
}

export async function deleteDocument(documentId: string) {
  const { supabase, tenantId } = await cloudSession()
  const { data, error } = await supabase.from('documents').delete().eq('id', documentId).eq('tenant_id', tenantId).select('id').single()
  if (error || !data) throw new Error('Không thể xóa văn bản. Vui lòng kiểm tra quyền truy cập và thử lại.')
  revalidatePath('/dashboard')
}

export async function getDocuments() {
  const session = await documentSession()
  const config = await documentEditorConfig()
  if (!session) return { documents: [] as LocalDocumentRecord[], documentCount: 0, storageMode: 'browser' as const, ...config }
  const { supabase, tenantId } = await cloudSession()
  const { data, error } = await supabase.from('documents').select('id, title, doc_type, updated_at, created_at, content').eq('tenant_id', tenantId).order('updated_at', { ascending: false })
  if (error) throw new Error('Không tải được danh sách văn bản. Vui lòng kiểm tra kết nối và thử lại.')
  const documents = (data ?? []) as LocalDocumentRecord[]
  return { documents, documentCount: documents.length, storageMode: 'cloud' as const, ...config }
}

export async function getDocument(documentId: string) {
  const session = await documentSession()
  const config = await documentEditorConfig()
  if (!session) return { document: null as LocalDocumentRecord | null, versions: [] as LocalDocVersionRecord[], documentCount: 0, storageMode: 'browser' as const, ...config }
  const { supabase, tenantId } = await cloudSession()
  const [document, versions] = await Promise.all([
    supabase.from('documents').select('*').eq('id', documentId).eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('doc_versions').select('id, created_at, snapshot').eq('document_id', documentId).order('created_at', { ascending: false }),
  ])
  if (document.error || versions.error) throw new Error('Không tải được văn bản hoặc lịch sử phiên bản. Vui lòng thử lại.')
  return { document: document.data as LocalDocumentRecord | null, versions: (versions.data ?? []) as LocalDocVersionRecord[], documentCount: 0, storageMode: 'cloud' as const, ...config }
}

async function documentEditorConfig() {
  try { return await getEditorConfig() }
  catch (error) {
    // Explicit browser mode can still edit documents when account settings are
    // unavailable. Never inherit another account's server-side defaults.
    if ((await cookies()).get('document_storage')?.value === 'browser') return { agencies: [], signers: [] }
    throw error
  }
}

export async function renameFolder(oldName: string, newName: string) {
  const { supabase, tenantId } = await cloudSession()
  const { data, error } = await supabase.from('documents').select('id, content').eq('tenant_id', tenantId)
  if (error) throw new Error('Không tải được thư mục.')
  for (const doc of data ?? []) {
    const content = doc.content as DocumentState
    if (content?.folder?.trim() === oldName.trim()) {
      const result = await supabase.from('documents').update({ content: { ...content, folder: newName.trim() }, updated_at: new Date().toISOString() }).eq('id', doc.id).eq('tenant_id', tenantId).select('id').single()
      if (result.error || !result.data) throw new Error('Không cập nhật được thư mục. Vui lòng thử lại.')
    }
  }
  revalidatePath('/dashboard')
  return true
}

export async function deleteFolder(folderName: string) {
  return renameFolder(folderName, '')
}

export async function saveTenantConfig(agencies: Agency[], signers: Signer[]) {
  const config = await saveEditorConfig({ agencies, signers })
  revalidatePath('/dashboard')
  revalidatePath('/settings')
  revalidatePath('/documents/new')
  return config
}
