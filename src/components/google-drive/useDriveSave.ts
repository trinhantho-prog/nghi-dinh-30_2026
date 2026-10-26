'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentState } from '@/types'
import type { DriveSource } from '@/lib/drive-document'
import { createDocxBlob } from '@/components/document-editor/exportDocx'

export function driveDraftKey(source: DriveSource) { return `drive-draft:${source.accountId}:${source.id}` }

export function useDriveSave(state: DocumentState, source?: DriveSource, initialDirty = false) {
  const latest = useRef(state)
  const [savedState, setSavedState] = useState(initialDirty ? '' : JSON.stringify(state))
  const saved = useRef(savedState)
  const version = useRef(source?.version || '')
  const [isSaving, setIsSaving] = useState(false)
  const running = useRef<Promise<boolean> | null>(null)
  const blocked = useRef(false)
  const [status, setStatus] = useState('Sẵn sàng · Bấm Lưu để lưu vào Google Drive')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const flush = useCallback(async (): Promise<boolean> => {
    if (!source) return true
    if (running.current) return running.current
    if (blocked.current) return false
    const task = async () => {
      try {
        setIsSaving(true)
        setError('')
        if (JSON.stringify(latest.current) !== saved.current) {
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
          setSavedState(serialized)
          try { localStorage.setItem(driveDraftKey(source), JSON.stringify({ version: version.current, state: latest.current })) } catch { /* The remote content has already been saved. */ }
          setWarning(data.warning || '')
          // Only remove this draft if no newer edit was made while the request was running.
          if (JSON.stringify(latest.current) === serialized && !data.warning) {
            try { localStorage.removeItem(driveDraftKey(source)) } catch { /* Drive save still succeeded. */ }
          }
        }
        setStatus(JSON.stringify(latest.current) === saved.current ? 'Đã lưu vào Google Drive ✓' : 'Có thay đổi chưa lưu · Bấm Lưu để lưu vào Google Drive')
        return true
      } catch (error) {
        setStatus('Chưa lưu được lên Google Drive')
        setError(error instanceof Error ? error.message : 'Không thể lưu lên Drive. Bản nháp được giữ trên thiết bị nếu trình duyệt cho phép.')
        return false
      }
    }
    running.current = task()
    try { return await running.current } finally { running.current = null; setIsSaving(false) }
  }, [source])

  useEffect(() => {
    latest.current = state
    if (!source || JSON.stringify(state) === saved.current) return
    const serialized = JSON.stringify(state)
    let draftSaved = false
    try { localStorage.setItem(driveDraftKey(source), JSON.stringify({ version: version.current, state: JSON.parse(serialized) })); draftSaved = true } catch { /* Report the missing recovery copy below. */ }
    const notification = setTimeout(() => {
      setStatus('Có thay đổi chưa lưu · Bấm Lưu để lưu vào Google Drive')
      try {
        if (!draftSaved) { setWarning('Không đủ dung lượng lưu bản nháp trên thiết bị. Hãy bấm Lưu hoặc xuất DOCX trước khi rời trang.'); return }
        if (!localStorage.getItem(driveDraftKey(source))) setWarning('Trình duyệt không lưu được bản nháp khôi phục. Hãy bấm Lưu trước khi rời trang.')
      } catch { setWarning('Không thể lưu bản nháp trên thiết bị. Hãy bấm Lưu trước khi rời trang.') }
    }, 0)
    return () => clearTimeout(notification)
  }, [state, source])

  useEffect(() => {
    if (!source) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [source])

  return { status, error, warning, flush, isSaving, isDirty: Boolean(source) && JSON.stringify(state) !== savedState }
}
