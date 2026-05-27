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

const LINTER_SYSTEM_PROMPT = `Bạn là Trưởng ban Kiểm soát chất lượng văn thư/Chuyên viên Thư ký pháp chế kỳ cựu với hơn 20 năm kinh nghiệm công tác tại Văn phòng Chính phủ Việt Nam. Bạn có sự nhạy bén sắc sảo về ngôn từ công vụ, độ cẩn trọng tuyệt đối về lỗi chính tả tiếng Việt và am hiểu tường tận từng câu chữ trong Nghị định 30/2020/NĐ-CP.

Nhiệm vụ của bạn là rà soát cực kỳ tỉ mỉ văn bản hành chính được cung cấp dưới đây để phát hiện tất cả các lỗi chính tả, lỗi viết hoa và lỗi văn phong hành chính theo các nhóm sau:

## NHÓM 1: KIỂM SOÁT LỖI CHÍNH TẢ TIẾNG VIỆT (YÊU CẦU NGHIÊM NGẶT)
- Phát hiện toàn bộ các lỗi chính tả thông thường bao gồm:
  * Nhầm lẫn phụ âm đầu: s/x (ví dụ: "sản suất" -> "sản xuất"), ch/tr (ví dụ: "triễn lãm" -> "triển lãm"), d/gi/r (ví dụ: "giúp đở" -> "giúp đỡ"), l/n (ví dụ: "lên kế hoạch" -> "lên kế hoạch").
  * Sai dấu thanh điệu: hỏi/ngã (ví dụ: "xã hội" -> "xã hội").
  * Lỗi gõ dấu thanh không đồng nhất hoặc đặt sai vị trí nguyên âm (ví dụ: "hoà" -> "hòa", "thuở" -> "thuở" - thống nhất theo chuẩn tiếng Việt mới).
  * Lỗi đánh máy, dính chữ, gõ sai từ ngữ cảnh.

## NHÓM 2: LỖI VIẾT HOA SAI QUY CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP
- Viết thường các danh từ đặc biệt bắt buộc phải viết hoa: "Nhân dân", "Nhà nước". Cảnh báo ngay nếu ghi "nhân dân", "nhà nước".
- Tên cơ quan, tổ chức: Phải viết hoa chữ cái đầu của các từ/cụm từ chỉ loại hình cơ quan, chức năng chuyên môn (Ví dụ: "Bảo hiểm xã hội", "Ủy ban nhân dân", "Bộ Y tế", "Sở Tài chính"). Cảnh báo ngay nếu viết thường như "ủy ban nhân dân", "bảo hiểm xã hội".
- Tên địa lý (địa danh): Phải viết hoa chữ cái đầu của tất cả âm tiết (Ví dụ: "Cao Lãnh", "Tháp Mười", "Đồng Tháp"). Cảnh báo nếu ghi "cao lãnh", "tháp mười".

## NHÓM 3: VĂN PHONG HÀNH CHÍNH & TỪ NGỮ CÔNG VỤ
- Sử dụng khẩu ngữ, từ ngữ mang sắc thái cảm xúc hoặc từ bình dân không phù hợp với văn phong công vụ (Ví dụ: "rất tốt", "quá tệ", "làm hết sức", "sếp bảo", "mấy phòng khác"). Cảnh báo và gợi ý chuyển sang thuật ngữ hành chính trang trọng.

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
      "reason": "Giải thích ngắn gọn lý do sai theo quy tắc chính tả hoặc quy định Nghị định 30 dưới góc nhìn chuyên viên kỳ cựu"
    }
  ]
}

## LƯU Ý BẮT BUỘC VỀ ĐỊNH DẠNG JSON:
- JSON PHẢI hoàn toàn hợp lệ, tuyệt đối không được cắt ngắn nửa chừng hay thiếu dấu đóng ngoặc.
- Đối với bất kỳ dấu ngoặc kép nào xuất hiện TRONG văn bản thuộc tính (ví dụ: description, reason, suggestion), bạn BẮT BUỘC phải dùng ký tự escape \\\" (ví dụ: "description": "nhập dấu \\\"Tab\\\"" hoặc "Ủy ban \\\"nhân dân\\\"").
- Tuyệt đối không để xảy ra lỗi cú pháp JSON.

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
      max_tokens: 4000,
      system: LINTER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      top_p: 0.1,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Lỗi Anthropic API: ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text as string
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: LINTER_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            topP: 0.1,
          },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json()
      const errMsg = err.error?.message || ''
      
      if ((res.status === 429 || res.status === 503 || errMsg.toLowerCase().includes('demand') || errMsg.toLowerCase().includes('exhausted')) && model !== 'gemini-2.0-flash-lite') {
        console.warn(`[Gemini Fallback] Model ${model} gặp lỗi quá tải. Tự động chuyển đổi sang gemini-2.0-flash-lite...`)
        return callGemini(apiKey, 'gemini-2.0-flash-lite', prompt)
      }
      
      throw new Error(errMsg || `Lỗi Gemini API: ${res.status}`)
    }
    const data = await res.json()
    return data.candidates[0].content.parts[0].text as string
  } catch (error: any) {
    const msg = error.message || ''
    if ((msg.toLowerCase().includes('demand') || msg.toLowerCase().includes('exhausted') || msg.toLowerCase().includes('fetch')) && model !== 'gemini-2.0-flash-lite') {
      console.warn(`[Gemini Fallback] Model ${model} gặp lỗi. Tự động chuyển đổi sang gemini-2.0-flash-lite...`)
      return callGemini(apiKey, 'gemini-2.0-flash-lite', prompt)
    }
    throw error;
  }
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
      temperature: 0.1,
      top_p: 0.1,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      max_tokens: 4000,
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
    let model = 'gemini-2.5-flash' // default fallback

    if (provider === 'gemini') {
      // Nút Gemini (Trả phí)
      if (!apiKey) {
        apiKey = process.env.GEMINI_PAID_API_KEY || process.env.GEMINI_API_KEY
      }
      model = process.env.GEMINI_PAID_MODEL || 'gemini-2.5-flash-lite'
      if (!apiKey) {
        return NextResponse.json({ error: 'Thiếu API Key cho Gemini trả phí' }, { status: 400 })
      }
    } else if (provider === 'anthropic') {
      // Nút AI miễn phí (sử dụng Gemini Free)
      selectedProvider = 'gemini'
      apiKey = customApiKey || process.env.GEMINI_FREE_API_KEY || process.env.GEMINI_API_KEY
      model = process.env.GEMINI_FREE_MODEL || 'gemini-2.5-flash-lite'
      if (!apiKey) {
        return NextResponse.json({ error: 'Thiếu API Key cho AI miễn phí' }, { status: 400 })
      }
    } else if (provider === 'deepseek') {
      if (!apiKey) {
        apiKey = process.env.DEEPSEEK_API_KEY
      }
      if (!apiKey) {
        return NextResponse.json({ error: 'Thiếu API Key cho DeepSeek' }, { status: 400 })
      }
    } else {
      if (!apiKey) {
        apiKey = process.env.ANTHROPIC_API_KEY
      }
      if (!apiKey) {
        return NextResponse.json({ error: 'Thiếu API Key' }, { status: 400 })
      }
    }

    let rawResult: string
    if (selectedProvider === 'gemini') {
      rawResult = await callGemini(apiKey, model, prompt)
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
