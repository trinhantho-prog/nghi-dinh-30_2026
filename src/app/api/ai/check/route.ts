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

const LINTER_SYSTEM_PROMPT = `Bạn là chuyên gia rà soát, kiểm tra thể thức văn bản hành chính Việt Nam theo Nghị định 30/2020/NĐ-CP.
Nhiệm vụ của bạn là rà soát kỹ văn bản hành chính được cung cấp để phát hiện các lỗi thể thức và chính tả theo các nhóm sau:

## NHÓM 1: LỖI VIẾT HOA SAI QUY CHUẨN NĐ 30
- Danh từ đặc biệt bắt buộc viết hoa: "Nhân dân", "Nhà nước". Cảnh báo nếu ghi "nhân dân", "nhà nước".
- Tên cơ quan, tổ chức: Phải viết hoa chữ cái đầu của các từ/cụm từ chỉ loại hình cơ quan, chức năng chuyên môn (Ví dụ: "Bảo hiểm xã hội", "Ủy ban nhân dân", "Bộ Y tế", "Sở Tài chính"). Cảnh báo nếu viết thường như "ủy ban nhân dân", "bảo hiểm xã hội".
- Tên địa lý (địa danh): Phải viết hoa chữ cái đầu của tất cả âm tiết (Ví dụ: "Cao Lãnh", "Tháp Mười", "Đồng Tháp"). Cảnh báo nếu ghi "cao lãnh", "tháp mười".

## NHÓM 2: LỖI CHÍNH TẢ & VĂN PHONG HÀNH CHÍNH
- Lỗi chính tả tiếng Việt thông thường (s/x, ch/tr, d/gi, l/n, thanh hỏi/ngã).
- Sử dụng khẩu ngữ, từ ngữ cảm xúc, từ bình dân không phù hợp với văn phong công vụ (Ví dụ: "rất tốt", "quá tệ", "làm hết sức", "sếp bảo", "mấy phòng khác").

## KHÔNG BÁO LỖI VỚI:
- Các chữ viết tắt tiêu chuẩn như BHXH, BHYT, UBND, HĐND, NĐ-CP, TTr, QĐ, v.v.
- Số hiệu, ngày tháng, thuật ngữ chuyên ngành đã viết đúng.

## YÊU CẦU ĐẦU RA (JSON format):
Trả về duy nhất một đối tượng JSON có thuộc tính "issues" là mảng các lỗi tìm thấy:
{
  "issues": [
    {
      "field": "Tên trường chứa lỗi (Trích yếu / Kính gửi / Căn cứ pháp lý / Đặt vấn đề / Nội dung chính / Kết luận / Nơi nhận)",
      "fieldKey": "Key tương ứng (docSummary / recipient / legalBasis / issueStatement / mainContent / conclusion / recipientsCc)",
      "type": "error",
      "description": "Cụm từ 1-4 từ SAI nguyên văn lấy trực tiếp từ nội dung văn bản",
      "suggestion": "Cụm từ ĐÚNG tương ứng để sửa lỗi",
      "reason": "Giải thích ngắn gọn lý do sai theo quy tắc Nghị định 30"
    }
  ]
}

Nếu không có lỗi nào, trả về: {"issues": []}
CHỈ trả về JSON thuần túy, không bọc trong \`\`\`json, không kèm lời chào hay giải thích thêm.`

function buildPrompt(doc: DocumentState): string {
  const fields = [
    ['Cơ quan chủ quản', doc.agencyUpper],
    ['Cơ quan ban hành', doc.agencyMain],
    ['Trích yếu', doc.docSummary],
    ['Kính gửi', doc.recipient],
    ['Căn cứ pháp lý', doc.legalBasis],
    ['Đặt vấn đề', doc.issueStatement],
    ['Nội dung chính', doc.mainContent.substring(0, 4000)],
    ['Kết luận', doc.conclusion],
    ['Nơi nhận', doc.recipientsCc],
  ].filter(([, v]) => v?.trim()).map(([k, v]) => `--- ${k} ---\n${v}`).join('\n\n')

  return `Hãy rà soát văn bản sau đây:\n\n${fields}`
}

async function callAnthropic(apiKey: string, prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 2000,
      system: LINTER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Lỗi Anthropic API: ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text as string
}

async function callGemini(apiKey: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: LINTER_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Lỗi Gemini API: ${res.status}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text as string
}

async function callDeepSeek(apiKey: string, prompt: string) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: LINTER_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Lỗi DeepSeek API: ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content as string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

    const allowed = await checkRateLimit(user.id, supabase)
    if (!allowed) return NextResponse.json({ error: 'Đã đạt giới hạn 100 lần kiểm tra hôm nay' }, { status: 429 })

    const { documentData, apiKey: customApiKey, provider = 'gemini' } = await request.json()
    const prompt = buildPrompt(documentData)

    let apiKey = customApiKey?.trim()
    let selectedProvider = provider

    // Nếu không có custom key, tự động dùng server-side Gemini key
    if (!apiKey) {
      if (process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY
        selectedProvider = 'gemini'
      } else {
        return NextResponse.json({ error: 'Thiếu API Key để chạy AI Linter' }, { status: 400 })
      }
    }

    let rawResult: string
    if (selectedProvider === 'gemini') {
      rawResult = await callGemini(apiKey, prompt)
    } else if (selectedProvider === 'deepseek') {
      rawResult = await callDeepSeek(apiKey, prompt)
    } else {
      rawResult = await callAnthropic(apiKey, prompt)
    }

    // Làm sạch JSON
    const cleanJsonStr = rawResult.substring(
      rawResult.indexOf('{'),
      rawResult.lastIndexOf('}') + 1
    )
    const result = JSON.parse(cleanJsonStr)

    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định khi gọi AI Linter'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
