'use client'

import { useEffect, useRef, useState } from 'react'
import type { DocumentState } from '@/types'
import A4Preview from './A4Preview'

export default function PreviewPane({ state }: { state: DocumentState }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ available: 0, width: 794, height: 1123 })
  const [zoom, setZoom] = useState<number | 'fit'>('fit')

  useEffect(() => {
    const viewport = viewportRef.current, page = pageRef.current
    if (!viewport || !page) return
    const measure = () => setSize({ available: Math.max(0, viewport.clientWidth - 32), width: page.offsetWidth, height: page.offsetHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(page)
    measure()
    return () => observer.disconnect()
  }, [])

  const scale = zoom === 'fit' ? Math.min(1, size.available / Math.max(1, size.width)) : zoom / 100
  return <section aria-label="Xem trước văn bản" className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#c8d0e8] bg-white/70 px-3 py-2 text-xs text-[#1a1f36]">
      <h2 className="font-bold text-[#1a56b0]">Xem trước A4</h2>
      <label className="flex items-center gap-2">Thu phóng
        <select aria-label="Thu phóng bản xem trước" value={zoom} onChange={event => setZoom(event.target.value === 'fit' ? 'fit' : Number(event.target.value))} className="rounded border border-[#c8d0e8] bg-white px-2 py-1">
          <option value="fit">Vừa chiều rộng</option>
          {[50, 75, 100, 125, 150].map(value => <option key={value} value={value}>{value}%</option>)}
        </select>
      </label>
      <span className="tabular-nums" aria-live="polite">{Math.round(scale * 100)}%</span>
    </div>
    <div ref={viewportRef} className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
      <div className="relative mx-auto" style={{ width: size.width * scale, height: size.height * scale }}>
        <div ref={pageRef} className="absolute left-0 top-0 w-max origin-top-left" style={{ transform: `scale(${scale})` }}>
          <A4Preview state={state} />
        </div>
      </div>
    </div>
  </section>
}
