'use server'

import { createClient } from '@/lib/supabase/server'
import { DocumentState } from '@/types'
import { revalidatePath } from 'next/cache'

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Chưa đăng nhập')

  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single()

  if (!data) throw new Error('Không thuộc tổ chức nào')
  return { tenantId: data.tenant_id, userId: user.id }
}

export async function saveDocument(
  state: DocumentState,
  documentId?: string
): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { tenantId, userId } = await getTenantId(supabase)

    const title = state.docSummary || state.docNumber || 'Văn bản chưa đặt tên'

    if (documentId) {
      await supabase
        .from('documents')
        .update({ title, doc_type: state.docType, content: state, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .eq('tenant_id', tenantId)
      return documentId
    } else {
      // Check limit
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

      if ((count ?? 0) >= 1000) throw new Error('Đã đạt giới hạn 1000 văn bản')

      const { data } = await supabase
        .from('documents')
        .insert({ tenant_id: tenantId, title, doc_type: state.docType, content: state, created_by: userId })
        .select('id')
        .single()

      revalidatePath('/dashboard')
      return data?.id ?? null
    }
  } catch {
    return null
  }
}

export async function saveVersion(documentId: string, state: DocumentState) {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    // Check version limit
    const { count } = await supabase
      .from('doc_versions')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId)

    if ((count ?? 0) >= 99) {
      // Delete oldest version
      const { data: oldest } = await supabase
        .from('doc_versions')
        .select('id')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (oldest) await supabase.from('doc_versions').delete().eq('id', oldest.id)
    }

    const { data } = await supabase
      .from('doc_versions')
      .insert({ document_id: documentId, snapshot: state })
      .select('id, created_at')
      .single()

    return data ? { id: data.id, created_at: data.created_at, snapshot: state } : null
  } catch {
    return null
  }
}

export async function deleteVersion(versionId: string) {
  const supabase = await createClient()
  await supabase.from('doc_versions').delete().eq('id', versionId)
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient()
  const { tenantId } = await getTenantId(supabase)
  await supabase.from('documents').delete().eq('id', documentId).eq('tenant_id', tenantId)
  revalidatePath('/dashboard')
}

export async function getDocuments() {
  const supabase = await createClient()
  const { tenantId } = await getTenantId(supabase)

  const [{ data: docs, count }, { data: config }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, doc_type, updated_at, created_at, content', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('tenant_config')
      .select('agencies, signers')
      .eq('tenant_id', tenantId)
      .single(),
  ])

  return {
    documents: docs ?? [],
    documentCount: count ?? 0,
    agencies: config?.agencies ?? [],
    signers: config?.signers ?? [],
  }
}

export async function getDocument(documentId: string) {
  const supabase = await createClient()
  const { tenantId } = await getTenantId(supabase)

  const [{ data: doc }, { data: versions }, { data: config }, { count }] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('doc_versions')
      .select('id, created_at, snapshot')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tenant_config')
      .select('agencies, signers')
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ])

  return {
    document: doc,
    versions: versions ?? [],
    agencies: config?.agencies ?? [],
    signers: config?.signers ?? [],
    documentCount: count ?? 0,
  }
}

export async function renameFolder(oldName: string, newName: string) {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    // Fetch all documents in the old folder
    const { data: docs } = await supabase
      .from('documents')
      .select('id, content')
      .eq('tenant_id', tenantId)

    if (docs) {
      for (const doc of docs) {
        const content = doc.content as any
        if (content && content.folder?.trim() === oldName.trim()) {
          const updatedContent = { ...content, folder: newName.trim() }
          await supabase
            .from('documents')
            .update({ content: updatedContent, updated_at: new Date().toISOString() })
            .eq('id', doc.id)
        }
      }
    }
    revalidatePath('/dashboard')
    return true
  } catch (e) {
    return false
  }
}

export async function deleteFolder(folderName: string) {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    // Fetch all documents in the folder
    const { data: docs } = await supabase
      .from('documents')
      .select('id, content')
      .eq('tenant_id', tenantId)

    if (docs) {
      for (const doc of docs) {
        const content = doc.content as any
        if (content && content.folder?.trim() === folderName.trim()) {
          const updatedContent = { ...content, folder: '' }
          await supabase
            .from('documents')
            .update({ content: updatedContent, updated_at: new Date().toISOString() })
            .eq('id', doc.id)
        }
      }
    }
    revalidatePath('/dashboard')
    return true
  } catch (e) {
    return false
  }
}
