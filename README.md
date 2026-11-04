# DẤU ẤN ÁO XANH — Check-in AI Minh Khương

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

## Quy trình sử dụng trên điện thoại
1. Người dùng chọn một trong bảy phông nền phong cảnh.
2. Người dùng xác nhận quyền sử dụng ảnh.
3. Website mở camera chụp ảnh hệ thống của điện thoại qua `input capture="environment"`; không dùng thẻ video nhúng hoặc trình phát trong trang.
4. Sau khi chụp, website tự chuyển sang màn hình AI xử lý.
5. AI tách người ngay trên thiết bị. Máy chủ nhận mã bối cảnh đã chọn, không nhận ảnh người.
6. Hệ thống ghép người vào nền đã chọn. Người dùng tải ảnh về hoặc bấm chụp lại để mở camera hệ thống lần nữa.

## Thư viện bối cảnh
- Ruộng bậc thang vàng
- Thung lũng ruộng xanh
- Lối nhỏ giữa ruộng
- Hồ núi xanh
- Hồ sương sớm
- Thác giữa rừng
- Suối rừng xanh

Các ảnh xem trước và phông nền dự phòng lấy từ Pexels, có thông tin tác giả trong mã và kết quả. Pexels License: https://www.pexels.com/license/

## Cách xử lý ảnh và giới hạn
- MediaPipe Selfie Segmentation chạy trong trình duyệt để tạo mặt nạ tách người.
- Cloudflare Workers AI FLUX.1 Schnell thử tạo phông nền theo bối cảnh đã chọn. Nếu mô hình miễn phí tạm quá tải hoặc không khả dụng, API trả về ảnh phong cảnh chụp thật tương ứng từ thư viện Pexels.
- Trình duyệt ghép phần người và nền, căn chỉnh tỷ lệ, làm mềm viền, thêm bóng tiếp xúc và điều chỉnh sắc độ nhẹ.
- Đây là quy trình tách người và ghép ảnh 2D, không phải tái dựng ánh sáng 3D hoặc AI chỉnh sửa toàn bộ ảnh gốc. Muốn ảnh đạt mức chân thực như được chụp ngay tại địa điểm, cần mô hình image-to-image có khả năng nhận ảnh người và tái dựng ánh sáng; việc đó sẽ gửi ảnh cá nhân lên máy chủ AI và cần cơ chế đồng ý riêng, đồng thời thường có chi phí.

## Quyền riêng tư
- Ảnh gốc và phần người đã tách ở lại trên thiết bị.
- Worker chỉ nhận mã phông nền chung, không nhận ảnh chụp.
- Ảnh cuối cùng được ghép trong trình duyệt, không lưu vào database, KV, R2 hoặc ổ đĩa.
- Cloudflare vẫn có thể xử lý dữ liệu kỹ thuật của yêu cầu như IP, thời điểm truy cập và thông tin trình duyệt.
- Không sử dụng ảnh học sinh trước khi nhà trường hoàn tất quy trình thông báo và chấp thuận hợp lệ.

## Dịch vụ và chi phí
- Hosting: Cloudflare Workers + Static Assets.
- Tách người: MediaPipe Selfie Segmentation trên thiết bị.
- Tạo nền: Cloudflare Workers AI FLUX.1 Schnell trong hạn mức tài khoản; ảnh Pexels là phương án dự phòng.
- Không dùng PhotoRoom API và không yêu cầu API key trả phí.
- Website không tự nâng gói hoặc bật thanh toán.

## Tệp triển khai
- `public/index.html`: màn hình chọn bối cảnh, đồng ý, camera hệ thống, xử lý và kết quả.
- `public/assets/app.js`: camera capture, tách người, ghép nền, tải ảnh và chụp lại.
- `public/assets/styles.css`: giao diện mobile.
- `public/privacy.html`: thông tin xử lý ảnh.
- `functions/api/background.js`: tạo nền AI và ảnh dự phòng theo lựa chọn.
- `src/index.js`: Worker router và chính sách bảo mật.
- `wrangler.toml`: Static Assets và Workers AI binding.

## Kiểm tra tự động
- GitHub Actions kiểm tra cú pháp JavaScript, Worker modules và cấu hình Wrangler.
- Workflow smoke test gọi lần lượt bảy lựa chọn phông nền, không gửi ảnh cá nhân, kiểm tra từng phản hồi là ảnh JPEG hợp lệ.
