import { DocumentState, MainContentBlock } from '@/types'

function normalizeCellText(text: string): string {
  return text.replace(/\r/g, '').replace(/ /g, ' ').trim()
}

function isTableRows(rows: string[][]): boolean {
  return rows.length > 1 && rows.every(row => row.length > 1)
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
    .map(block => block.type === 'table' ? tableRowsToPlainText(block.rows) : block.text)
    .join('\n')
}

export function getEffectiveMainContentBlocks(state: DocumentState): MainContentBlock[] {
  if (state.mainContentBlocks?.length) return state.mainContentBlocks
  return plainTextToMainContentBlocks(state.mainContent)
}

export function parseTabularText(text: string): string[][] | null {
  const rows = text
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.split('\t').map(normalizeCellText))
    .filter(row => row.some(Boolean))

  if (!isTableRows(rows)) return null

  const columnCount = Math.max(...rows.map(row => row.length))
  return rows.map(row => [...row, ...Array(Math.max(0, columnCount - row.length)).fill('')])
}

export function parseHtmlTable(html: string): string[][] | null {
  if (!html || !html.includes('<table')) return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null

  const rows = Array.from(table.querySelectorAll('tr'))
    .map(row => Array.from(row.querySelectorAll('th, td')).map(cell => normalizeCellText(cell.textContent || '')))
    .filter(row => row.some(Boolean))

  if (!isTableRows(rows)) return null

  const columnCount = Math.max(...rows.map(row => row.length))
  return rows.map(row => [...row, ...Array(Math.max(0, columnCount - row.length)).fill('')])
}

export function parseClipboardToMainContentBlocks(html: string, text: string): MainContentBlock[] {
  const htmlRows = parseHtmlTable(html)
  if (htmlRows) return [{ type: 'table', rows: htmlRows }]

  const textRows = parseTabularText(text)
  if (textRows) return [{ type: 'table', rows: textRows }]

  return plainTextToMainContentBlocks(text)
}
