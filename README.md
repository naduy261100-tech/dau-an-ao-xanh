# DẤU ẤN ÁO XANH — Check-in AI Minh Khương

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

## Quy trình sử dụng trên điện thoại
1. Người dùng chọn một trong 11 phong cảnh.
2. Người dùng xác nhận quyền sử dụng ảnh.
3. Website mở camera chụp ảnh hệ thống của điện thoại hoặc cho phép tải ảnh có sẵn.
4. Trình duyệt chạy mô hình Longpipe XL (hoặc Longpipe Large dự phòng) để tách người và tạo alpha matte ngay trên thiết bị.
5. Máy chủ chỉ nhận mã bối cảnh, thông số ánh sáng và câu lệnh; không nhận ảnh người.
6. Cloudflare Workers AI FLUX.1 Schnell tạo một phông nền mới cho từng lượt ghép.
7. Trình duyệt tự phối ghép người gốc với phông nền AI, xuất JPEG 1600 × 2000 px; người dùng tải ảnh hoặc chụp lại.

## Mục tiêu khoảng 100 lượt AI/ngày
- Workers AI Free có 10.000 Neurons mỗi ngày, làm mới theo lịch 00:00 UTC (07:00 giờ Việt Nam).
- Mô hình sử dụng: `@cf/black-forest-labs/flux-1-schnell`, 4 bước.
- Theo bảng giá Cloudflare hiện hành: 4,8 Neurons cho mỗi ô 512 × 512 và 9,6 Neurons cho mỗi bước. Với ảnh vuông đầu ra mặc định 1024 × 1024, chi phí ước tính khoảng 57,6 Neurons/lượt; 100 lượt khoảng 5.760 Neurons.
- Đây là mức ước tính, không phải cam kết hạn mức. Số lượt thực tế phụ thuộc mức sử dụng Workers AI khác trên cùng tài khoản và việc Cloudflare có đang từ chối yêu cầu do trạng thái hạn mức hay không.
- Website không tự chuyển sang gói trả phí và không tự bật thanh toán. Khi Cloudflare từ chối vì quota, ứng dụng hiển thị lỗi rõ ràng, không âm thầm gọi dịch vụ tính phí.
- Mỗi yêu cầu mới tạo một ảnh nền AI riêng; không dùng lại kho 44 ảnh như phiên bản thử nghiệm trước. Người chụp vẫn được xử lý trực tiếp trên thiết bị.

## Thư viện phong cảnh
- Ruộng bậc thang vàng
- Thung lũng ruộng xanh
- Con đường giữa ruộng
- Đường đá bản làng
- Đường làng miền núi
- Lối mòn đồi xanh
- Cầu gỗ giữa rừng
- Lối vườn xanh
- Vườn nhà gỗ
- Vườn hoa rực rỡ
- Thác rừng trên bậc đá

Ảnh xem trước/thư viện dự phòng lấy từ Pexels; thông tin tác giả được lưu trong mã và hiển thị khi chọn chế độ thư viện. Pexels License: https://www.pexels.com/license/

## Chất lượng và giới hạn
- FLUX.1 Schnell được chọn để ưu tiên số lượt tạo mới trong hạn mức miễn phí; mô hình chạy 4 bước để cân bằng tốc độ và chất lượng.
- Đầu ra gốc của mô hình là ảnh vuông; trình duyệt dùng cover-crop để tạo bố cục dọc 4:5 trước khi ghép.
- Ảnh người được giữ từ ảnh gốc; hệ thống không dùng AI vẽ lại khuôn mặt, không làm đẹp da, không đổi nét mặt.
- Đây vẫn là quy trình tách người và ghép ảnh 2D. Hệ thống tạo bóng tiếp xúc nhẹ, nhưng không tái dựng toàn bộ ánh sáng 3D; độ liền mạch phụ thuộc ảnh gốc, mặt nạ tách người và nền được sinh ra.

## Quyền riêng tư
- Ảnh gốc, mặt nạ alpha và phần người đã tách ở lại trên thiết bị.
- Worker chỉ nhận mã bối cảnh, câu lệnh và thông số sáng; không nhận ảnh người.
- Ảnh cuối cùng được ghép trong trình duyệt, không lưu vào database, KV, R2 hoặc ổ đĩa.
- Cloudflare vẫn có thể xử lý dữ liệu kỹ thuật của yêu cầu như IP, thời điểm và thông tin trình duyệt.
- Chỉ sử dụng ảnh học sinh khi nhà trường đã hoàn tất việc thông báo và có chấp thuận phù hợp của người đại diện.

## Dịch vụ và chi phí
- Hosting: Cloudflare Workers + Static Assets.
- Tách người: Longpipe XL / Longpipe Large chạy trong trình duyệt.
- Tạo nền: Cloudflare Workers AI FLUX.1 Schnell trong hạn mức miễn phí của tài khoản.
- Không dùng PhotoRoom API, không yêu cầu API key trả phí và không tự nâng gói.

## Tệp triển khai
- `public/index.html`: chọn bối cảnh, đồng ý, camera và màn hình kết quả.
- `public/assets/app.js`: camera, tách người, gọi AI, ghép nền, tải ảnh và chụp lại.
- `public/assets/styles.css`: giao diện.
- `public/privacy.html`: thông tin xử lý ảnh.
- `functions/api/background.js`: tạo nền AI theo từng lượt.
- `functions/api/health.js`: kiểm tra cấu hình binding; không tiêu Neurons và không khẳng định quota còn.
- `src/index.js`: Worker router và chính sách bảo mật.
- `wrangler.toml`: cấu hình Cloudflare Workers.

## Kiểm tra tự động
- Kiểm tra cú pháp JavaScript cho trình duyệt và Worker.
- Kiểm tra cấu hình Wrangler và các tệp triển khai thiết yếu.
- Smoke test AI thật phải kiểm tra POST trả về `200 image/jpeg`; health check đơn thuần không đủ để kết luận inference đang hoạt động.
