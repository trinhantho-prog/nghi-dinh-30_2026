'use client'

import { useState, type ReactNode } from 'react'
import type { DocumentState } from '@/types'
import PreviewPane from './PreviewPane'

export default function EditorWorkspace({ sidebar, children, state }: { sidebar: ReactNode; children: ReactNode; state: DocumentState }) {
  const [view, setView] = useState<'split' | 'editor' | 'preview'>('split')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  return <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c8d0e8] bg-white px-3 py-2 text-xs text-[#1a1f36]">
        <button type="button" aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(value => !value)} className="hidden rounded border border-[#c8d0e8] px-3 py-2 hover:bg-blue-50 lg:block">{sidebarCollapsed ? '☰ Hiện thông tin' : '☰ Thu gọn thông tin'}</button>
        <button type="button" aria-expanded={mobileSidebarOpen} onClick={() => setMobileSidebarOpen(value => !value)} className="rounded border border-[#c8d0e8] px-3 py-2 hover:bg-blue-50 lg:hidden">☰ Thông tin văn bản</button>
        <div className="ml-auto flex gap-1" aria-label="Chế độ hiển thị">
          {([{ id: 'editor', label: 'Soạn thảo' }, { id: 'preview', label: 'Xem trước' }, { id: 'split', label: 'Song song' }] as const).map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)} className={`${item.id === 'split' ? 'hidden md:block' : ''} rounded px-3 py-2 ${view === item.id ? 'bg-[#1a56b0] text-white' : 'bg-slate-100 hover:bg-blue-50'}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden" onKeyDown={event => { if (event.key === 'Escape') setMobileSidebarOpen(false) }}>
      {mobileSidebarOpen && <button type="button" aria-label="Đóng thông tin văn bản" className="absolute inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />}
      <div className={`${mobileSidebarOpen ? 'absolute inset-y-0 left-0 z-30 flex w-[min(340px,100%)]' : 'hidden'} ${sidebarCollapsed ? 'lg:hidden' : 'lg:relative lg:flex lg:w-[300px] xl:w-[320px] 2xl:w-[360px]'} shrink-0 flex-col`}>
      {mobileSidebarOpen && <button type="button" onClick={() => setMobileSidebarOpen(false)} className="shrink-0 bg-[#1a56b0] px-4 py-2 text-right text-sm text-white lg:hidden">Đóng thông tin ✕</button>}
      <div className="min-h-0 flex-1">
        {sidebar}
      </div>
      </div>

      {/* Preview scales to its available width; each pane scrolls independently. */}
      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 60% 40%, #d6ddf0 0%, #c8d0e8 100%)' }}>
        {/* Left: Nội dung chính editor */}
        <div className={`${view === 'preview' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col border-r border-[#c8d0e8] overflow-hidden ${view === 'split' ? 'md:basis-[44%] md:grow-0' : ''}`}>
          {children}
        </div>
        {/* Right: A4 Preview */}
        <div className={`${view === 'editor' ? 'hidden' : view === 'split' ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-1`}>
          <PreviewPane state={state} />
        </div>
      </main>
      </div>

  </>
}
