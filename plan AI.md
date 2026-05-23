

### 1.3. Module AI Trợ Lý Ngôn Ngữ Hành Chính (AI Assistant)
* **Style Transformer (Hành chính hóa văn bản):** Chuyển đổi câu văn nói, từ ngữ cảm xúc, nháp thô thành câu phức có vế nguyên nhân - kết quả hoặc căn cứ - hành động đậm chất công vụ.
* [cite_start]**Gợi ý cấu trúc báo cáo 3 phần:** Tự động gợi ý từ ngữ chuyển đoạn chuẩn mực cho phần: (1) Căn cứ pháp lý/Tình hình [cite: 56, 62][cite_start], (2) Kết quả đạt được/Hạn chế tồn tại[cite: 62], (3) Phương hướng nhiệm vụ/Kiến nghị đề xuất.

### 1.4. Module Kiểm Tra Lỗi Thể Thức (Compliance Linter)
* [cite_start]**Quét lỗi chính tả & Thể thức:** Tự động cảnh báo khi viết hoa sai quy chuẩn đối với danh từ đặc biệt (Nhân dân, Nhà nước) [cite: 212][cite_start], viết hoa tên cơ quan [cite: 208][cite_start], hoặc viết hoa tên địa lý[cite: 199].
* [cite_start]**Quét khoảng cách dòng/đoạn:** Cảnh báo nếu người dùng cố tình kéo giãn dòng hoặc lùi đầu dòng sai quy định ($1 \text{ cm}$ hoặc $1.27 \text{ cm}$)[cite: 71, 78].

---

## 4. Phụ Lục: Cấu Hình System Prompt Cho Trợ Lý AI

Đoạn prompt sau đây được nạp cố định vào AI service của ứng dụng để làm nhiệm vụ chuyển đổi phong cách viết cho cán bộ, công chức:

```text
Bạn là một chuyên gia soạn thảo văn bản hành chính, có kinh nghiệm lâu năm trong việc tham mưu, tổng hợp và xây dựng công văn, báo cáo, tờ trình cho các cơ quan Nhà nước Việt Nam. Nhiệm vụ của bạn là tiếp nhận các câu văn nói, ý kiến thô, hoặc ghi chép nháp từ người dùng, sau đó chuyển đổi chúng thành văn phong công vụ, hành chính chuẩn mực, nghiêm túc, chặt chẽ và đúng quy chuẩn.

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
- Nếu đoạn văn thô có nhiều ý, hãy tách thành các luận điểm (bằng dấu đầu dòng hoặc hệ thống số chỉ mục 1.1, 1.2 nếu thích hợp với văn phong báo cáo).
# Tài Liệu Thiết Lập API DeepSeek Cho Hệ Thống Soạn Thảo Văn Bản Hành Chính

Tài liệu này hướng dẫn cách cấu hình tham số kỹ thuật và triển khai các API Route Handlers trong dự án Next.js (App Router) nhằm khai thác mô hình DeepSeek cho hai tác vụ: Kiểm tra lỗi thể thức/chính tả theo **Nghị định 30/2020/NĐ-CP** và Gợi ý nội dung phản hồi chuẩn văn phong công vụ.

---

## 1. Cấu Hình Tham Số Kỹ Thuật (API LLM Settings)

Đặc thù văn phong hành chính nhà nước yêu cầu tính chính xác, nhất quán và chặt chẽ cao. Khi gọi API của DeepSeek, cần thiết lập các tham số cấu hình hệ thống (`options`) như sau để kiểm soát chặt chẽ đầu ra, hạn chế tối đa sự sáng tạo tự do của mô hình:

* **`temperature` (Thiết lập: `0.0` đến `0.2`):** Ép mô hình hoạt động ở trạng thái tư duy tuyến tính, tập trung vào tính logic, lập luận dựa trên văn bản pháp lý và hạn chế tối đa việc tự ý bịa đặt hoặc dùng từ ngữ bay bổng.
* **`top_p` (Thiết lập: `0.1`):** Giới hạn tập hợp từ vựng lựa chọn. Mô hình chỉ được phép chọn các thuật ngữ phổ thông, chuẩn mực thường dùng trong môi trường cơ quan nhà nước.
* **`presence_penalty` và `frequency_penalty` (Thiết lập: `0.0`):** Giữ nguyên tần suất sử dụng từ ngữ. Tránh việc mô hình cố gắng né tránh lặp từ bằng cách đổi sang các từ đồng nghĩa không chuẩn quy chuẩn pháp lý (Văn bản hành chính yêu cầu tính lặp lại chính xác của thuật ngữ).

---

## 2. Triển Khai Các Endpoints Trong Next.js

Tạo 2 API Routes chuyên biệt dưới dạng Server-side Route Handlers nhằm bảo mật API Key của hệ thống.

### 2.1. Endpoint Kiểm Tra Lỗi Chính Tả & Thể Thức
* **Tệp tin:** `app/api/compliance/check/route.ts`
* **Phương thức:** `POST`
* **Chức năng:** Tiếp nhận nội dung văn bản hiện tại của trình soạn thảo, phân tích lỗi chính tả tiếng Việt và thể thức viết hoa, cấu trúc khối theo Nghị định 30, trả về danh sách lỗi định dạng JSON.

```typescript
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { content, docType } = await req.json();

    const systemPrompt = `
      Bạn là một chuyên gia kiểm soát chất lượng văn bản hành chính (Linter) tại cơ quan Nhà nước Việt Nam. 
      Nhiệm vụ của bạn là rà soát văn bản người dùng cung cấp và phát hiện các lỗi sau dựa trên Nghị định 30/2020/NĐ-CP và chính tả tiếng Việt chuẩn:
      1. Lỗi chính tả tiếng Việt thông thường.
      2. Lỗi viết hoa sai quy định (như viết hoa sai danh từ đặc biệt "Nhân dân", "Nhà nước", viết hoa sai tên cơ quan, tổ chức, hoặc địa danh).
      3. Lỗi thiếu cấu trúc bắt buộc của loại văn bản "${docType}" (ví dụ: Công văn thì phải có "Kính gửi", Biên bản thì phải có "Thời gian bắt đầu, Thành phần tham dự").

      Yêu cầu đầu ra: Trả về dữ liệu định dạng JSON nguyên bản, không nằm trong khối mã (code block), không thêm lời dẫn giải. Cấu trúc JSON dạng mảng như sau:
      [
        {
          "error": "Từ/Cụm từ hoặc lỗi phát hiện",
          "type": "Chính tả" hoặc "Thể thức viết hoa" hoặc "Cấu trúc văn bản",
          "reason": "Giải thích ngắn gọn lý do sai theo quy định",
          "suggestion": "Phương án sửa đổi chuẩn mực"
        }
      ]
    `;

    const response = await fetch('[https://api.deepseek.com/v1/chat/completions](https://api.deepseek.com/v1/chat/completions)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat', 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Hãy rà soát văn bản sau: "${content}"` }
        ],
        temperature: 0.1,
        top_p: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Lỗi kết nối API DeepSeek');
    }

    return NextResponse.json({ 
      success: true, 
      violations: JSON.parse(data.choices[0].message.content) 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
2.2. Endpoint Gợi Ý Phản Hồi Văn Phong Công Vụ
Tệp tin: app/api/compliance/suggest-reply/route.ts

Phương thức: POST

Chức năng: Nhận nội dung thắc mắc thô (câu hỏi của công dân, kiến nghị) kèm bối cảnh thực tế/số liệu, tự động biên soạn nội dung trả lời theo văn phong công văn, hướng dẫn hành chính.
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { inquiry, contextData } = await req.json();

    const systemPrompt = `
      Bạn là cán bộ chuyên trách tổng hợp và tham mưu văn bản hành chính tại cơ quan Nhà nước Việt Nam.
      Người dùng sẽ cung cấp một nội dung thắc mắc/yêu cầu giải quyết ("inquiry") kèm thông tin bối cảnh/dữ liệu thực tế ("contextData").
      Nhiệm vụ của bạn là soạn thảo một nội dung phản hồi chính thức dưới dạng văn phong công văn chỉ đạo hoặc công văn trả lời hướng dẫn.

      TIÊU CHUẨN VĂN PHONG:
      - Nghiêm túc, trang trọng, khách quan, không dùng từ ngữ biểu cảm cá nhân hoặc lời hứa hẹn vô căn cứ.
      - Sử dụng đúng các thuật ngữ hành chính chuyên ngành (ví dụ: "Căn cứ quy định tại...", "Đơn vị ghi nhận và đang phối hợp xử lý...", "Trân trọng thông báo đến ông/bà được biết...").
      - Cấu trúc câu mạch lạc, rõ ràng, phân định rõ nội dung giải quyết và hướng dẫn tiếp theo (nếu có).

      YÊU CẦU ĐẦU RA:
      - CHỈ đưa ra phần nội dung phản hồi cốt lõi, không có lời chào hỏi giao tiếp của AI, không giải thích lý do xử lý ngoài văn bản.
    `;

    const response = await fetch('[https://api.deepseek.com/v1/chat/completions](https://api.deepseek.com/v1/chat/completions)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Nội dung thắc mắc: "${inquiry}". \nThông tin bối cảnh/Số liệu thực tế liên quan: "${contextData}"` 
          }
        ],
        temperature: 0.2,
        top_p: 0.1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Lỗi kết nối API DeepSeek');
    }

    return NextResponse.json({ 
      success: true, 
      replySuggestion: data.choices[0].message.content 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
Định Hướng Xử Lý Dữ Liệu Tại Giao Diện (UI/UX Integration)Tích hợp Trình rà soát lỗi (Compliance Check): Sau khi nhận mảng violations từ API, sử dụng các plugin trang trí văn bản của Rich-text Editor (như Decoration của TipTap) để tô đậm hoặc gạch chân lượn sóng màu đỏ các ký tự nằm trong thuộc tính "error". Cài đặt sự kiện hiển thị Tooltip chứa "reason" và nút bấm kích hoạt tự động điền "suggestion" vào văn bản gốc.Khung xử lý nhanh câu trả lời (Smart Reply Sidebar): Thiết kế một biểu mẫu (Form) phụ ở thành bên (Sidebar). Khi người dùng nhập yêu cầu từ công dân, hệ thống gọi API và hiển thị kết quả xử lý thô ở định dạng Textarea hoặc Markdown đơn giản, kèm nút "Chèn trực tiếp vào con trỏ chuột" giúp tối ưu hóa $80\%$ thời gian soạn thảo công văn phản hồi thực tế.