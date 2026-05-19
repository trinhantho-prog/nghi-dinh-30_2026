'use client'

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

const isHeadingLine = (line: string): boolean =>
  /^(VII|III|VI|IV|II|I|V|\d+)(?!\.\d+\.\d)[.)\s]/i.test(line.trim())

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

  const mainContentLines = state.mainContent
    .split('\n')
    .filter(l => l.trim())

  const bodyStyle: React.CSSProperties = {
    marginBottom: '5pt',
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
        padding: '20mm 15mm 20mm 30mm',
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '14pt',
        lineHeight: '1.35',
        color: '#000',
        borderRadius: '2px',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }}
    >
      {/* Document Header */}
      {isBienBan ? (
        /* Biên bản: Quốc ngữ + Độc lập canh giữa toàn trang, không cơ quan ban hành */
        <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </div>
          <div style={{ fontSize: '13pt', fontWeight: 'bold', display: 'inline-block', borderBottom: '1px solid black' }}>
            Độc lập - Tự do - Hạnh phúc
          </div>
          <div style={{ fontSize: '13pt', fontStyle: 'italic', marginTop: '4pt' }}>
            {formattedDate}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.8rem' }}>
          {/* Cột trái 48%: Cơ quan */}
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

          {/* Cột phải 48%: Quốc hiệu */}
          <div style={{ width: '48%', textAlign: 'center' }}>
            <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', display: 'inline-block', borderBottom: '1px solid black' }}>
              Độc lập - Tự do - Hạnh phúc
            </div>
            <div style={{ fontSize: '13pt', fontStyle: 'italic', marginTop: '4pt' }}>
              {formattedDate}
            </div>
          </div>
        </div>
      )}

      {/* Kính gửi / Tên loại văn bản */}
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
            <div style={{ fontSize: '14pt', marginTop: '4pt', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {state.docSummary}
            </div>
            {state.docSummary && (
              <div style={{ height: '1px', background: '#000', width: '4cm', margin: '3pt auto 0' }} />
            )}
          </div>
        )}
      </div>

      {/* Nội dung văn bản */}
      <div style={{ minHeight: '80mm', lineHeight: '1.5' }}>
        {/* Căn cứ pháp lý */}
        {legalBasisLines.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {legalBasisLines.map((line, i) => (
              <div key={i} style={bodyStyle}>
                {renderHighlighted(addPunctuation(line, i === legalBasisLines.length - 1), highlightWords, onWordDoubleClick)}
              </div>
            ))}
          </div>
        )}

        {/* Đặt vấn đề */}
        {state.issueStatement && (
          <div style={{ ...bodyStyle, marginBottom: '0.5rem', ...(isHeadingLine(state.issueStatement) ? { fontWeight: 'bold' } : {}) }}>
            {renderHighlighted(state.issueStatement, highlightWords, onWordDoubleClick)}
          </div>
        )}

        {/* Nội dung chính — mỗi dòng là một đoạn riêng */}
        {mainContentLines.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {mainContentLines.map((line, i) => (
              <div key={i} style={{ ...bodyStyle, ...(isHeadingLine(line) ? { fontWeight: 'bold' } : {}) }}>
                {renderHighlighted(line, highlightWords, onWordDoubleClick)}
              </div>
            ))}
          </div>
        )}

        {/* Kết luận */}
        {state.conclusion && (
          <div style={{ ...bodyStyle, marginBottom: '0.5rem', ...(isHeadingLine(state.conclusion) ? { fontWeight: 'bold' } : {}) }}>
            {renderHighlighted(state.conclusion, highlightWords, onWordDoubleClick)}
          </div>
        )}
      </div>

      {/* Footer: Nơi nhận / Đại diện bên A + Chữ ký / Đại diện bên B */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        {/* Cột trái */}
        <div style={{ width: '42%' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', marginBottom: '4pt' }}>
            {isBienBan ? 'ĐẠI DIỆN BÊN A' : 'Nơi nhận:'}
          </div>
          {recipientsCcLines.map((line, i) => (
            <div key={i} style={{ fontSize: '11pt' }}>{line}</div>
          ))}
        </div>

        {/* Cột phải: Chữ ký / Đại diện bên B */}
        <div style={{ width: '50%', textAlign: 'center' }}>
          {isBienBan ? (
            <>
              <div style={{ fontSize: '12pt', fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline', marginBottom: '4pt' }}>
                ĐẠI DIỆN BÊN B
              </div>
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{state.signPosition}</div>
            </>
          ) : (
            <>
              {isDeputy && (
                <div style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase' }}>KT. GIÁM ĐỐC</div>
              )}
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{state.signPosition}</div>
            </>
          )}
          <div style={{ height: '90px' }} />
          <div style={{ fontWeight: 'bold' }}>{state.signName}</div>
        </div>
      </div>
    </div>
  )
}
