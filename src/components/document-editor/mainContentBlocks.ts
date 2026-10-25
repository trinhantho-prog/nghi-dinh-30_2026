import { DocumentState, MainContentBlock, MainContentTableBlock } from '@/types'
import { htmlTableData } from '@/lib/html-content'

function normalizeCellText(text: string): string {
  return text.replace(/\r/g, '').replace(/ /g, ' ')
}

function isTableRows(rows: string[][]): boolean {
  return rows.length > 0 && rows.every(row => row.length > 0)
}

export function tableRowsToPlainText(rows: string[][]): string {
  return rows.map(row => row.join('\t')).join('\n')
}

export function plainTextToMainContentBlocks(text: string): MainContentBlock[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ type: 'paragraph', text: line } satisfies MainContentBlock))
}

export function blocksToPlainText(blocks: MainContentBlock[]): string {
  return blocks
    .map(block => block.type === 'table' ? tableRowsToPlainText(block.rows) : block.type === 'image' ? `[Ảnh: ${block.alt}]` : block.text)
    .join('\n')
}

export function getEffectiveMainContentBlocks(state: DocumentState): MainContentBlock[] {
  if (state.mainContentBlocks?.length) return state.mainContentBlocks
  return plainTextToMainContentBlocks(state.mainContent)
}

export function parseTabularText(text: string, forceSingleColumn = false): string[][] | null {
  if (!text || (!forceSingleColumn && !text.includes('\t') && !text.includes('\n'))) return null
  // Excel TSV uses quoted fields for cells containing embedded tabs or line breaks.
  const rows: string[][] = []
  let row: string[] = [], value = '', quoted = false, fieldStart = true, endedWithRow = false, foundDelimiter = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++ }
      else if (char === '"') quoted = false
      else value += char
      endedWithRow = false
    } else if (char === '"' && fieldStart) { quoted = true; fieldStart = false; endedWithRow = false }
    else if (char === '\t') { row.push(normalizeCellText(value)); value = ''; fieldStart = true; endedWithRow = false; foundDelimiter = true }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(normalizeCellText(value)); rows.push(row); row = []; value = ''; fieldStart = true; endedWithRow = true
    } else { value += char; fieldStart = false; endedWithRow = false }
  }
  if (quoted || (!foundDelimiter && !forceSingleColumn)) return null
  if (!endedWithRow) { row.push(normalizeCellText(value)); rows.push(row) }

  if (!isTableRows(rows)) return null

  const columnCount = Math.max(...rows.map(row => row.length))
  return rows.map(row => [...row, ...Array(Math.max(0, columnCount - row.length)).fill('')])
}

export function parseHtmlTable(html: string): string[][] | null {
  return parseHtmlTableBlock(html)?.rows || null
}

export function parseHtmlTableBlock(html: string): MainContentTableBlock | null {
  if (!html || !/<table[\s>]/i.test(html)) return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null

  const block = htmlTableData(table, true)
  const rows = block.rows

  if (!isTableRows(rows)) return null

  return block
}

export function parseClipboardTable(html: string, text: string, forceSingleColumn = false): MainContentTableBlock | null {
  const rich = parseHtmlTableBlock(html)
  if (rich) return rich
  const rows = parseTabularText(text, forceSingleColumn)
  return rows ? { type: 'table', rows, fontSize: 11, sourceWidth: rows[0].length * 64 } : null
}

export function parseClipboardToMainContentBlocks(html: string, text: string): MainContentBlock[] {
  const table = parseClipboardTable(html, text)
  if (table) return [table]

  return plainTextToMainContentBlocks(text)
}
