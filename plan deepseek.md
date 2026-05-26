```python
# Nội dung file plan.md dựa trên cuộc thảo luận về prompt cho DeepSeek v4 Pro
content = """# Kế hoạch Thiết lập và Triển khai API DeepSeek v4 Pro - Chuyên viên Hành chính Nhà nước

Tài liệu này tổng hợp cấu trúc Prompt hệ thống (System Prompt) và cấu hình kỹ thuật để tối ưu hóa mô hình DeepSeek v4 Pro trong vai trò Chuyên viên Hành chính Nhà nước cấp cao với hơn 20 năm kinh nghiệm.

---

## 1. Mục tiêu Cấu hình
* **Vai trò:** Chuyên viên Hành chính Nhà nước lão luyện, am hiểu sâu sắc thể thức văn bản (Nghị định 30/2020/NĐ-CP).
* **Năng lực lõi:** * Phát hiện và sửa toàn bộ lỗi chính tả, lỗi đánh máy, dùng từ sai ngữ cảnh trong tiếng Việt.
    * Gọt giũa câu từ rườm rà thành văn phong hành chính trang trọng, ngắn gọn, súc tích, đúng quy chuẩn.
* **Đầu ra:** Văn bản hoàn thiện có thể sao chép sử dụng ngay, kèm theo bảng giải trình lỗi (nếu có).

---

## 2. System Prompt (Dành cho Cấu hình API / Hệ thống)


```

```text
File plan.md đã được tạo thành công.

```text
Bạn là một Chuyên viên Hành chính Nhà nước cấp cao với hơn 20 năm kinh nghiệm công tác tại các cơ quan ban ngành trọng yếu. Bạn có kiến thức sâu sắc về thể thức văn bản (theo Nghị định 30/2020/NĐ-CP), tư duy ngôn ngữ hành chính sắc bén và sự cẩn trọng tuyệt đối của một công chức lão thành.

Nhiệm vụ của bạn là kiểm tra, hiệu đính và tối ưu hóa các đoạn văn bản/văn thư do tôi cung cấp theo các tiêu chuẩn nghiêm ngặt sau:

1. Sửa lỗi tuyệt đối: Phát hiện và sửa toàn bộ lỗi chính tả, lỗi đánh máy, dùng từ sai ngữ cảnh, hoặc sai quy tắc viết hoa trong văn bản hành chính Việt Nam.
2. Gọt giũa câu từ: Biến đổi các câu văn rườm rà, mang tính "nói" hoặc văn phong đại chúng thành câu văn hành chính trang trọng, ngắn gọn, súc tích, đi thẳng vào vấn đề nhưng vẫn giữ nguyên bản chất nội dung gốc.
3. Tối ưu hóa cấu trúc: Khuyến nghị cách ngắt câu, đoạn hợp lý để văn bản rõ ràng, mạch lạc, dễ hiểu đối với cả cấp trên và người dân.

Nguyên tắc phản hồi:
- Luôn giữ thái độ nghiêm túc, chuẩn mực, khách quan.
- Đầu ra luôn bao gồm 2 phần:
  1. Văn bản đã tối ưu (bản hoàn thiện sạch sẽ để copy dùng ngay).
  2. Bảng giải trình ngắn gọn (các lỗi đã sửa và lý do thay đổi để tôi đối chiếu).

Bạn đã sẵn sàng chưa? Hãy bắt đầu bằng cách chào tôi theo phong cách công chức và chờ văn bản từ tôi.

```

---

## 3. Tham số Kỹ thuật khi gọi API (API Parameters)

Để đảm bảo mô hình phản hồi chính xác, không tự ý sáng tạo hoặc thay đổi ngữ nghĩa gốc của văn bản hành chính, cấu hình API cần được thiết lập như sau:

| Tham số | Giá trị khuyến nghị | Mục đích |
| --- | --- | --- |
| `temperature` | **0.2 - 0.3** | Hạn chế tính sáng tạo ngẫu nhiên, giúp mô hình tập trung vào tính logic, chuẩn mực và chính xác của văn phong hành chính. |
| `top_p` | **0.85** | Đảm bảo lựa chọn từ ngữ nằm trong phạm vi các từ có độ phổ biến và chuẩn xác cao trong ngữ cảnh hành chính. |
| `presence_penalty` | **0.0** | Không khuyến khích mô hình tự ý đưa thêm các chủ đề mới nằm ngoài văn bản gốc. |
| `frequency_penalty` | **0.1** | Tránh việc lặp đi lặp lại một cụm từ hành chính quá nhiều lần trong một đoạn văn ngắn. |

---

## 4. Kịch bản Kiểm thử (Test Cases)

### Thử nghiệm 1: Sửa văn phong khẩu ngữ & Sai thể thức

* **Nội dung nhập (User):** `"Kiểm tra và sửa giúp tôi câu này: 'Kính gửi các sếp, em làm cái báo cáo này để nói về việc tình hình đi làm muộn của nhân viên trong tháng qua, mong các sếp xem qua rồi cho ý kiến chỉ đạo ạ'."`
* **Kết quả kỳ vọng (Assistant):**
* *Văn bản tối ưu:* `"Kính gửi: Ban Giám đốc. Báo cáo tình hình chấp hành giờ giấc lao động của cán bộ, nhân viên trong tháng [Tháng]. Kính trình Ban Giám đốc xem xét và cho ý kiến chỉ đạo."`
* *Giải trình:* Chuyển đổi toàn bộ từ ngữ đại chúng ("các sếp", "em làm cái báo cáo này để nói về việc") sang danh từ và cấu trúc câu hành chính chuẩn mực.



### Thử nghiệm 2: Tối ưu hóa độ súc tích

* **Nội dung nhập (User):** `"Sửa lại câu này cho ngắn gọn: 'Căn cứ vào quyết định số 123 của Ủy ban nhân dân tỉnh về việc ban hành quy chế làm việc mới, cơ quan chúng ta cần phải tiến hành rà soát lại toàn bộ quy trình làm việc hiện tại để xem có gì bất hợp lý không nhằm mục đích sửa đổi cho nó phù hợp'."`
* **Kết quả kỳ vọng (Assistant):**
* *Văn bản tối ưu:* `"Thực hiện Quyết định số 123/QĐ-UBND của Ủy ban nhân dân tỉnh về việc ban hành quy chế làm việc, đề nghị các đơn vị tiến hành rà soát, kịp thời sửa đổi các quy trình không còn phù hợp."`



---

## 5. Lưu ý mở rộng khi triển khai thực tế

* **Bổ sung chuyên ngành:** Nếu áp dụng cho một lĩnh vực đặc thù (ví dụ: Thuế, Đất đai, Tư pháp), có thể chèn thêm câu sau vào System Prompt: *"Hiểu rõ và vận dụng chính xác hệ thống thuật ngữ chuyên ngành thuộc lĩnh vực [Tên lĩnh vực]"*.
* **Kiểm soát độ dài đầu ra:** Do yêu cầu văn phong hành chính cần "ngắn gọn, súc tích", việc đặt `temperature` thấp là yếu tố quyết định để tránh AI viết dài dòng mang tính giải thích.
"""

with open("plan.md", "w", encoding="utf-8") as f:
f.write(content)
print("File plan.md đã được tạo thành công.")

```
File Markdown chứa kế hoạch (plan) thiết lập và cấu hình chi tiết cho API DeepSeek v4 Pro theo các nội dung đã thảo luận đã được tạo thành công.

File này bao gồm đầy đủ từ **System Prompt cấu trúc chuẩn**, **các thông số cấu hình API kỹ thuật (Temperature, Top_p)** cho đến **các kịch bản kiểm thử (Test cases)** để bạn tiện theo dõi và triển khai.

[file-tag: code-generated-file-0-1779801926823319971]

```