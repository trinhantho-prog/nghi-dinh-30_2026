'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentState, MainContentBlock, MainContentTableBlock } from '@/types'
import { getEffectiveMainContentBlocks, parseClipboardTable, parseTabularText } from './mainContentBlocks'
import AutoSizeTableCell from './AutoSizeTableCell'
import TableFontControls from './TableFontControls'
import { normalizeColumnWidths, resizeColumnBoundary } from './tableSizing'
import { CellRange, alignTableCells, changeTableStructure, expandCellRange, formatTableCellFont, mergeTableCells, pasteTableInto, tableCellLayout, unmergeTableCells, visibleTableCells } from '@/lib/table-layout'
import { MAX_DOCUMENT_DATA_LENGTH, clipboardImageBlock, matchPreviousImageLayout } from '@/lib/document-image'
import { editSourceParagraph } from '@/lib/source-format'

const buttonClass = 'rounded border border-[#c8d0e8] bg-white px-2 py-1 text-xs text-[#1a56b0] hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40'
const emptyRows = (rows: number, columns: number) => Array.from({ length: rows }, () => Array<string>(columns).fill(''))

interface Props {
  state: DocumentState
  onChange: (blocks: MainContentBlock[]) => void
  editorRef: React.RefObject<HTMLDivElement | null>
}

export default function MainContentEditor({ state, onChange, editorRef }: Props) {
  const blocks = useMemo(() => getEffectiveMainContentBlocks(state).reduce<MainContentBlock[]>((result, block) => {
    const previous = result[result.length - 1]
    if (!state.sourceLayout && block.type === 'paragraph' && previous?.type === 'paragraph') {
      result[result.length - 1] = { type: 'paragraph', text: `${previous.text}\n${block.text}` }
    } else result.push(block)
    return result
  }, []), [state])
  const content = useMemo<MainContentBlock[]>(() => blocks.length || state.sourceLayout ? blocks : [{ type: 'paragraph', text: '' }], [blocks, state.sourceLayout])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [size, setSize] = useState({ rows: 3, columns: 3 })
  const [hoverSize, setHoverSize] = useState({ rows: 3, columns: 3 })
  const [activeCell, setActiveCell] = useState({ block: -1, row: 0, column: 0 })
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState('')
  const [cellSelection, setCellSelection] = useState<{ block: number; range: CellRange; anchor: { row: number; column: number } } | null>(null)
  const contentRef = useRef(content)
  const pendingImageFocus = useRef<number | null>(null)
  const stopSelection = useRef<(() => void) | null>(null)
  const cellDrag = useRef(false)
  const selection = useRef({ block: 0, start: 0, end: 0 })
  const pickerRef = useRef<HTMLDetailsElement>(null)
  const drag = useRef<{ block: number; column: number; startX: number; width: number; widths: number[] } | null>(null)
  useEffect(() => {
    contentRef.current = content
    if (pendingImageFocus.current !== null) {
      const index = pendingImageFocus.current
      pendingImageFocus.current = null
      selection.current = { block: index, start: 0, end: 0 }
      const input = editorRef.current?.querySelector<HTMLTextAreaElement>(`[data-paragraph="${index}"]`)
      input?.focus()
      input?.setSelectionRange(0, 0)
    }
  }, [content, editorRef])
  useEffect(() => () => stopSelection.current?.(), [])

  function startCellSelection(event: React.PointerEvent<HTMLTableCellElement>, block: MainContentTableBlock, index: number, row: number, column: number) {
    if (event.button !== 0) return
    stopSelection.current?.()
    const anchor = event.shiftKey && cellSelection?.block === index ? cellSelection.anchor : { row, column }
    const initial = expandCellRange(block, { top: anchor.row, left: anchor.column, bottom: row, right: column })
    setCellSelection({ block: index, range: initial, anchor })
    setActiveCell({ block: index, row, column })
    selection.current = { block: index, start: 0, end: 0 }
    cellDrag.current = true
    if (event.shiftKey) event.preventDefault()
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return
      const cell = document.elementFromPoint(next.clientX, next.clientY)?.closest<HTMLElement>('[data-table-cell]')
      if (!cell || !editorRef.current?.contains(cell)) return
      const [tableIndex, r, c] = (cell.dataset.tableCell || '').split('-').map(Number)
      if (tableIndex !== index || (r === row && c === column && !event.shiftKey)) return
      next.preventDefault()
      window.getSelection()?.removeAllRanges()
      const range = expandCellRange(block, { top: anchor.row, left: anchor.column, bottom: r, right: c })
      setCellSelection({ block: index, range, anchor })
    }
    const finish = () => {
      cellDrag.current = false
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', finish)
      stopSelection.current = null
    }
    document.addEventListener('pointermove', move, { passive: false })
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', finish)
    stopSelection.current = finish
  }

  async function insertImages(files: Blob[]) {
    const target = { ...selection.current }
    const original = contentRef.current[target.block]
    try {
      const decoded = await Promise.all(files.map(clipboardImageBlock))
      const current = contentRef.current
      const images = matchPreviousImageLayout(decoded, current, target.block)
      const block = current[target.block]
      let next: MainContentBlock[]
      let afterIndex: number
      if (block?.type === 'paragraph') {
        const start = Math.min(target.start, block.text.length)
        const end = original?.type === 'paragraph' && original.text === block.text ? Math.min(target.end, block.text.length) : start
        next = [...current.slice(0, target.block), { type: 'paragraph', text: block.text.slice(0, start) }, ...images, { type: 'paragraph', text: block.text.slice(end) }, ...current.slice(target.block + 1)]
        afterIndex = target.block + images.length + 1
      } else {
        const index = Math.min(target.block + 1, current.length)
        next = [...current.slice(0, index), ...images, { type: 'paragraph', text: '' }, ...current.slice(index)]
        afterIndex = index + images.length
      }
      if (JSON.stringify(next).length > MAX_DOCUMENT_DATA_LENGTH - 20_000) throw new Error('Văn bản có quá nhiều ảnh. Hãy chụp vùng nhỏ hơn hoặc xóa bớt ảnh.')
      pendingImageFocus.current = afterIndex
      onChange(next)
      setCellSelection(null)
      setPasteMessage('Đã dán ảnh chụp màn hình. Có thể chỉnh độ rộng và căn ảnh ngay bên dưới.')
    } catch (error) { setPasteMessage(error instanceof Error ? error.message : 'Không thể dán ảnh.') }
  }

  async function pasteScreenshot() {
    try {
      const items = await navigator.clipboard.read()
      const images: Blob[] = []
      for (const item of items) {
        const mime = item.types.find(type => type.startsWith('image/'))
        if (mime) images.push(await item.getType(mime))
      }
      if (images.length) { await insertImages(images); return }
    } catch { /* Normal Ctrl+V does not require Clipboard API access. */ }
    setPasteMessage('Chụp màn hình, chọn vị trí trong nội dung chính rồi nhấn Ctrl+V để dán ảnh.')
  }

  function focusCell(block: number, row: number, column: number) {
    requestAnimationFrame(() => editorRef.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${block}-${row}-${column}"]`)?.focus())
  }

  function insertTable(input: string[][] | MainContentTableBlock) {
    const table: MainContentTableBlock = Array.isArray(input) ? { type: 'table', rows: input } : input
    const target = selection.current
    const block = content[target.block]
    let next: MainContentBlock[]
    let tableIndex: number
    if (block?.type === 'paragraph') {
      const before = block.text.slice(0, target.start)
      const after = block.text.slice(target.end)
      tableIndex = target.block + 1
      next = [...content.slice(0, target.block), { type: 'paragraph', text: before }, table, { type: 'paragraph', text: after }, ...content.slice(target.block + 1)]
    } else {
      tableIndex = Math.min(target.block + 1, content.length)
      next = [...content.slice(0, tableIndex), table, { type: 'paragraph', text: '' }, ...content.slice(tableIndex)]
    }
    onChange(next)
    setPickerOpen(false)
    setCellSelection(null)
    focusCell(tableIndex, 0, 0)
  }

  function updateRows(index: number, rows: string[][], columnWidths?: number[]) {
    onChange(content.map((block, i) => i === index && block.type === 'table' ? {
      ...block, rows, columnWidths: normalizeColumnWidths(columnWidths || block.columnWidths, rows[0].length),
      ...(block.cellParagraphs ? { cellParagraphs: rows.map((row, r) => row.map((text, c) => {
        const paragraphs = block.cellParagraphs?.[r]?.[c]
        if (paragraphs?.map(p => p.text).join('\n') === text) return paragraphs
        return text.split('\n').map((line, index) => editSourceParagraph(paragraphs?.[index] || { type: 'paragraph', text: '', style: paragraphs?.[0]?.style }, line))
      })) } : {}),
    } : block))
  }

  function pasteRows(input: string[][] | MainContentTableBlock) {
    const table: MainContentTableBlock = Array.isArray(input) ? { type: 'table', rows: input, fontSize: 11, sourceWidth: input[0].length * 64 } : input
    const index = selection.current.block
    const block = content[index]
    if (block?.type === 'table' && activeCell.block === index) {
      const { row: r, column: c } = activeCell
      const next = pasteTableInto(block, table, r, c)
      onChange(content.map((item, i) => i === index ? next : item))
      focusCell(index, r, c)
    } else insertTable(table)
    setPasteOpen(false)
    setPasteText('')
    setPasteMessage('Đã dán bảng Excel. Bạn có thể sửa ô, kéo cột hoặc chọn Vừa nội dung.')
  }

  async function pasteFromExcel() {
    try {
      let html = '', text = ''
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read()
        for (const item of items) {
          if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text()
          if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text()
        }
      } else text = await navigator.clipboard.readText()
      const rows = parseClipboardTable(html, text, true)
      if (rows) { pasteRows(rows); return }
    } catch { /* Offer normal Ctrl+V when the browser cannot read the clipboard. */ }
    setPasteOpen(true)
    setPasteMessage('Sao chép vùng ô trong Excel rồi nhấn Ctrl+V vào khung bên dưới.')
  }

  function updateWidths(index: number, widths: number[]) {
    onChange(content.map((block, i) => i === index && block.type === 'table' ? { ...block, columnWidths: widths } : block))
  }

  function fitColumns(index: number) {
    const table = editorRef.current?.querySelector<HTMLTableElement>(`[data-table="${index}"]`)
    const block = content[index]
    const context = document.createElement('canvas').getContext('2d')
    if (!table || block?.type !== 'table' || !context) return
    const input = table.querySelector('textarea')
    if (!input) return
    context.font = getComputedStyle(input).font
    const desired = block.rows[0].map(() => 36)
    block.rows.forEach((row, r) => row.forEach((text, c) => {
      const layout = tableCellLayout(block, r, c)
      if (layout.hidden) return
      const measured = Math.max(...text.split('\n').map(line => context.measureText(line).width + 12)) / layout.colSpan
      for (let column = c; column < c + layout.colSpan; column++) desired[column] = Math.max(desired[column], measured)
    }))
    const available = table.getBoundingClientRect().width
    const minimum = Math.min(36, available / desired.length)
    const remaining = Math.max(0, available - minimum * desired.length)
    const total = desired.reduce((sum, width) => sum + width, 0)
    updateWidths(index, desired.map(width => (minimum + remaining * width / total) / available * 100))
  }

  function removeTable(index: number) {
    const next = content.filter((_, i) => i !== index)
    onChange(next)
    setActiveCell({ block: -1, row: 0, column: 0 })
    setCellSelection(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[#1a1f36]" onPasteCapture={e => {
      const files = Array.from(e.clipboardData.items).filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter((file): file is File => Boolean(file))
      // Excel may also offer a bitmap. Prefer its editable table HTML over that bitmap.
      if (!files.length || /<table[\s>]/i.test(e.clipboardData.getData('text/html'))) return
      const input = e.target as HTMLTextAreaElement
      if (input.tagName === 'TEXTAREA' && input.dataset.paragraph !== undefined) {
        selection.current = { block: Number(input.dataset.paragraph), start: input.selectionStart, end: input.selectionEnd }
      }
      e.preventDefault(); e.stopPropagation(); void insertImages(files)
    }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#c8d0e8] bg-white/80 px-5 py-2">
        <details ref={pickerRef} open={pickerOpen} onToggle={e => setPickerOpen(e.currentTarget.open)} className="relative" onKeyDown={e => {
          if (e.key === 'Escape') { setPickerOpen(false); pickerRef.current?.querySelector('summary')?.focus() }
        }} onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPickerOpen(false)
        }}>
          <summary className={`${buttonClass} cursor-pointer list-none`} aria-label="Chèn bảng">▦ Chèn bảng ▾</summary>
          <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-[#c8d0e8] bg-white p-3 shadow-xl">
            <p className="mb-2 text-sm font-semibold">Bảng {hoverSize.columns} × {hoverSize.rows}</p>
            <div className="grid grid-cols-8 gap-1" onMouseLeave={() => setHoverSize(size)}>
              {Array.from({ length: 64 }, (_, i) => {
                const rows = Math.floor(i / 8) + 1
                const columns = i % 8 + 1
                return <button key={i} type="button" aria-label={`Chèn bảng ${columns} cột ${rows} hàng`}
                  onMouseEnter={() => setHoverSize({ rows, columns })} onFocus={() => setHoverSize({ rows, columns })}
                  onClick={() => insertTable(emptyRows(rows, columns))}
                  className={`h-5 rounded-sm border focus-visible:outline-2 focus-visible:outline-blue-600 ${rows <= hoverSize.rows && columns <= hoverSize.columns ? 'border-blue-500 bg-blue-100' : 'border-slate-300 bg-white'}`} />
              })}
            </div>
            <form className="mt-3 border-t border-slate-200 pt-3" onSubmit={e => { e.preventDefault(); insertTable(emptyRows(size.rows, size.columns)) }}>
              <div className="mb-2 flex gap-3 text-xs">
                <label className="flex-1">Số cột<input type="number" min={1} max={20} required value={size.columns} onChange={e => setSize({ ...size, columns: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-1" /></label>
                <label className="flex-1">Số hàng<input type="number" min={1} max={100} required value={size.rows} onChange={e => setSize({ ...size, rows: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-1" /></label>
              </div>
              <button type="submit" className={buttonClass}>Chèn bảng tùy chỉnh</button>
            </form>
          </div>
        </details>
        <button type="button" className={buttonClass} onClick={() => { void pasteFromExcel() }}>📋 Dán bảng Excel</button>
        <button type="button" className={buttonClass} onClick={() => { void pasteScreenshot() }}>🖼 Dán ảnh</button>
        <span className="text-[11px] text-slate-500">Chọn vị trí trong nội dung rồi chèn bảng</span>
      </div>
      {pasteMessage && <p role="status" className="bg-blue-50 px-5 py-2 text-xs text-[#1a56b0]">{pasteMessage}</p>}
      {pasteOpen && <div className="space-y-2 border-b border-[#c8d0e8] bg-white p-3">
        <textarea autoFocus aria-label="Dán dữ liệu Excel" value={pasteText} rows={3} onChange={e => setPasteText(e.target.value)} onPaste={e => {
          const rows = parseClipboardTable(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'), true)
          if (rows) { e.preventDefault(); pasteRows(rows) }
        }} placeholder="Chọn vùng ô trong Excel → Ctrl+C → Ctrl+V vào đây" className="w-full rounded border border-[#c8d0e8] p-2 text-sm" />
        <div className="flex gap-2"><button type="button" className={buttonClass} disabled={!pasteText} onClick={() => { const rows = parseTabularText(pasteText, true); if (rows) pasteRows(rows) }}>Chèn bảng đã dán</button><button type="button" className={buttonClass} onClick={() => setPasteOpen(false)}>Đóng</button></div>
      </div>}
      <div ref={editorRef} className="flex-1 overflow-y-auto bg-white/80 p-5" aria-label="Nội dung chính">
        {content.map((block, index) => block.type === 'paragraph' ? (
          <div key={index} className="group relative mb-2 rounded border border-transparent focus-within:border-blue-200 hover:border-slate-200">
          <div className="flex justify-end px-2 pt-1"><button type="button" aria-label={`Xóa đoạn văn ${index + 1}`} className={`${buttonClass} text-red-600`} onClick={() => {
            onChange(content.filter((_, i) => i !== index))
            selection.current = { block: Math.max(0, index - 1), start: 0, end: 0 }
            setActiveCell({ block: -1, row: 0, column: 0 })
            setCellSelection(null)
          }}>Xóa đoạn</button></div>
          <textarea data-paragraph={index} aria-label={`Đoạn văn ${index + 1}`} value={block.text}
            rows={Math.max(3, block.text.split('\n').length + 1)}
            onSelect={e => { selection.current = { block: index, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd } }}
            onFocus={e => { selection.current = { block: index, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd } }}
            onChange={e => onChange(content.map((item, i) => i === index ? editSourceParagraph(block, e.target.value) : item))}
            onPaste={e => {
              const rows = parseClipboardTable(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'))
              if (rows) { e.preventDefault(); selection.current = { block: index, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; insertTable(rows) }
            }}
            className="block min-h-24 w-full resize-y rounded p-2 text-[0.9rem] leading-relaxed focus:bg-white focus:outline-2 focus:outline-blue-200"
            style={{ fontFamily: '"Times New Roman", Times, serif' }} placeholder="Nhập nội dung chính của văn bản..." />
          </div>
        ) : block.type === 'image' ? (
          <figure key={index} className="my-3 rounded-lg border border-[#c8d0e8] bg-white p-3" onClick={() => { selection.current = { block: index, start: 0, end: 0 } }}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="mr-auto font-semibold">Ảnh chụp màn hình</span>
              <label>Độ rộng <input aria-label={`Độ rộng ảnh ${index + 1}`} type="range" min={10} max={100} value={block.widthPercent || 100} onChange={e => onChange(content.map((item, i) => i === index ? { ...block, widthPercent: Number(e.target.value) } : item))} /> {Math.round(block.widthPercent || 100)}%</label>
              <select aria-label={`Căn ảnh ${index + 1}`} value={block.align || 'center'} onChange={e => onChange(content.map((item, i) => i === index ? { ...block, align: e.target.value as 'left' | 'center' | 'right' } : item))} className={buttonClass}><option value="left">Căn trái</option><option value="center">Căn giữa</option><option value="right">Căn phải</option></select>
              <button type="button" className={`${buttonClass} text-red-600`} onClick={() => onChange(content.filter((_, i) => i !== index))}>Xóa ảnh</button>
            </div>
            <div style={{ textAlign: block.align || 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.src} alt={block.alt} style={{ width: `${block.widthPercent || 100}%`, height: 'auto', display: 'inline-block', maxWidth: '100%' }} />
            </div>
          </figure>
        ) : (
          <section key={index} className="my-3 rounded-lg border border-[#c8d0e8] bg-white p-2" aria-label={`Bảng ${index + 1}`}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-auto text-xs font-semibold">{block.rows.length} hàng × {block.rows[0]?.length || 0} cột</span>
              <button type="button" className={`${buttonClass} text-red-600`} onClick={() => removeTable(index)}>Xóa bảng</button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              <button type="button" className={buttonClass} disabled={cellSelection?.block !== index || (cellSelection.range.top === cellSelection.range.bottom && cellSelection.range.left === cellSelection.range.right)} onClick={() => {
                if (cellSelection?.block !== index) return
                const next = mergeTableCells(block, cellSelection.range)
                onChange(content.map((item, i) => i === index ? next : item))
                focusCell(index, cellSelection.range.top, cellSelection.range.left)
              }}>Gộp ô</button>
              <button type="button" className={buttonClass} disabled={cellSelection?.block !== index || !block.merges?.some(merge => merge.row <= cellSelection.range.bottom && merge.row + merge.rowSpan > cellSelection.range.top && merge.column <= cellSelection.range.right && merge.column + merge.colSpan > cellSelection.range.left)} onClick={() => {
                if (cellSelection?.block !== index) return
                onChange(content.map((item, i) => i === index ? unmergeTableCells(block, cellSelection.range) : item))
              }}>Tách ô</button>
              {cellSelection?.block === index && <span role="status" className="self-center px-1 text-[11px] text-blue-700">Đã chọn {cellSelection.range.bottom - cellSelection.range.top + 1} hàng × {cellSelection.range.right - cellSelection.range.left + 1} cột</span>}
              <button type="button" className={buttonClass} onClick={() => fitColumns(index)}>Vừa nội dung</button>
              <button type="button" className={buttonClass} onClick={() => updateWidths(index, normalizeColumnWidths(undefined, block.rows[0].length))}>Chia đều cột</button>
              {(['left', 'center', 'right', 'middle'] as const).map(align => <button key={align} type="button" className={buttonClass} disabled={cellSelection?.block !== index && activeCell.block !== index} onClick={() => {
                const range = cellSelection?.block === index ? cellSelection.range : { top: activeCell.row, bottom: activeCell.row, left: activeCell.column, right: activeCell.column }
                const next = alignTableCells(block, range, align === 'middle' ? { verticalAlign: 'middle' } : { align })
                onChange(content.map((item, i) => i === index ? next : item))
              }}>{({ left: 'Căn trái', center: 'Căn giữa', right: 'Căn phải', middle: 'Giữa theo chiều dọc' })[align]}</button>)}
              <button type="button" className={buttonClass} aria-pressed={!block.borderless} onClick={() => onChange(content.map((item, i) => i === index ? { ...block, borderless: !block.borderless } : item))}>{block.borderless ? 'Hiện viền bảng' : 'Ẩn viền bảng'}</button>
              {(['above', 'below', 'left', 'right', 'deleteRow', 'deleteColumn'] as const).map(action => {
                const labels = { above: 'Hàng trên', below: 'Hàng dưới', left: 'Cột trái', right: 'Cột phải', deleteRow: 'Xóa hàng', deleteColumn: 'Xóa cột' }
                return <button key={action} type="button" className={buttonClass} disabled={activeCell.block !== index || (action === 'deleteRow' && block.rows.length <= 1) || (action === 'deleteColumn' && block.rows[0].length <= 1)} onClick={() => {
                  let { row, column } = activeCell
                  const axis = ['above', 'below', 'deleteRow'].includes(action) ? 'row' : 'column'
                  const remove = action === 'deleteRow' || action === 'deleteColumn'
                  const position = axis === 'row' ? row + (action === 'below' ? 1 : 0) : column + (action === 'right' ? 1 : 0)
                  const next = changeTableStructure(block, axis, position, remove)
                  onChange(content.map((item, i) => i === index ? next : item))
                  setCellSelection(null)
                  row = axis === 'row' ? Math.min(position, next.rows.length - 1) : row
                  column = axis === 'column' ? Math.min(position, next.rows[0].length - 1) : column
                  const covering = next.merges?.find(merge => row >= merge.row && row < merge.row + merge.rowSpan && column >= merge.column && column < merge.column + merge.colSpan)
                  if (covering) { row = covering.row; column = covering.column }
                  focusCell(index, row, column)
                }}>{labels[action]}</button>
              })}
            </div>
            <TableFontControls table={block} defaultSize={state.sourceLayout ? 11 : state.docType === 'bien-ban' ? 13 : 14}
              range={cellSelection?.block === index ? cellSelection.range : activeCell.block === index ? { top: activeCell.row, bottom: activeCell.row, left: activeCell.column, right: activeCell.column } : undefined}
              onSelectAll={() => {
                setActiveCell({ block: index, row: 0, column: 0 })
                setCellSelection({ block: index, range: { top: 0, left: 0, bottom: block.rows.length - 1, right: block.rows[0].length - 1 }, anchor: { row: 0, column: 0 } })
              }}
              onChange={font => {
                const range = cellSelection?.block === index ? cellSelection.range : { top: activeCell.row, bottom: activeCell.row, left: activeCell.column, right: activeCell.column }
                const next = formatTableCellFont(block, range, font)
                onChange(content.map((item, i) => i === index ? next : item))
              }} />
            <div className="overflow-x-auto">
              <div className="relative" style={{ minWidth: Math.max(240, block.sourceWidth || block.rows[0].length * 60) }}>
              <table data-table={index} className="w-full table-fixed border-collapse">
                <colgroup>{normalizeColumnWidths(block.columnWidths, block.rows[0].length).map((width, c) => <col key={c} style={{ width: `${width}%` }} />)}</colgroup>
                <tbody>
                {block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => {
                  const layout = tableCellLayout(block, r, c)
                  if (layout.hidden) return null
                  const selected = cellSelection?.block === index && r <= cellSelection.range.bottom && r + layout.rowSpan > cellSelection.range.top && c <= cellSelection.range.right && c + layout.colSpan > cellSelection.range.left
                  return <td key={c} data-table-cell={`${index}-${r}-${c}`} rowSpan={layout.rowSpan} colSpan={layout.colSpan} onPointerDownCapture={e => startCellSelection(e, block, index, r, c)} onKeyDownCapture={e => { if (e.key === 'Escape') setCellSelection(null) }} className="border border-slate-400 p-0" style={{ verticalAlign: layout.style.verticalAlign || (block.fontSize ? 'middle' : 'top'), backgroundColor: layout.style.background, boxShadow: selected ? 'inset 0 0 0 2px #3b82f6' : undefined }}>
                  <AutoSizeTableCell data-cell={`${index}-${r}-${c}`} aria-label={`Bảng ${index + 1}, hàng ${r + 1}, cột ${c + 1}`} value={cell}
                    onFocus={() => {
                      setActiveCell({ block: index, row: r, column: c }); selection.current = { block: index, start: 0, end: 0 }
                      if (!cellDrag.current && !(cellSelection?.block === index && r >= cellSelection.range.top && r <= cellSelection.range.bottom && c >= cellSelection.range.left && c <= cellSelection.range.right)) setCellSelection({ block: index, anchor: { row: r, column: c }, range: expandCellRange(block, { top: r, bottom: r, left: c, right: c }) })
                    }}
                    onChange={e => updateRows(index, block.rows.map((cells, ri) => ri === r ? cells.map((value, ci) => ci === c ? e.target.value : value) : cells))}
                    onPaste={e => {
                      const pasted = parseClipboardTable(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'))
                      if (!pasted) return
                      e.preventDefault()
                      const next = pasteTableInto(block, pasted, r, c)
                      onChange(content.map((item, i) => i === index ? next : item))
                    }}
                    onKeyDown={e => {
                      if (e.key !== 'Tab') return
                      const visible = visibleTableCells(block)
                      const next = visible.findIndex(item => item.row === r && item.column === c) + (e.shiftKey ? -1 : 1)
                      if (next < 0) return
                      e.preventDefault()
                      if (next === visible.length) { updateRows(index, [...block.rows, Array<string>(row.length).fill('')]); focusCell(index, block.rows.length, 0) }
                      else focusCell(index, visible[next].row, visible[next].column)
                    }}
                    className="block w-full resize-none overflow-hidden bg-transparent text-black focus:bg-blue-50 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500" style={{ fontFamily: layout.style.fontFamily || 'Times New Roman', fontSize: `${layout.style.fontSize || block.fontSize || (state.sourceLayout ? 11 : state.docType === 'bien-ban' ? 13 : 14)}pt`, fontWeight: layout.style.bold ? 'bold' : 'normal', textAlign: layout.style.align || 'left', color: layout.style.color, padding: block.fontSize ? '2px 3px' : '8px', lineHeight: block.fontSize ? 1.15 : '20px' }} />
                </td>})}</tr>)}
              </tbody></table>
              {normalizeColumnWidths(block.columnWidths, block.rows[0].length).slice(0, -1).map((width, c, widths) => (
                <div key={c} role="separator" aria-orientation="vertical" aria-label={`Độ rộng cột ${c + 1} của bảng ${index + 1}`} aria-valuenow={Math.round(width)} tabIndex={0}
                  title="Kéo để đổi độ rộng cột; nhấp đúp để vừa nội dung. Dùng phím ← → để điều chỉnh."
                  className="absolute inset-y-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none hover:bg-blue-400/40 focus:bg-blue-400/40 focus:outline-none"
                  style={{ left: `${widths.slice(0, c + 1).reduce((sum, value) => sum + value, 0)}%` }}
                  onPointerDown={e => {
                    e.preventDefault()
                    e.currentTarget.focus()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    drag.current = { block: index, column: c, startX: e.clientX, width: e.currentTarget.parentElement!.getBoundingClientRect().width, widths: normalizeColumnWidths(block.columnWidths, block.rows[0].length) }
                  }}
                  onPointerMove={e => {
                    const start = drag.current
                    if (start?.block !== index || start.column !== c) return
                    updateWidths(index, resizeColumnBoundary(start.widths, c, (e.clientX - start.startX) / start.width * 100, 36 / start.width * 100))
                  }}
                  onPointerUp={() => { drag.current = null }}
                  onPointerCancel={() => { if (drag.current) updateWidths(index, drag.current.widths); drag.current = null }}
                  onLostPointerCapture={() => { drag.current = null }}
                  onDoubleClick={() => fitColumns(index)}
                  onKeyDown={e => {
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                    e.preventDefault()
                    const tableWidth = e.currentTarget.parentElement!.getBoundingClientRect().width
                    updateWidths(index, resizeColumnBoundary(normalizeColumnWidths(block.columnWidths, block.rows[0].length), c, (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1), 36 / tableWidth * 100))
                  }} />
              ))}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Kéo chuột qua nhiều ô hoặc Shift+nhấp để chọn vùng → Gộp ô / Tách ô. Nội dung được giữ trong ô đầu khi tách. Kéo đường biên để đổi độ rộng cột. Tab để chuyển ô.</p>
            <button type="button" className={`${buttonClass} mt-2`} onClick={() => {
              if (content[index + 1]?.type === 'paragraph') {
                requestAnimationFrame(() => editorRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label^="Đoạn văn"]')[content.slice(0, index + 1).filter(item => item.type === 'paragraph').length]?.focus())
                return
              }
              onChange([...content.slice(0, index + 1), { type: 'paragraph', text: '' }, ...content.slice(index + 1)])
              requestAnimationFrame(() => editorRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label^="Đoạn văn"]')[content.slice(0, index + 1).filter(item => item.type === 'paragraph').length]?.focus())
            }}>+ Đoạn văn sau bảng</button>
          </section>
        ))}
        <button type="button" className={`${buttonClass} mt-2`} onClick={() => {
          pendingImageFocus.current = content.length
          onChange([...content, { type: 'paragraph', text: '' }])
        }}>+ Thêm đoạn văn</button>
      </div>
    </div>
  )
}
