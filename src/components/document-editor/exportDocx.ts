import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType,
  LineRuleType, convertInchesToTwip, Header, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import { DocumentState } from '@/types'

const DOC_TYPE_TITLES: Record<string, string> = {
  'bao-cao': 'BÁO CÁO',
  'thong-bao': 'THÔNG BÁO',
  'ke-hoach': 'KẾ HOẠCH',
  'bien-ban': 'BIÊN BẢN',
}

const addPunctuation = (line: string, isLast: boolean): string => {
  const expected = isLast ? ',' : ';'
  const stripped = line.replace(/[;,]\s*$/, '')
  return `${stripped}${expected}`
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
  return /^(VII|III|VI|IV|II|I|V|\d+)(?!\.\d+\.\d)[.)\s]/i.test(line.trim())
}

function createBodyParagraph(text: string, bold = false, fontSize = 28) {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    indent: { firstLine: cmToTwip(1.27), left: 0 },
    spacing: { after: 100, line: 360, lineRule: LineRuleType.AUTO },
    children: [new TextRun({ text, font: 'Times New Roman', size: fontSize, bold })],
  })
}

export async function exportDocx(state: DocumentState) {
  const isCongVan = state.docType === 'cong-van'
  const isBienBan = state.docType === 'bien-ban'
  const isDeputy = /phó/i.test(state.signPosition)
  const bodyFontSize = isBienBan ? 26 : 28

  const formattedDate = state.date
    ? (() => {
        const d = new Date(state.date + 'T00:00:00')
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        return `${state.location}, ngày ${day} tháng ${month} năm ${d.getFullYear()}`
      })()
    : `${state.location}, ngày ... tháng ... năm ...`

  const legalBasisLines = state.legalBasis.split('\n').map(l => l.trim()).filter(Boolean)
  const recipientsCcLines = state.recipientsCc.split('\n').map(l => l.trim()).filter(Boolean)
  const mainContentLines = state.mainContent.split('\n').filter(l => l.trim())

  const doc = new Document({
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
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            },
            children: [
              new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', font: 'Times New Roman', bold: true, size: 26 }),
            ],
          }),
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
                    new TextRun({ text: state.agencyUpper, font: 'Times New Roman', size: 24, allCaps: true }),
                  ]}),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: state.agencyMain, font: 'Times New Roman', bold: true, size: 24, allCaps: true, characterSpacing: -20 }),
                  ]}),
                  new Paragraph({
                    indent: { left: 827, right: 827 },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
                    children: [new TextRun({ text: '', font: 'Times New Roman' })],
                  }),
                  emptyLine(),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({
                      text: `Số: ${state.docSymbol ? `${state.docNumber || '   '}/${state.docSymbol}` : (state.docNumber || '...')}`,
                      font: 'Times New Roman', size: 26,
                    }),
                  ]}),
                  ...(isCongVan ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [
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
                    spacing: { before: 0, after: 0, line: 160, lineRule: LineRuleType.EXACTLY },
                    children: [new TextRun({ text: '______________________________________', font: 'Times New Roman', bold: true, size: 16 })],
                  }),
                  emptyLine(),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: formattedDate, font: 'Times New Roman', italics: true, size: 28 }),
                  ]}),
                ],
              }),
            ]})],
          }),
        ]),

        emptyLine(),

        ...(isCongVan ? [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: `Kính gửi: ${state.recipient}`, font: 'Times New Roman', size: 28 }),
          ]}),
        ] : [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: DOC_TYPE_TITLES[state.docType] || '', font: 'Times New Roman', bold: true, size: 32, allCaps: true }),
          ]}),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: state.docSummary, font: 'Times New Roman', size: 28 }),
          ]}),
        ]),

        emptyLine(),

        ...legalBasisLines.map((line, i) => createBodyParagraph(addPunctuation(line, i === legalBasisLines.length - 1), false, bodyFontSize)),

        ...(state.issueStatement ? [createBodyParagraph(state.issueStatement, isHeadingLine(state.issueStatement), bodyFontSize)] : []),

        ...mainContentLines.map(line => createBodyParagraph(line, isHeadingLine(line), bodyFontSize)),

        ...(state.conclusion ? [createBodyParagraph(state.conclusion, isHeadingLine(state.conclusion), bodyFontSize)] : []),

        emptyLine(),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorder,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: noBorder,
              children: isBienBan ? [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: state.partyAUnit, font: 'Times New Roman', bold: true, size: 28, allCaps: true }),
                ]}),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: state.partyAPosition, font: 'Times New Roman', bold: true, size: 28, allCaps: true }),
                ]}),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: state.partyAName, font: 'Times New Roman', bold: true, size: 28 }),
                ]}),
              ] : [
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
              children: isBienBan ? [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: state.partyBUnit, font: 'Times New Roman', bold: true, size: 28, allCaps: true }),
                ]}),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: state.partyBPosition, font: 'Times New Roman', bold: true, size: 28, allCaps: true }),
                ]}),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                emptyLine(),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: state.partyBName, font: 'Times New Roman', bold: true, size: 28 }),
                ]}),
              ] : [
                ...(isDeputy ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                  new TextRun({ text: 'KT. GIÁM ĐỐC', font: 'Times New Roman', bold: true, size: 28 }),
                ]})] : []),
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
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${removeVietnameseDiacritics(state.docSummary) || 'vanban'}.docx`
  saveAs(blob, filename)
}
