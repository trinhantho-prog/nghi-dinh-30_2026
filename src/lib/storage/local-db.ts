import fs from 'fs'
import path from 'path'
import { DocumentState, DocType, Agency, Signer } from '@/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'local-db.json')

export interface LocalDocumentRecord {
  id: string
  tenant_id: string
  title: string
  doc_type: DocType
  content: DocumentState
  created_by: string
  updated_at: string
  created_at: string
}

export interface LocalDocVersionRecord {
  id: string
  document_id: string
  snapshot: DocumentState
  created_at: string
}

export interface LocalTenantConfigRecord {
  agencies: Agency[]
  signers: Signer[]
}

interface LocalDBData {
  documents: LocalDocumentRecord[]
  versions: LocalDocVersionRecord[]
  config: LocalTenantConfigRecord
}

const DEFAULT_CONFIG: LocalTenantConfigRecord = {
  agencies: [
    {
      upper: 'BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP',
      main: 'BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH',
      location: 'Cao Lãnh',
    },
  ],
  signers: [
    {
      position: 'GIÁM ĐỐC',
      name: 'Nguyễn Văn A',
    },
  ],
}

function ensureDBFile(): LocalDBData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialData: LocalDBData = {
        documents: [],
        versions: [],
        config: DEFAULT_CONFIG,
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8')
      return initialData
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    return {
      documents: parsed.documents || [],
      versions: parsed.versions || [],
      config: parsed.config || DEFAULT_CONFIG,
    }
  } catch (error) {
    console.error('Error reading local DB:', error)
    return {
      documents: [],
      versions: [],
      config: DEFAULT_CONFIG,
    }
  }
}

function saveDBFile(data: LocalDBData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving local DB:', error)
  }
}

export async function getLocalDocuments() {
  const db = ensureDBFile()
  const docs = [...db.documents].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
  return {
    documents: docs,
    documentCount: docs.length,
    agencies: db.config.agencies,
    signers: db.config.signers,
  }
}

export async function getLocalDocument(documentId: string) {
  const db = ensureDBFile()
  const doc = db.documents.find((d) => d.id === documentId) || null
  const versions = db.versions
    .filter((v) => v.document_id === documentId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    document: doc,
    versions,
    agencies: db.config.agencies,
    signers: db.config.signers,
    documentCount: db.documents.length,
  }
}

export async function saveLocalDocument(
  state: DocumentState,
  documentId?: string
): Promise<string | null> {
  const db = ensureDBFile()
  const now = new Date().toISOString()
  const title = state.docSummary || state.docNumber || 'Văn bản chưa đặt tên'

  if (documentId) {
    const existingIndex = db.documents.findIndex((d) => d.id === documentId)
    if (existingIndex >= 0) {
      db.documents[existingIndex] = {
        ...db.documents[existingIndex],
        title,
        doc_type: state.docType,
        content: state,
        updated_at: now,
      }
      saveDBFile(db)
      return documentId
    }
  }

  const newId = documentId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const newDoc: LocalDocumentRecord = {
    id: newId,
    tenant_id: 'local_tenant',
    title,
    doc_type: state.docType,
    content: state,
    created_by: 'local_user',
    created_at: now,
    updated_at: now,
  }
  db.documents.push(newDoc)
  saveDBFile(db)
  return newId
}

export async function saveLocalVersion(documentId: string, state: DocumentState) {
  const db = ensureDBFile()
  const now = new Date().toISOString()
  const docVersions = db.versions.filter((v) => v.document_id === documentId)

  if (docVersions.length >= 99) {
    const oldest = docVersions.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0]
    if (oldest) {
      db.versions = db.versions.filter((v) => v.id !== oldest.id)
    }
  }

  const newVersion: LocalDocVersionRecord = {
    id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    document_id: documentId,
    snapshot: state,
    created_at: now,
  }
  db.versions.push(newVersion)
  saveDBFile(db)
  return newVersion
}

export async function deleteLocalVersion(versionId: string) {
  const db = ensureDBFile()
  db.versions = db.versions.filter((v) => v.id !== versionId)
  saveDBFile(db)
}

export async function deleteLocalDocument(documentId: string) {
  const db = ensureDBFile()
  db.documents = db.documents.filter((d) => d.id !== documentId)
  db.versions = db.versions.filter((v) => v.document_id !== documentId)
  saveDBFile(db)
}

export async function renameLocalFolder(oldName: string, newName: string) {
  const db = ensureDBFile()
  let updated = false
  db.documents.forEach((doc) => {
    if (doc.content && doc.content.folder?.trim() === oldName.trim()) {
      doc.content.folder = newName.trim()
      doc.updated_at = new Date().toISOString()
      updated = true
    }
  })
  if (updated) saveDBFile(db)
  return true
}

export async function deleteLocalFolder(folderName: string) {
  const db = ensureDBFile()
  let updated = false
  db.documents.forEach((doc) => {
    if (doc.content && doc.content.folder?.trim() === folderName.trim()) {
      doc.content.folder = ''
      doc.updated_at = new Date().toISOString()
      updated = true
    }
  })
  if (updated) saveDBFile(db)
  return true
}

export async function saveLocalConfig(config: LocalTenantConfigRecord) {
  const db = ensureDBFile()
  db.config = config
  saveDBFile(db)
  return true
}

