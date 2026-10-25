import { DEFAULT_DOCUMENT_STATE, DocumentState, DocType, MainContentBlock } from '@/types'
import { extractDocumentFooter } from './recognize-document-footer'

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim()
const compact = (text: string) => fold(text).replace(/[^a-z0-9]/g, '')
const isNational = (text: string) => compact(text).includes('conghoaxahoichunghiavietnam')
const isMotto = (text: string) => compact(text).includes('doclaptudohanhphuc')
const clean = (text: string) => text.trim().replace(/[.;:]+$/, '').trim()
const isHeading = (text: string) => /^(?:(?:[IVXLCDM]+|\d+)\s*[.)\-–—]|PHẦN\s+(?:[IVXLCDM]+|\d+)(?=\s|[.:]|$)|(?:Căn cứ|Kính gửi)(?=\s|:|$))/iu.test(text)
const isUpper = (text: string) => /\p{L}/u.test(text) && text.toLocaleUpperCase('vi') === text
const isMinutesOpening = (text: string) => /^(?:Hôm nay|Vào (?:hồi|lúc)|Thời gian|Địa điểm|Thành phần|Chúng tôi)(?=[\s,:：]|$)/iu.test(text)
const organization = /^(?:BẢO HIỂM XÃ HỘI|ỦY BAN|UỶ BAN|HỘI ĐỒNG|SỞ|PHÒNG|BỘ|CỤC|CHI CỤC|TRƯỜNG|BỆNH VIỆN|VĂN PHÒNG|BAN|ĐẢNG|CÔNG TY)(?=\s|$)/iu

function titleType(text: string): DocType | undefined {
  const types: Record<string, DocType> = { 'bao cao': 'bao-cao', 'thong bao': 'thong-bao', 'ke hoach': 'ke-hoach', 'bien ban': 'bien-ban', 'bien ban lam viec': 'bien-ban', 'cong van': 'cong-van' }
  return types[fold(clean(text))]
}

export function contentBlocksText(blocks: MainContentBlock[]) {
  return blocks.map(block => block.type === 'paragraph' ? block.text : block.type === 'image' ? `[Ảnh: ${block.alt}]` : block.rows.map(row => row.join('\t')).join('\n')).join('\n')
}

export function extractAdministrativeContent(input: MainContentBlock[], summaryHints = new Set<string>(), fallbackDocType?: DocType) {
  const blocks = input.flatMap<MainContentBlock>(block => block.type === 'paragraph' ? block.text.split('\n').map(text => ({ type: 'paragraph' as const, text: text.trim() })).filter(block => block.text) : [block])
  const fields: Partial<DocumentState> = {}
  let headerFound = false
  let index = 0
  const nearbyHeader = blocks.slice(0, 12).some(block => isNational(block.type === 'paragraph' ? block.text : block.type === 'table' ? block.rows.flat().join(' ') : ''))
  let agencyLines: string[] = []
  function agencies(lines: string[]) {
    // Older imports glued adjacent Word paragraphs together; split repeated agency prefixes too.
    const expanded = lines.flatMap(line => line.replace(/(.)(?=(?:BẢO HIỂM XÃ HỘI|ỦY BAN NHÂN DÂN|UỶ BAN NHÂN DÂN|HỘI ĐỒNG NHÂN DÂN|CHI CỤC|TRƯỜNG ĐẠI HỌC))/gu, '$1\n').split('\n')).map(clean).filter(Boolean)
    if (!expanded.length) return
    const starts = expanded.map((line, i) => organization.test(line) ? i : -1).filter(i => i >= 0)
    const split = starts.length > 1 ? starts[starts.length - 1] : expanded.length > 1 ? expanded.length - 1 : 0
    fields.agencyUpper = split ? expanded.slice(0, split).join(' ') : ''
    fields.agencyMain = expanded.slice(split).join(' ')
  }
  function metadata(text: string): boolean {
    let found = false
    const number = text.match(/(?:^|\n)\s*Số\s*:\s*([^\n,]*)/iu)
    if (number) {
      const value = clean(number[1])
      const slash = value.indexOf('/')
      fields.docNumber = (slash < 0 ? value : value.slice(0, slash)).replace(/^[.\s…]+$/, '')
      fields.docSymbol = slash < 0 ? '' : value.slice(slash + 1).trim()
      found = true
    }
    const date = text.match(/(?:^|\n)([^\n,]+),\s*(ngày\s*([\d.\s…]*)\s*tháng\s*(\d{1,2}|[.\s…]+)\s*năm\s*(\d{4}|[.\s…]+))/iu)
    if (date) {
      fields.location = date[1].trim()
      fields.dateText = date[2].trim()
      const day = Number(date[3].trim()), month = Number(date[4].trim()), year = Number(date[5].trim())
      const parsed = new Date(year, month - 1, day)
      if (year > 1900 && parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) fields.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      else fields.date = ''
      found = true
    }
    const summary = text.match(/(?:^|\n)\s*(?:V\s*\/\s*v|Về việc)\s*[:：]?\s*([^\n]+(?:\n(?!\s*(?:Số\s*:|Kính gửi\s*:|[^\n,]+,\s*ngày))[^\n]+)*)/iu)
    if (summary) { fields.docSummary = clean(summary[1]); fields.docType = 'cong-van'; found = true }
    return found
  }

  while (index < blocks.length && index < 24) {
    const block = blocks[index]
    if (block.type === 'image') break
    if (block.type === 'table') {
      if (!isNational(block.rows[0]?.join(' ') || '')) break
      if (agencyLines.length) { agencies(agencyLines); agencyLines = [] }
      headerFound = true
      let consumed = 0
      for (const row of block.rows) {
        const combined = row.join('\n')
        const first = row[0] || ''
        if (isNational(combined)) {
          if (!isNational(first)) {
            const lines = first.split('\n')
            const summaryStart = lines.findIndex(line => /^\s*(?:V\s*\/\s*v|Về việc)\b/iu.test(line))
            agencies((summaryStart < 0 ? lines : lines.slice(0, summaryStart)).filter(line => !/^\s*Số\s*:/iu.test(line)))
          }
          row.forEach(metadata)
          consumed++
        } else if (!combined.trim() || row.every(cell => !cell.trim() || metadata(cell) || /^[-_—\s]+$/.test(cell))) consumed++
        else break
      }
      if (consumed < block.rows.length) {
        blocks[index] = { ...block, rows: block.rows.slice(consumed) }
        break
      }
      index++
      continue
    }
    const text = block.text
    if (titleType(text)) break
    if (isNational(text) || isMotto(text)) {
      if (agencyLines.length) { agencies(agencyLines); agencyLines = [] }
      headerFound = true; index++; continue
    }
    if (metadata(text) || /^[-_—\s]+$/.test(text)) { index++; continue }
    const recipient = text.match(/^Kính gửi\s*[:：]?\s*(.*)/iu)
    if (recipient) { fields.recipient = /^[.\s…]*$/.test(recipient[1]) ? '' : clean(recipient[1]); index++; continue }
    if (nearbyHeader && isUpper(text) && !isHeading(text) && !headerFound && text.length < 250) { agencyLines.push(text); index++; continue }
    break
  }
  if (agencyLines.length) agencies(agencyLines)
  const title = blocks[index]
  const titleFound = title?.type === 'paragraph' && Boolean(titleType(title.text))
  if (title?.type === 'paragraph' && titleType(title.text)) {
    fields.docType = titleType(title.text)
    fields.docSummary = ''
    index++
    const summary: string[] = []
    // Minutes can have a sentence-case subtitle ending with a centered number.
    // Require that number before accepting plain text, so the opening of the
    // minutes ("Hôm nay...", participants, etc.) is not mistaken for a subtitle.
    let minutesNumber = -1
    if (fields.docType === 'bien-ban') {
      for (let i = index; i < Math.min(blocks.length, index + 12); i++) {
        const candidate = blocks[i]
        if (candidate.type !== 'paragraph' || isHeading(candidate.text) || titleType(candidate.text) || isMinutesOpening(candidate.text)) break
        if (/^Số\s*[:：]/iu.test(candidate.text)) { minutesNumber = i; break }
      }
    }
    while (index < blocks.length && summary.length < (minutesNumber >= 0 ? 12 : 6) && (minutesNumber >= 0 || fold(clean(title.text)) !== 'bien ban lam viec')) {
      const block = blocks[index]
      if (block.type !== 'paragraph' || isHeading(block.text) || titleType(block.text) || /^Số\s*[:：]/iu.test(block.text)) break
      if (fields.docType === 'bien-ban' && isMinutesOpening(block.text)) break
      if (minutesNumber < 0 && !isUpper(block.text) && !summaryHints.has(block.text) && !/^Về(?=\s|$)/iu.test(block.text)) break
      summary.push(clean(block.text)); index++
    }
    fields.docSummary = summary.join(' ')
    // Minutes often place the document number below their centered title.
    // Keep it in the source opening instead of normalizing it as a body paragraph.
    while (index < blocks.length) {
      const block = blocks[index]
      if (block.type !== 'paragraph' || !/^Số\s*:/iu.test(block.text)) break
      metadata(block.text)
      if (fields.docType === 'bien-ban' && summary.length) fields.docSummary += `\n${block.text.trim()}`
      index++
    }
  }
  const footer = extractDocumentFooter(blocks.slice(index), fields.docType || fallbackDocType)
  return { fields: { ...fields, ...footer.fields }, blocks: footer.blocks, headerFound, titleFound, footerFound: footer.footerFound }
}

export function recognizeImportedDocument(blocks: MainContentBlock[], name: string, summaryHints?: Set<string>): DocumentState {
  const result = extractAdministrativeContent(blocks, summaryHints)
  return { ...DEFAULT_DOCUMENT_STATE, docSummary: name.replace(/\.(docx|doc)$/i, ''), ...result.fields, mainContentBlocks: result.blocks, mainContent: contentBlocksText(result.blocks) }
}

export function repairImportedDocument(state: DocumentState): DocumentState {
  if (state.sourceLayout) return state
  const blocks = state.mainContentBlocks || state.mainContent.split('\n').map(text => ({ type: 'paragraph' as const, text }))
  const result = extractAdministrativeContent(blocks, new Set(), state.docType)
  if (!result.headerFound && !result.titleFound && !result.footerFound) return state
  // A structured snapshot may already have a user-edited conclusion. A lone closing
  // sentence in its body is not enough evidence to replace that separate field.
  if (!result.headerFound && result.fields.signPosition === undefined && state.conclusion?.trim() && result.fields.conclusion !== undefined) return state
  return { ...state, ...result.fields, mainContentBlocks: result.blocks, mainContent: contentBlocksText(result.blocks) }
}
