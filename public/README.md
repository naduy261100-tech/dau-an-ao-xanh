# DẤU ẤN ÁO XANH — Check-in AI Minh Khương

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

## Mục tiêu
Mở website trên điện thoại, chụp một ảnh, AI tự tạo phong cảnh Tuyên Quang và trình duyệt ghép người vào nền, sau đó người dùng tải ảnh về.

## Kiến trúc không thu phí theo lượt trong hạn mức miễn phí
- Hosting: Cloudflare Workers + Static Assets.
- AI tạo nền: Cloudflare Workers AI, model `@cf/black-forest-labs/flux-1-schnell`.
- Tách người: MediaPipe Selfie Segmentation chạy ngay trong trình duyệt.
- Ghép ảnh: Canvas API chạy ngay trong trình duyệt.
- Ảnh gốc không được tải lên Worker hoặc gửi tới mô hình tạo ảnh.
- Không dùng PhotoRoom API, không cần API key của bên thứ ba.
- Wrangler AI binding: `[ai] binding = "AI"`.

## Hạn mức miễn phí
Tài liệu Cloudflare kiểm tra ngày 04/11/2026 nêu 10.000 Neurons/ngày miễn phí cho Workers AI. FLUX.1 Schnell được tính theo tile 512×512 và số bước; website đặt 8 bước để ưu tiên chất lượng. Số ảnh thực tế phụ thuộc kích thước trả về, lượng Neurons mỗi lần chạy và mức sử dụng chung của tài khoản. Khi hết hạn mức, yêu cầu tạo nền thất bại cho tới khi quota làm mới; ứng dụng không nâng cấp tự động và không tự phát sinh thanh toán.

Nguồn: https://developers.cloudflare.com/workers-ai/platform/pricing/
Mô hình: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/

## Quyền riêng tư
Ảnh gốc và phần người tách ra ở lại trên thiết bị. Worker chỉ nhận mã cảnh chung `rice` hoặc `lake`, trả về nền AI. Ảnh cuối cùng được ghép trong trình duyệt và không được lưu trên server. Cloudflare vẫn có thể xử lý dữ liệu kỹ thuật của yêu cầu như địa chỉ IP, thời điểm và thông tin trình duyệt.

Không sử dụng ảnh học sinh trước khi nhà trường hoàn tất quy trình thông báo và chấp thuận hợp lệ.

## Cây thư mục
- `public/index.html`: giao diện chụp ảnh.
- `public/assets/app.js`: camera, MediaPipe segmentation cục bộ, gọi AI tạo nền và ghép ảnh.
- `public/assets/styles.css`: giao diện điện thoại.
- `public/privacy.html`: thông tin xử lý ảnh.
- `src/index.js`: Worker router.
- `functions/api/health.js`: kiểm tra AI binding.
- `functions/api/background.js`: gọi FLUX.1 Schnell để tạo nền thiên nhiên.
- `wrangler.toml`: static assets và Workers AI binding.

## Kiểm tra sau khi triển khai
1. Mở `/api/health`; kỳ vọng `ready: true`, `mode: "free-ai"`.
2. Mở trang chủ bằng Chrome/Safari trên điện thoại.
3. Chấp thuận camera, chụp ảnh toàn thân, đủ sáng.
4. AI tạo nền; ảnh người và nền được ghép ngay trên điện thoại.
5. Tải ảnh kết quả.

## Giới hạn
MediaPipe có thể tách chưa chuẩn ở tóc bay, nền nhiều chi tiết, người bị che khuất hoặc trang phục trùng màu nền. FLUX.1 Schnell tạo ảnh nền chung theo prompt; bóng và phối tông được xử lý cục bộ. Không thể bảo đảm mọi kết quả đều giống hoàn toàn một ảnh chụp tại chỗ.
