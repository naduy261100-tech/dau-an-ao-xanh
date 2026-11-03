# DẤU ẤN ÁO XANH – CHECK-IN AI MINH KHƯƠNG

Công trình thanh niên của Chi đoàn Trường Tiểu học Minh Khương.

Mã nguồn ứng dụng đang được đóng gói trong `Dau_an_Ao_xanh_AI.zip`. Đây là ứng dụng Cloudflare Pages gồm website điện thoại và Pages Functions để giữ kín khóa PhotoRoom API. Không triển khai bằng GitHub Pages tĩnh vì cần máy chủ trung gian.

## Triển khai
1. Tải và giải nén `Dau_an_Ao_xanh_AI.zip` tại thư mục gốc của dự án khi tạo Cloudflare Pages build.
2. Cloudflare Pages: Connect to Git → chọn `naduy261100-tech/dau-an-ao-xanh`, nhánh `main`.
3. Framework preset: None; Build command: `unzip -o Dau_an_Ao_xanh_AI.zip -d .`; Build output directory: `.`.
4. Thêm các secrets: `PHOTOROOM_API_KEY`, `PHOTOROOM_NO_TRAINING_CONFIRMED`, `SCHOOL_PROCESSING_APPROVED` theo README trong ZIP.
5. Chỉ mở xử lý sau khi đã xác nhận tắt huấn luyện/được opt-out trong PhotoRoom và nhà trường hoàn tất phê duyệt bảo vệ dữ liệu, chuyển dữ liệu xuyên biên giới.

## Cảnh báo
Chưa cấu hình khóa API và quyền riêng tư thì camera sẽ bị khóa. Giai đoạn thử nghiệm chỉ dùng ảnh người trưởng thành đã đồng ý. Không đưa ảnh học sinh vào thử nghiệm khi chưa hoàn tất thủ tục.