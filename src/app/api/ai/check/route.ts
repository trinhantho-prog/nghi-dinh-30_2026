import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DocumentState } from '@/types'

const RATE_LIMIT = 100

async function checkRateLimit(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single()

  if ((data?.count ?? 0) >= RATE_LIMIT) return false

  await supabase.from('ai_usage').upsert(
    { user_id: userId, usage_date: today, count: (data?.count ?? 0) + 1 },
    { onConflict: 'user_id,usage_date' }
  )
  return true
}

function buildPrompt(doc: DocumentState): string {
  const fields = [
    ['Trích yếu', doc.docSummary],
    ['Kính gửi / Gửi đến', doc.recipient],
    ['Căn cứ pháp lý', doc.legalBasis],
    ['Đặt vấn đề', doc.issueStatement],
    ['Nội dung chính', doc.mainContent.substring(0, 4000)],
    ['Kết luận', doc.conclusion],
  ].filter(([, v]) => v?.trim()).map(([k, v]) => `--- ${k} ---\n${v}`).join('\n\n')

  return `Bạn là Chuyên viên Kiểm soát Văn bản Hành chính với tính cách cực kỳ cẩn thận và nghiêm túc. Nhiệm vụ của bạn là rà soát toàn bộ văn bản công vụ dưới đây để phát hiện hai nhóm lỗi sau:

## NHÓM 1 — LỖI CHÍNH TẢ VÀ GÕ MÁY
Nhầm dấu hỏi/ngã, sai nguyên âm đôi, thừa/thiếu ký tự, đặt sai dấu câu:
- Sai phụ âm đầu (d/gi, ch/tr, s/x, l/n): "dải thích" → "giải thích", "cần cứ" → "căn cứ"
- Sai vần/nguyên âm (ăn/ân, ơn/on, iêu/iu): "thực hiên" → "thực hiện", "thiếc" → "thiết"
- Sai thanh điệu hỏi/ngã: "qủa" → "quả", "bão hiểm" → "bảo hiểm", "mẩu" → "mẫu"
- Thừa/thiếu dấu phụ (ă/a, ơ/o, ê/e, ô/o, ư/u, đ/d): "cơ quản" → "cơ quan"

## NHÓM 2 — LỖI DÙNG TỪ KHÔNG PHÙ HỢP VĂN PHONG HÀNH CHÍNH
Từ bình dân, khẩu ngữ, địa phương hoặc nhầm lẫn từ gần âm:
- Nhầm từ đồng âm: "tham quan" ≠ "thăm quan", "chín muồi" ≠ "chín mùi"
- Dùng từ sai chuẩn hành chính: "sử lý" → "xử lý", "sản suất" → "sản xuất", "dự thão" → "dự thảo"
- Lẫn lộn từ gần âm: "khoản/khoảng", "điều/điếu", "tham mưu/thăm mưu"
- Từ khẩu ngữ/địa phương không dùng trong văn bản chính thức

## KHÔNG BÁO LỖI VỚI (bắt buộc bỏ qua):
- Chữ viết tắt chuẩn: BHYT, BHXH, NĐ-CP, TT-BYT, QĐ, CV, KCB, DVKT, v.v.
- Mã văn bản, số hiệu: 30/2020/NĐ-CP, 26/2025/TT-BYT, 4790/QĐ-BYT
- Số liệu, ngày tháng, tiền tệ, phần trăm
- Thuật ngữ y tế, pháp lý chuyên ngành đã chuẩn
- Viết hoa/thường của từ thông dụng trong câu ("công văn", "thông tư", "báo cáo" KHÔNG phải lỗi)

## YÊU CẦU ĐỊNH DẠNG JSON (bắt buộc):
- "field": tên trường chứa lỗi (một trong: Trích yếu / Kính gửi / Gửi đến / Căn cứ pháp lý / Đặt vấn đề / Nội dung chính / Kết luận)
- "type": "error" cho nhóm 1 và nhóm 2
- "description": cụm từ SAI gồm 2-4 từ trích nguyên văn, PHẢI bao gồm từ bị sai và 1-2 từ liền kề để định vị chính xác trong văn bản — VÍ DỤ: "kết quả làm việt" thay vì chỉ "việt"; "tiến hành sử lý" thay vì chỉ "sử lý"
- "suggestion": cụm từ ĐÚNG tương ứng, cùng số từ với description — VÍ DỤ: "kết quả làm việc"; "tiến hành xử lý"
- Nếu không xác định được từ cụ thể bị sai → KHÔNG báo lỗi đó

## Nội dung cần kiểm tra:

${fields}

Trả về JSON thuần túy (không có markdown, không có \`\`\`):
{"issues": [{"field": "tên trường", "type": "error|warning", "description": "2-4 từ nguyên văn chứa lỗi", "suggestion": "cụm từ đúng tương ứng"}]}

Nếu không phát hiện lỗi: {"issues": []}
CHỈ trả về JSON, không kèm giải thích hay văn bản khác.`
}

async function callGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Lỗi Gemini API: ${res.status}`)
  }
  const data = await res.json()
  return JSON.parse(data.candidates[0].content.parts[0].text)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const allowed = await checkRateLimit(user.id, supabase)
    if (!allowed) return NextResponse.json({ error: 'Đã đạt giới hạn 10 lần kiểm tra hôm nay' }, { status: 429 })

    const { documentData }: { documentData: DocumentState } = await request.json()
    const prompt = buildPrompt(documentData)
    const result = await callGemini(prompt)

    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: 'Lỗi khi gọi AI' }, { status: 500 })
  }
}
