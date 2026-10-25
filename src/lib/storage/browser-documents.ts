import type { DocumentState } from '@/types'
import type { LocalDocumentRecord, LocalDocVersionRecord } from './local-db'

const KEY = 'vanban_documents_v1'
type Store = { documents: LocalDocumentRecord[]; versions: LocalDocVersionRecord[] }

function read(): Store {
  const value = localStorage.getItem(KEY)
  if (!value) {
    const store: Store = { documents: [], versions: [] }
    // Recover old local-mode drafts once. UUID cloud caches have no reliable
    // account ownership, so they are never imported into the local workspace.
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key?.startsWith('doc_doc_')) continue
      try {
        const content = JSON.parse(localStorage.getItem(key)!) as DocumentState
        if (!content || typeof content.docType !== 'string') continue
        const now = new Date().toISOString()
        store.documents.push({ id: key.slice(4), tenant_id: 'local_tenant', created_by: 'local_user',
          title: content.docSummary || content.docNumber || 'Văn bản chưa đặt tên',
          doc_type: content.docType, content, created_at: now, updated_at: now })
      } catch { /* Preserve unreadable legacy entries for manual recovery. */ }
    }
    localStorage.setItem(KEY, JSON.stringify(store))
    return store
  }
  const store = JSON.parse(value) as Store
  if (!Array.isArray(store.documents) || !Array.isArray(store.versions)) {
    throw new Error('Dữ liệu văn bản trên trình duyệt không hợp lệ. Vui lòng sao lưu trước khi đặt lại.')
  }
  return store
}

function write(store: Store) {
  // A failed/quota-exceeded write must never be reported as a successful save.
  localStorage.setItem(KEY, JSON.stringify(store))
  window.dispatchEvent(new Event('vanban-documents-changed'))
}

export function getBrowserDocuments() {
  return read().documents.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getBrowserDocument(id: string) {
  const store = read()
  return { document: store.documents.find(doc => doc.id === id) ?? null,
    versions: store.versions.filter(version => version.document_id === id).reverse() }
}

export function saveBrowserDocument(state: DocumentState, id = `doc_${crypto.randomUUID()}`) {
  const store = read()
  const existing = store.documents.find(doc => doc.id === id)
  const now = new Date().toISOString()
  const record: LocalDocumentRecord = {
    id, tenant_id: 'local_tenant', created_by: 'local_user',
    created_at: existing?.created_at ?? now, updated_at: now,
    title: state.docSummary || state.docNumber || 'Văn bản chưa đặt tên',
    doc_type: state.docType, content: state,
  }
  store.documents = [...store.documents.filter(doc => doc.id !== id), record]
  write(store)
  return id
}

export function deleteBrowserDocument(id: string) {
  const store = read()
  store.documents = store.documents.filter(doc => doc.id !== id)
  store.versions = store.versions.filter(version => version.document_id !== id)
  write(store)
  // Remove the old recovery cache too, so deleted documents cannot reappear.
  localStorage.removeItem(`doc_${id}`)
}

export function saveBrowserVersion(documentId: string, state: DocumentState) {
  const store = read()
  if (!store.documents.some(doc => doc.id === documentId)) throw new Error('Không tìm thấy văn bản để lưu phiên bản.')
  const version = { id: `ver_${crypto.randomUUID()}`, document_id: documentId, snapshot: state, created_at: new Date().toISOString() }
  const previous = store.versions.filter(item => item.document_id === documentId).slice(-98)
  store.versions = [...store.versions.filter(item => item.document_id !== documentId), ...previous, version]
  write(store)
  return version
}

export function deleteBrowserVersion(id: string) {
  const store = read()
  store.versions = store.versions.filter(version => version.id !== id)
  write(store)
}

export function renameBrowserFolder(oldName: string, newName: string) {
  const store = read()
  store.documents = store.documents.map(doc => doc.content.folder?.trim() === oldName.trim()
    ? { ...doc, content: { ...doc.content, folder: newName.trim() }, updated_at: new Date().toISOString() } : doc)
  write(store)
  return true
}
