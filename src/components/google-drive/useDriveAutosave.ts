'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentState } from '@/types'
import type { DriveSource } from '@/lib/drive-document'
import { createDocxBlob } from '@/components/document-editor/exportDocx'

export function driveDraftKey(source: DriveSource) { return `drive-draft:${source.accountId}:${source.id}` }

export function useDriveAutosave(state: DocumentState, source?: DriveSource, initialDirty = false) {
  const latest = useRef(state)
  const saved = useRef(initialDirty ? '' : JSON.stringify(state))
  const version = useRef(source?.version || '')
  const editedRef = useRef(initialDirty)
  const [edited, setEdited] = useState(initialDirty)
  const running = useRef<Promise<boolean> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const blocked = useRef(false)
  const [status, setStatus] = useState('Sẵn sàng · Tự lưu sau khi chỉnh sửa')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const markEdited = useCallback(() => {
    if (!source || editedRef.current) return
    saved.current = JSON.stringify(latest.current)
    editedRef.current = true
    setEdited(true)
  }, [source])

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    if (!source || !editedRef.current) return true
    if (running.current) return running.current
    if (blocked.current) return false
    const task = async () => {
      try {
        setError('')
        while (JSON.stringify(latest.current) !== saved.current) {
          const snapshot = latest.current
          const serialized = JSON.stringify(snapshot)
          setStatus('Đang lưu lên Google Drive...')
          const form = new FormData()
          form.set('file', await createDocxBlob(snapshot), 'document.docx')
          form.set('state', serialized)
          form.set('version', version.current)
          form.set('accountId', source.accountId)
          const response = await fetch(`/api/drive/file/${encodeURIComponent(source.id)}`, { method: 'PUT', body: form, signal: AbortSignal.timeout(90_000) })
          const data = await response.json()
          if (!response.ok) {
            if (response.status === 409) blocked.current = true
            throw new Error(data.error || 'Không thể lưu lên Drive.')
          }
          version.current = data.version
          saved.current = serialized
          try { localStorage.setItem(driveDraftKey(source), JSON.stringify({ version: version.current, state: latest.current })) } catch { /* The remote content has already been saved. */ }
          setWarning(data.warning || '')
          // Only remove this draft if no newer edit was made while the request was running.
          if (JSON.stringify(latest.current) === serialized && !data.warning) {
            try { localStorage.removeItem(driveDraftKey(source)) } catch { /* Drive save still succeeded. */ }
          }
        }
        setStatus('Đã lưu vào Google Drive ✓')
        return true
      } catch (error) {
        setStatus('Chưa lưu được lên Google Drive')
        setError(error instanceof Error ? error.message : 'Không thể lưu lên Drive. Bản nháp được giữ trên thiết bị nếu trình duyệt cho phép.')
        return false
      }
    }
    running.current = task()
    try { return await running.current } finally { running.current = null }
  }, [source])

  useEffect(() => {
    latest.current = state
    if (!source || !edited || JSON.stringify(state) === saved.current) return
    const serialized = JSON.stringify(state)
    let draftSaved = false
    try { localStorage.setItem(driveDraftKey(source), JSON.stringify({ version: version.current, state: JSON.parse(serialized) })); draftSaved = true } catch { /* Report the missing recovery copy below. */ }
    const notification = setTimeout(() => {
      setStatus('Có thay đổi · Đang chờ lưu...')
      try {
        if (!draftSaved) { setWarning('Không đủ dung lượng lưu bản nháp trên thiết bị. Hãy chờ lưu lên Drive hoặc xuất DOCX trước khi rời trang.'); return }
        if (!localStorage.getItem(driveDraftKey(source))) setWarning('Trình duyệt không lưu được bản nháp khôi phục. Hãy chờ lưu lên Drive trước khi rời trang.')
      } catch { setWarning('Không thể lưu bản nháp trên thiết bị. Hãy chờ lưu lên Drive trước khi rời trang.') }
    }, 0)
    timer.current = setTimeout(() => { void flush() }, 1500)
    return () => { clearTimeout(notification); clearTimeout(timer.current) }
  }, [state, source, edited, flush])

  useEffect(() => {
    if (!source) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (editedRef.current && JSON.stringify(latest.current) !== saved.current) { event.preventDefault(); event.returnValue = '' }
    }
    const onOnline = () => { void flush() }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('online', onOnline)
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); window.removeEventListener('online', onOnline) }
  }, [source, flush])

  return { status, error, warning, flush, markEdited }
}
