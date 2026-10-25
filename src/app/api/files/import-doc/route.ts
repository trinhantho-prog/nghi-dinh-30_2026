import WordExtractor from 'word-extractor'

export const runtime = 'nodejs'

const MAX_BYTES = 20 * 1024 * 1024
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Yêu cầu mở file không hợp lệ.' }, 403)
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return json({ error: 'File quá lớn. Vui lòng chọn file tối đa 20 MB.' }, 413)
  if (!request.body) return json({ error: 'File trống. Vui lòng chọn file khác.' }, 400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BYTES) {
        await reader.cancel()
        return json({ error: 'File quá lớn. Vui lòng chọn file tối đa 20 MB.' }, 413)
      }
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks, length)
    if (length < 512 || !buffer.subarray(0, 8).equals(OLE_SIGNATURE)) return json({ error: 'File không đúng định dạng Word .doc (97–2003). Hãy dùng file .doc gốc hoặc lưu lại thành .docx bằng Word.' }, 400)
    const document = await new WordExtractor().extract(buffer)
    const text = [document.getHeaders({ includeFooters: false }), document.getBody(), document.getTextboxes({ includeHeadersAndFooters: false }), document.getFootnotes(), document.getEndnotes(), document.getFooters()].filter(value => value.trim()).join('\n')
    if (!text.trim()) return json({ error: 'Không tìm thấy nội dung chữ trong file .doc. Nếu tài liệu chỉ chứa ảnh, hãy lưu sang .docx để nhập ảnh.' }, 422)
    if (text.length > 5_000_000) return json({ error: 'Nội dung file quá lớn để nhập vào trình soạn thảo.' }, 413)
    return json({ text })
  } catch {
    return json({ error: 'Không đọc được file .doc. File có thể bị hỏng, có mật khẩu hoặc thuộc phiên bản Word chưa hỗ trợ. Hãy mở bằng Word và lưu lại thành .docx rồi thử lại.' }, 422)
  } finally { reader.releaseLock() }
}
