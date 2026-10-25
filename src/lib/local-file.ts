import { type DocumentState } from '@/types'
import { importedHtmlToDocument } from './drive-document'
import { normalizeImportedDocument } from './normalize-imported-document'

export const LOCAL_FILE_LIMIT = 20 * 1024 * 1024

export async function importLocalFile(file: File): Promise<DocumentState> {
  if (!/\.(docx|doc)$/i.test(file.name)) throw new Error('Chỉ hỗ trợ file Word .docx và .doc.')
  if (!file.size) throw new Error('File trống. Vui lòng chọn file khác.')
  if (file.size > LOCAL_FILE_LIMIT) throw new Error('File quá lớn. Vui lòng chọn file tối đa 20 MB.')
  if (/\.doc$/i.test(file.name)) {
    const response = await fetch('/api/files/import-doc', { method: 'POST', headers: { 'Content-Type': 'application/msword' }, body: file, signal: AbortSignal.timeout(60000) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Không thể nhập file .doc.')
    if (typeof result.text !== 'string') throw new Error('Dữ liệu nhập file .doc không hợp lệ.')
    const html = result.text.split(/\r\n|\r|\n/).map((line: string) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('')
    return normalizeImportedDocument(await importedHtmlToDocument(html, file.name))
  }
  try {
    const { importDocx } = await import('./import-docx')
    return normalizeImportedDocument(await importDocx(await file.arrayBuffer(), file.name))
  } catch (error) {
    throw new Error(`Không thể nhập file Word: ${error instanceof Error ? error.message : 'File bị hỏng hoặc không đúng định dạng .docx.'}`)
  }
}

export function docxFilename(name: string) {
  const base = name.replace(/\.(docx|doc|txt)$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/g, '').slice(0, 160)
  return `${base || 'van-ban'}.docx`
}

type SaveHandle = { name?: string; createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }
type SaveWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle> }

// Call from a click handler before generating the DOCX to preserve user activation.
export function chooseSaveFile(name: string): Promise<SaveHandle> | undefined {
  const pickerWindow = window as SaveWindow
  return pickerWindow.showSaveFilePicker?.({ suggestedName: docxFilename(name), types: [{ description: 'Word Document (.docx)', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }] })
}

export async function writeSaveFile(handle: SaveHandle, blob: Blob) {
  const writer = await handle.createWritable()
  try { await writer.write(blob); await writer.close() }
  catch (error) { await writer.abort().catch(() => {}); throw error }
}
