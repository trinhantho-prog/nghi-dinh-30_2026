import type { DocumentState, MainContentBlock, MainContentParagraphBlock, MainContentTableBlock } from '@/types'
import { contentBlocksText, extractAdministrativeContent } from './recognize-document'
import { extractDocumentFooter } from './recognize-document-footer'
import { editSourceParagraph } from './source-format'

const compact = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase()
const fields = ['agencyUpper', 'agencyMain', 'docNumber', 'docSymbol', 'location', 'date', 'dateText', 'docType', 'docSummary', 'recipient', 'legalBasis', 'issueStatement', 'signAuthority', 'signPosition', 'signName', 'recipientsCc', 'conclusion', 'partyAUnit', 'partyAPosition', 'partyAName', 'partyBUnit', 'partyBPosition', 'partyBName'] as const

export function organizeSourceDocument(state: DocumentState): DocumentState {
  if (!state.sourceLayout || state.sourceSections) return state
  const blocks = state.mainContentBlocks || []
  const header = blocks.findIndex((block, index) => index < 5 && block.type === 'table' && compact(block.rows.flat().join(' ')).includes('conghoaxahoichunghiavietnam'))
  let footer = -1
  for (let i = blocks.length - 1; i >= Math.max(0, blocks.length - 5); i--) {
    if (blocks[i].type !== 'table') continue
    const result = extractDocumentFooter([blocks[i]], state.docType)
    if (result.footerFound && result.fields.signPosition) { footer = i; break }
  }
  const recognized = extractAdministrativeContent(blocks)
  if (header < 0 && footer < 0) return recognized.titleFound ? { ...state, ...recognized.fields } : state
  let openingEnd = header < 0 ? 0 : header + 1
  while (openingEnd && openingEnd < blocks.length) {
    const block = blocks[openingEnd]
    if (block.type !== 'paragraph' || (block.text.trim() && !/^Kính gửi\s*:/iu.test(block.text.trim()))) break
    openingEnd++
  }
  let closingStart = footer < 0 ? blocks.length : footer
  while (closingStart > openingEnd) {
    const previous = blocks[closingStart - 1]
    if (previous.type !== 'paragraph' || (previous.text.trim() && previous.text.trim() !== recognized.fields.conclusion?.trim())) break
    closingStart--
  }
  const next = { ...state, ...recognized.fields }
  if (header >= 0) {
    const table = blocks[header] as MainContentTableBlock
    const summary = table.rows.flat().find(text => /^\s*V\s*\/\s*v\s*/iu.test(text))
    if (summary) next.docSummary = summary.replace(/^\s*V\s*\/\s*v\s*[:：]?\s*/iu, '').trim()
  }
  const body = blocks.slice(openingEnd, closingStart)
  return { ...next, mainContentBlocks: body, mainContent: contentBlocksText(body), sourceSections: { opening: blocks.slice(0, openingEnd), closing: blocks.slice(closingStart), baseline: Object.fromEntries(fields.map(key => [key, String(next[key] ?? '')])) } }
}

/** Regenerate only edited administrative text inside the original layout. */
export function sourceDocumentBlocks(state: DocumentState): MainContentBlock[] {
  const sections = state.sourceSections
  if (!sections) return state.mainContentBlocks || []
  const changed = (...keys: typeof fields[number][]) => keys.some(key => String(state[key] ?? '') !== sections.baseline[key])
  const update = (paragraphs: MainContentParagraphBlock[], text: string) => text.split('\n').map((line, i) => editSourceParagraph(paragraphs[i] || { ...paragraphs[0], type: 'paragraph', text: '', runs: undefined, rules: undefined }, line))
  const editParagraph = (p: MainContentParagraphBlock, section: 'opening' | 'closing') => {
    const text = p.text.trim()
    for (const key of section === 'opening' ? ['agencyUpper', 'agencyMain'] as const : ['signPosition', 'signName', 'signAuthority'] as const) {
      if (sections.baseline[key] && text === sections.baseline[key].trim() && changed(key)) return editSourceParagraph(p, state[key] || '')
    }
    if (section === 'opening' && /^Số\s*:/iu.test(text) && changed('docNumber', 'docSymbol')) return editSourceParagraph(p, `Số: ${state.docNumber}${state.docSymbol ? `/${state.docSymbol}` : ''}`)
    if (section === 'opening' && /ngày.*tháng.*năm/iu.test(text) && changed('location', 'date', 'dateText')) {
      const parts = state.date?.split('-')
      return editSourceParagraph(p, `${state.location}, ${parts?.length === 3 ? `ngày ${parts[2]} tháng ${parts[1]} năm ${parts[0]}` : state.dateText || 'ngày ... tháng ... năm ...'}`)
    }
    if (section === 'opening' && /^Kính gửi\s*:/iu.test(text) && changed('recipient')) return editSourceParagraph(p, `Kính gửi: ${state.recipient}${text.endsWith('.') && !state.recipient.endsWith('.') ? '.' : ''}`)
    if (section === 'closing' && sections.baseline.conclusion && text === sections.baseline.conclusion.trim() && changed('conclusion')) return editSourceParagraph(p, state.conclusion)
    return p
  }
  const renderSection = (blocks: MainContentBlock[], section: 'opening' | 'closing'): MainContentBlock[] => blocks.map(block => {
    if (block.type === 'paragraph') return editParagraph(block, section)
    if (block.type !== 'table' || !block.cellParagraphs) return block
    const cells = block.cellParagraphs.map(row => row.map(paragraphs => paragraphs.map(p => editParagraph(p, section))))
    if (section === 'opening' && changed('docSummary')) block.rows.forEach((row, r) => row.forEach((text, c) => {
      if (/^\s*V\s*\/\s*v/iu.test(text)) cells[r][c] = update(block.cellParagraphs![r][c], `V/v ${state.docSummary}`)
    }))
    if (section === 'closing' && changed('signAuthority') && !sections.baseline.signAuthority && state.signAuthority) block.rows.forEach((row, r) => row.forEach((text, c) => {
      if (text.split('\n').some(line => line.trim() === sections.baseline.signPosition)) cells[r][c] = [...update([cells[r][c][0]], state.signAuthority || ''), ...cells[r][c]]
    }))
    if (section === 'closing' && changed('recipientsCc')) {
      const r = block.rows.findIndex(row => row.some(text => /^Nơi\s*nhận\s*:/iu.test(text.trim())))
      if (r >= 0) {
        const c = block.rows[r].findIndex(text => /^Nơi\s*nhận\s*:/iu.test(text.trim()))
        const paras = block.cellParagraphs[r][c], marker = paras.findIndex(p => /^Nơi\s*nhận\s*:/iu.test(p.text.trim()))
        if (marker < paras.length - 1 || r === block.rows.length - 1) cells[r][c] = [...paras.slice(0, marker + 1), ...update(paras.slice(marker + 1).length ? paras.slice(marker + 1) : [paras[marker]], state.recipientsCc)]
        else { cells[r + 1][c] = update(block.cellParagraphs[r + 1][c], state.recipientsCc); for (let i = r + 2; i < cells.length; i++) cells[i][c] = [] }
      }
    }
    return { ...block, cellParagraphs: cells, rows: cells.map(row => row.map(paras => paras.map(p => p.text).join('\n'))) }
  })
  const paragraph = (text: string, centered = false): MainContentParagraphBlock => ({ type: 'paragraph', text, style: { fontFamily: 'Times New Roman', fontSize: state.docType === 'bien-ban' ? 13 : 14, align: centered ? 'center' : 'justify', before: 6, after: 6, line: 18, firstLine: centered ? 0 : 36 } })
  const textKey = (text: string) => text.replace(/\s+/g, ' ').trim()
  let sourceOpening = sections.opening
  if (changed('docSummary')) {
    const summary = textKey(sections.baseline.docSummary || '')
    let replaced = false
    if (summary) for (let start = 0; start < sourceOpening.length && !replaced; start++) {
      let text = ''
      for (let end = start; end < sourceOpening.length; end++) {
        const block = sourceOpening[end]
        if (block.type !== 'paragraph') break
        text = textKey(`${text} ${block.text}`)
        if (text === summary) {
          const originals = sourceOpening.slice(start, end + 1) as MainContentParagraphBlock[]
          sourceOpening = [...sourceOpening.slice(0, start), ...update(originals, state.docSummary), ...sourceOpening.slice(end + 1)]
          replaced = true
          break
        }
        if (!summary.startsWith(text)) break
      }
    }
    const tableSummary = sourceOpening.some(block => block.type === 'table' && block.rows.some(row => row.some(text => /^\s*V\s*\/\s*v/iu.test(text))))
    if (!replaced && !tableSummary && state.docSummary.trim()) sourceOpening = [...sourceOpening, ...state.docSummary.split('\n').map(text => paragraph(text, true))]
  }
  const opening = renderSection(sourceOpening, 'opening')
  if (changed('docType') && state.docType !== 'cong-van') {
    const titles = { 'bao-cao': 'BÁO CÁO', 'thong-bao': 'THÔNG BÁO', 'ke-hoach': 'KẾ HOẠCH', 'bien-ban': 'BIÊN BẢN' }
    opening.push({ type: 'paragraph', text: titles[state.docType], style: { fontFamily: 'Times New Roman', fontSize: 14, bold: true, align: 'center', before: 6, after: 6 } })
  }
  const hasText = (blocks: MainContentBlock[], test: (text: string) => boolean) => blocks.some(block => block.type === 'paragraph' ? test(block.text) : block.type === 'table' && block.rows.some(row => row.some(test)))
  if (changed('recipient') && state.recipient.trim() && !hasText(sections.opening, text => /^\s*Kính gửi\s*:/iu.test(text))) opening.push(paragraph(`Kính gửi: ${state.recipient}`))
  const additions = (key: 'legalBasis' | 'issueStatement' | 'conclusion') => changed(key) && state[key].trim() ? state[key].split('\n').map(text => paragraph(text)) : []
  const closing = renderSection(sections.closing, 'closing')
  const conclusionInSource = Boolean(sections.baseline.conclusion?.trim()) && hasText(sections.closing, text => textKey(text) === textKey(sections.baseline.conclusion))
  const parties = ['partyAUnit', 'partyAPosition', 'partyAName', 'partyBUnit', 'partyBPosition', 'partyBName'] as const
  const signatures: MainContentBlock[] = []
  if (state.docType === 'bien-ban' && changed(...parties) && parties.some(key => state[key].trim())) {
    const rows = [
      ['ĐẠI DIỆN BÊN A', 'ĐẠI DIỆN BÊN B'],
      [state.partyAUnit, state.partyBUnit],
      [state.partyAPosition, state.partyBPosition],
      [state.partyAName, state.partyBName],
    ]
    const cellParagraphs = rows.map((row, r) => row.map(text => text.split('\n').map(line => {
      const p = paragraph(line, true)
      return { ...p, style: { ...p.style, bold: true, ...(r === 3 ? { before: 36 } : {}) } }
    })))
    signatures.push({ type: 'table', rows, columnWidths: [50, 50], borderless: true, cellParagraphs })
  }
  return [...opening, ...additions('legalBasis'), ...additions('issueStatement'), ...(state.mainContentBlocks || []), ...(conclusionInSource ? [] : additions('conclusion')), ...closing, ...signatures]
}
