type LoginStatus = { ok: true } | { ok: false; error: string }

export async function googleLoginStatus(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  request: typeof fetch = fetch,
): Promise<LoginStatus> {
  if (!url || !key) return { ok: false, error: 'Chưa cấu hình đăng nhập Google. Cần đặt NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY) trong .env.local rồi khởi động lại ứng dụng.' }
  let endpoint: URL
  try {
    endpoint = new URL(url)
    if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Invalid URL')
  } catch {
    return { ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL không phải địa chỉ HTTP/HTTPS hợp lệ. Hãy sao chép Project URL từ dự án Supabase đang hoạt động.' }
  }

  // Legacy public JWT keys contain their project reference. Never return the key.
  const project = endpoint.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1]
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
    if (project && typeof payload.ref === 'string' && payload.ref !== project) {
      return { ok: false, error: 'URL Supabase và khóa public đang thuộc hai dự án khác nhau. Hãy lấy Project URL và khóa anon/publishable từ cùng một dự án đang hoạt động, cập nhật .env.local rồi khởi động lại ứng dụng.' }
    }
  } catch { /* Publishable keys do not use the legacy JWT format. */ }

  try {
    const response = await request(new URL('/auth/v1/settings', endpoint), {
      headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(6000), redirect: 'error',
    })
    if (response.status === 401 || response.status === 403) return { ok: false, error: 'Supabase từ chối khóa public. Hãy kiểm tra khóa anon/publishable có đúng dự án và còn hiệu lực, sau đó khởi động lại ứng dụng.' }
    if (!response.ok) return { ok: false, error: 'Dự án Supabase chưa sẵn sàng. Hãy kiểm tra trạng thái dự án trong Supabase Dashboard, khôi phục nếu đang tạm dừng và kiểm tra lại Project URL.' }
    const settings = await response.json()
    if (settings.external?.google !== true) return { ok: false, error: 'Dự án Supabase chưa bật đăng nhập Google. Mở Authentication → Sign In / Providers → Google để bật và cấu hình Google OAuth.' }
    return { ok: true }
  } catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined
    if (cause?.code === 'ENOTFOUND' || cause?.code === 'EAI_AGAIN') return { ok: false, error: `Không tìm thấy địa chỉ Supabase ${endpoint.hostname} qua DNS. Hãy kiểm tra Project URL và trạng thái dự án trong Supabase Dashboard. Không thể đăng nhập Google khi địa chỉ này chưa hoạt động.` }
    return { ok: false, error: 'Không kết nối được dịch vụ đăng nhập Supabase. Hãy kiểm tra mạng, Project URL và trạng thái dự án, rồi thử lại.' }
  }
}
