import JSZip from 'jszip'
import { DEFAULT_DOCUMENT_STATE, type DocumentState, type MainContentBlock, type MainContentParagraphBlock, type MainContentTableBlock, type SourceTextStyle } from '@/types'
import { clipboardImageBlock } from './document-image'
import { validateDriveDocument } from './drive-document'
import { organizeSourceDocument } from './source-administrative'

const children = (node: Element, name: string) => Array.from(node.children).filter(child => child.localName === name)
const child = (node: Element | undefined, name: string) => node && children(node, name)[0]
const val = (node: Element | undefined, name = 'val') => node?.getAttribute(`w:${name}`) ?? node?.getAttribute(name) ?? undefined
const number = (value: string | undefined, factor = 1) => value !== undefined && Number.isFinite(Number(value)) ? Number(value) * factor : undefined
const toggle = (node: Element | undefined) => node ? !['0', 'false', 'off', 'none'].includes(val(node) || '') : undefined
const isLine = (drawing: Element) => Array.from(drawing.getElementsByTagName('*')).some(item => item.localName === 'prstGeom' && item.getAttribute('prst') === 'line')

function properties(p?: Element, r?: Element): SourceTextStyle {
  const style: SourceTextStyle = {}
  const put = <K extends keyof SourceTextStyle>(key: K, value: SourceTextStyle[K] | undefined) => { if (value !== undefined) style[key] = value }
  put('fontSize', number(val(child(r, 'sz')), 0.5))
  put('fontFamily', val(child(r, 'rFonts'), 'ascii') || val(child(r, 'rFonts'), 'hAnsi'))
  put('characterSpacing', number(val(child(r, 'spacing')), 1 / 20))
  put('bold', toggle(child(r, 'b'))); put('italic', toggle(child(r, 'i'))); put('underline', toggle(child(r, 'u')))
  const align = val(child(p, 'jc'))
  if (align && ['left', 'center', 'right', 'both', 'justify', 'start', 'end'].includes(align)) style.align = align === 'both' ? 'justify' : align === 'start' ? 'left' : align === 'end' ? 'right' : align as SourceTextStyle['align']
  const spacing = child(p, 'spacing'), indent = child(p, 'ind')
  put('before', number(val(spacing, 'before'), 1 / 20)); put('after', number(val(spacing, 'after'), 1 / 20))
  const line = number(val(spacing, 'line'))
  if (line !== undefined) put(val(spacing, 'lineRule') === 'auto' || !val(spacing, 'lineRule') ? 'lineMultiple' : 'line', line / (val(spacing, 'lineRule') === 'auto' || !val(spacing, 'lineRule') ? 240 : 20))
  put('left', number(val(indent, 'left'), 1 / 20)); put('right', number(val(indent, 'right'), 1 / 20))
  put('firstLine', val(indent, 'hanging') !== undefined ? number(val(indent, 'hanging'), -1 / 20) : number(val(indent, 'firstLine'), 1 / 20))
  put('pageBreakBefore', toggle(child(p, 'pageBreakBefore')))
  return style
}

/** Read WordprocessingML directly: semantic HTML converters discard source geometry. */
export async function importDocx(arrayBuffer: ArrayBuffer, name: string): Promise<DocumentState> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const xml = async (path: string) => {
    const source = await zip.file(path)?.async('string')
    if (!source) return undefined
    if (source.length > 24_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Cấu trúc Word không hợp lệ hoặc quá lớn.')
    const parsed = new DOMParser().parseFromString(source, 'application/xml')
    if (parsed.getElementsByTagName('parsererror').length) throw new Error('Không đọc được cấu trúc Word.')
    return parsed.documentElement
  }
  const root = await xml('word/document.xml'), styles = await xml('word/styles.xml')
  if (!root) throw new Error('File không có nội dung Word hợp lệ.')
  const body = child(root, 'body')
  if (!body) throw new Error('File không có phần nội dung Word.')
  const defaults = child(styles, 'docDefaults')
  const defaultStyle = { fontSize: 11, fontFamily: 'Times New Roman', before: 0, after: 0, lineMultiple: 1, ...properties(child(child(defaults, 'pPrDefault'), 'pPr'), child(child(defaults, 'rPrDefault'), 'rPr')) }
  const definitions = new Map(styles ? children(styles, 'style').map(item => [val(item, 'styleId'), item]) : [])
  const normalId = [...definitions].find(([, element]) => val(element, 'type') === 'paragraph' && val(element, 'default') === '1')?.[0]
  const resolveStyle = (id: string | undefined, seen = new Set<string>()): SourceTextStyle => {
    if (!id || seen.has(id)) return {}
    seen.add(id)
    const element = definitions.get(id)
    return element ? { ...resolveStyle(val(child(element, 'basedOn')), seen), ...properties(child(element, 'pPr'), child(element, 'rPr')) } : {}
  }
  const rels = await xml('word/_rels/document.xml.rels')
  const relationships = new Map(rels ? Array.from(rels.children).map(item => [item.getAttribute('Id'), item]) : [])
  const numbering = await xml('word/numbering.xml')
  const numbers = new Map(numbering ? children(numbering, 'num').map(item => [val(item, 'numId'), val(child(item, 'abstractNumId'))]) : [])
  const abstracts = new Map(numbering ? children(numbering, 'abstractNum').map(item => [val(item, 'abstractNumId'), item]) : [])
  const counters = new Map<string, number[]>()
  async function image(drawing: Element, align: SourceTextStyle['align'], partRelationships = relationships, partPath = 'word/document.xml'): Promise<MainContentBlock> {
    const blip = Array.from(drawing.getElementsByTagName('*')).find(item => item.localName === 'blip')
    const relation = partRelationships.get(blip?.getAttribute('r:embed') || '')
    if (!relation || relation.getAttribute('TargetMode') === 'External') throw new Error('Ảnh liên kết ngoài chưa được hỗ trợ. Hãy nhúng ảnh vào file Word rồi mở lại.')
    const target = relation.getAttribute('Target') || ''
    const path = new URL(target, `https://docx.local/${partPath}`).pathname.slice(1)
    const entry = zip.file(path)
    if (!entry) throw new Error('Không tìm thấy dữ liệu ảnh trong Word.')
    const bytes = await entry.async('uint8array')
    const ext = target.split('.').pop()?.toLowerCase()
    const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' } as Record<string, string>)[ext || '']
    if (!mime) throw new Error('Ảnh trong Word cần chuyển sang PNG hoặc JPEG trước khi mở.')
    const result = await clipboardImageBlock(new Blob([new Uint8Array(bytes)], { type: mime }))
    const extent = Array.from(drawing.getElementsByTagName('*')).find(item => item.localName === 'extent')
    const widthPt = Number(extent?.getAttribute('cx')) / 12700
    return { ...result, widthPercent: widthPt > 0 ? Math.min(100, widthPt / contentWidth * 100) : 100, align: align === 'right' ? 'right' : align === 'left' ? 'left' : 'center' }
  }
  function paragraph(element: Element, inherited: SourceTextStyle = {}): MainContentParagraphBlock {
    const p = child(element, 'pPr')
    const style = { ...defaultStyle, ...resolveStyle(normalId), ...inherited, ...resolveStyle(val(child(p, 'pStyle'))), ...properties(p, child(p, 'rPr')) }
    const runs: NonNullable<MainContentParagraphBlock['runs']> = []
    let fieldInstruction = '', inField = false, fieldResult = false, fieldProduced = false
    const visit = (node: Element) => {
      if (node.localName === 'del') return
      if (node.localName === 'r') {
        const r = child(node, 'rPr')
        const runStyle = { ...style, ...resolveStyle(val(child(r, 'rStyle'))), ...properties(undefined, r) }
        let text = ''
        let field: 'PAGE' | 'NUMPAGES' | undefined
        for (const item of Array.from(node.children)) {
          if (item.localName === 'fldChar') {
            const kind = val(item, 'fldCharType')
            if (kind === 'begin') { inField = true; fieldResult = false; fieldInstruction = ''; fieldProduced = false }
            if (kind === 'separate') fieldResult = true
            if (kind === 'end') {
              const type = fieldInstruction.trim().match(/^(PAGE|NUMPAGES)\b/i)?.[1].toUpperCase()
              if (!fieldProduced && (type === 'PAGE' || type === 'NUMPAGES')) runs.push({ text: '1', style: runStyle, field: type })
              inField = false; fieldResult = false
            }
          }
          if (item.localName === 'instrText' && inField) fieldInstruction += item.textContent || ''
          if (item.localName === 't') {
            text += item.textContent || ''
            const type = fieldResult && fieldInstruction.trim().match(/^(PAGE|NUMPAGES)\b/i)?.[1].toUpperCase()
            if (type === 'PAGE' || type === 'NUMPAGES') { field = type; fieldProduced = true }
          }
          if (item.localName === 'tab') text += '\t'
          if (item.localName === 'br' || item.localName === 'cr') text += '\n'
        }
        if (text) runs.push({ text, style: runStyle, ...(field ? { field } : {}) })
      } else for (const item of Array.from(node.children)) visit(item)
    }
    visit(element)
    const num = child(p, 'numPr'), numId = val(child(num, 'numId')), level = Number(val(child(num, 'ilvl'))) || 0
    const definition = abstracts.get(numbers.get(numId))
    const lvl = definition && children(definition, 'lvl').find(item => Number(val(item, 'ilvl')) === level)
    if (numId && numId !== '0' && lvl) {
      const current = counters.get(numId) || []
      current[level] = current[level] === undefined ? Number(val(child(lvl, 'start'))) || 1 : current[level] + 1
      current.length = level + 1
      counters.set(numId, current)
      const format = (n: number, kind: string | undefined) => {
        if (kind === 'lowerLetter' || kind === 'upperLetter') return String.fromCharCode((kind === 'lowerLetter' ? 97 : 65) + (n - 1) % 26)
        if (kind === 'lowerRoman' || kind === 'upperRoman') {
          let result = '', value = n
          for (const [count, token] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) { while (value >= Number(count)) { result += token; value -= Number(count) } }
          return kind === 'lowerRoman' ? result.toLowerCase() : result
        }
        return String(n)
      }
      const label = (val(child(lvl, 'lvlText')) || '%1.').replace(/%([1-9])/g, (_, index) => {
        const target = children(definition!, 'lvl').find(item => Number(val(item, 'ilvl')) === Number(index) - 1)
        return format(current[Number(index) - 1] || 1, val(child(target, 'numFmt')))
      })
      runs.unshift({ text: `${label}\t`, style })
    }
    const rules = Array.from(element.getElementsByTagName('*')).filter(item => item.localName === 'drawing' && isLine(item)).map(drawing => {
      const nodes = Array.from(drawing.getElementsByTagName('*'))
      const extent = nodes.find(item => item.localName === 'extent')
      const position = (kind: string) => nodes.find(item => item.localName === kind)?.getElementsByTagNameNS('*', 'posOffset')[0]?.textContent || '0'
      const line = nodes.find(item => item.localName === 'ln')
      const color = line && Array.from(line.getElementsByTagName('*')).find(item => item.localName === 'srgbClr')?.getAttribute('val')
      return { width: Number(extent?.getAttribute('cx')) / 12700, left: Number(position('positionH')) / 12700, top: Number(position('positionV')) / 12700, weight: Number(line?.getAttribute('w') || 12700) / 12700, color: color && /^[0-9a-f]{6}$/i.test(color) ? color : '000000' }
    })
    return { type: 'paragraph', text: runs.map(run => run.text).join(''), style, runs, ...(rules.length ? { rules } : {}) }
  }
  function table(element: Element): MainContentTableBlock {
    const grid = child(element, 'tblGrid')
    const widths = grid ? children(grid, 'gridCol').map(item => Number(val(item, 'w')) / 20) : []
    const count = widths.length || Math.max(...children(element, 'tr').map(row => children(row, 'tc').reduce((sum, cell) => sum + (Number(val(child(child(cell, 'tcPr'), 'gridSpan'))) || 1), 0)))
    const rows: string[][] = [], cellParagraphs: MainContentParagraphBlock[][][] = [], cellStyles: NonNullable<MainContentTableBlock['cellStyles']> = [], merges: NonNullable<MainContentTableBlock['merges']> = []
    const tblPr = child(element, 'tblPr'), borders = child(tblPr, 'tblBorders')
    const tableDefinition = definitions.get(val(child(tblPr, 'tblStyle')))
    const inheritedBorders = child(child(tableDefinition, 'tblPr'), 'tblBorders')
    const visibleBorder = (value: Element | undefined) => value && Array.from(value.children).some(item => !['nil', 'none'].includes(val(item) || 'single'))
    const cellBordersVisible = Array.from(element.getElementsByTagName('*')).some(item => item.localName === 'tcBorders' && visibleBorder(item))
    for (const [r, row] of children(element, 'tr').entries()) {
      rows[r] = Array(count).fill(''); cellParagraphs[r] = Array.from({ length: count }, () => []); cellStyles[r] = Array.from({ length: count }, () => ({}))
      let c = Number(val(child(child(row, 'trPr'), 'gridBefore'))) || 0
      for (const cell of children(row, 'tc')) {
        const tcPr = child(cell, 'tcPr'), span = Number(val(child(tcPr, 'gridSpan'))) || 1, vm = child(tcPr, 'vMerge')
        if (vm && val(vm) !== 'restart') {
          const merge = merges.find(item => item.column === c && item.colSpan === span && item.row + item.rowSpan === r)
          if (merge) merge.rowSpan++
        } else {
          const paras = children(cell, 'p').map(item => paragraph(item))
          cellParagraphs[r][c] = paras
          rows[r][c] = paras.map(item => item.text).join('\n')
          const s = paras[0]?.runs?.[0]?.style || paras[0]?.style || defaultStyle
          cellStyles[r][c] = { fontSize: s.fontSize, bold: s.bold, align: s.align === 'justify' ? 'left' : s.align, verticalAlign: val(child(tcPr, 'vAlign')) === 'center' ? 'middle' : val(child(tcPr, 'vAlign')) === 'bottom' ? 'bottom' : 'top' }
          if (span > 1 || vm) merges.push({ row: r, column: c, colSpan: span, rowSpan: 1 })
        }
        c += span
      }
    }
    const total = widths.reduce((sum, width) => sum + width, 0)
    const align = val(child(tblPr, 'jc'))
    return { type: 'table', rows, merges: merges.filter(item => item.colSpan > 1 || item.rowSpan > 1), cellParagraphs, cellStyles, fontSize: defaultStyle.fontSize, borderless: !visibleBorder(borders || inheritedBorders) && !cellBordersVisible, ...(['left', 'center', 'right'].includes(align || '') ? { tableAlign: align as MainContentTableBlock['tableAlign'] } : {}), ...(total ? { columnWidths: widths.map(width => width / total * 100), sourceWidth: total * 4 / 3 } : {}) }
  }
  const section = child(body, 'sectPr'), size = child(section, 'pgSz'), margin = child(section, 'pgMar')
  const sourceLayout = { width: Number(val(size, 'w')) / 20 || 595.3, height: Number(val(size, 'h')) / 20 || 841.9, top: number(val(margin, 'top'), 1 / 20) ?? 56.7, bottom: number(val(margin, 'bottom'), 1 / 20) ?? 56.7, left: number(val(margin, 'left'), 1 / 20) ?? 85, right: number(val(margin, 'right'), 1 / 20) ?? 42.5, header: number(val(margin, 'header'), 1 / 20) ?? 28.35, footer: number(val(margin, 'footer'), 1 / 20) ?? 28.35, differentFirstPage: toggle(child(section, 'titlePg')) || false }
  const contentWidth = sourceLayout.width - sourceLayout.left - sourceLayout.right
  const blocks: MainContentBlock[] = []
  const region = async (kind: 'headerReference' | 'footerReference') => {
    const reference = section && children(section, kind).find(item => val(item, 'type') === 'default')
    if (!reference) return undefined
    const relation = relationships.get(reference.getAttribute('r:id'))
    const target = relation?.getAttribute('Target')
    if (!target) throw new Error('Không đọc được header/footer của Word.')
    const partPath = new URL(target, 'https://docx.local/word/document.xml').pathname.slice(1)
    const part = await xml(partPath)
    if (!part) throw new Error('Không tìm thấy header/footer của Word.')
    const partRels = await xml(partPath.replace(/([^/]+)$/, '_rels/$1.rels'))
    const partRelationships = new Map(partRels ? Array.from(partRels.children).map(item => [item.getAttribute('Id'), item]) : [])
    const regionBlocks: MainContentBlock[] = []
    for (const element of Array.from(part.children)) {
      const drawings = Array.from(element.getElementsByTagName('*')).filter(item => item.localName === 'drawing')
      if (element.localName === 'p') {
        const p = paragraph(element)
        if (p.text || !drawings.length) regionBlocks.push(p)
      } else if (element.localName === 'tbl') regionBlocks.push(table(element))
      for (const drawing of drawings) {
        if (isLine(drawing)) continue
        const descendants = Array.from(drawing.getElementsByTagName('*'))
        const textBox = descendants.find(item => item.localName === 'txbxContent')
        if (textBox) {
          const positioning = descendants.find(item => item.localName === 'positionH')
          const align = positioning && Array.from(positioning.children).find(item => item.localName === 'align')?.textContent
          for (const item of Array.from(textBox.children)) {
            if (item.localName === 'p') {
              const p = paragraph(item)
              if (align && ['left', 'center', 'right'].includes(align)) p.style = { ...p.style, align: align as SourceTextStyle['align'] }
              regionBlocks.push(p)
            } else if (item.localName === 'tbl') regionBlocks.push(table(item))
          }
        } else if (descendants.some(item => item.localName === 'blip')) {
          regionBlocks.push(await image(drawing, 'center', partRelationships, partPath))
        } else throw new Error('Header/footer chứa đối tượng vẽ chưa đọc được. Hãy kiểm tra đối tượng trong Word.')
      }
    }
    return regionBlocks
  }
  const sourceHeader = await region('headerReference'), sourceFooter = await region('footerReference')
  for (const element of Array.from(body.children)) {
    if (element.localName === 'p') {
      const p = paragraph(element)
      const drawings = Array.from(element.getElementsByTagName('*')).filter(item => item.localName === 'drawing')
      if (!drawings.length || p.text || p.rules?.length) blocks.push(p)
      for (const drawing of drawings) if (!isLine(drawing)) blocks.push(await image(drawing, p.style?.align))
    } else if (element.localName === 'tbl') {
      blocks.push(table(element))
      // Cell images must not silently disappear from an imported document.
      for (const drawing of Array.from(element.getElementsByTagName('*')).filter(item => item.localName === 'drawing' && !isLine(item))) blocks.push(await image(drawing, 'center'))
    }
  }
  return organizeSourceDocument(validateDriveDocument({ ...DEFAULT_DOCUMENT_STATE, docSummary: name.replace(/\.docx?$/i, ''), sourceLayout, sourceHeader, sourceFooter, mainContentBlocks: blocks, mainContent: blocks.map(block => block.type === 'paragraph' ? block.text : block.type === 'table' ? block.rows.map(row => row.join('\t')).join('\n') : `[Ảnh: ${block.alt}]`).join('\n') }))
}
