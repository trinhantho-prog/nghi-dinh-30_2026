export type DocType = 'cong-van' | 'bao-cao' | 'thong-bao' | 'ke-hoach' | 'bien-ban'

export type MainContentParagraphBlock = {
  type: 'paragraph'
  text: string
  style?: SourceTextStyle
  runs?: { text: string; style?: SourceTextStyle; field?: 'PAGE' | 'NUMPAGES' }[]
  rules?: { width: number; left: number; top: number; weight: number; color: string }[]
}

export type SourceTextStyle = {
  fontSize?: number; fontFamily?: string; bold?: boolean; italic?: boolean; underline?: boolean
  characterSpacing?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  before?: number; after?: number; line?: number; lineMultiple?: number
  left?: number; right?: number; firstLine?: number; pageBreakBefore?: boolean
}

export type SourcePageLayout = { width: number; height: number; top: number; bottom: number; left: number; right: number; header?: number; footer?: number; differentFirstPage?: boolean }

export type MainContentTableBlock = {
  type: 'table'
  rows: string[][]
  columnWidths?: number[] // Relative column widths, normalized to percentages when rendered.
  merges?: TableCellMerge[]
  cellStyles?: TableCellStyle[][]
  fontSize?: number // Points in the source spreadsheet.
  sourceWidth?: number // Pixel width before fitting to the document page.
  borderless?: boolean
  tableAlign?: 'left' | 'center' | 'right'
  cellParagraphs?: MainContentParagraphBlock[][][]
}

export type TableCellMerge = { row: number; column: number; rowSpan: number; colSpan: number }
export type TableCellStyle = {
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  background?: string
  color?: string
  fontSize?: number
}

export type MainContentImageBlock = {
  type: 'image'
  src: string
  width: number
  height: number
  widthPercent?: number
  align?: 'left' | 'center' | 'right'
  alt: string
}

export type MainContentBlock = MainContentParagraphBlock | MainContentTableBlock | MainContentImageBlock

export interface DocumentState {
  sourceLayout?: SourcePageLayout
  sourceHeader?: MainContentBlock[]
  sourceFooter?: MainContentBlock[]
  sourceSections?: { opening: MainContentBlock[]; closing: MainContentBlock[]; baseline: Record<string, string> }
  docType: DocType
  agencyUpper: string
  agencyMain: string
  docNumber: string
  docSymbol: string
  location: string
  date: string
  dateText?: string
  docSummary: string
  recipient: string
  legalBasis: string
  issueStatement: string
  mainContent: string
  mainContentBlocks?: MainContentBlock[]
  conclusion: string
  signPosition: string
  signAuthority?: string
  signName: string
  recipientsCc: string
  partyAUnit: string
  partyAPosition: string
  partyAName: string
  partyBUnit: string
  partyBPosition: string
  partyBName: string
  folder?: string
}

export const DEFAULT_DOCUMENT_STATE: DocumentState = {
  docType: 'cong-van',
  agencyUpper: '',
  agencyMain: '',
  docNumber: '',
  docSymbol: '',
  location: '',
  date: '',
  dateText: '',
  docSummary: '',
  recipient: '',
  legalBasis: '',
  issueStatement: '',
  mainContent: '',
  conclusion: '',
  signPosition: 'GIÁM ĐỐC',
  signAuthority: undefined,
  signName: '',
  recipientsCc: '- Như trên;\n- Lưu: VT.',
  partyAUnit: '',
  partyAPosition: '',
  partyAName: '',
  partyBUnit: '',
  partyBPosition: '',
  partyBName: '',
  folder: '',
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
  fieldKey?: string
  reason?: string
}
