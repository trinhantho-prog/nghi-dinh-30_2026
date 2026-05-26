'use client'

import { DocumentState } from '@/types'
import { getEffectiveMainContentBlocks } from './mainContentBlocks'

const DOC_TYPE_TITLES: Record<string, string> = {
  'bao-cao': 'BÁO CÁO',
  'thong-bao': 'THÔNG BÁO',
  'ke-hoach': 'KẾ HOẠCH',
  'bien-ban': 'BIÊN BẢN',
}

const addPunctuation = (line: string): string => {
  const stripped = line.replace(/[;,]\s*$/, '')
  return `${stripped};`
}

const stripEndingPunctuation = (line: string): string => line.trim().replace(/[.;:,]+\s*$/, '')

const isHeadingLine = (line: string): boolean => {
  const trimmed = line.trim()
  const isRoman = /^(IX|VIII|VII|VI|V|IV|III|II|I)(?!\w)([.)\s/\\-]|$)/i.test(trimmed)
  const isArabic = /^[1-9](?!\d)(?!\.\d)([.)\s/\\-]|$)/.test(trimmed)
  return isRoman || isArabic
}

// Mục La Mã I-IX và mục số 1-9 → không có dấu ở cuối câu. Đoạn văn thường → dấu "."
const normalizeBodyText = (text: string): string => {
  const stripped = stripEndingPunctuation(text)
  if (isHeadingLine(text)) {
    return stripped
  }
  return `${stripped}.`
}

// Chuẩn hóa đoạn văn tự do (trích yếu, kết luận, câu đặt vấn đề): nếu là heading thì không dấu ở cuối, ngược lại luôn kết thúc bằng dấu "."
const normalizeFreeText = (text: string): string => {
  const stripped = stripEndingPunctuation(text)
  if (isHeadingLine(text)) {
    return stripped
  }
  return stripped ? `${stripped}.` : text
}

interface A4PreviewProps {
  state: DocumentState
  highlightWords?: string[]
  onWordDoubleClick?: (word: string) => void
}

function renderHighlighted(text: string, words: string[], onDoubleClick?: (word: string) => void): React.ReactNode {
  if (!words.length) return text
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'g')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        words.includes(part)
          ? <mark key={i} onDoubleClick={() => onDoubleClick?.(part)} style={{ background: '#fef08a', color: '#b91c1c', borderRadius: '2px', padding: '0 1px', cursor: 'pointer' }}>{part}</mark>
          : part
      )}
    </>
  )
}

export default function A4Preview({ state, highlightWords = [], onWordDoubleClick }: A4PreviewProps) {
  const isCongVan = state.docType === 'cong-van'
  const isBienBan = state.docType === 'bien-ban'
  const docTypeTitle = DOC_TYPE_TITLES[state.docType]
  const isDeputy = /phó/i.test(state.signPosition)
  const mainContentBlocks = getEffectiveMainContentBlocks(state)

  const formattedDate = state.date
    ? (() => {
        const d = new Date(state.date + 'T00:00:00')
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        return `${state.location}, ngày ${day} tháng ${month} năm ${d.getFullYear()}`
      })()
    : `${state.location}, ngày ... tháng ... năm ...`

  const legalBasisLines = state.legalBasis
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const recipientsCcLines = state.recipientsCc
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const bodyStyle: React.CSSProperties = {
    marginTop: '6pt',
    marginBottom: '6pt',
    lineHeight: '18pt',
    textIndent: '1.27cm',
    textAlign: 'justify',
  }

  return (
    <div
      style={{
        width: '210mm',
        minHeight: '297mm',
        background: 'white',
        boxShadow: '0 20px 50px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
        padding: isBienBan ? '20mm 20mm 20mm 30mm' : '20mm 15mm 20mm 30mm',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: isBienBan ? '13pt' : '14pt',
        lineHeight: '1.35',
        color: '#000',
        borderRadius: '2px',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }}
    >
      {isBienBan ? (
        <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </div>
          <div style={{ fontSize: '13pt', fontWeight: 'bold', lineHeight: '1.1' }}>
            Độc lập - Tự do - Hạnh phúc
          </div>
          {/* Dòng kẻ 5.7cm căn giữa */}
          <div style={{ height: '1px', background: '#000', width: '5.7cm', margin: '2px auto 0' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.8rem' }}>
          <div style={{ width: '48%', textAlign: 'center' }}>
            <div style={{ fontSize: '12pt', textTransform: 'uppercase' }}>{state.agencyUpper}</div>
            <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
              {state.agencyMain}
            </div>
            <div style={{ width: '45%', height: '1px', background: 'black', margin: '3px auto 5px' }} />
            <div style={{ fontSize: '13pt' }}>
              Số: {state.docSymbol
                ? `${state.docNumber || '   '}/${state.docSymbol}`
                : (state.docNumber || '...')}
            </div>
            {isCongVan && (
              <div style={{ fontSize: '13pt', textAlign: 'center', marginTop: '4pt' }}>
                V/v {state.docSummary || '...'}
              </div>
            )}
          </div>

          <div style={{ width: '48%', textAlign: 'center' }}>
            <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', lineHeight: '1.1' }}>
              Độc lập - Tự do - Hạnh phúc
            </div>
            <div style={{ height: '1px', background: 'black', width: '5.7cm', margin: '2px auto 0' }} />
            <div style={{ fontSize: '13pt', fontStyle: 'italic', marginTop: '4pt' }}>
              {formattedDate}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '0.9rem' }}>
        {isCongVan ? (
          <div style={{ fontSize: '14pt', textAlign: 'center' }}>
            Kính gửi: {state.recipient || '...'}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {docTypeTitle}
            </div>
            {/* Trích yếu nội dung: font 13pt, Times New Roman, KHÔNG có dấu chấm cuối câu */}
            <div style={{ fontSize: '13pt', marginTop: '4pt', whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontWeight: isBienBan ? 'normal' : undefined, fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif' }}>
              {state.docSummary ? stripEndingPunctuation(state.docSummary) : ''}
            </div>
            {state.docSummary && (
              <div style={{ height: '1px', background: '#000', width: '4cm', margin: '3pt auto 0' }} />
            )}
          </div>
        )}
      </div>

      <div style={{ minHeight: '80mm', lineHeight: '1.5' }}>
        {legalBasisLines.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {legalBasisLines.map((line, i) => (
              <div key={i} style={bodyStyle}>
                {renderHighlighted(addPunctuation(line), highlightWords, onWordDoubleClick)}
              </div>
            ))}
          </div>
        )}

        {/* Câu đặt vấn đề: ngay sát nội dung chính, không có khoảng cách thêm */}
        {state.issueStatement && (
          <div style={{ ...bodyStyle, ...(isHeadingLine(state.issueStatement) ? { fontWeight: 'bold' } : {}) }}>
            {renderHighlighted(normalizeFreeText(state.issueStatement), highlightWords, onWordDoubleClick)}
          </div>
        )}

        {mainContentBlocks.length > 0 && (
          <div>
            {mainContentBlocks.map((block, i) =>
              block.type === 'table' ? (
                // Bảng từ Excel: không có khoảng trống trên/dưới (margin=0)
                <table
                  key={i}
                  style={{ width: '100%', borderCollapse: 'collapse', margin: '0', textIndent: 0 }}
                >
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            style={{ border: '1px solid #000', padding: '4pt 6pt', verticalAlign: 'top', textAlign: 'left' }}
                          >
                            {renderHighlighted(cell, highlightWords, onWordDoubleClick)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div key={i} style={{ ...bodyStyle, ...(isHeadingLine(block.text) ? { fontWeight: 'bold' } : {}) }}>
                  {renderHighlighted(normalizeBodyText(block.text), highlightWords, onWordDoubleClick)}
                </div>
              )
            )}
          </div>
        )}

        {/* Kết luận/Yêu cầu: luôn kết thúc bằng dấu "." */}
        {state.conclusion && (
          <div style={{ ...bodyStyle, ...(isHeadingLine(state.conclusion) ? { fontWeight: 'bold' } : {}) }}>
            {renderHighlighted(normalizeFreeText(state.conclusion), highlightWords, onWordDoubleClick)}
          </div>
        )}
      </div>

      {isBienBan ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '8%', marginTop: '1rem', textAlign: 'center' }}>
          <div>
            {/* Tên cơ quan bên A: font 13pt, Times New Roman */}
            <div style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2pt', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap' }}>
              {state.partyAUnit}
            </div>
            {/* Chức vụ bên A: font 13pt, Times New Roman */}
            <div style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2pt', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap' }}>
              {state.partyAPosition}
            </div>
          </div>
          <div>
            {/* Tên cơ quan bên B: font 13pt, Times New Roman */}
            <div style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2pt', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap' }}>
              {state.partyBUnit}
            </div>
            {/* Chức vụ bên B: font 13pt, Times New Roman */}
            <div style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2pt', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap' }}>
              {state.partyBPosition}
            </div>
          </div>
          <div style={{ height: '90px' }} />
          <div style={{ height: '90px' }} />
          {/* Họ và tên bên A: font 13pt, Times New Roman */}
          <div style={{ fontWeight: 'bold', fontSize: '13pt', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap' }}>{state.partyAName}</div>
          {/* Họ và tên bên B: font 13pt, Times New Roman */}
          <div style={{ fontWeight: 'bold', fontSize: '13pt', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap' }}>{state.partyBName}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <div style={{ width: '42%', textAlign: 'left' }}>
            <div style={{ fontSize: '12pt', fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', marginBottom: '4pt' }}>
              Nơi nhận:
            </div>
            {recipientsCcLines.map((line, i) => (
              <div key={i} style={{ fontSize: '11pt' }}>{line}</div>
            ))}
          </div>

          <div style={{ width: '50%', textAlign: 'center' }}>
            {isDeputy && (
              <div style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase' }}>KT. GIÁM ĐỐC</div>
            )}
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{state.signPosition}</div>
            <div style={{ height: '90px' }} />
            <div style={{ fontWeight: 'bold' }}>{state.signName}</div>
          </div>
        </div>
      )}
    </div>
  )
}
