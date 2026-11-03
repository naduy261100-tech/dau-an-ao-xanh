# Thông báo xử lý ảnh — Dấu ấn Áo xanh

**Đơn vị dự kiến vận hành:** Chi đoàn Trường Tiểu học Minh Khương.  
**Mục đích:** Tạo ảnh check-in tự nguyện bằng cách dùng AI tách người và tạo phông nền thiên nhiên.

Đây là bản thông báo mẫu để nhà trường rà soát và phê duyệt trước khi sử dụng. Chưa phải văn bản xác nhận rằng trường đã hoàn thành mọi nghĩa vụ pháp lý.

## 1. Ảnh được xử lý như thế nào?

Khi người chụp xác nhận và bấm chụp:
1. Camera trên thiết bị tạo ảnh.
2. Trình duyệt gửi ảnh qua kết nối HTTPS đến hàm xử lý của website trên Cloudflare.
3. Hàm xử lý gửi ảnh tới PhotoRoom Image Editing API để tách nền, tạo nền AI và hòa phối hình ảnh.
4. Ảnh kết quả được truyền trực tiếp về trình duyệt để người dùng xem và tải về.

Website không tạo tài khoản, không hỏi họ tên/số điện thoại, không lưu ảnh thành thư viện, không ghi ảnh vào database/KV/R2/ổ đĩa và không tự đăng ảnh lên mạng xã hội. Ảnh kết quả chỉ nằm tạm trong bộ nhớ trình duyệt khi trang còn mở; khi rời trang, URL ảnh tạm được giải phóng.

## 2. Bên thứ ba và chuyển dữ liệu

PhotoRoom là nhà cung cấp AI xử lý ảnh. Theo trang bảo mật công bố của PhotoRoom tại thời điểm soạn thông báo:
- Ảnh gửi qua API đồng bộ được xử lý trong thời gian thực và loại bỏ ngay sau khi phản hồi.
- Hạ tầng được công bố tại Hoa Kỳ trên Google Cloud Platform và Amazon Web Services.
- Log vận hành được xóa sau 15 ngày; API access logs được giữ một năm.
- PhotoRoom công bố ảnh gửi qua API không được dùng để huấn luyện mô hình AI. Nhà trường vẫn cần kiểm tra điều khoản API, DPA, sub-processors và lựa chọn dữ liệu đang áp dụng cho chính tài khoản trước khi bật xử lý.

Nguồn công bố: https://www.photoroom.com/platform/security

Cloudflare cung cấp hosting, xử lý API và xác thực chống lạm dụng qua Turnstile. Turnstile có thể xử lý địa chỉ IP, hostname, thông tin trình duyệt/thiết bị và tín hiệu bảo mật của phiên truy cập. Nhà trường cần rà soát điều khoản, vị trí xử lý, nhà thầu phụ và chính sách lưu log hiện hành của Cloudflare trước khi phê duyệt.

## 3. Quyền lựa chọn và quyền của người trong ảnh

- Chỉ chụp và gửi ảnh khi người trong ảnh đã được thông báo và có căn cứ đồng ý hợp lệ.
- Người dùng có thể không tiếp tục, đóng trang hoặc từ chối cấp quyền camera.
- Không dùng ảnh của người khác khi chưa có quyền hoặc sự đồng ý hợp lệ.
- Với học sinh, nhà trường cần xác định căn cứ xử lý phù hợp, thông báo cho cha mẹ/người đại diện theo pháp luật và lấy chấp thuận cần thiết; đồng thời lắng nghe, tôn trọng ý kiến của học sinh theo độ tuổi và quy định áp dụng.
- Nhà trường cần xác định đầu mối tiếp nhận yêu cầu liên quan đến dữ liệu cá nhân và quy trình xử lý yêu cầu đó trước khi phát hành mã QR.

## 4. Giai đoạn thử nghiệm và vận hành

**Thử nghiệm:** Chỉ dùng ảnh của chính người trưởng thành đã đọc thông báo và đồng ý. Không thử với ảnh học sinh.

**Vận hành tại trường:** Chỉ bật chế độ học sinh sau khi nhà trường phê duyệt bằng văn bản về mục đích, căn cứ xử lý, thông báo, chấp thuận, dữ liệu chuyển ra nước ngoài, nhà cung cấp xử lý, thời hạn lưu giữ/log, và quy trình tiếp nhận yêu cầu của chủ thể dữ liệu.

## 5. Văn bản cần rà soát

- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, hiệu lực từ 01/01/2026: https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=
- Nghị định 356/2025/NĐ-CP, hiệu lực từ 01/01/2026: https://chinhphu.vn/?classid=1&docid=216387&orggroupid=2&pageid=27160

Nhà trường nên xin ý kiến người phụ trách pháp chế/cơ quan quản lý có thẩm quyền khi cần. Tài liệu này không thay thế tư vấn pháp lý.
