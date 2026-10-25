import type { MainContentTableBlock, TableCellStyle } from '@/types'

// Read text from inert parsed HTML, preserving paragraph and line boundaries.
export function htmlElementText(element: Element): string {
  function read(node: Node): string {
    if (node.nodeType === 3) return node.textContent || ''
    if (node.nodeType !== 1) return ''
    const tag = (node as Element).tagName
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return ''
    if (tag === 'BR') return '\n'
    const text = Array.from(node.childNodes).map(read).join('')
    return /^(P|DIV|LI|H[1-6])$/.test(tag) ? `${text}\n` : text
  }
  return read(element).replace(/\r/g, '').replace(/\u00a0/g, ' ').split('\n').map(line => line.trim()).join('\n').trim()
}

export function htmlTableData(table: HTMLTableElement, spreadsheet = false): MainContentTableBlock {
  const grid: string[][] = []
  const merges: NonNullable<MainContentTableBlock['merges']> = []
  const cellStyles: TableCellStyle[][] = []
  // Excel puts formatting in .xlNN classes as well as inline style attributes.
  const rules: { selector: string; declarations: string }[] = []
  table.ownerDocument.querySelectorAll('style').forEach(style => {
    for (const match of (style.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--|-->/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of match[1].split(',')) if (selector.trim() && !selector.includes('@')) rules.push({ selector: selector.trim(), declarations: match[2] })
    }
  })
  function css(element: Element): CSSStyleDeclaration {
    const result = table.ownerDocument.createElement('span').style
    for (const rule of rules) {
      try { if (element.matches(rule.selector)) result.cssText += `;${rule.declarations}` } catch { /* Ignore unsupported Office selectors. */ }
    }
    result.cssText += `;${element.getAttribute('style') || ''}`
    return result
  }
  function length(value: string | null, points = false): number | undefined {
    if (!value) return undefined
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(px|pt)?$/i)
    if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0 || Number(match[1]) > 100_000) return undefined
    return Number(match[1]) * (points ? match[2]?.toLowerCase() === 'pt' ? 1 : 0.75 : match[2]?.toLowerCase() === 'pt' ? 4 / 3 : 1)
  }
  function color(value: string): string | undefined {
    const names: Record<string, string> = { black: '#000000', white: '#FFFFFF', gray: '#808080', grey: '#808080', silver: '#C0C0C0', red: '#FF0000', blue: '#0000FF' }
    if (names[value.toLowerCase()]) return names[value.toLowerCase()]
    if (/^#[\da-f]{6}$/i.test(value)) return value.toUpperCase()
    if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split('').map(char => char + char).join('')}`.toUpperCase()
    const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*1)?\s*\)$/i)
    return rgb ? `#${rgb.slice(1, 4).map(part => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('')}`.toUpperCase() : undefined
  }
  const tableCss = css(table)
  const tableFont = length(tableCss.fontSize, true)
  const constraints: { column: number; span: number; width: number }[] = []
  Array.from(table.rows).forEach((row, r) => {
    grid[r] ||= []
    cellStyles[r] ||= []
    let column = 0
    Array.from(row.cells).forEach(cell => {
      while (grid[r][column] !== undefined) column++
      const columnSpan = Math.min(50, Math.max(1, cell.colSpan))
      const rowSpan = Math.min(1000, Math.max(1, cell.rowSpan || table.rows.length - r))
      if (rowSpan > 1 || columnSpan > 1) merges.push({ row: r, column, rowSpan, colSpan: columnSpan })
      const style = css(cell), rowStyle = css(row)
      const text = htmlElementText(cell)
      const fontSize = length(style.fontSize || rowStyle.fontSize || tableCss.fontSize, true)
      const bold = ['bold', 'bolder'].includes(style.fontWeight) || Number(style.fontWeight) >= 600 || cell.tagName === 'TH' || (cell.querySelector('b,strong')?.textContent?.trim() === text.trim() && Boolean(text))
      const align = style.textAlign || cell.getAttribute('align') || rowStyle.textAlign || tableCss.textAlign
      const verticalAlign = style.verticalAlign || cell.getAttribute('valign') || rowStyle.verticalAlign || tableCss.verticalAlign
      const background = color(style.backgroundColor || cell.getAttribute('bgcolor') || rowStyle.backgroundColor || tableCss.backgroundColor)
      const foreground = color(style.color || rowStyle.color || tableCss.color)
      cellStyles[r][column] = { ...(bold ? { bold: true } : {}), ...(['left', 'center', 'right'].includes(align) ? { align: align as TableCellStyle['align'] } : spreadsheet && /^[-+]?\d[\d,.\s]*%?$/.test(text) ? { align: 'right' as const } : {}), ...(['top', 'middle', 'bottom'].includes(verticalAlign) ? { verticalAlign: verticalAlign as TableCellStyle['verticalAlign'] } : {}), ...(background ? { background } : {}), ...(foreground ? { color: foreground } : {}), ...(fontSize && fontSize >= 6 && fontSize <= 36 ? { fontSize } : {}) }
      const cellWidth = length(style.width) || length(cell.getAttribute('width'))
      if (cellWidth) constraints.push({ column, span: columnSpan, width: cellWidth })
      for (let ri = r; ri < r + rowSpan; ri++) {
        grid[ri] ||= []
        for (let ci = column; ci < column + columnSpan; ci++) grid[ri][ci] = ri === r && ci === column ? text : ''
      }
      column += columnSpan
    })
  })
  const width = Math.max(0, ...grid.map(row => row.length))
  const columnWidths: (number | undefined)[] = []
  table.querySelectorAll('col').forEach(col => {
    const colWidth = length(css(col).width) || length(col.getAttribute('width'))
    for (let i = 0; i < Math.min(50, col.span || 1); i++) columnWidths.push(colWidth)
  })
  constraints.sort((a, b) => a.span - b.span).forEach(item => {
    const indices = Array.from({ length: item.span }, (_, i) => item.column + i)
    const unknown = indices.filter(i => !columnWidths[i])
    const known = indices.reduce((sum, i) => sum + (columnWidths[i] || 0), 0)
    if (unknown.length) unknown.forEach(i => { columnWidths[i] = Math.max(8, (item.width - known) / unknown.length) })
  })
  const tableWidth = length(tableCss.width) || length(table.getAttribute('width'))
  const known = columnWidths.slice(0, width).filter((value): value is number => Boolean(value))
  const fallback = tableWidth ? tableWidth / Math.max(1, width) : known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : 64
  const pixels = Array.from({ length: width }, (_, i) => columnWidths[i] || fallback)
  const sourceWidth = pixels.reduce((sum, value) => sum + value, 0)
  return { type: 'table', rows: width ? grid.map(row => Array.from({ length: width }, (_, c) => row[c] || '')) : [], merges, cellStyles, ...(width && (spreadsheet || known.length || tableWidth) ? { columnWidths: pixels.map(value => value / sourceWidth * 100), sourceWidth } : {}), ...(tableFont ? { fontSize: tableFont } : spreadsheet ? { fontSize: 11 } : {}) }
}

export function htmlTableRows(table: HTMLTableElement): string[][] { return htmlTableData(table).rows }
