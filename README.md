# DẤU ẤN ÁO XANH — Check-in AI Minh Khương

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

## Cách hoạt động
1. Người dùng mở link và cho phép camera.
2. MediaPipe Selfie Segmentation chạy ngay trong trình duyệt để tách người khỏi nền.
3. Trình duyệt gửi mã cảnh chung (ruộng lúa hoặc hồ núi), không gửi ảnh gốc, lên Worker.
4. Cloudflare Workers AI dùng FLUX.1 Schnell tạo phong cảnh thiên nhiên.
5. Nếu mô hình AI tạm quá tải hoặc hết hạn mức miễn phí, hệ thống dùng ảnh phong cảnh thật từ Pexels làm nền dự phòng.
6. Ảnh người và phong cảnh được ghép ngay trên điện thoại; người dùng tải kết quả về.

## Dịch vụ và chi phí
- Hosting: Cloudflare Workers + Static Assets.
- Tách người: MediaPipe Selfie Segmentation trong trình duyệt.
- Tạo nền: Cloudflare Workers AI, `@cf/black-forest-labs/flux-1-schnell`.
- Không dùng PhotoRoom API, không cần API key bên thứ ba.
- Tài khoản Cloudflare hiện đang ở **Workers Free**. Hạn mức được công bố là 10.000 Neurons/ngày.
- Ứng dụng đặt FLUX.1 Schnell ở 4 bước. Theo đơn giá công bố, mô hình tiêu thụ 4.8 Neurons mỗi tile 512×512 và 9.6 Neurons mỗi bước. Nếu đầu ra 1024×1024 (4 tile), ước tính khoảng 57.6 Neurons/ảnh, tương đương lý thuyết khoảng 170 ảnh/ngày hoặc khoảng 5.000 ảnh/tháng nếu toàn bộ hạn mức chỉ dùng cho website này. Số lượng thực tế có thể thấp hơn do mức sử dụng chung tài khoản, kích thước ảnh, tải hệ thống và giới hạn mô hình.
- Trên Workers Free, khi hết hạn mức miễn phí, yêu cầu AI sẽ bị từ chối cho tới khi làm mới; website không tự nâng cấp gói và không bật thanh toán.
- Không chuyển tài khoản sang Workers Paid hoặc mua AI credits nếu mục tiêu là giữ chi phí 0 đồng.
- Khi FLUX không sẵn sàng, fallback ảnh Pexels giữ cho quy trình ghép ảnh tiếp tục hoạt động; ảnh fallback là ảnh chụp thật, không phải ảnh AI tạo.

Nguồn: https://developers.cloudflare.com/workers-ai/platform/pricing/
Model: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/

## Quyền riêng tư
- Ảnh gốc và phần người đã tách ở lại trên thiết bị.
- Worker chỉ nhận lựa chọn cảnh chung `rice` hoặc `lake`, không nhận ảnh chụp.
- Nếu cần fallback, Worker chỉ tải ảnh phong cảnh Pexels; không gửi ảnh người dùng đến Pexels.
- Ảnh cuối cùng được ghép trong trình duyệt, không lưu vào database, KV, R2 hoặc ổ đĩa.
- Cloudflare vẫn có thể xử lý dữ liệu kỹ thuật của yêu cầu như địa chỉ IP, thời điểm và thông tin trình duyệt.
- Không sử dụng ảnh học sinh trước khi nhà trường hoàn tất quy trình thông báo và chấp thuận hợp lệ.

## Tệp triển khai
- `public/index.html`: giao diện chụp ảnh.
- `public/assets/app.js`: camera, tách người cục bộ, gọi AI tạo nền và ghép ảnh.
- `public/assets/styles.css`: giao diện điện thoại.
- `public/privacy.html`: thông tin xử lý ảnh.
- `src/index.js`: Worker router.
- `functions/api/health.js`: kiểm tra Workers AI binding.
- `functions/api/background.js`: gọi FLUX.1 Schnell để tạo nền, sau đó fallback sang ảnh chụp thật từ Pexels nếu mô hình tạm quá tải/hết hạn mức.
- `wrangler.toml`: khai báo Static Assets và AI binding.

## Giới hạn chất lượng
MediaPipe có thể tách chưa chuẩn ở tóc bay, nền nhiều chi tiết, người bị che khuất hoặc trang phục gần màu nền. FLUX.1 Schnell tạo nền từ mô tả cảnh, không phân tích ảnh người để tự căn chỉnh mọi chi tiết. Ứng dụng bổ sung bóng và phối tông ở mức nhẹ; không thể bảo đảm mọi ảnh đều giống ảnh chụp tại địa điểm thật.

## Kiểm tra
- `/api/health` phải trả `ready: true` và `mode: "free-ai"`.
- Mở website bằng Chrome/Safari phiên bản mới, cấp quyền camera, chụp rõ toàn thân và tải kết quả.
