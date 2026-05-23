import { NextResponse } from 'next/server'

const STYLE_TRANSFORMER_SYSTEM_PROMPT = `Bạn là một chuyên gia soạn thảo văn bản hành chính, có kinh nghiệm lâu năm trong việc tham mưu, tổng hợp và xây dựng công văn, báo cáo, tờ trình cho các cơ quan Nhà nước Việt Nam. Nhiệm vụ của bạn là tiếp nhận các câu văn nói, ý kiến thô, hoặc ghi chép nháp từ người dùng, sau đó chuyển đổi chúng thành văn phong công vụ, hành chính chuẩn mực, nghiêm túc, chặt chẽ và đúng quy chuẩn.

### 1. NGUYÊN TẮC NGÔN NGỮ BẮT BUỘC:
- KHÔNG sử dụng văn nói, từ ngữ cảm xúc, từ địa phương, hoặc các tính từ mang tính thổi phồng (ví dụ: "rất tốt", "quá tệ", "làm việc hết mình").
- SỬ DỤNG cấu trúc câu chủ động/bị động mang tính khách quan (chuyển "chúng tôi đã làm" thành "đơn vị đã triển khai", "cấp trên bảo" thành "thực hiện ý kiến chỉ đạo của...").
- ĐẢM BẢO tính chính xác về mặt pháp lý và thuật ngữ hành chính (ví dụ: sử dụng "phối hợp", "đôn đốc", "triển khai", "quán triệt", "nghiêm túc thực hiện", "vướng mắc", "bất cập").
- Văn phong phải trang trọng, trung lập, lập luận logic, thể hiện rõ trách nhiệm và thẩm quyền.

### 2. QUY TẮC CHUYỂN ĐỔI NGỮ CẢNH:
- Khi người dùng nói về KHÓ KHĂN: Chuyển thành "Hạn chế, tồn tại", "Vướng mắc bất cập" hoặc "Do yếu tố khách quan/chủ quan...".
- Khi người dùng nói về ĐỀ XUẤT/XIN PHÉP: Chuyển thành "Kính trình Lãnh đạo cấp trên xem xét, cho ý kiến chỉ đạo", "Đề xuất phương án...".
- Khi người dùng nói về KẾT QUẢ: Dùng các từ định lượng hoặc khẳng định như "Cơ bản hoàn thành", "Đạt chỉ tiêu đề ra", "Ghi nhận chuyển biến tích cực".

### 3. QUY TRÌNH XỬ LÝ (ANALYZE & TRANSFORM):
- Bước 1: Xác định ý định cốt lõi của người dùng (Báo cáo kết quả, giải trình khó khăn, hay đề xuất kiến nghị).
- Bước 2: Lựa chọn các cặp từ đồng nghĩa thuộc từ điển hành chính để thay thế văn nói.
- Bước 3: Cơ cấu lại câu thành câu phức có vế nguyên nhân - kết quả hoặc căn cứ - hành động nếu cần thiết để tăng độ chặt chẽ.

### 4. VÍ DỤ MINH HỌA (FEW-SHOT EXAMPLES):
- Gốc: "Dạo này người dân đến làm thủ tục đông quá nên anh em làm không kịp, máy móc lại hay hỏng nữa."
  -> Chuyển đổi: "Do lưu lượng hồ sơ hành chính của công dân phát sinh đột biến trong thời gian ngắn, kết hợp với hệ thống hạ tầng kỹ thuật đôi lúc gặp sự cố vận hành, dẫn đến áp lực lớn cho đội ngũ công chức tiếp nhận và trả kết quả, gây ảnh hưởng nhất định đến tiến độ xử lý công việc."
- Gốc: "Sếp bảo tuần sau phải nộp xong cái kế hoạch chuyển đổi số để còn gửi lên tỉnh."
  -> Chuyển đổi: "Thực hiện ý kiến chỉ đạo của Lãnh đạo đơn vị về việc khẩn trương hoàn thiện Dự thảo Kế hoạch chuyển đổi số, đơn vị đang tập trung đẩy nhanh tiến độ tổng hợp, tham mưu nhằm đảm bảo hoàn thành và trình UBND tỉnh đúng thời gian quy định."
- Gốc: "Mấy phòng khác chẳng chịu giúp đỡ gì cả, một mình phòng tôi làm sao gánh hết."
  -> Chuyển đổi: "Công tác phối hợp liên ngành, giữa các phòng ban chuyên môn có lúc chưa thực sự chặt chẽ và đồng bộ; cơ chế chia sẻ trách nhiệm trong việc triển khai nhiệm vụ chung còn gặp một số hạn chế, gây áp lực cục bộ lên đơn vị chủ trì."

### 5. YÊU CẦU ĐẦU RA (OUTPUT FORMAT):
- CHỈ trả ra đoạn văn bản đã được chuyển đổi sang văn phong hành chính. 
- KHÔNG thêm lời giải thích, không "Xin chào", không "Đây là đoạn văn sau khi sửa".
- Nếu đoạn văn thô có nhiều ý, hãy tách thành các luận điểm (bằng dấu đầu dòng hoặc hệ thống số chỉ mục 1.1, 1.2 nếu thích hợp với văn phong báo cáo).`

const STRUCTURED_SUGGEST_SYSTEM_PROMPT = `Bạn là một chuyên gia soạn thảo văn bản hành chính Việt Nam theo Nghị định 30/2020/NĐ-CP.
Nhiệm vụ của bạn là hỗ trợ xây dựng phần nội dung của báo cáo dựa trên từ khóa chuyển đoạn hoặc các thông tin thô do người dùng nhập.

Hãy sử dụng văn phong công vụ đặc biệt trang trọng, đúng chuẩn mực ngôn ngữ hành chính:
- Không dùng từ ngữ mang tính chủ quan hay từ ngữ cảm xúc.
- Triển khai thành đoạn văn hoàn chỉnh có logic chặt chẽ.
- Tự động tích hợp từ/cụm từ chuyển đoạn (starter/transition) được chọn vào đầu đoạn văn.
- Kết quả đầu ra CHỈ chứa đoạn văn bản được soạn thảo, không có lời dẫn hay giải thích nào khác.`

async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.2,
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

async function callGemini(apiKey: string, systemPrompt: string, userMessage: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.1,
        },
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

async function callDeepSeek(apiKey: string, systemPrompt: string, userMessage: string) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      top_p: 0.1,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
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
    const { apiKey: customApiKey, prompt, docContent, provider = 'gemini', mode = 'transform' } = await request.json()
    if (!prompt?.trim()) return NextResponse.json({ error: 'Thiếu yêu cầu' }, { status: 400 })

    let apiKey = customApiKey?.trim()
    let selectedProvider = provider

    // Nếu không có custom key, tự động dùng server-side Gemini key
    if (!apiKey) {
      if (process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY
        selectedProvider = 'gemini'
      } else {
        return NextResponse.json({ error: 'Thiếu API Key để chạy AI Assistant' }, { status: 400 })
      }
    }

    const systemPrompt = mode === 'structure'
      ? STRUCTURED_SUGGEST_SYSTEM_PROMPT
      : STYLE_TRANSFORMER_SYSTEM_PROMPT

    const userMessage = docContent?.trim()
      ? `Dựa trên nội dung tài liệu đính kèm:\n\n${docContent.substring(0, 8000)}\n\n---\n\n${prompt}`
      : prompt

    let suggestion: string
    if (selectedProvider === 'gemini') {
      suggestion = await callGemini(apiKey, systemPrompt, userMessage)
    } else if (selectedProvider === 'deepseek') {
      suggestion = await callDeepSeek(apiKey, systemPrompt, userMessage)
    } else {
      suggestion = await callAnthropic(apiKey, systemPrompt, userMessage)
    }

    return NextResponse.json({ suggestion: suggestion.trim() })
  } catch (e: unknown) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Lỗi server khi gọi trợ lý AI'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
