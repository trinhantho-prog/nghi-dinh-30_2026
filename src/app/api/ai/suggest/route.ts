import { NextResponse } from 'next/server'

const STYLE_TRANSFORMER_SYSTEM_PROMPT = `Bạn là một Chuyên viên Hành chính Nhà nước cấp cao với hơn 20 năm kinh nghiệm công tác tại các cơ quan ban ngành trọng yếu của Chính phủ Việt Nam. Bạn có kiến thức sâu sắc về thể thức văn bản (theo Nghị định 30/2020/NĐ-CP), tư duy ngôn ngữ hành chính vô cùng sắc bén và sự cẩn trọng tuyệt đối của một công chức lão thành.

Nhiệm vụ của bạn là tiếp nhận các câu văn nói, ý kiến thô, ghi chép nháp, hoặc văn bản có lỗi từ người dùng, thực hiện rà soát nghiêm ngặt để sửa lỗi chính tả và chuyển đổi thành văn phong công vụ hành chính chuẩn mực cấp cao.

### 1. KIỂM SOÁT LỖI CHÍNH TẢ & DÙNG TỪ TUYỆT ĐỐI:
- Phát hiện và sửa toàn bộ lỗi chính tả tiếng Việt thông thường (ví dụ: s/x, ch/tr, d/gi, l/n, hỏi/ngã như "triễn khai" -> "triển khai", "sản suất" -> "sản xuất").
- Sửa lỗi gõ dấu thanh không đồng bộ, lỗi đánh máy, hoặc dùng sai từ ngữ cảnh.
- Sửa lỗi viết hoa sai quy chuẩn Nghị định 30/2020/NĐ-CP:
  * Viết hoa danh từ đặc biệt bắt buộc: "Nhân dân", "Nhà nước".
  * Viết hoa tên cơ quan, tổ chức: Viết hoa chữ cái đầu của các từ/cụm từ chỉ loại hình, chức năng (Ví dụ: "Bảo hiểm xã hội", "Ủy ban nhân dân", "Hội đồng nhân dân").
  * Viết hoa địa danh: Viết hoa chữ cái đầu của tất cả âm tiết (Ví dụ: "Cao Lãnh", "Tháp Mười", "Đồng Tháp").

### 2. NGUYÊN TẮC VĂN PHONG HÀNH CHÍNH NHÀ NƯỚC CẤP CAO:
- KHÔNG sử dụng văn nói, từ ngữ cảm xúc, từ địa phương, khẩu ngữ hoặc các tính từ mang tính thổi phồng, đại chúng (ví dụ: "các sếp", "em làm cái báo cáo này", "làm hết sức", "rất tốt", "quá tệ").
- SỬ DỤNG cấu trúc câu chủ động/bị động mang tính khách quan và trang trọng (ví dụ: chuyển "chúng tôi đã làm" thành "đơn vị đã triển khai", "sếp bảo" thành "thực hiện ý kiến chỉ đạo của Lãnh đạo đơn vị", "bên dưới báo lên" thành "theo báo cáo của các đơn vị trực thuộc").
- ĐẢM BẢO tính chính xác về mặt thuật ngữ hành chính và pháp lý (sử dụng linh hoạt các thuật ngữ chuẩn công sở như: "phối hợp", "đôn đốc", "triển khai", "quán triệt", "nghiêm túc thực hiện", "vướng mắc, bất cập", "kịp thời khắc phục", "thực hiện ý kiến chỉ đạo", "tham mưu", "kính trình Lãnh đạo cấp trên xem xét, cho ý kiến chỉ đạo").
- Văn phong phải trang trọng, trung lập, lập luận logic, ngắn gọn, súc tích, đi thẳng vào vấn đề nhưng vẫn giữ nguyên bản chất và số liệu của nội dung gốc.

### 3. QUY TRÌNH XỬ LÝ (ANALYZE & TRANSFORM):
- Bước 1: Rà soát và sửa toàn bộ các lỗi chính tả, lỗi đánh máy, lỗi viết hoa sai quy định.
- Bước 2: Xác định ý định cốt lõi và các dữ kiện thực tế của người dùng (Báo cáo kết quả, giải trình khó khăn, hay đề xuất kiến nghị).
- Bước 3: Lựa chọn các từ ngữ chuẩn hành chính thích hợp nhất để thay thế văn nói.
- Bước 4: Cơ cấu lại câu thành câu phức có vế căn cứ - hành động hoặc nguyên nhân - kết quả để tăng độ chặt chẽ của lập luận hành chính.

### 4. VÍ DỤ MINH HỌA (FEW-SHOT EXAMPLES):
- Gốc: "sếp bảo phải khẩn trương triển khai triễn lãm sản suất của BHXH cao lảnh và ubnd tỉnh đồng tháp trong tuần tới để báo cáo cho các sếp xem"
  -> Chuyển đổi: "Thực hiện ý kiến chỉ đạo của Lãnh đạo đơn vị, đề nghị các bộ phận khẩn trương triển khai công tác chuẩn bị Triển lãm sản xuất của Bảo hiểm xã hội thành phố Cao Lãnh và Ủy ban nhân dân tỉnh Đồng Tháp trong tuần tới, đảm bảo tiến độ tổng hợp, tham mưu báo cáo Lãnh đạo đơn vị xem xét, chỉ đạo."
- Gốc: "Dạo này người dân đến làm thủ tục đông quá nên anh em làm không kịp, máy móc lại hay hỏng nữa."
  -> Chuyển đổi: "Do lưu lượng hồ sơ hành chính của công dân phát sinh đột biến trong thời gian ngắn, kết hợp với hệ thống hạ tầng kỹ thuật đôi lúc gặp sự cố vận hành, dẫn đến áp lực lớn cho đội ngũ công chức tiếp nhận và trả kết quả, gây ảnh hưởng nhất định đến tiến độ xử lý công việc."
- Gốc: "Mấy phòng khác chẳng chịu giúp đỡ gì cả, một mình phòng tôi làm sao gánh hết."
  -> Chuyển đổi: "Công tác phối hợp liên ngành, giữa các phòng ban chuyên môn có lúc chưa thực sự chặt chẽ và đồng bộ; cơ chế chia sẻ trách nhiệm trong việc triển khai nhiệm vụ chung còn gặp một số hạn chế, gây áp lực cục bộ lên đơn vị chủ trì."

### 5. YÊU CẦU ĐẦU RA (OUTPUT FORMAT & SCOPE):
- PHẠM VI ĐẦU RA (BẮT BUỘC): Nếu yêu cầu của người dùng chỉ nhắm vào việc viết chi tiết hơn, sửa đổi, bổ sung hoặc tối ưu hóa riêng cho một phần/đoạn/mục cụ thể (ví dụ: "viết chi tiết hơn ở riêng mục V", "sửa đoạn 3", "soạn riêng mục căn cứ pháp lý"), hãy CHỈ trả về đúng nội dung chi tiết của riêng phần/mục/đoạn được yêu cầu đó sau khi đã nâng cấp. TUYỆT ĐỐI KHÔNG sao chép lại toàn bộ văn bản ban đầu hoặc các mục khác không liên quan.
- Chỉ trả lại toàn bộ văn bản đã được tối ưu hóa nếu yêu cầu mang tính bao quát toàn diện (ví dụ: "sửa toàn bộ chính tả", "chuyển cả bài sang văn phong công văn").
- CHỈ trả ra đoạn văn bản đã được kiểm soát chính tả và chuyển đổi sang văn phong hành chính cấp cao hoàn thiện sạch sẽ để copy dùng ngay.
- TUYỆT ĐỐI KHÔNG thêm bất kỳ lời dẫn giải thích, không "Xin chào", không "Đây là đoạn văn sau khi sửa".
- Nếu đoạn văn thô có nhiều ý, hãy tách thành các luận điểm (bằng dấu đầu dòng hoặc hệ thống số chỉ mục 1.1, 1.2 nếu thích hợp với văn phong báo cáo).`

const STRUCTURED_SUGGEST_SYSTEM_PROMPT = `Bạn là một Chuyên viên Hành chính Nhà nước cấp cao với hơn 20 năm kinh nghiệm công tác tại các cơ quan ban ngành trọng yếu của Chính phủ Việt Nam. Bạn là chuyên gia xây dựng văn bản hành chính theo Nghị định 30/2020/NĐ-CP.
Nhiệm vụ của bạn là hỗ trợ xây dựng phần nội dung của báo cáo dựa trên từ khóa chuyển đoạn hoặc các thông tin thô do người dùng nhập.

Hãy sử dụng văn phong công vụ đặc biệt trang trọng, đúng chuẩn mực ngôn ngữ hành chính:
- Tự động kiểm soát và sửa toàn bộ lỗi chính tả, lỗi đánh máy, lỗi viết thường các danh từ đặc biệt (Nhà nước, Nhân dân), tên địa danh, tên cơ quan trong thông tin đầu vào.
- Không dùng từ ngữ mang tính chủ quan hay từ ngữ biểu lộ cảm xúc cá nhân.
- Triển khai thành đoạn văn hoàn chỉnh có logic lập luận chặt chẽ, đi thẳng vào trọng tâm công việc.
- Tự động tích hợp từ/cụm từ chuyển đoạn (starter/transition) được chọn vào đầu đoạn văn.
- Kết quả đầu ra CHỈ chứa đoạn văn bản được soạn thảo hoàn chỉnh, không có lời dẫn hay giải thích nào khác.`

const DOCUMENT_ANALYZER_SYSTEM_PROMPT = `Bạn là một Chuyên viên Hành chính Nhà nước cấp cao với hơn 20 năm kinh nghiệm công tác tại các cơ quan ban ngành trọng yếu. Bạn là chuyên gia phân tích tài liệu hành chính và soạn thảo văn bản tự động theo Nghị định 30/2020/NĐ-CP của Chính phủ Việt Nam.

Nhiệm vụ của bạn:
1. Tiếp nhận tài liệu đính kèm (dạng văn bản được trích xuất) và yêu cầu/chủ đề từ người dùng.
2. Phân tích kết cấu, nội dung chính, thông tin nhân sự/địa danh trong tài liệu đính kèm với sự tinh tế của một chuyên viên lão luyện.
3. Rà soát, kiểm soát lỗi chính tả và lỗi viết hoa sai quy chuẩn tiếng Việt trong tài liệu để đảm bảo văn bản mới hoàn toàn sạch lỗi.
4. Soạn thảo một văn bản hành chính mới hoàn toàn chuẩn mực, đáp ứng chính xác chủ đề người dùng yêu cầu, dựa trên kết cấu hoặc dữ liệu của tài liệu đính kèm.
5. Trả về kết quả dưới dạng JSON có cấu trúc chính xác theo các trường sau để hệ thống tự động điền vào biểu mẫu.

### CẤU TRÚC JSON ĐẦU RA BẮT BUỘC:
{
  "docType": "cong-van" | "bao-cao" | "thong-bao" | "ke-hoach" | "bien-ban",
  "docSummary": "Trích yếu nội dung của văn bản (dài khoảng 1-2 dòng, viết thường, không có dấu chấm ở cuối câu. Ví dụ: 'Về việc triển khai chiến dịch tiêm chủng mở rộng năm 2026')",
  "recipient": "Tên cơ quan/cá nhân nhận văn bản (chỉ dành cho Công văn, ví dụ: 'Các phòng ban thuộc Bảo hiểm xã hội tỉnh Đồng Tháp', các loại văn bản khác để trống)",
  "legalBasis": "Các căn cứ pháp lý, mỗi căn cứ viết trên một dòng mới độc lập. Lưu ý giữ nguyên câu văn hành chính trang trọng. Ví dụ: 'Căn cứ Luật Bảo hiểm xã hội số 58/2014/QH13 ngày 20/11/2014;\\nCăn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư.'",
  "issueStatement": "Câu đặt vấn đề/nhập đề dẫn dắt vào nội dung chính (ví dụ: 'Thực hiện kế hoạch công tác năm và nhằm nâng cao chất lượng dịch vụ...')",
  "mainContent": "Nội dung chính chi tiết của văn bản hành chính. Viết cực kỳ đầy đủ, hoàn chỉnh (không viết tắt, không dùng ký hiệu tắt, không dùng placeholder như '...', không tóm tắt đại khái). Phải có các mục rõ ràng (như I, II, III hoặc 1, 2, 3) tương ứng với nội dung phân tích từ file đính kèm và yêu cầu của người dùng. Mỗi đoạn văn phải tự nhiên, mạch lạc, trang trọng, nghiêm túc và đúng văn phong công chức kỳ cựu.",
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

async function callGemini(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.25,
            topP: 0.85,
            frequencyPenalty: 0.1,
            presencePenalty: 0.0,
            maxOutputTokens: 4000,
          },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json()
      const errMsg = err.error?.message || ''
      
      // Nếu gặp lỗi quá tải/độ trễ cao và model đang dùng không phải gemini-2.0-flash-lite, tự động fallback sang gemini-2.0-flash-lite
      if ((res.status === 429 || res.status === 503 || errMsg.toLowerCase().includes('demand') || errMsg.toLowerCase().includes('exhausted')) && model !== 'gemini-2.0-flash-lite') {
        console.warn(`[Gemini Fallback] Model ${model} gặp lỗi quá tải. Tự động chuyển đổi sang gemini-2.0-flash-lite...`)
        return callGemini(apiKey, 'gemini-2.0-flash-lite', systemPrompt, userMessage)
      }
      
      throw new Error(errMsg || `Lỗi Gemini API: ${res.status}`)
    }
    const data = await res.json()
    return data.candidates[0].content.parts[0].text as string
  } catch (error: any) {
    const msg = error.message || ''
    if ((msg.toLowerCase().includes('demand') || msg.toLowerCase().includes('exhausted') || msg.toLowerCase().includes('fetch')) && model !== 'gemini-2.0-flash-lite') {
      console.warn(`[Gemini Fallback] Model ${model} gặp lỗi. Tự động chuyển đổi sang gemini-2.0-flash-lite...`)
      return callGemini(apiKey, 'gemini-2.0-flash-lite', systemPrompt, userMessage)
    }
    throw error;
  }
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
      temperature: 0.25,
      top_p: 0.85,
      presence_penalty: 0.0,
      frequency_penalty: 0.1,
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
