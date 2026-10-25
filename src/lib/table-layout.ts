import type { MainContentTableBlock, TableCellMerge, TableCellStyle } from '@/types'

export type CellRange = { top: number; left: number; bottom: number; right: number }
const intersects = (merge: TableCellMerge, range: CellRange) => merge.row <= range.bottom && merge.row + merge.rowSpan > range.top && merge.column <= range.right && merge.column + merge.colSpan > range.left

export function expandCellRange(block: MainContentTableBlock, input: CellRange): CellRange {
  const range = { top: Math.min(block.rows.length - 1, Math.max(0, Math.min(input.top, input.bottom))), left: Math.min(block.rows[0].length - 1, Math.max(0, Math.min(input.left, input.right))), bottom: Math.max(0, Math.min(block.rows.length - 1, Math.max(input.top, input.bottom))), right: Math.max(0, Math.min(block.rows[0].length - 1, Math.max(input.left, input.right))) }
  let changed = true
  while (changed) {
    const before = JSON.stringify(range)
    for (const merge of block.merges || []) if (intersects(merge, range)) {
      range.top = Math.min(range.top, merge.row); range.left = Math.min(range.left, merge.column)
      range.bottom = Math.max(range.bottom, merge.row + merge.rowSpan - 1); range.right = Math.max(range.right, merge.column + merge.colSpan - 1)
    }
    changed = before !== JSON.stringify(range)
  }
  return range
}

export function mergeTableCells(block: MainContentTableBlock, input: CellRange): MainContentTableBlock {
  const range = expandCellRange(block, input)
  if (range.top === range.bottom && range.left === range.right) return block
  const rows = block.rows.map(row => [...row])
  const text: string[] = []
  for (let r = range.top; r <= range.bottom; r++) for (let c = range.left; c <= range.right; c++) {
    if (!tableCellLayout(block, r, c).hidden && rows[r][c]) text.push(rows[r][c])
    rows[r][c] = ''
  }
  rows[range.top][range.left] = text.join('\n')
  const merges = (block.merges || []).filter(merge => !intersects(merge, range))
  merges.push({ row: range.top, column: range.left, rowSpan: range.bottom - range.top + 1, colSpan: range.right - range.left + 1 })
  return { ...block, rows, merges }
}

export function unmergeTableCells(block: MainContentTableBlock, input: CellRange): MainContentTableBlock {
  return { ...block, merges: (block.merges || []).filter(merge => !intersects(merge, input)) }
}

export function alignTableCells(block: MainContentTableBlock, input: CellRange, alignment: Pick<TableCellStyle, 'align' | 'verticalAlign'>): MainContentTableBlock {
  const range = expandCellRange(block, input)
  const selected = (r: number, c: number) => r >= range.top && r <= range.bottom && c >= range.left && c <= range.right
  const cellStyles = block.rows.map((row, r) => row.map((_, c) => ({ ...block.cellStyles?.[r]?.[c], ...(selected(r, c) ? alignment : {}) })))
  const cellParagraphs = block.cellParagraphs?.map((row, r) => row.map((paragraphs, c) => selected(r, c) && alignment.align ? paragraphs.map(p => ({ ...p, style: { ...p.style, align: alignment.align } })) : paragraphs))
  return { ...block, cellStyles, ...(cellParagraphs ? { cellParagraphs } : {}) }
}

export function tableCellLayout(block: MainContentTableBlock, row: number, column: number) {
  const merge = block.merges?.find(item => row >= item.row && row < item.row + item.rowSpan && column >= item.column && column < item.column + item.colSpan)
  return { hidden: Boolean(merge && (merge.row !== row || merge.column !== column)), rowSpan: merge?.rowSpan || 1, colSpan: merge?.colSpan || 1, style: block.cellStyles?.[row]?.[column] || {} }
}

export function tableFontScale(block: MainContentTableBlock, pageWidth: number) {
  return block.sourceWidth && block.sourceWidth > pageWidth ? pageWidth / block.sourceWidth : 1
}

export function visibleTableCells(block: MainContentTableBlock) {
  return block.rows.flatMap((row, r) => row.flatMap((_, c) => tableCellLayout(block, r, c).hidden ? [] : [{ row: r, column: c }]))
}

export function validateTableLayout(block: MainContentTableBlock): MainContentTableBlock {
  const height = block.rows.length, width = block.rows[0]?.length || 0
  const occupied = new Set<number>()
  const merges: TableCellMerge[] = []
  if (block.merges !== undefined && (!Array.isArray(block.merges) || block.merges.length > height * width)) throw new Error('Ô gộp không hợp lệ.')
  for (const merge of block.merges || []) {
    if (!merge || ![merge.row, merge.column, merge.rowSpan, merge.colSpan].every(Number.isInteger) || merge.row < 0 || merge.column < 0 || merge.rowSpan < 1 || merge.colSpan < 1 || merge.row + merge.rowSpan > height || merge.column + merge.colSpan > width) throw new Error('Phạm vi ô gộp không hợp lệ.')
    for (let r = merge.row; r < merge.row + merge.rowSpan; r++) for (let c = merge.column; c < merge.column + merge.colSpan; c++) {
      const key = r * width + c
      if (occupied.has(key) || ((r !== merge.row || c !== merge.column) && block.rows[r][c] !== '')) throw new Error('Ô gộp chồng lấn hoặc che mất dữ liệu.')
      occupied.add(key)
    }
    if (merge.rowSpan > 1 || merge.colSpan > 1) merges.push({ row: merge.row, column: merge.column, rowSpan: merge.rowSpan, colSpan: merge.colSpan })
  }
  const styles = Array.isArray(block.cellStyles) ? block.cellStyles.slice(0, height).map(row => Array.isArray(row) ? row.slice(0, width).map((value): TableCellStyle => {
    if (!value || typeof value !== 'object') return {}
    const style: TableCellStyle = {}
    if (typeof value.bold === 'boolean') style.bold = value.bold
    if (['left', 'center', 'right'].includes(value.align || '')) style.align = value.align
    if (['top', 'middle', 'bottom'].includes(value.verticalAlign || '')) style.verticalAlign = value.verticalAlign
    if (/^#[\da-f]{6}$/i.test(value.background || '')) style.background = value.background
    if (/^#[\da-f]{6}$/i.test(value.color || '')) style.color = value.color
    if (typeof value.fontSize === 'number' && Number.isFinite(value.fontSize) && value.fontSize >= 6 && value.fontSize <= 36) style.fontSize = value.fontSize
    return style
  }) : []) : undefined
  return { ...block, ...(block.merges ? { merges } : {}), ...(styles ? { cellStyles: styles } : {}), ...(typeof block.fontSize === 'number' && Number.isFinite(block.fontSize) && block.fontSize >= 6 && block.fontSize <= 36 ? { fontSize: block.fontSize } : { fontSize: undefined }), ...(typeof block.sourceWidth === 'number' && Number.isFinite(block.sourceWidth) && block.sourceWidth > 0 && block.sourceWidth < 100_000 ? { sourceWidth: block.sourceWidth } : { sourceWidth: undefined }) }
}

export function changeTableStructure(block: MainContentTableBlock, axis: 'row' | 'column', index: number, remove: boolean): MainContentTableBlock {
  const rows = block.rows.map(row => [...row])
  const styles = block.cellStyles?.map(row => row.map(style => ({ ...style })))
  const paragraphs = block.cellParagraphs?.map(row => row.map(cell => [...cell]))
  const count = axis === 'row' ? rows.length : rows[0].length
  if ((remove && count <= 1) || index < 0 || index > count || (remove && index === count)) return block
  const widths = block.columnWidths ? [...block.columnWidths] : undefined
  if (axis === 'row') { rows.splice(index, remove ? 1 : 0, ...(remove ? [] : [Array<string>(rows[0].length).fill('')])); styles?.splice(index, remove ? 1 : 0, ...(remove ? [] : [Array.from({ length: rows[0].length }, () => ({}))])) }
  else {
    rows.forEach(row => row.splice(index, remove ? 1 : 0, ...(remove ? [] : [''])))
    styles?.forEach(row => row.splice(index, remove ? 1 : 0, ...(remove ? [] : [{}])))
    widths?.splice(index, remove ? 1 : 0, ...(remove ? [] : [100 / count]))
  }
  if (paragraphs) {
    if (axis === 'row') paragraphs.splice(index, remove ? 1 : 0, ...(remove ? [] : [Array.from({ length: rows[0].length }, () => [])]))
    else paragraphs.forEach(row => row.splice(index, remove ? 1 : 0, ...(remove ? [] : [[]])))
  }
  const merges = (block.merges || []).flatMap(original => {
    const merge = { ...original }
    const startKey = axis === 'row' ? 'row' : 'column', spanKey = axis === 'row' ? 'rowSpan' : 'colSpan'
    const start = merge[startKey], end = start + merge[spanKey]
    if (!remove) {
      if (index <= start) merge[startKey]++
      else if (index < end) merge[spanKey]++
    } else if (index < start) merge[startKey]--
    else if (index < end) {
      merge[spanKey]--
      if (!merge[spanKey]) return []
      if (index === start) {
        rows[merge.row][merge.column] = block.rows[original.row][original.column]
        if (styles?.[merge.row]) styles[merge.row][merge.column] = { ...block.cellStyles?.[original.row]?.[original.column] }
        if (paragraphs?.[merge.row]) paragraphs[merge.row][merge.column] = block.cellParagraphs?.[original.row]?.[original.column] || []
      }
    }
    return merge.rowSpan > 1 || merge.colSpan > 1 ? [merge] : []
  })
  return { ...block, rows, merges, ...(styles ? { cellStyles: styles } : {}), ...(paragraphs ? { cellParagraphs: paragraphs } : {}), columnWidths: widths }
}

export function pasteTableInto(target: MainContentTableBlock, source: MainContentTableBlock, r: number, c: number): MainContentTableBlock {
  const height = Math.max(target.rows.length, r + source.rows.length), width = Math.max(target.rows[0].length, c + source.rows[0].length)
  const rows = Array.from({ length: height }, (_, ri) => Array.from({ length: width }, (_, ci) => target.rows[ri]?.[ci] || ''))
  const cellStyles = Array.from({ length: height }, (_, ri) => Array.from({ length: width }, (_, ci) => ({ ...target.cellStyles?.[ri]?.[ci] })))
  const cellParagraphs = target.cellParagraphs || source.cellParagraphs ? Array.from({ length: height }, (_, ri) => Array.from({ length: width }, (_, ci) => target.cellParagraphs?.[ri]?.[ci] || [])) : undefined
  source.rows.forEach((row, ri) => row.forEach((value, ci) => { rows[r + ri][c + ci] = value; cellStyles[r + ri][c + ci] = { ...(source.fontSize ? { fontSize: source.fontSize } : {}), ...source.cellStyles?.[ri]?.[ci] } }))
  if (cellParagraphs) source.rows.forEach((row, ri) => row.forEach((_, ci) => { cellParagraphs[r + ri][c + ci] = source.cellParagraphs?.[ri]?.[ci] || [] }))
  const merges = (target.merges || []).filter(merge => merge.row + merge.rowSpan <= r || merge.row >= r + source.rows.length || merge.column + merge.colSpan <= c || merge.column >= c + source.rows[0].length)
  merges.push(...(source.merges || []).map(merge => ({ ...merge, row: merge.row + r, column: merge.column + c })))
  const replaceAll = r === 0 && c === 0 && source.rows.length >= target.rows.length && source.rows[0].length >= target.rows[0].length
  return { ...target, ...(replaceAll ? { fontSize: source.fontSize, sourceWidth: source.sourceWidth, columnWidths: source.columnWidths } : {}), rows, merges, cellStyles, ...(cellParagraphs ? { cellParagraphs } : {}) }
}
