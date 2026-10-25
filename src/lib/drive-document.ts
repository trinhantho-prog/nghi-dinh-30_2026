import { DEFAULT_DOCUMENT_STATE, DocumentState, MainContentBlock } from '@/types'
import { htmlElementText, htmlTableData } from './html-content'
import { recognizeImportedDocument } from './recognize-document'
import { validateTableLayout } from './table-layout'
import { MAX_DOCUMENT_DATA_LENGTH, clipboardImageBlock, validateDocumentImage } from './document-image'
import { sourcePageLayout, sourceParagraph } from './source-format'

export type DriveSource = { id: string; name: string; mimeType: string; version: string; accountId: string; etag?: string }

export function validateDriveDocument(value: unknown): DocumentState {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > MAX_DOCUMENT_DATA_LENGTH) throw new Error('Dữ liệu văn bản không hợp lệ hoặc quá lớn.')
  const input = value as Record<string, unknown>
  const state = { ...DEFAULT_DOCUMENT_STATE }
  if (input.sourceLayout !== undefined) state.sourceLayout = sourcePageLayout(input.sourceLayout)
  if (input.sourceHeader !== undefined) state.sourceHeader = validateDriveDocument({ mainContentBlocks: input.sourceHeader }).mainContentBlocks
  if (input.sourceFooter !== undefined) state.sourceFooter = validateDriveDocument({ mainContentBlocks: input.sourceFooter }).mainContentBlocks
  for (const key of Object.keys(DEFAULT_DOCUMENT_STATE) as (keyof DocumentState)[]) {
    if (key === 'docType') continue
    if (typeof input[key] === 'string') (state as unknown as Record<string, unknown>)[key] = input[key]
  }
  if (['cong-van', 'bao-cao', 'thong-bao', 'ke-hoach', 'bien-ban'].includes(String(input.docType))) state.docType = input.docType as DocumentState['docType']
  if (input.mainContentBlocks !== undefined) {
    if (!Array.isArray(input.mainContentBlocks) || input.mainContentBlocks.length > 5000) throw new Error('Nội dung văn bản không hợp lệ.')
    state.mainContentBlocks = input.mainContentBlocks.map((item): MainContentBlock => {
      if (item?.type === 'paragraph' && typeof item.text === 'string') return sourceParagraph(item)
      if (item?.type === 'image') return validateDocumentImage(item)
      if (item?.type === 'table' && Array.isArray(item.rows) && item.rows.length > 0 && item.rows.length <= 1000 && item.rows[0]?.length > 0 && item.rows[0].length <= 50 && item.rows.every((row: unknown) => Array.isArray(row) && row.length === item.rows[0].length && row.every(cell => typeof cell === 'string'))) {
        const cellParagraphs = item.cellParagraphs === undefined ? undefined : item.rows.map((row: string[], r: number) => row.map((_: string, c: number) => {
          const paragraphs = item.cellParagraphs?.[r]?.[c]
          if (!Array.isArray(paragraphs) || paragraphs.length > 1000) throw new Error('Định dạng ô nguồn không hợp lệ.')
          return paragraphs.map(sourceParagraph)
        }))
        return validateTableLayout({ type: 'table', rows: item.rows, merges: item.merges, cellStyles: item.cellStyles, fontSize: item.fontSize, sourceWidth: item.sourceWidth, ...(['left', 'center', 'right'].includes(item.tableAlign) ? { tableAlign: item.tableAlign } : {}), ...(typeof item.borderless === 'boolean' ? { borderless: item.borderless } : {}), ...(cellParagraphs ? { cellParagraphs } : {}), ...(Array.isArray(item.columnWidths) && item.columnWidths.length === item.rows[0].length && item.columnWidths.every((width: unknown) => typeof width === 'number' && Number.isFinite(width) && width > 0) ? { columnWidths: item.columnWidths } : {}) })
      }
      throw new Error('Bảng hoặc đoạn văn không hợp lệ.')
    })
  }
  if (input.sourceSections !== undefined) {
    const sections = input.sourceSections as { opening?: unknown; closing?: unknown; baseline?: unknown }
    if (!sections || typeof sections !== 'object' || !sections.baseline || typeof sections.baseline !== 'object' || Array.isArray(sections.baseline) || !Array.isArray(sections.opening) || !Array.isArray(sections.closing)) throw new Error('Thông tin đầu/cuối văn bản không hợp lệ.')
    const baseline: Record<string, string> = {}
    for (const [key, value] of Object.entries(sections.baseline)) {
      if (typeof value !== 'string' || !/^[a-zA-Z]+$/.test(key) || Object.keys(baseline).length >= 100) throw new Error('Trường thông tin văn bản không hợp lệ.')
      baseline[key] = value
    }
    state.sourceSections = { opening: validateDriveDocument({ mainContentBlocks: sections.opening }).mainContentBlocks || [], closing: validateDriveDocument({ mainContentBlocks: sections.closing }).mainContentBlocks || [], baseline }
  }
  return state
}

// Parse the inert import document, never mount imported HTML in the application.
export async function importedHtmlToDocument(html: string, name: string): Promise<DocumentState> {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const blocks: MainContentBlock[] = []
  const summaryHints = new Set<string>()
  async function importImage(element: Element) {
    const src = element.getAttribute('src') || ''
    const match = src.match(/^data:(image\/(?:png|jpeg|gif|webp|bmp));base64,([A-Za-z0-9+/]+={0,2})$/)
    if (!match || src.length > 28_000_000) throw new Error('Không nhập được ảnh trong tài liệu. Hãy dùng ảnh PNG hoặc JPEG trong file gốc rồi mở lại.')
    const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
    const image = await clipboardImageBlock(new Blob([bytes], { type: match[1] }))
    blocks.push({ ...image, widthPercent: 100, align: 'center', alt: element.getAttribute('alt') || 'Ảnh từ tài liệu Drive' })
  }
  async function visit(element: Element) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return
    if (element.tagName === 'TABLE') {
      const table = htmlTableData(element as HTMLTableElement)
      if (table.rows.length) blocks.push(table)
      // Cells currently store text; keep their images immediately after the table.
      for (const image of Array.from(element.querySelectorAll('img'))) await importImage(image)
    } else if (element.tagName === 'IMG') {
      await importImage(element)
    } else if (/^(P|H[1-6]|LI)$/.test(element.tagName)) {
      const text = htmlElementText(element)
      const emphasized = /^H[1-6]$/.test(element.tagName) || Array.from(element.querySelectorAll('strong,b')).map(node => node.textContent || '').join('').length >= text.length * 0.7
      if (emphasized) text.split('\n').forEach(line => summaryHints.add(line.trim()))
      if (!element.querySelector('img')) {
        if (text) blocks.push({ type: 'paragraph', text })
      } else {
        // Split mixed text/image paragraphs in source order, including nested spans.
        let pending = ''
        const flush = () => { if (pending.trim()) blocks.push({ type: 'paragraph', text: pending.trim() }); pending = '' }
        async function inline(node: Node) {
          if (node.nodeType === 3) { pending += node.textContent || ''; return }
          if (node.nodeType !== 1) return
          const child = node as Element
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(child.tagName)) return
          if (child.tagName === 'IMG') { flush(); await importImage(child); return }
          if (child.tagName === 'BR') { pending += '\n'; return }
          for (const nested of Array.from(child.childNodes)) await inline(nested)
        }
        for (const child of Array.from(element.childNodes)) await inline(child)
        flush()
      }
    } else for (const child of Array.from(element.children)) await visit(child)
  }
  for (const child of Array.from(body.children)) await visit(child)
  return validateDriveDocument(recognizeImportedDocument(blocks, name, summaryHints))
}
