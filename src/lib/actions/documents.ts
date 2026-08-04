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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(str?: string | null): boolean {
  if (!str) return false
  return UUID_REGEX.test(str)
}

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single()

      if (data && isUUID(data.tenant_id)) return { tenantId: data.tenant_id, userId: user.id }
    }
  } catch (e) {}
  return { tenantId: 'local_tenant', userId: 'local_user' }
}

export async function saveDocument(
  state: DocumentState,
  documentId?: string
): Promise<string | null> {
  // 1. Always save to local DB first to guarantee persistence
  const localId = await saveLocalDocument(state, documentId)
  const activeId = documentId || localId || `doc_${Date.now()}`

  try {
    const supabase = await createClient()
    const { tenantId, userId } = await getTenantId(supabase)

    if (tenantId === 'local_tenant' || !isUUID(tenantId)) {
      revalidatePath('/dashboard')
      return activeId
    }

    const title = state.docSummary || state.docNumber || 'Văn bản chưa đặt tên'

    if (activeId && isUUID(activeId)) {
      const { data, error } = await supabase
        .from('documents')
        .update({ title, doc_type: state.docType, content: state, updated_at: new Date().toISOString() })
        .eq('id', activeId)
        .eq('tenant_id', tenantId)
        .select('id')

      if (!error && data && data.length > 0) {
        revalidatePath('/dashboard')
        return activeId
      }
    }

    // Insert new document into Supabase if it's not in Supabase yet
    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({ tenant_id: tenantId, title, doc_type: state.docType, content: state, created_by: userId })
      .select('id')
      .single()

    if (!insertError && data?.id) {
      await saveLocalDocument(state, data.id)
      revalidatePath('/dashboard')
      return data.id
    }
  } catch (error) {
    console.warn('Supabase offline/error, using local DB for saveDocument:', error)
  }

  revalidatePath('/dashboard')
  return activeId
}

export async function saveVersion(documentId: string, state: DocumentState) {
  const localVer = await saveLocalVersion(documentId, state)
  if (isUUID(documentId)) {
    try {
      const supabase = await createClient()
      const { tenantId } = await getTenantId(supabase)

      if (tenantId !== 'local_tenant' && isUUID(tenantId)) {
        const { count } = await supabase
          .from('doc_versions')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', documentId)

        if ((count ?? 0) >= 99) {
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

        if (data) {
          return { id: data.id, created_at: data.created_at, snapshot: state }
        }
      }
    } catch (error) {
      console.warn('Supabase offline/error, using local DB for saveVersion:', error)
    }
  }
  return localVer
}

export async function deleteVersion(versionId: string) {
  await deleteLocalVersion(versionId)
  if (isUUID(versionId)) {
    try {
      const supabase = await createClient()
      await supabase.from('doc_versions').delete().eq('id', versionId)
    } catch (e) {
      console.warn('Supabase offline/error during deleteVersion:', e)
    }
  }
}

export async function deleteDocument(documentId: string) {
  await deleteLocalDocument(documentId)
  if (isUUID(documentId)) {
    try {
      const supabase = await createClient()
      const { tenantId } = await getTenantId(supabase)
      if (tenantId !== 'local_tenant' && isUUID(tenantId)) {
        await supabase.from('documents').delete().eq('id', documentId).eq('tenant_id', tenantId)
      }
    } catch (e) {
      console.warn('Supabase offline/error during deleteDocument:', e)
    }
  }
  revalidatePath('/dashboard')
}

export async function getDocuments() {
  const localRes = await getLocalDocuments()
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    if (tenantId === 'local_tenant' || !isUUID(tenantId)) {
      return localRes
    }

    const [{ data: docs, error: docError }, configRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, doc_type, updated_at, created_at, content')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('tenant_config')
        .select('agencies, signers')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])

    if (docError) throw docError

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

    const config = configRes.data
    return {
      documents: combinedDocs,
      documentCount: combinedDocs.length,
      agencies: config?.agencies?.length ? config.agencies : localRes.agencies,
      signers: config?.signers?.length ? config.signers : localRes.signers,
    }
  } catch (error) {
    console.warn('Supabase offline/error, falling back to local DB for getDocuments:', error)
    return localRes
  }
}

export async function getDocument(documentId: string) {
  const localRes = await getLocalDocument(documentId)

  if (!isUUID(documentId)) {
    return localRes
  }

  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    let config: { agencies?: Agency[]; signers?: Signer[] } | null = null
    if (tenantId !== 'local_tenant' && isUUID(tenantId)) {
      const { data } = await supabase
        .from('tenant_config')
        .select('agencies, signers')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      config = data
    }

    const [{ data: doc, error: docErr }, { data: versions, error: verErr }] = await Promise.all([
      supabase.from('documents').select('*').eq('id', documentId).maybeSingle(),
      supabase
        .from('doc_versions')
        .select('id, created_at, snapshot')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false }),
    ])

    if (docErr) throw docErr

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
  } catch (error) {
    console.warn('Supabase offline/error, falling back to local DB for getDocument:', error)
    return localRes
  }
}

export async function renameFolder(oldName: string, newName: string) {
  await renameLocalFolder(oldName, newName)
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    if (tenantId !== 'local_tenant' && isUUID(tenantId)) {
      const { data: docs, error } = await supabase
        .from('documents')
        .select('id, content')
        .eq('tenant_id', tenantId)

      if (docs && !error) {
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
    }
  } catch (e) {
    console.warn('Supabase offline/error, using local DB for renameFolder:', e)
  }
  revalidatePath('/dashboard')
  return true
}

export async function deleteFolder(folderName: string) {
  await deleteLocalFolder(folderName)
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)

    if (tenantId !== 'local_tenant' && isUUID(tenantId)) {
      const { data: docs, error } = await supabase
        .from('documents')
        .select('id, content')
        .eq('tenant_id', tenantId)

      if (docs && !error) {
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
    }
  } catch (e) {
    console.warn('Supabase offline/error, using local DB for deleteFolder:', e)
  }
  revalidatePath('/dashboard')
  return true
}

export async function saveTenantConfig(agencies: Agency[], signers: Signer[]) {
  console.log('[saveTenantConfig] Called with:', JSON.stringify({ agencies, signers }))
  await saveLocalConfig({ agencies, signers })
  try {
    const supabase = await createClient()
    const { tenantId } = await getTenantId(supabase)
    if (tenantId !== 'local_tenant' && isUUID(tenantId)) {
      const { error } = await supabase
        .from('tenant_config')
        .upsert({ tenant_id: tenantId, agencies, signers, updated_at: new Date().toISOString() })
      if (error) {
        console.error('[saveTenantConfig] Supabase error:', error)
      }
    }
  } catch (e) {
    console.warn('[saveTenantConfig] Supabase offline/error:', e)
  }
  revalidatePath('/dashboard')
  revalidatePath('/settings')
  revalidatePath('/documents/new')
  return true
}



