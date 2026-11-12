# Popup mobile V8

Đã thu gọn toàn bộ popup cho điện thoại dọc (rộng ≤700 px) và ngang (cao ≤550 px). Bản local: http://127.0.0.1:5173.

## Hiển thị

- Một stylesheet `popup-mobile.css` quản lý kích thước mobile, nạp sau các stylesheet còn lại. Đã bỏ các quy tắc popup mobile trùng lặp trong stylesheet cũ; quy tắc HUD và desktop được giữ riêng.
- Tiêu đề 18 px; tiêu đề thẻ 14–15 px; nội dung 12 px; thông tin phụ 10–11 px; nhãn nút 12 px; icon 18 px; padding 12 px ở dọc, 10×12 px ở ngang; khoảng cách 6–8 px.
- Ảnh trong ô cá giảm 60 xuống 48 px, chiều cao ô giảm 85 xuống 72 px. Ảnh thẻ cửa hàng dọc giảm 95×110 xuống 76×88 px. Vùng bấm các nút vẫn tối thiểu 44×44 px, ô nhập/select/textarea giữ chữ 16 px.
- Túi giữ ba cột ở dọc, album giữ bốn cột. Cửa hàng dọc giữ ảnh trái và thông tin bên phải; ngang giữ ba thẻ một hàng. Phần xem trước nhân vật, hàng cài đặt, nhiệm vụ và danh sách phòng gọn hơn.
- Popup ngắn tự co chiều cao; popup dài cuộn nội bộ với nút đóng luôn tiếp cận được. Kết quả câu dùng kích thước CSS thực tế, đã bỏ scale thu nhỏ ở màn hình ngang. Giữ liquid glass và safe area.
- Không đổi API, dữ liệu, giao dịch, logic câu hoặc bố cục HUD/lobby. Bổ sung nhãn dialog cho popup hướng dẫn/kết quả; hướng dẫn nhận Escape khi có focus trong hộp.

Áp dụng: túi, trang bị trong túi, cửa hàng/cần/mồi, album, bản đồ, nhiệm vụ, nhân vật, chọn phòng, cài đặt, cộng đồng, báo cáo, hướng dẫn, xác nhận bán, kết quả câu và nhập chat gần.

## Kiểm chứng

- Build đạt, 47 unit test đạt.
- Bộ kiểm tra popup chụp 16 trạng thái × 6 viewport = 96 ảnh mỗi bản trước/sau. Bốn viewport mobile: 360×800, 390×844, 844×390, 740×360; hai desktop: 1366×768 và 1920×1080.
- Kiểm tra tất cả khung nằm trong màn hình, không tràn ngang, nút đạt 44×44 px và chữ ô nhập ít nhất 16 px. Cuộn tới cuối từng popup vẫn tiếp cận nút đóng.
- Kiểm tra thêm túi nhiều trang, cân nặng 60 tấn, số dư 123.456.789 Xu, lỗi lưu tên dài, popup bán chồng trên túi và trạng thái đang bán bị khóa thao tác.
- Khung chat được nhập thử nhưng không gửi; mô phỏng vùng nhìn thấp 390×420 để kiểm tra chừa chỗ bàn phím. Kiểm tra Escape ở Cài đặt và khung chat gần.
- So sánh cỡ tiêu đề, padding và chiều rộng desktop với bản trước: giữ nguyên. Chiều cao nội dung có thể khác vì danh sách phòng trực tuyến thay đổi và các phép đo baseline ban đầu được lấy ngay khi resize.
- Kiểm tra hồi quy cài đặt/lưu tùy chọn, khoe cá từ túi/bán cá và bố cục HUD sáu kích thước. Kiểm tra xoay chat đã được đồng bộ với sự kiện cập nhật vùng nhìn, tránh đọc tọa độ của chiều màn hình cũ.

Kiểm tra bằng Chromium trên Windows; viewport/cảm ứng và vùng nhìn khi mở bàn phím được mô phỏng. Chưa kiểm chứng trực tiếp trên thiết bị Android/iOS hoặc Safari.

## Ảnh và dữ liệu

- [So sánh trước/sau](images/popups-v8-comparison.png)
- [Túi đồ dọc](images/popups-v8-inventory.png)
- [Cửa hàng dọc](images/popups-v8-shop.png)
- [Nhân vật ngang](images/popups-v8-appearance-landscape.png)
- [Cài đặt ngang](images/popups-v8-settings-landscape.png)
- [Số đo kiểm chứng](validation/popups-v8.json)

Toàn bộ ảnh và số đo thô nằm trong `.local/popups-v8/before` và `.local/popups-v8/after`. Popup kết quả câu dùng dữ liệu hiển thị fixture từ cá của tài khoản kiểm thử; không ép kết quả câu hoặc thưởng trên server. Trạng thái chờ/lỗi dùng fixture và phản hồi API giả lập của bài kiểm tra.

Không phát hành công khai.

## Điều chỉnh sau V8

Theo yêu cầu tiếp theo, đã bỏ nút Cộng đồng ngoài HUD và popup danh sách người chơi cùng phần báo cáo gắn với danh sách đó. Chat thế giới vẫn dùng Trò chuyện, chat gần và biểu cảm giữ nguyên. Bộ kiểm tra popup hiện loại hai trạng thái Cộng đồng/Báo cáo; số ảnh V8 ở trên là bản bàn giao trước thay đổi này.
