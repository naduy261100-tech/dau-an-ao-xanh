# DẤU ẤN ÁO XANH — Check-in AI Minh Khương

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

## Kiến trúc

- GitHub repository: `naduy261100-tech/dau-an-ao-xanh`.
- Hosting giao diện và API: Cloudflare Pages + Pages Functions.
- AI xử lý ảnh: PhotoRoom Image Editing API Plus, AI Backgrounds Studio và AI Relight.
- Website không có tài khoản người dùng, không lưu ảnh vào database, KV, R2 hay ổ đĩa.
- GitHub Pages tĩnh không chạy được API backend/secret. GitHub lưu mã nguồn; Cloudflare Pages chạy giao diện và hàm API.

## Trải nghiệm dành cho khách

1. Mở một đường link HTTPS.
2. Đọc thông báo xử lý ảnh, xác nhận và cho phép camera.
3. Chụp ảnh.
4. AI tách chủ thể, tạo phong cảnh tham chiếu từ ảnh thiên nhiên Tuyên Quang và hòa phối ánh sáng.
5. Ảnh trả thẳng về điện thoại để tải xuống.

Không cần chọn nền, nhập tên, cài ứng dụng hay tải ảnh lên một trang khác.

## Ảnh phong cảnh tham chiếu

- Hồ núi sương sớm ở Tuyên Quang: Quang Nguyen Vinh, Pexels photo 2166695 — https://www.pexels.com/photo/foggy-lake-2166695/
- Ruộng lúa và núi ở Tuyên Quang: Q. Hưng Phạm, Pexels photo 29127885 — https://www.pexels.com/photo/lush-rice-fields-in-vietnam-s-tuyen-quang-29127885/
- Trang ảnh ghi rõ “Free to use” theo Pexels License; phần ghi công vẫn được giữ trong thông tin dự án.

## Xuất bản online — không cần cài phần mềm

### 1. Kết nối GitHub với Cloudflare Pages

1. Đăng nhập hoặc tạo tài khoản tại https://dash.cloudflare.com/.
2. Mở **Workers & Pages → Create application → Pages → Connect to Git**.
3. Chọn GitHub và repository `naduy261100-tech/dau-an-ao-xanh`.
4. Production branch: `main`.
5. Framework preset: **None**; Build command để trống; Build output directory: `.`; Root directory để trống.
6. Bấm **Save and Deploy**. Có thể đặt tên project `dau-an-ao-xanh`; URL sẽ là `https://<ten-du-an>.pages.dev`.
7. Mỗi commit mới lên `main` sẽ tự động kích hoạt deployment.

### 2. Cấu hình PhotoRoom API

Tạo tài khoản API tại https://www.photoroom.com/api/, bật Image Editing API Plus và lấy API key trong dashboard.

Trong Cloudflare Pages → dự án → **Settings → Variables and Secrets → Add**:

| Tên biến | Loại | Giá trị |
|---|---|---|
| `PHOTOROOM_API_KEY` | Secret | API key PhotoRoom; dùng key bắt đầu bằng `sandbox_` để thử nghiệm |
| `PHOTOROOM_NO_TRAINING_CONFIRMED` | Text | Chỉ đặt `YES` sau khi đã xác nhận lựa chọn opt-out huấn luyện/cải thiện mô hình trong tài khoản PhotoRoom |
| `ADULT_TESTING_ENABLED` | Text | Đặt `YES` để thử nghiệm giới hạn bằng ảnh của chính người trưởng thành đã đồng ý |
| `SCHOOL_PROCESSING_APPROVED` | Text | Chỉ đặt `YES` sau khi nhà trường phê duyệt quy trình, thông báo, căn cứ xử lý và phương án chuyển dữ liệu |

Để thử nghiệm ban đầu, chỉ đặt `ADULT_TESTING_ENABLED=YES`, dùng ảnh của chính người trưởng thành; chưa dùng ảnh học sinh. Khi đưa vào vận hành tại trường, tắt adult testing và chỉ bật `SCHOOL_PROCESSING_APPROVED=YES` sau khi hoàn tất rà soát. Khóa API phải là **Secret**, tuyệt đối không đưa vào HTML/JavaScript hoặc GitHub.

Sau khi thêm/sửa biến, tạo deployment mới để Pages Functions nhận cấu hình.

### 3. Kiểm tra

- Mở `https://<ten-du-an>.pages.dev/api/health`; trường `ready` phải là `true`.
- Mở trang chủ bằng Safari/Chrome trên điện thoại, đồng ý thông báo, cho phép camera và chụp thử bằng ảnh người trưởng thành.
- Sandbox có watermark. Cần gói/khóa production Plus phù hợp trước khi sử dụng thật.
- Trước khi in QR, bật Cloudflare WAF rate limiting cho `/api/process`; mức khởi điểm tham khảo 4 yêu cầu/5 phút/IP và điều chỉnh theo lưu lượng.

## Chi phí PhotoRoom tham khảo

Tại thời điểm kiểm tra 03/11/2026, trang giá chính thức nêu:
- Sandbox Image Editing API: 1.000 lượt/tháng, tối đa 100 lượt/ngày, kết quả có watermark, không cần thẻ.
- Image Editing API Plus: mức tham chiếu 0,10 USD/ảnh. Ví dụ 100 ảnh khoảng 10 USD, chưa gồm thuế/tỷ giá và thay đổi gói.
- Yêu cầu lỗi không bị tính lượt theo tài liệu giá API.

Nguồn: https://www.photoroom.com/api/pricing

## Quyền riêng tư và bảo vệ dữ liệu

- Luồng xử lý đồng bộ: trình duyệt → Cloudflare Pages Function → PhotoRoom API → trình duyệt.
- Website không lưu ảnh gốc hoặc ảnh kết quả vào database, KV, R2 hay ổ đĩa.
- PhotoRoom công bố hạ tầng API tại Hoa Kỳ; ảnh API đồng bộ bị loại bỏ sau khi phản hồi. Log vận hành được giữ 15 ngày và API access logs 1 năm.
- Thông tin bảo mật hiện hành của PhotoRoom nêu chính sách huấn luyện phụ thuộc gói/hợp đồng; self-serve API có lựa chọn opt-out trong cài đặt. Mã nguồn khóa xử lý cho đến khi quản trị viên xác nhận opt-out đã có hiệu lực.
- Trước khi dùng ảnh học sinh, nhà trường cần rà soát Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026), Nghị định 356/2025/NĐ-CP, thông báo/chấp thuận, hồ sơ chuyển dữ liệu ra nước ngoài và trách nhiệm của các bên.
- Giai đoạn đầu chỉ thử nghiệm bằng ảnh của chính người trưởng thành tự nguyện. Không dùng ảnh học sinh trước khi nhà trường phê duyệt quy trình và có chấp thuận phù hợp.
- Website không có thư viện ảnh, không tự đăng mạng xã hội, không yêu cầu tên/số điện thoại.

Nguồn bảo mật: https://www.photoroom.com/platform/security
Luật 91/2025/QH15: https://chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroupid=3
Nghị định 356/2025/NĐ-CP: https://chinhphu.vn/?classid=1&docid=216387&orggroupid=2&pageid=27160

## Giới hạn chất lượng

AI Backgrounds Studio tạo phong cảnh mới dựa trên ảnh chủ thể, prompt và ảnh tham chiếu; AI Relight giúp hòa hợp ánh sáng nhưng có thể làm biến đổi nhẹ sắc độ. Không có API nào bảo đảm giữ nguyên từng pixel khuôn mặt hoặc tạo kết quả hoàn hảo với mọi ảnh. Ảnh tối, tóc bay, người bị che khuất, nhiều người đứng sát nhau hoặc thiếu phần bàn chân có thể làm giảm chất lượng. Cần thử nghiệm nhiều góc chụp trước khi công khai QR.

## Tệp dự án

- `index.html`: giao diện check-in.
- `assets/styles.css`: giao diện điện thoại.
- `assets/app.js`: camera, nén ảnh, gửi API, tải kết quả.
- `functions/api/health.js`: kiểm tra trạng thái.
- `functions/api/process.js`: kiểm tra đồng ý, xác thực ảnh, gọi AI và trả ảnh không lưu.
- `_headers`, `_routes.json`, `wrangler.toml`: cấu hình Cloudflare Pages.
- `PRIVACY.md`: thông báo quyền riêng tư mẫu để nhà trường rà soát/phê duyệt.
