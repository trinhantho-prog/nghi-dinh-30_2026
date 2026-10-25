import type { MainContentTableBlock, TableCellStyle } from '@/types'
import { TABLE_FONT_FAMILIES, type CellRange, expandCellRange, tableCellLayout, visibleTableCells } from '@/lib/table-layout'

export default function TableFontControls({ table, range, onChange, onSelectAll, defaultSize }: {
  table: MainContentTableBlock
  range?: CellRange
  defaultSize: number
  onChange: (font: Pick<TableCellStyle, 'fontFamily' | 'fontSize'>) => void
  onSelectAll: () => void
}) {
  const expanded = range && expandCellRange(table, range)
  const selected = expanded ? visibleTableCells(table).filter(({row, column}) => row >= expanded.top && row <= expanded.bottom && column >= expanded.left && column <= expanded.right) : []
  const fonts = selected.map(({row, column}) => {
    const style = tableCellLayout(table, row, column).style
    const source = table.cellParagraphs?.[row]?.[column]?.[0]
    return { fontFamily: style.fontFamily || source?.runs?.[0]?.style?.fontFamily || source?.style?.fontFamily || 'Times New Roman', fontSize: style.fontSize || table.fontSize || defaultSize }
  })
  const family = fonts.length && fonts.every(font => font.fontFamily === fonts[0].fontFamily) ? fonts[0].fontFamily : ''
  const size = fonts.length && fonts.every(font => font.fontSize === fonts[0].fontSize) ? fonts[0].fontSize : ''
  const families = Array.from(new Set([...TABLE_FONT_FAMILIES, ...(family ? [family] : [])]))
  const sizes = Array.from(new Set([6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, ...(size ? [size] : [])])).sort((a,b) => a-b)
  return <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
    <button type="button" className="rounded border border-[#c8d0e8] px-2 py-1 text-blue-700 hover:bg-blue-50" onClick={onSelectAll}>Chọn cả bảng</button>
    <label className="flex items-center gap-1">Phông chữ
      <select aria-label="Phông chữ trong ô" disabled={!range} value={family} onChange={event => onChange({fontFamily:event.target.value})} className="max-w-44 rounded border border-[#c8d0e8] bg-white px-2 py-1 disabled:opacity-40">
        <option value="" disabled>{range ? 'Nhiều phông chữ' : 'Chọn ô trước'}</option>
        {families.map(font => <option key={font} value={font}>{font}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-1">Cỡ chữ (pt)
      <select aria-label="Cỡ chữ trong ô" disabled={!range} value={size} onChange={event => onChange({fontSize:Number(event.target.value)})} className="rounded border border-[#c8d0e8] bg-white px-2 py-1 disabled:opacity-40">
        <option value="" disabled>{range ? 'Nhiều cỡ' : 'Chọn ô'}</option>
        {sizes.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <span className="text-slate-500">Chọn ô, kéo chọn nhiều ô hoặc chọn cả bảng để đổi chữ.</span>
  </div>
}
