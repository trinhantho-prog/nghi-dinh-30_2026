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

const DOCUMENT_ANALYZER_SYSTEM_PROMPT = `Bạn là một trợ lý AI chuyên nghiệp phân tích tài liệu hành chính và soạn thảo văn bản tự động theo Nghị định 30/2020/NĐ-CP của Chính phủ Việt Nam.

Nhiệm vụ của bạn:
1. Tiếp nhận tài liệu đính kèm (dạng văn bản được trích xuất) và yêu cầu/chủ đề từ người dùng.
2. Phân tích kết cấu, nội dung chính, thông tin nhân sự/địa danh trong tài liệu đính kèm.
3. Soạn thảo một văn bản hành chính mới hoàn toàn chuẩn mực, đáp ứng chính xác chủ đề người dùng yêu cầu, dựa trên kết cấu hoặc dữ liệu của tài liệu đính kèm.
4. Trả về kết quả dưới dạng JSON có cấu trúc chính xác theo các trường sau để hệ thống tự động điền vào biểu mẫu.

### CẤU TRÚC JSON ĐẦU RA BẮT BUỘC:
{
  "docType": "cong-van" | "bao-cao" | "thong-bao" | "ke-hoach" | "bien-ban",
  "docSummary": "Trích yếu nội dung của văn bản (dài khoảng 1-2 dòng, viết thường, không có dấu chấm ở cuối câu. Ví dụ: 'Về việc triển khai chiến dịch tiêm chủng mở rộng năm 2026')",
  "recipient": "Tên cơ quan/cá nhân nhận văn bản (chỉ dành cho Công văn, ví dụ: 'Các phòng ban thuộc Bảo hiểm xã hội tỉnh Đồng Tháp', các loại văn bản khác để trống)",
  "legalBasis": "Các căn cứ pháp lý, mỗi căn cứ viết trên một dòng mới độc lập. Lưu ý giữ nguyên câu văn hành chính trang trọng. Ví dụ: 'Căn cứ Luật Bảo hiểm xã hội số 58/2014/QH13 ngày 20/11/2014;\\nCăn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư.'",
  "issueStatement": "Câu đặt vấn đề/nhập đề dẫn dắt vào nội dung chính (ví dụ: 'Thực hiện kế hoạch công tác năm và nhằm nâng cao chất lượng dịch vụ...')",
  "mainContent": "Nội dung chính chi tiết của văn bản hành chính. Viết cực kỳ đầy đủ, hoàn chỉnh (không viết tắt, không dùng ký hiệu tắt, không dùng placeholder như '...', không tóm tắt đại khái). Phải có các mục rõ ràng (như I, II, III hoặc 1, 2, 3) tương ứng với nội dung phân tích từ file đính kèm và yêu cầu của người dùng. Mỗi đoạn văn phải tự nhiên, mạch lạc, trang trọng và nghiêm túc.",
  "conclusion": "Phần kết luận, yêu cầu hoặc lời đề nghị ở cuối văn bản (ví dụ: 'Đơn vị kính trình Lãnh đạo cấp trên xem xét, chỉ đạo thực hiện. Xin trân trọng cảm ơn.')",
  "recipientsCc": "Nơi nhận chi tiết dưới dạng danh sách xuống dòng. Ví dụ: '- Như trên;\\n- Lãnh đạo BHXH tỉnh (để b/c);\\n- Lưu: VT, Tổ CNTT.'",
  "partyAUnit": "Tên đơn vị bên A (chỉ dành cho Biên bản, các loại khác để trống)",
  "partyAPosition": "Chức vụ bên A (chỉ dành cho Biên bản, các loại khác để trống)",
  "partyAName": "Họ tên bên A (chỉ dành cho Biên bản, các loại khác để trống)",
  "partyBUnit": "Tên đơn vị bên B (chỉ dành cho Biên bản, các loại khác để trống)",
  "partyBPosition": "Chức vụ bên B (chỉ dành cho Biên bản, các loại khác để trống)",
  "partyBName": "Họ tên bên B (chỉ dành cho Biên bản, các loại khác để trống)"
}

LƯU Ý QUAN TRỌNG:
- Chỉ trả ra một khối JSON duy nhất hợp lệ. KHÔNG thêm bất kỳ từ dẫn giải, giải thích hay markdown rác bên ngoài khối JSON.
- Đảm bảo trích xuất đầy đủ, thông minh và soạn thảo hoàn chỉnh, cá nhân hóa sâu sắc theo đúng ngữ cảnh thực tế (như các tên riêng trong file đính kèm).`

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
      max_tokens: 4000,
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

async function callGemini(apiKey: string, model: string, systemPrompt: string, userMessage: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.1,
          maxOutputTokens: 4000,
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
      max_tokens: 4000,
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
    let model = 'gemini-2.5-flash' // default fallback

    if (provider === 'gemini') {
      // Nút Gemini (Trả phí)
      if (!apiKey) {
        apiKey = process.env.GEMINI_PAID_API_KEY || process.env.GEMINI_API_KEY
      }
      model = process.env.GEMINI_PAID_MODEL || 'gemini-2.5-pro'
      if (!apiKey) {
        return NextResponse.json({ error: 'Thiếu API Key cho Gemini trả phí' }, { status: 400 })
      }
    } else if (provider === 'anthropic') {
      // Nút AI miễn phí (sử dụng Gemini Free)
      selectedProvider = 'gemini'
      apiKey = process.env.GEMINI_FREE_API_KEY || process.env.GEMINI_API_KEY
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

    const systemPrompt = mode === 'structure'
      ? STRUCTURED_SUGGEST_SYSTEM_PROMPT
      : mode === 'analyzer'
        ? DOCUMENT_ANALYZER_SYSTEM_PROMPT
        : STYLE_TRANSFORMER_SYSTEM_PROMPT

    const userMessage = docContent?.trim()
      ? `Dựa trên nội dung tài liệu đính kèm:\n\n${docContent.substring(0, 8000)}\n\n---\n\n${prompt}`
      : prompt

    let suggestion: string
    if (selectedProvider === 'gemini') {
      suggestion = await callGemini(apiKey, model, systemPrompt, userMessage)
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
