'use client'

import { Dispatch, useEffect, useRef, useState } from 'react'
import { DocumentState, DocType, Agency, Signer } from '@/types'

type Action =
  | { type: 'SET_FIELD'; field: keyof DocumentState; value: string }
  | { type: 'LOAD'; state: DocumentState }
  | { type: 'RESET' }

interface SidebarProps {
  state: DocumentState
  dispatch: Dispatch<Action>
  agencies: Agency[]
  signers: Signer[]
  onSave: () => void
  onNewDocument: () => void
  onExportDocx: () => void
  versions: { id: string; created_at: string }[]
  onLoadVersion: (id: string) => void
  onDeleteVersion: (id: string) => void
  isSaving: boolean
  documentCount: number
  isDriveDocument?: boolean
  isLocalDocument?: boolean
}

const AGENCY_DEFAULTS: Record<string, { suffix: string; location: string }> = {}

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'cong-van', label: 'Công Văn' },
  { value: 'bao-cao', label: 'Báo cáo' },
  { value: 'thong-bao', label: 'Thông báo' },
  { value: 'ke-hoach', label: 'Kế hoạch' },
  { value: 'bien-ban', label: 'Biên bản' },
]

export default function Sidebar({
  state, dispatch, agencies, signers,
  onSave, onNewDocument, onExportDocx,
  versions, onLoadVersion, onDeleteVersion,
  isSaving, documentCount, isDriveDocument, isLocalDocument,
}: SidebarProps) {
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef<HTMLElement>(null)
  const isBienBan = state.docType === 'bien-ban'

  useEffect(() => {
    if (showHistory && historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showHistory])

  // Auto-fill agency and docSymbol on mount or when agencies change
  useEffect(() => {
    if (isDriveDocument || isLocalDocument || state.sourceLayout) return
    if (agencies.length === 0) return
    const matched = agencies.find(a => a.main === state.agencyMain)
    if (!matched && agencies[0]) {
      dispatch({ type: 'SET_FIELD', field: 'agencyMain', value: agencies[0].main })
      if (agencies[0].upper) dispatch({ type: 'SET_FIELD', field: 'agencyUpper', value: agencies[0].upper })
      if (agencies[0].location) dispatch({ type: 'SET_FIELD', field: 'location', value: agencies[0].location })
      const rawSuffix = agencies[0].suffix
      const suffix = rawSuffix ? rawSuffix.replace(/^\//, '') : ''
      dispatch({ type: 'SET_FIELD', field: 'docSymbol', value: suffix })
    } else if (matched && !state.docSymbol && matched.suffix) {
      const rawSuffix = matched.suffix
      const suffix = rawSuffix ? rawSuffix.replace(/^\//, '') : ''
      if (suffix) dispatch({ type: 'SET_FIELD', field: 'docSymbol', value: suffix })
    }
  }, [agencies, state.agencyMain, isDriveDocument, isLocalDocument])

  // Auto-sync signer position & name when current signPosition is not present in signers list
  useEffect(() => {
    if (isDriveDocument || isLocalDocument || state.sourceLayout) return
    if (signers.length === 0) return
    const matchedPosition = signers.some(s => s.position === state.signPosition)
    if (!matchedPosition && signers[0]) {
      dispatch({ type: 'SET_FIELD', field: 'signPosition', value: signers[0].position })
      if (signers[0].name) {
        dispatch({ type: 'SET_FIELD', field: 'signName', value: signers[0].name })
      }
    }
  }, [signers, state.signPosition, isDriveDocument, isLocalDocument])

  const set = (field: keyof DocumentState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => dispatch({ type: 'SET_FIELD', field, value: e.target.value })

  const filteredSigners = signers.filter(s => s.position === state.signPosition)

  function handleAgencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    dispatch({ type: 'SET_FIELD', field: 'agencyMain', value })

    const selectedAgency = agencies.find(a => a.main === value)
    if (selectedAgency?.upper) {
      dispatch({ type: 'SET_FIELD', field: 'agencyUpper', value: selectedAgency.upper })
    }

    const rawSuffix = selectedAgency?.suffix
    const suffix = rawSuffix ? rawSuffix.replace(/^\//, '') : ''
    const location = selectedAgency?.location

    if (location) dispatch({ type: 'SET_FIELD', field: 'location', value: location })
    dispatch({ type: 'SET_FIELD', field: 'docSymbol', value: suffix })
  }

  return (
    <aside className="h-full w-full min-w-0 bg-[#f7f8fc] border-r-[1.5px] border-[#dde1ef] flex flex-col z-10 shadow-[3px_0_18px_rgba(26,86,176,0.07)] overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 bg-[#1a56b0] text-white shrink-0">
        <h1 className="text-[1.1rem] font-bold tracking-[0.01em]">📄 Thể thức văn bản</h1>
        <p className="text-[0.78rem] opacity-80 mt-0.5">Tác giả: Trần Trí Nhân</p>
        <p className="text-[0.78rem] opacity-80 mt-0.5">Soạn thảo tự động – Chuẩn Nghị định 30/2020/NĐ-CP</p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#dde1ef]">

        {/* 1. Thông tin cơ quan */}
        <section>
          <SectionTitle>{isBienBan ? '1. Thông tin biên bản' : '1. Thông tin cơ quan & Tiêu đề'}</SectionTitle>
          {!isBienBan && (
            <>
              <Field label="Cơ quan chủ quản">
                <input value={state.agencyUpper} onChange={set('agencyUpper')} className={inputCls} />
              </Field>
              <Field label="Cơ quan ban hành">
                <select value={state.agencyMain} onChange={handleAgencyChange} className={inputCls}>
                  {!agencies.some(a => a.main === state.agencyMain) && <option value={state.agencyMain}>{state.agencyMain || '-- Chọn cơ quan --'}</option>}
                  {agencies.map(a => (
                    <option key={a.main} value={a.main}>{a.main}</option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-2.5">
                <Field label="Số" className="flex-1">
                  <input value={state.docNumber} onChange={set('docNumber')} className={inputCls} placeholder="Số..." />
                </Field>
                <Field label="Ký hiệu" className="flex-1">
                  <input value={state.docSymbol} onChange={set('docSymbol')} className={inputCls} placeholder="Ký hiệu..." />
                </Field>
              </div>
              <Field label="Địa danh">
                <input value={state.location} onChange={set('location')} className={inputCls} />
              </Field>
              <Field label="Ngày tháng năm">
                <input type="date" value={state.date} onChange={set('date')} className={inputCls} />
                {!state.date && state.dateText && <p className="mt-1 text-xs text-[#6b7597]">Ngày trong file nguồn: {state.dateText}</p>}
              </Field>
            </>
          )}
        </section>

        {/* 2. Thể loại */}
        <section>
          <SectionTitle>2. Thể loại &amp; Trích yếu</SectionTitle>
          <Field label="Thể loại văn bản">
            <select value={state.docType} onChange={set('docType')} className={inputCls}>
              {DOC_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Thư mục (Folder)">
            <input value={state.folder || ''} onChange={set('folder')} className={inputCls} placeholder="Ví dụ: Báo cáo năm 2026..." />
          </Field>
          <Field label="Trích yếu nội dung">
            <textarea value={state.docSummary} onChange={set('docSummary')} rows={2} className={`${inputCls} resize-y`} />
          </Field>
          <Field label={state.docType === 'cong-van' ? 'Kính gửi' : 'Gửi đến (tùy chọn)'}>
            <textarea
              value={state.recipient}
              onChange={set('recipient')}
              rows={3}
              className={`${inputCls} resize-y`}
              placeholder={state.docType === 'cong-van' ? "Ví dụ:\n- Công an Phường;\n- Văn phòng HĐND&UBND Phường." : "Nhập nơi nhận..."}
            />
          </Field>
        </section>

        {/* 3. Căn cứ */}
        <section>
          <SectionTitle>3. Căn cứ &amp; Đặt vấn đề</SectionTitle>
          <Field label="Các căn cứ pháp lý (mỗi dòng 1 căn cứ)">
            <textarea value={state.legalBasis} onChange={set('legalBasis')} rows={4} className={`${inputCls} resize-y`} />
          </Field>
          <Field label="Câu đặt vấn đề">
            <textarea value={state.issueStatement} onChange={set('issueStatement')} rows={3} className={`${inputCls} resize-y`} />
          </Field>
        </section>

        {/* 4. Nội dung chính → xem bên phải màn hình */}

        {/* 5. Kết luận & Chữ ký */}
        <section>
          <SectionTitle>5. Kết luận &amp; Chữ ký</SectionTitle>
          <Field label="Kết luận / Yêu cầu">
            <textarea value={state.conclusion} onChange={set('conclusion')} rows={2} className={`${inputCls} resize-y`} />
          </Field>

          {state.docType === 'bien-ban' ? (
            /* --- Biên bản: Đại diện bên A và bên B --- */
            <>
              <div className="mb-2 text-[0.78rem] font-bold text-[#1a56b0] uppercase tracking-wide">Đại diện bên A</div>
              <Field label="Tên cơ quan/đơn vị bên A">
                <input value={state.partyAUnit} onChange={set('partyAUnit')} className={inputCls} placeholder="Nhập tên cơ quan/đơn vị..." />
              </Field>
              <Field label="Chức vụ bên A">
                <input value={state.partyAPosition} onChange={set('partyAPosition')} className={inputCls} placeholder="Ví dụ: Giám đốc" />
              </Field>
              <Field label="Họ và tên bên A">
                <input value={state.partyAName} onChange={set('partyAName')} className={inputCls} placeholder="Nhập họ và tên..." />
              </Field>

              <div className="mb-2 mt-4 text-[0.78rem] font-bold text-[#1a56b0] uppercase tracking-wide">Đại diện bên B</div>
              <Field label="Tên cơ quan/đơn vị bên B">
                <input value={state.partyBUnit} onChange={set('partyBUnit')} className={inputCls} placeholder="Nhập tên cơ quan/đơn vị..." />
              </Field>
              <Field label="Chức vụ bên B">
                <input value={state.partyBPosition} onChange={set('partyBPosition')} className={inputCls} placeholder="Ví dụ: Giám đốc" />
              </Field>
              <Field label="Họ và tên bên B">
                <input value={state.partyBName} onChange={set('partyBName')} className={inputCls} placeholder="Nhập họ và tên..." />
              </Field>
            </>
          ) : (
            /* --- Các loại khác: Chữ ký thông thường --- */
            <>
              <Field label="Thể thức ký (TM., KT., TL., TUQ. nếu có)">
                <textarea value={state.signAuthority ?? ''} onChange={set('signAuthority')} rows={2} className={`${inputCls} resize-y`} placeholder={state.signAuthority === undefined ? 'Tự động theo cơ quan và chức vụ' : 'Để trống nếu file nguồn không có thể thức ký'} />
              </Field>
              <div className="flex gap-2.5">
                <Field label="Chức vụ người ký" className="flex-1">
                  <select value={state.signPosition} onChange={set('signPosition')} className={inputCls}>
                    {!signers.some(s => s.position === state.signPosition) && <option value={state.signPosition}>{state.signPosition || '-- Chọn chức vụ --'}</option>}
                    {[...new Set(signers.map(s => s.position))].map(p => (
                      <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Họ và tên" className="flex-1">
                  <select value={state.signName} onChange={set('signName')} className={inputCls}>
                    <option value="">-- Chọn --</option>
                    {state.signName && !filteredSigners.some(s => s.name === state.signName) && <option value={state.signName}>{state.signName}</option>}
                    {filteredSigners.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Nơi nhận (phần cuối)">
                <textarea value={state.recipientsCc} onChange={set('recipientsCc')} rows={3} className={`${inputCls} resize-y`} />
              </Field>
            </>
          )}
        </section>

        {/* Lịch sử phiên bản */}
        {showHistory && (
          <section ref={historyRef}>
            <SectionTitle>Lịch sử phiên bản</SectionTitle>
            {versions.length === 0 ? (
              <p className="text-xs text-[#6b7597] text-center py-3">Chưa có phiên bản nào được lưu.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center gap-2 p-2.5 border-[1.5px] border-[#dde1ef] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#1a1f36]">
                        {new Date(v.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <button
                      onClick={() => onLoadVersion(v.id)}
                      className="text-xs bg-[#1a56b0] text-white px-3 py-1 rounded-md font-semibold hover:bg-[#1345a0] transition-colors"
                    >
                      Tải
                    </button>
                    <button
                      onClick={() => onDeleteVersion(v.id)}
                      className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-md font-semibold hover:bg-red-200 transition-colors"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>

      {/* Footer */}
      <footer className="px-5 py-3.5 border-t-[1.5px] border-[#dde1ef] bg-[#f7f8fc] shrink-0 space-y-2">
        <div className="flex gap-2">
          <button onClick={onNewDocument} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-semibold bg-[#ec4899] text-white hover:bg-[#db2777] transition-colors">
            <span>+</span> Văn bản mới
          </button>
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-semibold bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition-colors"
          >
            🕐 Lịch sử
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onSave} disabled={isSaving} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-semibold bg-[#f59e0b] text-white hover:bg-[#d97706] disabled:opacity-60 transition-colors">
            {isSaving ? 'Đang lưu...' : isLocalDocument ? 'File Save As' : isDriveDocument ? '☁️ Lưu Google Drive' : '💾 Lưu phiên bản'}
          </button>
          <button
            onClick={() => versions.length > 0 && onLoadVersion(versions[0].id)}
            disabled={versions.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-semibold bg-[#6b7597] text-white hover:bg-[#525c7a] disabled:opacity-40 transition-colors"
          >
            ⬆️ Tải mới nhất
          </button>
        </div>
        <button onClick={onExportDocx} className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-semibold bg-[#10b981] text-white hover:bg-[#059669] transition-colors">
          📥 Xuất DOCX
        </button>
        <div className="text-center text-xs text-[#6b7597]">{documentCount}/1000 văn bản</div>
      </footer>
    </aside>
  )
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#7b8abf] mb-3 pb-1.5 border-b-[1.5px] border-[#dde1ef] ${className}`}>
      {children}
    </h2>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-[0.78rem] font-semibold text-[#6b7597] mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-[0.55rem] border-[1.5px] border-[#dde1ef] rounded-[6px] text-[0.855rem] font-[inherit] bg-white text-[#1a1f36] transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-[#1a56b0] focus:ring-2 focus:ring-[#1a56b0]/10'
