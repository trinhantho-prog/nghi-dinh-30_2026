# HỆ THỐNG QUY TẮC THỂ THỨC VĂN BẢN HÀNH CHÍNH (NGHỊ ĐỊNH 30/2020/NĐ-CP)
> Báo cáo chi tiết các quy tắc đã được hiện thực hóa hoàn thiện và đồng bộ giữa Giao diện xem trước A4 (Preview) và File xuất bản (DOCX) trong ứng dụng Thể thức văn bản AI.

---

## 1. Quy tắc Khổ giấy & Canh lề (Page Setup)
Hệ thống tuân thủ nghiêm ngặt quy định lề trang tiêu chuẩn của Nghị định 30/2020/NĐ-CP trên khổ giấy **A4 (210mm × 297mm)**:

| Loại văn bản | Lề Trên (Top) | Lề Dưới (Bottom) | Lề Trái (Left) | Lề Phải (Right) |
| :--- | :---: | :---: | :---: | :---: |
| **Văn bản thông thường** *(Công văn, Báo cáo, Thông báo, Kế hoạch...)* | 20mm (2.0 cm) | 20mm (2.0 cm) | **30mm (3.0 cm)** | **15mm (1.5 cm)** |
| **Biên bản** *(Khổ đặc thù cho ghi chép)* | 20mm (2.0 cm) | 20mm (2.0 cm) | **30mm (3.0 cm)** | **20mm (2.0 cm)** |

### Hiện thực hóa kỹ thuật:
*   **Web Preview (`A4Preview.tsx`):** Sử dụng thuộc tính `padding` quy đổi trực tiếp theo đơn vị `mm` tương ứng trên thẻ div kích thước cố định `210mm × 297mm`.
*   **Xuất DOCX (`exportDocx.ts`):** Chuyển đổi chính xác sang đơn vị **Twip** (1 inch = 1440 Twip, 1 cm = 567 Twip):
    *   *Thông thường:* Left = `1.18 in` (~30mm), Right = `0.59 in` (~15mm), Top/Bottom = `0.79 in` (~20mm).
    *   *Biên bản:* Left = `3.0 cm`, Right/Top/Bottom = `2.0 cm`.

---

## 2. Quy tắc Phông chữ & Cỡ chữ (Typography)
*   **Phông chữ duy nhất:** **Times New Roman** (chuẩn Unicode chân phương).
*   **Cỡ chữ mặc định:**
    *   *Văn bản thông thường:* **14pt** (Word size 28).
    *   *Biên bản:* **13pt** (Word size 26) để tối ưu mật độ thông tin.

---

## 3. Quy tắc các Thành phần Đầu trang (Header Elements)

### 3.1. Đối với Văn bản Thông thường (Công văn, Báo cáo, Thông báo, Kế hoạch)
Đầu trang được định dạng bằng một bảng 2 cột ẩn viền (`borders: noBorder`), tỷ lệ phân bổ chiều rộng là **48% / 52%** để đảm bảo căn chỉnh cân đối tuyệt đối:

#### Cột bên trái: Cơ quan & Số hiệu
*   **Cơ quan chủ quản cấp trên (agencyUpper):** Chữ in hoa thường, cỡ chữ **12pt**, không in đậm.
*   **Cơ quan ban hành (agencyMain):** Chữ in hoa đậm (**bold**), cỡ chữ **12pt**. Để tránh bị tràn xuống dòng thứ hai khi tên cơ quan dài, hệ thống sử dụng quy tắc thu hẹp khoảng cách ký tự (`characterSpacing: -20` trong Word và `letterSpacing: -0.5px` trên Web Preview).
*   **Đường kẻ phân cách:** Dưới tên cơ quan ban hành, vẽ đường kẻ ngang nét liền dài bằng **1/3 đến 1/2** chiều dài chuỗi chữ in đậm, đặt cân đối chính giữa.
*   **Số, ký hiệu văn bản:** Cỡ chữ **13pt**.
    *   *Dạng Công văn:* `Số: [Số]/[Ký hiệu]` (Ví dụ: `Số: 125/BHXH-CL`).
    *   *Văn bản khác:* `Số: [Số]/KH-BHXH` hoặc chỉ hiển thị Số nếu không có ký hiệu.
*   **Trích yếu ngắn (Chỉ dành cho Công văn):** Đặt trực tiếp dưới số hiệu theo dạng `V/v [Nội dung trích yếu]`, cỡ chữ **13pt**, in thường, không in đậm.

#### Cột bên phải: Quốc hiệu & Tiêu ngữ
*   **Quốc hiệu (CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM):** Chữ in hoa đậm (**bold**), cỡ chữ **12pt** (để giữ trên 1 dòng duy nhất, áp dụng nén khoảng cách ký tự `characterSpacing: -20`).
*   **Tiêu ngữ (Độc lập - Tự do - Hạnh phúc):** Chữ in thường, in đậm (**bold**), cỡ chữ **13pt**.
*   **Đường kẻ tiêu ngữ:** Đường kẻ nét liền dưới dòng tiêu ngữ, có chiều dài bằng **100%** độ dài của chuỗi chữ Tiêu ngữ.
*   **Địa danh & Thời gian ban hành:** Cỡ chữ **13pt - 14pt**, in nghiêng (*italics*). Định dạng tự động chuẩn hóa ngày/tháng/năm sang chữ: `"ngày DD tháng MM năm YYYY"` (VD: *Cao Lãnh, ngày 23 tháng 05 năm 2026*).

### 3.2. Đối với Biên bản
*   Không sử dụng bảng hai cột ở đầu trang.
*   Quốc hiệu, Tiêu ngữ được căn đều chính giữa trang. Phía dưới dòng tiêu ngữ có đường kẻ nét liền dài bằng **100%** độ dài của chuỗi chữ Tiêu ngữ ở cả file docx xuất ra (đã được bổ sung chuẩn) và web preview.

---

## 4. Quy tắc Tên loại & Trích yếu nội dung (Title & Summary)

### 4.1. Đối với Công văn
*   Trích yếu ngắn (`V/v [Tóm tắt nội dung]`) được căn lề giữa ngay dưới số hiệu ở cột bên trái của Header Table (Cỡ chữ **13pt**).
*   Thêm dòng **Kính gửi** căn lề giữa ở phần đầu nội dung, cỡ chữ **14pt**:
    *   *Định dạng:* `Kính gửi: [Tên cơ quan/cá nhân nhận chính]` (Ví dụ: *Kính gửi: Bảo hiểm xã hội tỉnh Đồng Tháp*).

### 4.2. Đối với Báo cáo, Thông báo, Kế hoạch, Biên bản
*   **Tên loại văn bản:** Căn giữa trang, in hoa đậm (**bold**), cỡ chữ **16pt** (Word size 32).
*   **Trích yếu nội dung:** Căn giữa trang ngay dưới tên loại văn bản, cỡ chữ **13pt**, in thường, in đậm đối với Báo cáo/Thông báo/Kế hoạch, in thường không đậm đối với Biên bản. Định dạng trích yếu này **không có dấu chấm cuối câu** ở cả Web Preview và file DOCX xuất ra.
*   **Đường kẻ phân tách:** Phía dưới trích yếu có đường kẻ ngang nét liền dài khoảng **4cm** nằm cân đối ở giữa.

---

## 5. Quy tắc Chuẩn hóa Căn cứ Pháp lý (Legal Basis)
Căn cứ pháp lý là phần cực kỳ quan trọng, dễ mắc lỗi thể thức nhất. Hệ thống đã lập trình và hoàn thiện các quy tắc tự động hóa sau:

1.  **Kiểu chữ & Thụt lề:** Chữ in thường, đứng, không nghiêng, không in đậm, cỡ chữ **13pt - 14pt**. Thụt lề dòng đầu tiên đúng **1.27cm (0.5 inch)**.
2.  **Chuẩn hóa Dấu câu tự động (`addPunctuation`):**
    *   Mỗi dòng căn cứ pháp lý được viết trên một đoạn riêng biệt.
    *   Hệ thống tự động xóa dấu câu sai ở cuối dòng ban đầu (nếu có).
    *   Tự động thêm dấu chấm phẩy (`;`) ở cuối các dòng căn cứ trung gian.
    *   Tự động thêm dấu phẩy (`;`) ở dòng căn cứ cuối cùng trước khi chuyển sang câu đặt vấn đề.

---

## 6. Quy tắc Nội dung & Bố cục Thân bài (Body Content)

### 6.1. Định dạng Đoạn văn (Paragraph Formatting)
*   **Căn lề:** Căn đều hai bên (`AlignmentType.BOTH` / `textAlign: justify`) để trang văn bản phẳng phiu, chuyên nghiệp.
*   **Thụt dòng:** Thụt lề dòng đầu tiên (`textIndent` / `firstLine`) đúng **1.27cm**.
*   **Giãn dòng (Line & Paragraph Spacing):**
    *   Giãn dòng chính xác **1.5 lines** (Word twip = 300, lineRule = `EXACTLY`).
    *   Khoảng cách sau mỗi đoạn văn (`after`) là **120 Twip** (~6pt) để tạo khoảng thở vừa phải giữa các nội dung.

### 6.2. Phân tích & Chuẩn hóa Đầu mục tự động (`normalizeBodyText` & `isHeadingLine`)
Hệ thống tự động nhận diện cấu trúc đầu mục để định dạng kiểu chữ và dấu câu:
*   **Đầu mục La Mã (Ví dụ: `I.`, `II.`, `III.`,...):** Tự động phát hiện, áp dụng in đậm (**bold**), và chuẩn hóa kết thúc bằng dấu hai chấm (`:`).
*   **Đầu mục Số thường (Ví dụ: `1.`, `2.`, `3.`,...):** Tự động in đậm (nếu viết đầu mục riêng) và chuẩn hóa kết thúc bằng dấu chấm (`.`).
*   **Đoạn nội dung thường:** Tự động loại bỏ dấu câu thừa thãi ở cuối dòng và chuẩn hóa kết thúc bằng duy nhất một dấu chấm (`.`).

### 6.3. Xử lý Bảng biểu (Excel/Tabular Tables)
Hệ thống hỗ trợ nhập bảng thông qua dán (Paste) dữ liệu dạng Tab-separated hoặc HTML từ Excel:
*   Bảng biểu được định dạng tràn viền căn lề đều hai bên (`width: 100%`).
*   Đường viền mỏng đen nhạt thanh lịch (`border: 1px solid #000`).
*   **Quy tắc loại bỏ khoảng trống:** Nhằm tránh việc Word tự động chèn khoảng trắng lớn xung quanh bảng, hệ thống chèn các đoạn văn trống có thuộc tính giãn cách bằng 0 (`spacing: { before: 0, after: 0 }`) ngay trước và sau bảng biểu (`createTableWithNoSpacing`).

---

## 7. Quy tắc Phần cuối & Chữ ký (Footer & Signatures)

### 7.1. Đối với Văn bản Thông thường (Có Nơi nhận & Chữ ký)
Chân trang được chia làm 2 cột bằng bảng ẩn viền với tỷ lệ **50% / 50%**:

#### Cột bên trái: Nơi nhận (Recipients)
*   **Tiêu đề "Nơi nhận:":** Cỡ chữ **12pt**, in đậm, in nghiêng, có gạch chân nét đơn bên dưới.
*   **Danh sách nơi nhận:** Cỡ chữ **11pt**, in thường, đứng. Mỗi đơn vị nhận đặt trên một dòng độc lập.
*   **Tự động bổ sung nơi nhận mặc định:** Hệ thống tự động thêm hai dòng bắt buộc nếu chưa có ở cuối danh sách:
    ```text
    - Như trên;
    - Lưu: VT.
    ```

#### Cột bên phải: Chức danh & Chữ ký
*   **Quy tắc Ký thay (KT. GIÁM ĐỐC):** Nếu chức vụ người ký được nhập có chứa chữ `"Phó"` (Ví dụ: *Phó Giám đốc*), hệ thống tự động chèn thêm một dòng chữ in hoa đậm **`KT. GIÁM ĐỐC`** cỡ **13pt - 14pt** ngay phía trên chức danh ký để đúng thẩm quyền ký thay.
*   **Chức danh ký (Ví dụ: `GIÁM ĐỐC`):** Chữ in hoa đậm (**bold**), cỡ chữ **13pt - 14pt**.
*   **Khoảng trống chữ ký:** Chừa khoảng trống tương đương **6 dòng trống** (`emptyLine()`) để ký và đóng dấu.
*   **Họ và tên người ký:** Chữ in thường, in đậm (**bold**), cỡ chữ **13pt - 14pt**, căn giữa chính xác với chức danh.

### 7.2. Đối với Biên bản (Bên A / Bên B)
*   Chân trang chia làm 2 cột đều nhau cho **Bên A** (Bên chủ trì/Đơn vị ban hành) và **Bên B** (Đơn vị phối hợp/Đối tác).
*   **Dòng 1:** Tên đơn vị in hoa đậm (Ví dụ: `BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH`).
*   **Dòng 2:** Chức danh đại diện in hoa đậm (Ví dụ: `ĐẠI DIỆN BÊN A` / `GIÁM ĐỐC`).
*   **Dòng chữ ký:** Chừa khoảng trống chữ ký cao **90px** / 6 dòng trống.
*   **Dòng 4:** Họ và tên người ký in thường, in đậm.

---

