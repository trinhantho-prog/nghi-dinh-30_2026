'use server'

import { createClient } from '@/lib/supabase/server'
import { DocumentState, Agency, Signer } from '@/types'
import { revalidatePath } from 'next/cache'
import {
  getLocalDocuments,
  getLocalDocument,
  saveLocalDocument,
  saveLocalVersion,
  deleteLocalVersion,
  deleteLocalDocument,
  renameLocalFolder,
  deleteLocalFolder,
  saveLocalConfig,
} from '@/lib/storage/local-db'

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

      if (data) return { tenantId: data.tenant_id, userId: user.id }
    }
  } catch (e) {}
  return { tenantId: 'local_tenant', userId: 'local_user' }
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
  } catch (error) {
    console.warn('Supabase offline/error, falling back to local DB for saveDocument')
    const localId = await saveLocalDocument(state, documentId)
    revalidatePath('/dashboard')
    return localId
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
    console.warn('Supabase offline/error, falling back to local DB for saveVersion')
    return await saveLocalVersion(documentId, state)
  }
}

export async function deleteVersion(versionId: string) {
  try {
    const supabase = await createClient()
    await supabase.from('doc_versions').delete().eq('id', versionId)
  } catch {
    console.warn('Supabase offline/error, falling back to local DB for deleteVersion')
    await deleteLocalVersion(versionId)
  }
}

export async function deleteDocument(documentId: string) {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)
    await supabase.from('documents').delete().eq('id', documentId).eq('tenant_id', tenantId)
    revalidatePath('/dashboard')
  } catch {
    console.warn('Supabase offline/error, falling back to local DB for deleteDocument')
    await deleteLocalDocument(documentId)
    revalidatePath('/dashboard')
  }
}

export async function getDocuments() {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    let docQuery = supabase
      .from('documents')
      .select('id, title, doc_type, updated_at, created_at, content', { count: 'exact' })
      .order('updated_at', { ascending: false })

    if (tenantId !== 'local_tenant') {
      docQuery = docQuery.eq('tenant_id', tenantId)
    }

    let config: { agencies?: Agency[]; signers?: Signer[] } | null = null
    if (tenantId !== 'local_tenant') {
      const { data } = await supabase
        .from('tenant_config')
        .select('agencies, signers')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      config = data
    }

    const [{ data: docs }, localRes] = await Promise.all([
      docQuery,
      getLocalDocuments(),
    ])
    const supabaseDocs = docs ?? []
    const localDocs = localRes.documents ?? []

    const docMap = new Map<string, any>()
    supabaseDocs.forEach((d: any) => docMap.set(d.id, d))
    localDocs.forEach((d: any) => {
      if (!docMap.has(d.id)) docMap.set(d.id, d)
    })

    const combinedDocs = Array.from(docMap.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    return {
      documents: combinedDocs,
      documentCount: combinedDocs.length,
      agencies: config?.agencies?.length ? config.agencies : localRes.agencies,
      signers: config?.signers?.length ? config.signers : localRes.signers,
    }
  } catch {
    console.warn('Supabase offline/error, falling back to local DB for getDocuments')
    return await getLocalDocuments()
  }
}

export async function getDocument(documentId: string) {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    let config: { agencies?: Agency[]; signers?: Signer[] } | null = null
    if (tenantId !== 'local_tenant') {
      const { data } = await supabase
        .from('tenant_config')
        .select('agencies, signers')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      config = data
    }

    const [{ data: doc }, { data: versions }, localRes] = await Promise.all([
      supabase.from('documents').select('*').eq('id', documentId).maybeSingle(),
      supabase
        .from('doc_versions')
        .select('id, created_at, snapshot')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false }),
      getLocalDocument(documentId),
    ])

    if (doc) {
      return {
        document: doc,
        versions: versions && versions.length > 0 ? versions : localRes.versions ?? [],
        agencies: config?.agencies?.length ? config.agencies : localRes.agencies,
        signers: config?.signers?.length ? config.signers : localRes.signers,
        documentCount: localRes.documentCount,
      }
    }

    if (localRes.document) {
      return localRes
    }

    return {
      document: null,
      versions: [],
      agencies: localRes.agencies,
      signers: localRes.signers,
      documentCount: localRes.documentCount,
    }
  } catch {
    console.warn('Supabase offline/error, falling back to local DB for getDocument')
    return await getLocalDocument(documentId)
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
    await renameLocalFolder(oldName, newName)
    revalidatePath('/dashboard')
    return true
  } catch (e) {
    console.warn('Supabase offline/error, falling back to local DB for renameFolder')
    await renameLocalFolder(oldName, newName)
    revalidatePath('/dashboard')
    return true
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
    await deleteLocalFolder(folderName)
    revalidatePath('/dashboard')
    return true
  } catch (e) {
    console.warn('Supabase offline/error, falling back to local DB for deleteFolder')
    await deleteLocalFolder(folderName)
    revalidatePath('/dashboard')
    return true
  }
}

export async function saveTenantConfig(agencies: Agency[], signers: Signer[]) {
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)
    if (tenantId !== 'local_tenant') {
      const { error } = await supabase
        .from('tenant_config')
        .upsert({ tenant_id: tenantId, agencies, signers, updated_at: new Date().toISOString() })
      if (error) {
        console.error('Error saving tenant_config to Supabase:', error)
      }
    }
  } catch (e) {
    console.warn('Supabase offline/error, saving config to local DB:', e)
  }
  await saveLocalConfig({ agencies, signers })
  revalidatePath('/dashboard')
  revalidatePath('/settings')
  revalidatePath('/documents/new')
  return true
}

