export type DocType = 'cong-van' | 'bao-cao' | 'thong-bao' | 'ke-hoach' | 'bien-ban'

export type MainContentParagraphBlock = {
  type: 'paragraph'
  text: string
}

export type MainContentTableBlock = {
  type: 'table'
  rows: string[][]
}

export type MainContentBlock = MainContentParagraphBlock | MainContentTableBlock

export interface DocumentState {
  docType: DocType
  agencyUpper: string
  agencyMain: string
  docNumber: string
  docSymbol: string
  location: string
  date: string
  docSummary: string
  recipient: string
  legalBasis: string
  issueStatement: string
  mainContent: string
  mainContentBlocks?: MainContentBlock[]
  conclusion: string
  signPosition: string
  signName: string
  recipientsCc: string
  partyAUnit: string
  partyAPosition: string
  partyAName: string
  partyBUnit: string
  partyBPosition: string
  partyBName: string
}

export const DEFAULT_DOCUMENT_STATE: DocumentState = {
  docType: 'cong-van',
  agencyUpper: 'BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP',
  agencyMain: 'BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH',
  docNumber: '',
  docSymbol: '',
  location: 'Cao Lãnh',
  date: '',
  docSummary: '',
  recipient: '',
  legalBasis: '',
  issueStatement: '',
  mainContent: '',
  conclusion: '',
  signPosition: 'GIÁM ĐỐC',
  signName: '',
  recipientsCc: '- Như trên;\n- Lưu: VT.',
  partyAUnit: '',
  partyAPosition: '',
  partyAName: '',
  partyBUnit: '',
  partyBPosition: '',
  partyBName: '',
}

export interface Tenant {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface TenantMember {
  tenant_id: string
  user_id: string
  role: 'admin' | 'member'
}

export interface Document {
  id: string
  tenant_id: string
  title: string
  doc_type: DocType
  content: DocumentState
  created_by: string
  updated_at: string
  created_at: string
}

export interface DocVersion {
  id: string
  document_id: string
  snapshot: DocumentState
  created_at: string
}

export interface TenantConfig {
  tenant_id: string
  agencies: Agency[]
  signers: Signer[]
}

export interface Agency {
  upper: string
  main: string
  location: string
  suffix?: string
}

export interface Signer {
  position: string
  name: string
}

export interface AIIssue {
  field: string
  type: 'warning' | 'error'
  description: string
  suggestion: string
}
