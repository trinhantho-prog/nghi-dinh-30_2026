import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

export const DRIVE_COOKIE = 'personal_google_drive'
export const DRIVE_STATE_COOKIE = 'google_drive_oauth_state'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
export const DRIVE_APP_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
export const DRIVE_DOC = 'application/vnd.google-apps.document'
export const DRIVE_FOLDER = 'application/vnd.google-apps.folder'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export type DriveSession = { accessToken: string; refreshToken: string; expiresAt: number; accountId: string; email: string }
export type DriveFile = { id: string; name: string; mimeType: string; version: string; modifiedTime: string; capabilities?: { canEdit?: boolean }; size?: string; webViewLink?: string }

export class DriveError extends Error {
  constructor(message: string, public status = 500) { super(message) }
}

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && (process.env.GOOGLE_DRIVE_COOKIE_SECRET?.length || 0) >= 32)
}

function encryptionKey() {
  if (!driveConfigured()) throw new DriveError('Chưa cấu hình kết nối Google Drive trên máy chủ.', 503)
  return createHash('sha256').update(process.env.GOOGLE_DRIVE_COOKIE_SECRET!).digest()
}

export function sealDriveSession(session: DriveSession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

export function unsealDriveSession(value: string): DriveSession {
  const data = Buffer.from(value, 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12))
  decipher.setAuthTag(data.subarray(12, 28))
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'))
}

export const driveCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/drive', maxAge: 60 * 60 * 24 * 30 }

export async function driveSession() {
  const store = await cookies()
  const value = store.get(DRIVE_COOKIE)?.value
  if (!value) throw new DriveError('Hãy kết nối tài khoản Google Drive cá nhân.', 401)
  let session: DriveSession
  try { session = unsealDriveSession(value) } catch { throw new DriveError('Phiên Drive không hợp lệ. Vui lòng kết nối lại.', 401) }
  if (session.expiresAt > Date.now() + 60_000) return session
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!, grant_type: 'refresh_token', refresh_token: session.refreshToken }),
  })
  if (!response.ok) throw new DriveError('Quyền truy cập Drive đã hết hạn. Hãy kết nối lại; nội dung đang sửa được giữ trong bản nháp.', 401)
  const token = await response.json()
  session = { ...session, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 }
  store.set(DRIVE_COOKIE, sealDriveSession(session), driveCookieOptions)
  return session
}

export async function driveFetch(session: DriveSession, path: string, init: RequestInit = {}, upload = false) {
  const response = await fetch(`https://www.googleapis.com/${upload ? 'upload/' : ''}drive/v3/${path}`, {
    ...init, signal: init.signal || AbortSignal.timeout(60_000), cache: 'no-store', headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${session.accessToken}` },
  })
  if (!response.ok) {
    const status = response.status
    // Do not return Google error bodies, which may include account or request details.
    throw new DriveError(status === 412 ? 'File đã thay đổi trên Drive. Tải lại bản mới trước khi tiếp tục lưu.' : status === 401 ? 'Phiên Google Drive đã hết hạn. Hãy kết nối lại.' : status === 403 ? 'Google Drive từ chối truy cập. Kiểm tra quyền chỉnh sửa file và bật Drive API.' : status === 404 ? 'Không tìm thấy file hoặc thư mục trên Drive.' : 'Không thể kết nối Google Drive. Hãy thử lại.', status === 412 ? 409 : status)
  }
  return response
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new DriveError('Yêu cầu không hợp lệ.', 403)
}

export function driveErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof DriveError ? error.message : 'Không thể xử lý yêu cầu Google Drive.' }, { status: error instanceof DriveError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } })
}

export function validDriveId(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new DriveError('Mã file hoặc thư mục không hợp lệ.', 400)
  return value
}
