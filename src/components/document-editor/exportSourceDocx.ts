import { Document, Packer, Paragraph, TextRun, ImageRun, ImportedXmlComponent, Table, TableRow, TableCell, Header, Footer, PageNumber, AlignmentType, WidthType, TableLayoutType, BorderStyle, VerticalMergeType, VerticalAlign, LineRuleType } from 'docx'
import type { DocumentState, MainContentParagraphBlock, MainContentTableBlock, SourceTextStyle } from '@/types'
import { matchingCellParagraphs } from '@/lib/source-format'
import { tableCellLayout } from '@/lib/table-layout'
import { documentImageSize } from '@/lib/document-image'
import { normalizeColumnWidths } from './tableSizing'
import { sourceDocumentBlocks } from '@/lib/source-administrative'

const alignment = (align?: SourceTextStyle['align']) => align === 'center' ? AlignmentType.CENTER : align === 'right' ? AlignmentType.RIGHT : align === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT
let ruleId = 100000
function sourceRule(rule: NonNullable<MainContentParagraphBlock['rules']>[number]) {
  const emu = (n: number) => Math.round(n * 12700)
  // Build only a validated straight line; never embed arbitrary source XML.
  const node = (name: string, attributes: Record<string, string | number> = {}, children: (ImportedXmlComponent | string)[] = []) => {
    const result = new ImportedXmlComponent(name, attributes)
    children.forEach(item => result.push(item))
    return result
  }
  const drawing = node('w:drawing', { 'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main' }, [
    node('wp:anchor', { 'xmlns:wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'xmlns:wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape', distT: 0, distB: 0, distL: 0, distR: 0, simplePos: 0, relativeHeight: 0, behindDoc: 0, locked: 0, layoutInCell: 1, allowOverlap: 1 }, [
      node('wp:simplePos', { x: 0, y: 0 }),
      node('wp:positionH', { relativeFrom: 'column' }, [node('wp:posOffset', {}, [String(emu(rule.left))])]),
      node('wp:positionV', { relativeFrom: 'paragraph' }, [node('wp:posOffset', {}, [String(emu(rule.top))])]),
      node('wp:extent', { cx: emu(rule.width), cy: 0 }), node('wp:wrapNone'), node('wp:docPr', { id: ruleId++, name: 'Source line' }),
      node('a:graphic', {}, [node('a:graphicData', { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, [node('wps:wsp', {}, [
        node('wps:cNvCnPr'), node('wps:spPr', {}, [
          node('a:xfrm', {}, [node('a:off', { x: 0, y: 0 }), node('a:ext', { cx: emu(rule.width), cy: 0 })]),
          node('a:prstGeom', { prst: 'line' }, [node('a:avLst')]),
          node('a:ln', { w: emu(rule.weight) }, [node('a:solidFill', {}, [node('a:srgbClr', { val: rule.color })])]),
        ]), node('wps:bodyPr'),
      ])])]),
    ]),
  ])
  return new TextRun({ children: [drawing] })
}
function paragraph(p: MainContentParagraphBlock) {
  const s = p.style || {}
  const runs: MainContentParagraphBlock['runs'] = p.runs?.map(run => run.text).join('') === p.text ? p.runs : [{ text: p.text, style: s }]
  return new Paragraph({
    alignment: alignment(s.align),
    pageBreakBefore: s.pageBreakBefore,
    indent: { left: (s.left || 0) * 20, right: (s.right || 0) * 20, ...(s.firstLine && s.firstLine < 0 ? { hanging: -s.firstLine * 20 } : { firstLine: (s.firstLine || 0) * 20 }) },
    spacing: { before: (s.before || 0) * 20, after: (s.after || 0) * 20, line: s.line ? s.line * 20 : (s.lineMultiple || 1) * 240, lineRule: s.line ? LineRuleType.EXACT : LineRuleType.AUTO },
    children: [...(runs || []).flatMap(run => run.text.split('\n').map((text, i) => {
      const style = { ...s, ...run.style }
      return new TextRun({ ...(run.field ? { children: [run.field === 'PAGE' ? PageNumber.CURRENT : PageNumber.TOTAL_PAGES] } : { text }), ...(i ? { break: 1 } : {}), font: style.fontFamily || 'Times New Roman', size: Math.round((style.fontSize || 11) * 2), characterSpacing: style.characterSpacing === undefined ? undefined : Math.round(style.characterSpacing * 20), bold: style.bold, italics: style.italic, ...(style.underline ? { underline: {} } : {}) })
    })), ...(p.rules || []).map(sourceRule)],
  })
}

function table(block: MainContentTableBlock, pageWidth: number) {
  const width = (block.sourceWidth ? block.sourceWidth * 3 / 4 : pageWidth) * 20
  const columns = normalizeColumnWidths(block.columnWidths, block.rows[0].length)
  const border = { style: block.borderless ? BorderStyle.NONE : BorderStyle.SINGLE, size: 4, color: '000000' }
  return new Table({
    layout: TableLayoutType.FIXED, alignment: alignment(block.tableAlign), width: { size: Math.round(width), type: WidthType.DXA }, columnWidths: columns.map(value => Math.round(value / 100 * width)),
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: block.rows.map((row, r) => new TableRow({ children: row.flatMap((text, c) => {
      const layout = tableCellLayout(block, r, c)
      const merge = block.merges?.find(item => r >= item.row && r < item.row + item.rowSpan && c >= item.column && c < item.column + item.colSpan)
      if (layout.hidden && c !== merge?.column) return []
      const span = merge?.colSpan || 1
      const saved = matchingCellParagraphs(block.cellParagraphs?.[r]?.[c], text)
      const fallback = block.cellParagraphs?.[r]?.[c]?.[0]?.style
      return [new TableCell({
        width: { size: Math.round(columns.slice(c, c + span).reduce((sum, n) => sum + n, 0) / 100 * width), type: WidthType.DXA }, columnSpan: span,
        ...(merge && merge.rowSpan > 1 ? { verticalMerge: r === merge.row ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE } : {}),
        verticalAlign: layout.style.verticalAlign === 'middle' ? VerticalAlign.CENTER : layout.style.verticalAlign === 'bottom' ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: 40, right: 40 }, borders: { top: border, bottom: border, left: border, right: border },
        children: saved?.length ? saved.map(paragraph) : text.split('\n').map(line => paragraph({ type: 'paragraph', text: line, style: { ...fallback, fontSize: layout.style.fontSize || fallback?.fontSize || block.fontSize || 11, align: layout.style.align, bold: layout.style.bold } })),
      })]
    }) })),
  })
}

export function exportSourceDocx(state: DocumentState) {
  const page = state.sourceLayout!
  const contentWidth = page.width - page.left - page.right
  const elements = (blocks: DocumentState['mainContentBlocks']) => (blocks || []).map(block => block.type === 'paragraph' ? paragraph(block) : block.type === 'table' ? table(block, contentWidth) : new Paragraph({
    alignment: alignment(block.align), spacing: { before: 0, after: 0 },
    children: [new ImageRun({ type: block.src.startsWith('data:image/jpeg') ? 'jpg' : 'png', data: Uint8Array.from(atob(block.src.slice(block.src.indexOf(',') + 1)), char => char.charCodeAt(0)), transformation: documentImageSize(block, contentWidth * 4 / 3) })],
  }))
  return Packer.toBlob(new Document({ styles: { default: { document: { run: { font: 'Times New Roman', size: 22 }, paragraph: { spacing: { before: 0, after: 0 } } } } }, sections: [{ properties: { titlePage: page.differentFirstPage, page: { size: { width: Math.round(page.width * 20), height: Math.round(page.height * 20) }, margin: { top: Math.round(page.top * 20), bottom: Math.round(page.bottom * 20), left: Math.round(page.left * 20), right: Math.round(page.right * 20), header: Math.round((page.header || 0) * 20), footer: Math.round((page.footer || 0) * 20) } } }, ...(state.sourceHeader ? { headers: { default: new Header({ children: elements(state.sourceHeader) }) } } : {}), ...(state.sourceFooter ? { footers: { default: new Footer({ children: elements(state.sourceFooter) }) } } : {}), children: elements(sourceDocumentBlocks(state)) }] }))
}
