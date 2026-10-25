This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Đăng nhập Google và hồ sơ

- Trên trang đăng nhập, bấm **Đăng nhập với Google** để chọn tài khoản Gmail / Google. Khi đăng nhập lỗi, ứng dụng hiển thị lỗi để thử lại; không tự chuyển sang chế độ cục bộ.
- Mở **Hồ sơ / Đăng nhập Gmail** ở danh sách văn bản hoặc **Hồ sơ người dùng** trong trình soạn thảo. Hồ sơ hiển thị email đã xác thực; cho sửa họ tên, cơ quan và chức vụ. Thông tin được lưu trong user metadata của chính tài khoản Supabase, dùng lại khi đăng nhập trên thiết bị khác.
- Tài khoản mới được chuyển tới hồ sơ. Ứng dụng không còn tính năng tạo hoặc tham gia đơn vị. Kết nối Google Drive là phiên OAuth riêng.
- **Cài đặt → Cơ quan ban hành / Danh sách người ký** lưu riêng theo tài khoản đang đăng nhập trong `user_metadata.document_config` của Supabase Auth. Cấu hình tự tải lại khi đăng nhập và được dùng khi tạo, mở văn bản. Không cần tạo đơn vị hay chạy thêm SQL. Hai tài khoản không dùng chung cấu hình; danh sách đã xóa hết vẫn được giữ trống. Lưu thất bại hiển thị lỗi thay vì báo thành công hoặc ghi sang cấu hình dùng chung.
- Cấu hình cũ trên máy hoặc trong đơn vị không có chủ sở hữu Gmail nên không tự chuyển vào tài khoản. Người dùng cần nhập và lưu lại một lần trong tài khoản muốn dùng. Chế độ cục bộ tiếp tục sử dụng cấu hình của máy.

### Cấu hình đăng nhập một lần

1. Tạo dự án Supabase và chạy schema trong `supabase-schema.sql` nếu chưa có cơ sở dữ liệu.
2. Trong Google Cloud, tạo OAuth Client loại **Web application**, cấu hình consent screen và thêm Test users khi ở chế độ Testing. Thêm Authorized redirect URI `https://PROJECT_REF.supabase.co/auth/v1/callback` (dùng Callback URL do Supabase cung cấp).
3. Trong Supabase **Authentication → Sign In / Providers → Google**, bật Google và nhập Client ID, Client Secret. Khóa bí mật được đặt trong Supabase, không đưa vào mã phía trình duyệt.
4. Trong **Authentication → URL Configuration**, đặt Site URL và thêm `http://localhost:3000/auth/callback` cùng `https://TEN-MIEN-CUA-BAN/auth/callback` vào Redirect URLs theo môi trường thực tế.
5. Thêm vào `.env.local` và khởi động lại ứng dụng:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUPABASE_PUBLISHABLE_KEY_CUA_BAN
```

Ứng dụng nhận tên biến `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` theo mẫu Connect của Supabase. Cấu hình cũ dùng `NEXT_PUBLIC_SUPABASE_ANON_KEY` vẫn được hỗ trợ; nếu đặt cả hai, Publishable key được ưu tiên.

Tham khảo [hướng dẫn Google của Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google). Cần kiểm tra đăng nhập, sửa hồ sơ và đăng xuất với tài khoản Google thật sau khi cấu hình.

### Khi đăng nhập báo DNS_PROBE_FINISHED_NXDOMAIN

Lỗi này có nghĩa địa chỉ dịch vụ đăng nhập chưa phân giải được DNS. Kiểm tra Project URL trong Supabase Dashboard và trạng thái dự án; khôi phục nếu đang Paused. URL và khóa anon/publishable phải thuộc cùng một dự án. Không thay URL bằng một mã dự án đoán được từ nơi khác hoặc dùng khóa của dự án cũ.

Trước khi chuyển tới Google, ứng dụng kiểm tra cấu hình qua `/api/auth/google-status`: phát hiện URL/khóa JWT khác dự án, lỗi kết nối/DNS, khóa public bị từ chối hoặc Google provider chưa bật. Trang đăng nhập hiển thị lỗi và cho thử lại, không chuyển tới địa chỉ hỏng. Sau khi sửa `.env.local`, khởi động lại máy chủ; môi trường production cần build và triển khai lại để cập nhật các biến `NEXT_PUBLIC_` trong trình duyệt.

## File trên máy tính và File Save As

- Bấm **Mở file từ máy** trên danh sách văn bản hoặc trong trình soạn thảo. Hỗ trợ Word `.docx` và `.doc` (Word 97–2003), tối đa 20 MB. Không còn nhập `.txt`.
- File `.docx` được đọc trực tiếp từ WordprocessingML trong trình duyệt, giữ khổ trang/lề, cỡ và phông chữ, chữ đậm/nghiêng/gạch chân, căn đoạn, thụt đầu dòng, khoảng cách đoạn/dòng, tỷ lệ cột và ô gộp. Giữ đầu/cuối văn bản trong nội dung nguồn, không nhận diện rồi dựng lại bằng mẫu hành chính. Bảng không viền giữ không viền; bảng chữ 9pt không bị đổi thành chữ nội dung 14pt. Xem trước, bản nháp Drive và xuất Word dùng cùng dữ liệu định dạng. Văn bản tạo mới vẫn dùng mẫu hành chính.
- File `.doc` được gửi tới `/api/files/import-doc` trên máy chủ ứng dụng để trích xuất nội dung chữ trong bộ nhớ, không lưu file lên ổ cứng hay kho văn bản. Ảnh và bố cục bảng của `.doc` chưa được bảo toàn; cần lưu sang `.docx` trong Word để giữ định dạng. File có mật khẩu, sai định dạng hoặc không đọc được sẽ báo lỗi. File Save As xuất `.docx`.
- Chế độ giữ bố cục chưa thay thế toàn bộ bộ dàn trang của Microsoft Word: nhận xét, thay đổi được theo dõi, hình nổi phức tạp, tài liệu nhiều section và các thành phần nâng cao chưa được bảo toàn đầy đủ. Ảnh trong ô bảng hiện đặt sau bảng. Header/footer hỗ trợ chữ, bảng, hộp văn bản và ảnh nhúng với relationships của từng phần. Trường PAGE/NUMPAGES giữ dưới dạng trường tự cập nhật khi xuất Word; thiết lập ẩn header/footer mặc định ở trang đầu được giữ. Đường kẻ ngang dạng shape được giữ riêng, không bị nhận nhầm thành ảnh. Cần kiểm tra bản xem trước và file xuất trước khi lưu đè bản gốc.
- File mở từ ổ cứng không tự lưu vào cơ sở dữ liệu hay Google Drive. Nếu bạn dùng tính năng AI, nội dung trong yêu cầu AI được gửi theo cấu hình AI đã chọn.
- Bấm **File Save As** để chọn tên file `.docx` và thư mục lưu. Trên Chrome / Edge hỗ trợ File System Access API, sử dụng hộp thoại lưu của hệ điều hành qua HTTPS hoặc localhost; khi chọn trùng file, trình duyệt yêu cầu xác nhận ghi đè. Hủy hộp thoại không làm mất nội dung đang sửa.
- Trình duyệt không có API này sẽ hỏi tên file rồi tải xuống theo cài đặt của trình duyệt. Muốn chọn thư mục ở mỗi lần tải, bật tùy chọn hỏi nơi lưu trong trình duyệt. Ứng dụng báo đã gửi tới trình tải xuống và vẫn nhắc kiểm tra bản đã tải vì không thể xác nhận việc ghi file hoàn tất.
- Cảnh báo khi đóng hoặc rời trang có bản chỉnh sửa chưa lưu; báo lỗi ghi file và cho thử lại. Nút này cũng dùng được với văn bản trong kho hoặc Google Drive để lưu thêm một bản Word trên máy.

Kiểm tra: `node --test tests/local-file.test.cjs tests/google-login.test.cjs tests/google-drive.test.cjs` và `npm run build`.

## Google Drive cá nhân

Mở **Google Drive** từ trang danh sách văn bản hoặc **Cài đặt ban đầu → Google Drive cá nhân**. Phần này hoạt động cả khi ứng dụng đang dùng chế độ cục bộ; tài khoản Drive được kết nối riêng bằng OAuth.

### Thiết lập một lần trên máy chủ

1. Trong Google Cloud Console, tạo/chọn dự án và bật **Google Drive API**.
2. Thiết lập OAuth consent screen. Nếu ứng dụng đang ở chế độ Testing, thêm tài khoản Google cá nhân vào danh sách Test users.
3. Tạo OAuth Client loại **Web application**. Khai báo Authorized redirect URI chính xác:
   - Khi chạy local: `http://localhost:3000/api/drive/callback`.
   - Khi triển khai: `https://TEN-MIEN-CUA-BAN/api/drive/callback`.
4. Thêm các biến sau vào `.env.local` hoặc phần cấu hình môi trường của máy chủ (không dùng tiền tố `NEXT_PUBLIC_`):

```dotenv
GOOGLE_DRIVE_CLIENT_ID=CLIENT_ID_CUA_BAN
GOOGLE_DRIVE_CLIENT_SECRET=CLIENT_SECRET_CUA_BAN
GOOGLE_DRIVE_COOKIE_SECRET=CHUOI_NGAU_NHIEN_IT_NHAT_32_KY_TU
```

Có thể tạo khóa mã hóa bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Giữ nguyên khóa này giữa các lần khởi động; đổi khóa sẽ yêu cầu kết nối lại Drive. Khởi động lại ứng dụng sau khi thay đổi cấu hình.

5. Trong OAuth consent screen, khai báo các scope `openid`, `email`, `https://www.googleapis.com/auth/drive` và `https://www.googleapis.com/auth/drive.appdata`. Kết nối và cấp quyền bằng nút trong ứng dụng. Scope Drive đầy đủ cần thiết để liệt kê mọi thư mục có sẵn và cập nhật file gốc; khi phát hành công khai, Google có thể yêu cầu xác minh ứng dụng. Xem [hướng dẫn scope chính thức](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) và [OAuth cho ứng dụng web](https://developers.google.com/identity/protocols/oauth2/web-server).

### Luồng mở và lưu tài liệu

- Hiển thị toàn bộ thư mục do tài khoản cá nhân sở hữu, gồm thư mục trống, với đường dẫn thư mục con. Danh sách thư mục và file đọc hết các trang kết quả của Drive; không giới hạn ở 100 hay 1.000 mục đầu tiên.
- Mở và chỉnh sửa **Google Docs** hoặc **Word `.docx`** có quyền sửa. Các định dạng khác vẫn được liệt kê nhưng chưa mở để sửa trong ứng dụng.
- Lần đầu mở Google Docs hoặc DOCX, máy chủ trả gói DOCX gốc (Google Docs được xuất DOCX). Trình duyệt đọc cùng bộ nhập giữ định dạng với file trên ổ cứng. File chưa bị thay đổi chỉ vì mở xem. Bản nháp cũ theo mẫu vẫn mở được; nút **Đọc lại file trên Drive và giữ bố cục** nhập lại từ file thật, bỏ qua dữ liệu mẫu cũ. Nếu file thật đã bị lưu đè bằng mẫu cũ, cần khôi phục phiên bản gốc trên Drive để lấy lại định dạng đã mất.
- Trong chế độ giữ bố cục, bảng đầu văn bản và bảng nơi nhận/chữ ký được nhận diện thành thông tin hành chính: chỉnh cơ quan, số/ký hiệu, ngày ở mục 1; thể loại, trích yếu và kính gửi ở mục 2; kết luận, nơi nhận và người ký ở mục 5. Mục 4 chỉ giữ nội dung và bảng nghiệp vụ. Các phần hành chính được lưu riêng kèm bố cục nguồn; xem trước và xuất Word ghép lại đúng một lần, cập nhật phần chữ đã sửa và giữ định dạng còn lại. Bản nháp nguồn cũ được phân loại lại khi mở trong trình soạn thảo.
- Nhận diện phần cuối văn bản dạng bảng 2–3 cột hoặc đoạn văn: nơi nhận, chức vụ, tên người ký, các dòng TM./KT./TL./TUQ. và đoạn kết luận có dấu hiệu rõ ràng. Chuyển nội dung vào mục Kết luận & Chữ ký, bỏ bảng chữ ký gốc khỏi nội dung chính để tránh lặp. Dữ liệu bảng nghiệp vụ không được coi là chữ ký chỉ vì có tên/chức vụ. Các dòng thể thức ký nhập từ nguồn được giữ nguyên; không tự thêm TM. cho cơ quan Bảo hiểm xã hội.
- Trong nội dung chính, chọn vị trí rồi dùng **Dán bảng Excel** hoặc Ctrl+V sau khi sao chép vùng ô Excel. Có thể dán vào ô của bảng đang có; vùng dán sẽ mở rộng bảng nếu cần. Khi clipboard có HTML, giữ ô gộp ngang/dọc, tỷ lệ cột, cỡ chữ, chữ đậm, căn chữ, màu nền/chữ, xuống dòng và ô trống. Bảng được thu theo tỷ lệ vừa chiều rộng trang A4; xuất DOCX và dữ liệu mẫu trên Drive cũng giữ thông tin ô gộp/định dạng này. Dán chỉ văn bản vẫn nhập được dữ liệu nhưng không có thông tin để khôi phục ô gộp hay màu nền. Khi trình duyệt không cho đọc clipboard trực tiếp, dùng khung dán Ctrl+V được hiển thị.
- Sau khi người dùng chỉnh sửa, ứng dụng chờ khoảng 1,5 giây rồi cập nhật nội dung **đúng file ID**. Giữ nguyên tên và thư mục; Google Docs vẫn là Google Docs, Word vẫn là Word. Nội dung file gốc được thay bằng bản theo mẫu hành chính. Quy tắc chuyển đổi cập nhật của Drive được mô tả trong [hướng dẫn upload chính thức](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
- Các yêu cầu lưu trong một phiên được tuần tự hóa. Kiểm tra phiên bản file trước khi ghi; gửi `If-Match` khi Drive trả ETag. Nếu phát hiện thay đổi từ phiên khác, dừng tự lưu, giữ bản nháp và yêu cầu mở lại bản trên Drive để đối chiếu. Đây không phải trình soạn thảo cộng tác thời gian thực.
- Giữ bản nháp trong localStorage theo tài khoản và file khi còn thay đổi chưa lưu. Khi mạng trở lại, thử lưu lại. Nếu quyền bị thu hồi hoặc có xung đột, hiển thị lỗi; có thể xuất bản nháp thành DOCX. Khi rời trang, cần chờ trạng thái **Đã lưu vào Google Drive**.
- Dữ liệu mẫu (các trường văn bản, bảng, tỷ lệ cột, ảnh đã dán) được lưu thêm trong `appDataFolder` riêng của ứng dụng trên chính tài khoản Drive. Bản này chỉ được dùng lại khi khớp phiên bản file gốc; nếu file đã được sửa bên ngoài, nhập lại nội dung mới từ file thật. Không tạo file phụ trong các thư mục tài liệu cá nhân.
- Access token và refresh token nằm trong cookie HttpOnly mã hóa AES-GCM, không trả về JavaScript và không lưu vào cơ sở dữ liệu cục bộ dùng chung. Token được làm mới ở máy chủ. **Ngắt kết nối** xóa phiên trên trình duyệt; muốn thu hồi quyền OAuth hoàn toàn, dùng trang quản lý ứng dụng đã kết nối của tài khoản Google.

### Gộp ô và dán ảnh trong nội dung chính

- Chọn ô bằng cách nhấp vào ô, hoặc chọn vùng bằng kéo chuột / Shift+nhấp. Dùng **Căn trái**, **Căn giữa**, **Căn phải** để căn ngang; **Giữa theo chiều dọc** để căn giữa chiều cao ô. Định dạng áp dụng cho toàn vùng chọn, kể cả ô gộp, và giữ khi xem trước, lưu Drive, xuất rồi mở lại Word. **Hiện viền bảng / Ẩn viền bảng** áp dụng cho bảng đang thao tác, gồm các bản nháp đã nhập trước đây.
- Khi nhập Word, viền khai báo ở từng ô (`tcBorders`) cũng được nhận diện ngoài viền cấp bảng (`tblBorders`). Vì vậy bảng nghiệp vụ có viền sẽ hiện khung trong preview; bảng đầu trang và chữ ký không có viền vẫn giữ không viền. Với bản Drive đã nhập bằng phiên bản cũ, có thể chọn **Đọc lại file trên Drive và giữ bố cục** để lấy lại định dạng từ file thật.

- Kéo chuột qua các ô hoặc chọn ô đầu rồi **Shift+nhấp** ô cuối để chọn vùng chữ nhật, sau đó bấm **Gộp ô**. Nội dung được nối theo thứ tự hàng vào ô đầu. **Tách ô** khôi phục các ô riêng, giữ toàn bộ nội dung trong ô đầu để tránh mất dữ liệu. Vùng chọn tự mở rộng để bao trọn ô đã gộp.
- Chụp màn hình bằng **Win+Shift+S**, chọn vị trí trong **Nội dung chính** rồi **Ctrl+V**, hoặc bấm **Dán ảnh**. Có thể chỉnh độ rộng, căn trái/giữa/phải và xóa ảnh. Ảnh mới kế thừa độ rộng và cách căn của ảnh phía trước (mặc định 100%, căn giữa), giúp các ảnh khác kích thước pixel vẫn thẳng hàng. Sau khi dán, con trỏ chuyển đến đoạn văn sau ảnh để tiếp tục nhập hoặc dán ảnh tiếp theo đúng thứ tự. Ảnh giữ tỷ lệ khi xem A4 và xuất Word; dữ liệu mẫu trên Drive giữ ảnh khi mở lại cùng phiên bản.
- Ảnh được xử lý tại trình duyệt, thu nhỏ tối đa 2.048 pixel mỗi chiều; ảnh quá lớn sẽ báo lỗi. Nếu bộ nhớ bản nháp cục bộ đầy, ứng dụng báo rõ để người dùng chờ lưu Drive hoặc xuất DOCX.

### Kiểm tra

Chạy `node --test tests/google-drive.test.cjs` để kiểm tra mô phỏng việc mã hóa phiên, làm mới token, phân trang, kiểm tra tài khoản và xung đột phiên bản trước khi upload. Chạy `npm run build` để kiểm tra toàn bộ ứng dụng. Việc cấp quyền và lưu thật lên Google cần kiểm tra thêm với tài khoản đã kết nối sau khi cấu hình OAuth.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
