import {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, TableLayoutType, VerticalMergeType, VerticalAlign,
  LineRuleType, convertInchesToTwip, Header, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import { DocumentState, MainContentBlock } from '@/types'
import { getEffectiveMainContentBlocks } from './mainContentBlocks'
import { normalizeColumnWidths } from './tableSizing'
import { signatureAuthorityLines } from '@/lib/document-signature'
import { tableCellLayout, tableFontScale } from '@/lib/table-layout'
import { documentImageSize } from '@/lib/document-image'
import { exportSourceDocx } from './exportSourceDocx'

const DOC_TYPE_TITLES: Record<string, string> = {
  'bao-cao': 'BÁO CÁO',
  'thong-bao': 'THÔNG BÁO',
  'ke-hoach': 'KẾ HOẠCH',
  'bien-ban': 'BIÊN BẢN',
}

const addPunctuation = (line: string): string => {
  const stripped = line.replace(/[.;:,]\s*$/, '')
  return `${stripped};`
}

const stripEndingPunctuation = (line: string): string => line.trim().replace(/[.;:,]+\s*$/, '')

// Mục La Mã I-IX và mục số 1-9 → không có dấu ở cuối câu. Đoạn văn thường → dấu "."
const normalizeBodyText = (text: string): string => {
  const stripped = stripEndingPunctuation(text)
  if (isHeadingLine(text)) {
    return stripped
  }
  return `${stripped}.`
}

// Chuẩn hóa đoạn văn tự do (trích yếu, nội dung chính, kết luận): nếu là heading thì không dấu ở cuối, ngược lại luôn kết thúc bằng dấu "."
const normalizeFreeText = (text: string): string => {
  const stripped = stripEndingPunctuation(text)
  if (isHeadingLine(text)) {
    return stripped
  }
  return stripped ? `${stripped}.` : text
}

// Chuẩn hóa đoạn văn kết luận: tự động kết thúc bằng dấu "./." ở cuối
const normalizeConclusion = (text: string): string => {
  if (!text || !text.trim()) return text
  const lines = text.split('\n')
  return lines
    .map((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (isHeadingLine(trimmed)) {
        return trimmed.replace(/([.;:/]|\.\/\.)+\s*$/, '').trim()
      }
      const isLastLine = idx === lines.length - 1
      const cleaned = trimmed.replace(/([.;:/]|\.\/\.)+\s*$/, '').trim()
      if (!cleaned) return ''
      return isLastLine ? `${cleaned}./.` : `${cleaned}.`
    })
    .filter(Boolean)
    .join('\n')
}

const parseRecipient = (recipient: string) => {
  if (!recipient || !recipient.trim()) {
    return { isMultiLine: false, firstLine: '', lines: [] }
  }
  const rawLines = recipient.split('\n').map(l => l.trim()).filter(Boolean)
  if (rawLines.length <= 1) {
    let text = rawLines[0] || ''
    if (/^kính gửi:\s*/i.test(text)) {
      text = text.replace(/^kính gửi:\s*/i, '').trim()
    } else if (/^kính gửi\s*/i.test(text)) {
      text = text.replace(/^kính gửi\s*/i, '').trim()
    }
    return { isMultiLine: false, firstLine: text, lines: [] }
  }
  const contentLines = [...rawLines]
  if (/^kính gửi:?$/i.test(contentLines[0])) {
    contentLines.shift()
  } else if (/^kính gửi:\s*/i.test(contentLines[0])) {
    contentLines[0] = contentLines[0].replace(/^kính gửi:\s*/i, '').trim()
  }
  if (contentLines.length === 1) {
    return { isMultiLine: false, firstLine: contentLines[0], lines: [] }
  }
  const formattedLines = contentLines.map((line, idx) => {
    let text = line.trim()
    text = text.replace(/^[-\u2013\u2014•]\s*/, '')
    text = text.replace(/[;,.]\s*$/, '')
    const isLast = idx === contentLines.length - 1
    const punc = isLast ? '.' : ';'
    return `- ${text}${punc}`
  })
  return { isMultiLine: true, firstLine: '', lines: formattedLines }
}

const emptyLine = () => new Paragraph({ children: [new TextRun({ text: '', font: 'Times New Roman', size: 28 })] })
const cmToTwip = (cm: number) => Math.round(convertInchesToTwip(cm / 2.54))

const noBorder = {
  top: { style: 'nil' as (typeof BorderStyle)[keyof typeof BorderStyle], size: 0 },
  bottom: { style: 'nil' as (typeof BorderStyle)[keyof typeof BorderStyle], size: 0 },
  left: { style: 'nil' as (typeof BorderStyle)[keyof typeof BorderStyle], size: 0 },
  right: { style: 'nil' as (typeof BorderStyle)[keyof typeof BorderStyle], size: 0 },
  insideH: { style: 'nil' as (typeof BorderStyle)[keyof typeof BorderStyle], size: 0 },
  insideV: { style: 'nil' as (typeof BorderStyle)[keyof typeof BorderStyle], size: 0 },
}

const noCellMargins = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
}

function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  const isRoman = /^(IX|VIII|VII|VI|V|IV|III|II|I)(?!\w)([.)\s/\\-]|$)/i.test(trimmed)
  const isArabic = /^[1-9](?!\d)(?!\.\d)([.)\s/\\-]|$)/.test(trimmed)
  return isRoman || isArabic
}

function createBodyParagraph(text: string, bold = false, fontSize = 28, isFreeText = false) {
  const normalizedText = isFreeText ? normalizeFreeText(text) : normalizeBodyText(text)
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    contextualSpacing: false,
    indent: { firstLine: cmToTwip(1.27), left: 0 },
    spacing: { before: 120, after: 120, line: 360, lineRule: LineRuleType.EXACT },
    children: [new TextRun({ text: normalizedText, font: 'Times New Roman', size: fontSize, bold })],
  })
}

function createConclusionParagraph(text: string, bold = false, fontSize = 28) {
  const normalizedText = normalizeConclusion(text)
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    contextualSpacing: false,
    indent: { firstLine: cmToTwip(1.27), left: 0 },
    spacing: { before: 120, after: 120, line: 360, lineRule: LineRuleType.EXACT },
    children: normalizedText.split('\n').map((line, index) => new TextRun({ text: line, ...(index ? { break: 1 } : {}), font: 'Times New Roman', size: fontSize, bold })),
  })
}

// Căn cứ pháp lý: KHÔNG normalize lại để giữ nguyên dấu ";" từ addPunctuation
function createLegalBasisParagraph(text: string, fontSize = 28) {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    contextualSpacing: false,
    indent: { firstLine: cmToTwip(1.27), left: 0 },
    spacing: { before: 120, after: 120, line: 360, lineRule: LineRuleType.EXACT },
    children: [new TextRun({ text, font: 'Times New Roman', size: fontSize, bold: false })],
  })
}

function createTableBlock(block: Extract<MainContentBlock, { type: 'table' }>, fontSize = 28, contentWidth = cmToTwip(16.5)) {
  const widths = normalizeColumnWidths(block.columnWidths, block.rows[0]?.length || 0)
  const scale = tableFontScale(block, contentWidth / 15)
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    ...(block.borderless ? { borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } } } : {}),
    columnWidths: widths.map(width => Math.round(contentWidth * width / 100)),
    // spacing trước/sau bảng = 0 để không có khoảng trống
    rows: block.rows.map((row, r) => new TableRow({
      children: row.flatMap((cell, column) => {
        const layout = tableCellLayout(block, r, column)
        const merge = block.merges?.find(item => r >= item.row && r < item.row + item.rowSpan && column >= item.column && column < item.column + item.colSpan)
        if (layout.hidden && column !== merge?.column) return []
        const style = merge ? tableCellLayout(block, merge.row, merge.column).style : layout.style
        const span = merge?.colSpan || 1
        return [new TableCell({
        width: { size: widths.slice(column, column + span).reduce((sum, width) => sum + width, 0), type: WidthType.PERCENTAGE },
        columnSpan: span,
        ...(merge && merge.rowSpan > 1 ? { verticalMerge: r === merge.row ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE } : {}),
        verticalAlign: style.verticalAlign === 'top' || (!style.verticalAlign && !block.fontSize) ? VerticalAlign.TOP : style.verticalAlign === 'bottom' ? VerticalAlign.BOTTOM : VerticalAlign.CENTER,
        ...(style.background ? { shading: { fill: style.background.slice(1) } } : {}),
        borders: {
          top: { style: block.borderless ? BorderStyle.NONE : BorderStyle.SINGLE, size: 4, color: '000000' },
          bottom: { style: block.borderless ? BorderStyle.NONE : BorderStyle.SINGLE, size: 4, color: '000000' },
          left: { style: block.borderless ? BorderStyle.NONE : BorderStyle.SINGLE, size: 4, color: '000000' },
          right: { style: block.borderless ? BorderStyle.NONE : BorderStyle.SINGLE, size: 4, color: '000000' },
        },
        margins: block.fontSize ? { top: 20, bottom: 20, left: 40, right: 40 } : { top: 80, bottom: 80, left: 120, right: 120 },
        children: cell.split('\n').map(line => new Paragraph({
          alignment: style.align === 'center' ? AlignmentType.CENTER : style.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: line, font: style.fontFamily || 'Times New Roman', size: Math.max(12, Math.round((style.fontSize || block.fontSize || fontSize / 2) * scale * 2)), bold: style.bold, ...(style.color ? { color: style.color.slice(1) } : {}) })],
        })),
      })]
      }),
    })),
  })
}

function createMainContentElements(blocks: MainContentBlock[], fontSize = 28, contentWidth = cmToTwip(16.5)) {
  const elements: (Paragraph | Table)[] = []
  for (const block of blocks) {
    if (block.type === 'table') {
      // Paragraph trước bảng với spacing=0
      elements.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }))
      elements.push(createTableBlock(block, fontSize, contentWidth))
      // Paragraph sau bảng với spacing=0
      elements.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }))
    } else if (block.type === 'image') {
      const data = Uint8Array.from(atob(block.src.slice(block.src.indexOf(',') + 1)), char => char.charCodeAt(0))
      elements.push(new Paragraph({ alignment: block.align === 'left' ? AlignmentType.LEFT : block.align === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [new ImageRun({ type: block.src.startsWith('data:image/jpeg') ? 'jpg' : 'png', data, transformation: documentImageSize(block, contentWidth / 15) })] }))
    } else {
      // Nội dung chính: dùng normalizeBodyText theo heading hay đoạn văn
      for (const line of block.text.split('\n').map(text => text.trim()).filter(Boolean)) {
        elements.push(createBodyParagraph(line, isHeadingLine(line), fontSize))
      }
    }
  }
  return elements
}

export async function createDocxBlob(state: DocumentState) {
  if (state.sourceLayout) return exportSourceDocx(state)
  const isCongVan = state.docType === 'cong-van'
  const isBienBan = state.docType === 'bien-ban'
  const authorityLines = signatureAuthorityLines(state)
  const bodyFontSize = isBienBan ? 26 : 28
  const mottoIndent = isBienBan ? 5.15 : 5.4
  const summaryIndent = isBienBan ? 6.0 : 6.25

  const formattedDate = state.date
    ? (() => {
        const d = new Date(state.date + 'T00:00:00')
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        return `${state.location}, ngày ${day} tháng ${month} năm ${d.getFullYear()}`
      })()
    : `${state.location}, ${state.dateText || 'ngày ... tháng ... năm ...'}`

  const parseRecipientsCcLines = (text: string): string[] => {
    if (!text || !text.trim()) return []
    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean)
    return rawLines.map((line, idx) => {
      let t = line.trim()
      if (!/^[-\u2013\u2014•]\s*/.test(t)) {
        t = `- ${t}`
      }
      const stripped = t.replace(/[;,.]\s*$/, '').trim()
      const isLast = idx === rawLines.length - 1
      return isLast ? `${stripped}.` : `${stripped};`
    })
  }

  const legalBasisLines = state.legalBasis.split('\n').map(l => l.trim()).filter(Boolean)
  const recipientsCcLines = parseRecipientsCcLines(state.recipientsCc)
  const mainContentBlocks = getEffectiveMainContentBlocks(state)

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: bodyFontSize,
          },
          paragraph: {
            spacing: {
              before: 120,
              after: 120,
              line: 360,
              lineRule: LineRuleType.EXACT,
            },
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: isBienBan
            ? {
                top: cmToTwip(2.0),
                right: cmToTwip(2.0),
                bottom: cmToTwip(2.0),
                left: cmToTwip(3.0),
              }
            : {
                top: convertInchesToTwip(0.79),
                right: convertInchesToTwip(0.59),
                bottom: convertInchesToTwip(0.79),
                left: convertInchesToTwip(1.18),
              },
        },
        titlePage: true,
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: 'Times New Roman',
                  size: 28,
                }),
              ],
            }),
          ],
        }),
        first: new Header({
          children: [new Paragraph({ children: [] })],
        }),
      },
      children: [
        ...(isBienBan ? [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [
            new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: 'Times New Roman', bold: true, size: 24, allCaps: true, characterSpacing: -20 }),
          ]}),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: 'Times New Roman', bold: true, size: 26 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            indent: { left: cmToTwip(mottoIndent), right: cmToTwip(mottoIndent) },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
            spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
            children: [new TextRun({ text: '', font: 'Times New Roman', size: 2 })],
          }),
          new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
        ] : [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorder,
            rows: [new TableRow({ children: [
              new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: state.agencyUpper, font: 'Times New Roman', bold: true, size: 24, allCaps: true }),
                  ]}),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [
                    new TextRun({ text: state.agencyMain, font: 'Times New Roman', bold: true, size: 24, allCaps: true, characterSpacing: -20 }),
                  ]}),
                  new Paragraph({
                    indent: { left: 827, right: 827 },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
                    spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
                    children: [new TextRun({ text: '', font: 'Times New Roman', size: 2 })],
                  }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 }, children: [
                    new TextRun({
                      text: `Số: ${state.docSymbol ? `${state.docNumber || '   '}/${state.docSymbol}` : (state.docNumber || '...')}`,
                      font: 'Times New Roman', size: 26,
                    }),
                  ]}),
                  ...(isCongVan ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [
                    new TextRun({ text: `V/v ${state.docSummary}`, font: 'Times New Roman', size: 26 }),
                  ]})] : []),
                ],
              }),
              new TableCell({
                width: { size: 52, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: 'Times New Roman', bold: true, size: 24, allCaps: true, characterSpacing: -20 }),
                  ]}),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: 'Times New Roman', bold: true, size: 26 }),
                  ]}),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    indent: { left: cmToTwip(1.4), right: cmToTwip(1.4) },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
                    spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
                    children: [new TextRun({ text: '', font: 'Times New Roman', size: 2 })],
                  }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 }, children: [
                    new TextRun({ text: formattedDate, font: 'Times New Roman', italics: true, size: 28 }),
                  ]}),
                ],
              }),
            ]})],
          }),
        ]),

        emptyLine(),

        ...(isCongVan ? (() => {
          const parsed = parseRecipient(state.recipient)
          if (parsed.isMultiLine) {
            return [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: cmToTwip(5.5) },
                spacing: { before: 120, after: 60, line: 360, lineRule: LineRuleType.EXACT },
                children: [
                  new TextRun({ text: 'Kính gửi:', font: 'Times New Roman', size: 28 }),
                ],
              }),
              ...parsed.lines.map(line =>
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  indent: { left: cmToTwip(7.7), hanging: cmToTwip(0.5) },
                  spacing: { before: 0, after: 0, line: 360, lineRule: LineRuleType.EXACT },
                  children: [
                    new TextRun({ text: line, font: 'Times New Roman', size: 28 }),
                  ],
                })
              ),
            ]
          }
          return [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              indent: { left: cmToTwip(5.5) },
              spacing: { before: 120, after: 120, line: 360, lineRule: LineRuleType.EXACT },
              children: [
                new TextRun({ text: `Kính gửi: ${parsed.firstLine || state.recipient || '...'}`, font: 'Times New Roman', size: 28 }),
              ],
            }),
          ]
        })() : [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [
            new TextRun({ text: DOC_TYPE_TITLES[state.docType] || '', font: 'Times New Roman', bold: true, size: 32, allCaps: true }),
          ]}),
          // Trích yếu nội dung: font 13pt (size 26), Times New Roman, KHÔNG có dấu chấm cuối câu
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [
            new TextRun({ text: state.docSummary ? stripEndingPunctuation(state.docSummary) : '', font: 'Times New Roman', bold: !isBienBan, size: 26, italics: false }),
          ]}),
          ...(state.docSummary ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              indent: { left: cmToTwip(summaryIndent), right: cmToTwip(summaryIndent) },
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
              spacing: { before: 20, after: 120, line: 20, lineRule: LineRuleType.EXACT },
              children: [new TextRun({ text: '', font: 'Times New Roman', size: 2 })],
            }),
          ] : []),
        ]),

        emptyLine(),

        ...legalBasisLines.map((line) => createLegalBasisParagraph(addPunctuation(line), bodyFontSize)),

        // Câu đặt vấn đề: ngay sát nội dung chính, không có khoảng cách
        ...(state.issueStatement ? [createBodyParagraph(state.issueStatement, isHeadingLine(state.issueStatement), bodyFontSize, true)] : []),

        ...createMainContentElements(mainContentBlocks, bodyFontSize, cmToTwip(isBienBan ? 16 : 16.5)),

        // Kết luận/yêu cầu: luôn tự động kết thúc bằng dấu "./."
        ...(state.conclusion ? [createConclusionParagraph(state.conclusion, isHeadingLine(state.conclusion), bodyFontSize)] : []),

        emptyLine(),

        ...(isBienBan ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorder,
            rows: [
              new TableRow({ children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  margins: noCellMargins,
                  children: [
                    // Tên cơ quan bên A: font 13pt (size 26), Times New Roman
                    ...state.partyAUnit.split('\n').map(l => l.trim()).filter(Boolean).map(line =>
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [
                        new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 26, allCaps: true }),
                      ]})
                    ),
                    // Chức vụ bên A: font 13pt (size 26), Times New Roman
                    ...state.partyAPosition.split('\n').map(l => l.trim()).filter(Boolean).map(line =>
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [
                        new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 26, allCaps: true }),
                      ]})
                    ),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  margins: noCellMargins,
                  children: [
                    // Tên cơ quan bên B: font 13pt (size 26), Times New Roman
                    ...state.partyBUnit.split('\n').map(l => l.trim()).filter(Boolean).map(line =>
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [
                        new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 26, allCaps: true }),
                      ]})
                    ),
                    // Chức vụ bên B: font 13pt (size 26), Times New Roman
                    ...state.partyBPosition.split('\n').map(l => l.trim()).filter(Boolean).map(line =>
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [
                        new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 26, allCaps: true }),
                      ]})
                    ),
                  ],
                }),
              ]}),
              new TableRow({ children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  margins: noCellMargins,
                  children: [emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine()]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  margins: noCellMargins,
                  children: [emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine()]
                }),
              ]}),
              new TableRow({ children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  margins: noCellMargins,
                  // Họ và tên bên A: font 13pt (size 26), Times New Roman
                  children: state.partyAName.split('\n').map(l => l.trim()).filter(Boolean).map(line =>
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [
                      new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 26 }),
                    ]})
                  ),
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  margins: noCellMargins,
                  // Họ và tên bên B: font 13pt (size 26), Times New Roman
                  children: state.partyBName.split('\n').map(l => l.trim()).filter(Boolean).map(line =>
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [
                      new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 26 }),
                    ]})
                  ),
                }),
              ]}),
            ],
          }),
        ] : [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorder,
            rows: [new TableRow({ children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [
                  new Paragraph({ children: [
                    new TextRun({ text: 'Nơi nhận:', font: 'Times New Roman', italics: true, bold: true, underline: {}, size: 24 }),
                  ]}),
                  ...recipientsCcLines.map(line => new Paragraph({
                    children: [new TextRun({ text: line, font: 'Times New Roman', size: 22 })],
                  })),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [
                  ...authorityLines.map(line => new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: line, font: 'Times New Roman', bold: true, size: 28, allCaps: true }),
                  ]})),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: state.signPosition, font: 'Times New Roman', bold: true, size: 28, allCaps: true }),
                  ]}),
                  emptyLine(),
                  emptyLine(),
                  emptyLine(),
                  emptyLine(),
                  emptyLine(),
                  emptyLine(),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: state.signName, font: 'Times New Roman', bold: true, size: 28 }),
                  ]}),
                ],
              }),
            ]})],
          }),
        ]),
      ],
    }],
  })

  return Packer.toBlob(doc)
}

export async function exportDocx(state: DocumentState) {
  const blob = await createDocxBlob(state)
  const filename = `${removeVietnameseDiacritics(state.docSummary) || 'vanban'}.docx`
  saveAs(blob, filename)
}
