import { randomBytes } from 'node:crypto'
import { DOCX_MIME, DRIVE_DOC, DriveError, DriveFile, DriveSession, driveErrorResponse, driveFetch, driveSession, requireSameOrigin, validDriveId } from '@/lib/google-drive'
import { validateDriveDocument } from '@/lib/drive-document'
import type { DocumentState } from '@/types'

export const runtime = 'nodejs'
const fields = 'id,name,mimeType,version,modifiedTime,size,capabilities(canEdit)'

async function metadata(session: DriveSession, id: string) {
  const response = await driveFetch(session, `files/${id}?fields=${encodeURIComponent(fields)}`)
  const file: DriveFile = await response.json()
  if (![DRIVE_DOC, DOCX_MIME].includes(file.mimeType)) throw new DriveError('Chỉ mở để soạn thảo file Google Docs và Word (.docx).', 415)
  return { file, etag: response.headers.get('etag') || undefined }
}

async function snapshotFile(session: DriveSession, id: string): Promise<string | undefined> {
  const query = new URLSearchParams({ spaces: 'appDataFolder', q: `trashed = false and name = 'vanban-${id}.json'`, fields: 'files(id)', pageSize: '100', orderBy: 'modifiedTime desc' })
  const response = await driveFetch(session, `files?${query}`)
  return (await response.json()).files?.[0]?.id
}

async function writeSnapshot(session: DriveSession, id: string, version: string, state: DocumentState) {
  const snapshotId = await snapshotFile(session, id)
  const boundary = randomBytes(16).toString('hex')
  const meta = snapshotId ? {} : { name: `vanban-${id}.json`, parents: ['appDataFolder'] }
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ version, state })}\r\n--${boundary}--`
  await driveFetch(session, `files${snapshotId ? `/${snapshotId}` : ''}?uploadType=multipart&fields=id`, { method: snapshotId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, true)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await driveSession()
    const id = validDriveId((await context.params).id)
    const { file, etag } = await metadata(session, id)
    if (!file.capabilities?.canEdit) throw new DriveError('File này chỉ có quyền xem. Cần quyền chỉnh sửa để tự lưu vào file gốc.', 403)
    const source = { id, name: file.name, mimeType: file.mimeType, version: file.version, accountId: session.accountId, etag }
    try {
      const savedId = await snapshotFile(session, id)
      if (savedId && new URL(request.url).searchParams.get('source') !== '1') {
        const saved = await (await driveFetch(session, `files/${validDriveId(savedId)}?alt=media`)).json()
        if (saved.version === file.version) return Response.json({ source, state: validateDriveDocument(saved.state) }, { headers: { 'Cache-Control': 'no-store' } })
      }
    } catch { /* If application metadata is unavailable, import the actual source document. */ }
    if (Number(file.size || 0) > 20 * 1024 * 1024) throw new DriveError('File lớn hơn 20 MB. Hãy mở trực tiếp trên Google Drive.', 413)
    const path = file.mimeType === DRIVE_DOC ? `files/${id}/export?mimeType=${encodeURIComponent(DOCX_MIME)}` : `files/${id}?alt=media`
    const response = await driveFetch(session, path)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 20 * 1024 * 1024) throw new DriveError('File quá lớn để nhập vào trình soạn thảo.', 413)
    const latest = await metadata(session, id)
    if (latest.file.version !== file.version) throw new DriveError('File đang được sửa trên Drive. Vui lòng mở lại để lấy nội dung mới nhất.', 409)
    return Response.json({ source, docx: buffer.toString('base64'), imported: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return driveErrorResponse(error) }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const session = await driveSession()
    const id = validDriveId((await context.params).id)
    if (Number(request.headers.get('content-length') || 0) > 24 * 1024 * 1024) throw new DriveError('Văn bản quá lớn để lưu.', 413)
    const form = await request.formData()
    if (form.get('accountId') !== session.accountId) throw new DriveError('Tài khoản Drive đã thay đổi. Hãy kết nối lại đúng tài khoản của file đang sửa.', 409)
    let state: DocumentState
    try { state = validateDriveDocument(JSON.parse(String(form.get('state')))) }
    catch { throw new DriveError('Dữ liệu văn bản không hợp lệ.', 400) }
    const blob = form.get('file')
    if (!(blob instanceof File) || blob.size > 20 * 1024 * 1024 || blob.type !== DOCX_MIME) throw new DriveError('Dữ liệu file Word không hợp lệ.', 400)
    const { file, etag } = await metadata(session, id)
    if (!file.capabilities?.canEdit) throw new DriveError('Bạn không còn quyền chỉnh sửa file này.', 403)
    if (form.get('version') !== file.version) throw new DriveError('File đã thay đổi trên Drive. Bản nháp được giữ lại; hãy mở bản mới trước khi lưu tiếp.', 409)
    const boundary = randomBytes(16).toString('hex')
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ mimeType: file.mimeType })}\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`, blob, `\r\n--${boundary}--`])
    const uploaded = await driveFetch(session, `files/${id}?uploadType=multipart&fields=${encodeURIComponent(fields)}`, { method: 'PATCH', headers: { 'Content-Type': `multipart/related; boundary=${boundary}`, ...(etag ? { 'If-Match': etag } : {}) }, body }, true)
    const updated: DriveFile = await uploaded.json()
    let warning: string | undefined
    try { await writeSnapshot(session, id, updated.version, state) } catch { warning = 'Đã lưu file lên Drive, nhưng chưa lưu được dữ liệu mẫu. Giữ bản nháp trên thiết bị để khôi phục nếu cần.' }
    return Response.json({ version: updated.version, modifiedTime: updated.modifiedTime, warning }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return driveErrorResponse(error) }
}
