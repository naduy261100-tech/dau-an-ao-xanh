# DẤU ẤN ÁO XANH — Check-in AI Minh Khương

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

## Trải nghiệm trên điện thoại
1. Người dùng đọc thông tin và xác nhận quyền sử dụng ảnh.
2. Website mở camera trực tiếp, mặc định ưu tiên camera sau. Có thể đổi sang camera trước.
3. Người dùng bấm nút chụp như ứng dụng camera điện thoại.
4. Website hiển thị màn hình AI xử lý, tách người ngay trên thiết bị và ghép với phong cảnh.
5. Ảnh hoàn chỉnh có hai thao tác: tải ảnh về hoặc chụp lại. Chụp lại mở camera trở lại mà không phải làm lại bước đồng ý.

## Cách xử lý ảnh
- MediaPipe Selfie Segmentation chạy trong trình duyệt để tạo mặt nạ tách người.
- Trình duyệt gửi mã cảnh chung `rice` lên Cloudflare Worker, không gửi ảnh chụp hoặc phần người đã tách.
- Cloudflare Workers AI dùng `@cf/black-forest-labs/flux-1-schnell` để tạo ảnh phong cảnh Hồng Thái – Tuyên Quang.
- Khi mô hình tạo ảnh tạm quá tải hoặc không khả dụng, Worker lấy ảnh phong cảnh thật từ Pexels làm phương án dự phòng.
- Người và nền được ghép trên thiết bị, có căn chỉnh tỷ lệ, bóng tiếp xúc và điều chỉnh tông màu nhẹ.
- Nút tải ảnh dùng tải tệp trực tiếp trên Android/máy tính; trên iPhone/iPad, nếu trình duyệt hỗ trợ, nút mở bảng chia sẻ để người dùng chọn Lưu hình ảnh.

## Quyền riêng tư
- Ảnh gốc và phần người đã tách ở lại trên thiết bị.
- Worker chỉ nhận mã cảnh chung; không nhận ảnh chụp cá nhân.
- Ảnh nền dự phòng được tải từ Pexels; ảnh người dùng không được gửi tới Pexels.
- Ảnh cuối cùng được ghép trong trình duyệt, không lưu vào database, KV, R2 hoặc ổ đĩa.
- Cloudflare vẫn có thể xử lý dữ liệu kỹ thuật của yêu cầu như IP, thời điểm và thông tin trình duyệt.
- Không sử dụng ảnh học sinh trước khi nhà trường hoàn tất quy trình thông báo và chấp thuận phù hợp.

## Dịch vụ và chi phí
- Hosting: Cloudflare Workers + Static Assets.
- Tách người: MediaPipe Selfie Segmentation trên thiết bị.
- Tạo nền: Cloudflare Workers AI FLUX.1 Schnell.
- Không sử dụng PhotoRoom API, không yêu cầu API key trả phí.
- Tài khoản Cloudflare hiện đang ở Workers Free; hạn mức Workers AI áp dụng chung cho tài khoản và có thể thay đổi theo chính sách nhà cung cấp.
- Website không tự nâng gói hoặc bật thanh toán.

## Giới hạn chất lượng
Đây là quy trình tách chủ thể rồi ghép ảnh 2D, không phải hệ thống AI chỉnh sửa toàn bộ ảnh gốc. Chất lượng phụ thuộc vào độ sáng, nền chụp, tóc, trang phục, tư thế và hướng sáng. Ảnh gốc không được gửi lên máy chủ vì ưu tiên quyền riêng tư; do đó hệ thống không thể dùng mô hình cloud để phân tích từng chi tiết của ảnh cá nhân nhằm tái dựng ánh sáng hoàn toàn chính xác.

## Tệp triển khai
- `public/index.html`: các màn hình đồng ý, camera, xử lý và kết quả.
- `public/assets/app.js`: điều khiển camera, tách người, phối ghép và tải ảnh.
- `public/assets/styles.css`: giao diện mobile.
- `public/privacy.html`: thông tin xử lý ảnh.
- `functions/api/background.js`: tạo phong cảnh AI và ảnh dự phòng.
- `src/index.js`: Worker router và chính sách bảo mật.
- `wrangler.toml`: khai báo Static Assets và AI binding.

## Kiểm tra tự động
GitHub Actions kiểm tra cú pháp JavaScript, Worker modules, cấu hình Wrangler và kiểm tra một yêu cầu tạo nền không gửi ảnh cá nhân.
