# Camera, bàn phím và âm thanh V9

Bản local: http://127.0.0.1:5173.

## Thay đổi

- Điện thoại ngang: khoảng cách camera giảm 12% (14,8 xuống 13,024 khi đứng; 12 xuống 10,56 khi câu có zoom), áp dụng cả lobby và ingame. Dùng kích thước canvas ổn định và khả năng cảm ứng, nên mở bàn phím không tự kích hoạt camera ngang. Desktop và điện thoại dọc giữ khoảng cách cũ.
- Cảm xúc đã chọn trên desktop: khung 48×48 px và emoji 30 px; mobile giữ khung 40 px, emoji 26 px. Không thay kích thước nút chọn cảm xúc.
- Đổi nhạc lobby/ingame bằng ánh xạ file chung: lobby phát `game-song.mp3`, ingame phát `lobby-song.mp3`. Cả Web Audio và audio fallback dùng cùng ánh xạ. Giữ volume, crossfade, tắt tiếng và xử lý tab ẩn hiện.
- Tách `--game-height` khỏi `--visible-height`. Khi bàn phím làm vùng nhìn thu hẹp, canvas giữ chiều cao trước đó; popup và khung nhập theo vùng nhìn còn lại. Theo dõi cả resize, scroll của VisualViewport, focus và đổi chiều màn hình.
- Khóa cuộn trang bên ngoài game; xử lý `offsetTop` khi trình duyệt dịch vùng nhìn lên để đưa ô nhập vào tầm nhìn. Chat thế giới, chat gần và popup nhập tên vẫn có ô nhập/nút đóng nằm phía trên bàn phím.
- Thêm `interactive-widget=resizes-visual` vào viewport meta. Bộ theo dõi vẫn xử lý trường hợp trình duyệt thu nhỏ cả layout viewport, đóng bàn phím chưa blur và xoay máy khi đang nhập.

## Kiểm chứng

- Build đạt; 50 unit test đạt. Kiểm tra viewport bao gồm bàn phím chỉ thu visual viewport, trình duyệt thu cả layout, đóng bàn phím, đổi chiều, thay đổi thanh trình duyệt, resize desktop và phân biệt pinch zoom.
- 6 browser test nhạc, fallback, viewport và cảm xúc desktop đạt. Nhạc mới phát đúng ở hai cảnh, crossfade và tab ẩn hiện giữ hoạt động; lỗi tải nhạc không chặn game.
- Mô phỏng visual viewport từ 844 xuống 480/420 px, có offsetTop 120 px: canvas vẫn cao 844 px, profile và ô nhập vẫn trong vùng nhìn. Kiểm tra cả chat thế giới, chat gần và nhập tên nhân vật; nội dung nhập thử không được gửi.
- 7 browser test hồi quy bố cục và popup đạt: sáu viewport từ 360×800 tới 1920×1080, cùng toàn bộ popup còn dùng trên giao diện.
- Đo camera sau khi chuyển dọc sang ngang: độ lệch Z so với nhân vật giảm từ khoảng 14,14 xuống 12,50 trong thời gian nội suy, phù hợp mức zoom thêm 12%.
- Ảnh và số đo: `images/viewport-v9-keyboard.png`, `images/viewport-v9-world-chat.png`, `images/viewport-v9-landscape.png`, `validation/viewport-v9.json`.

Kiểm tra bằng Chromium trên Windows với viewport/cảm ứng và sự kiện bàn phím được mô phỏng. Chưa thử bàn phím hệ thống trên Android/iOS thật; không coi ảnh mô phỏng là bằng chứng đã kiểm chứng thiết bị thật. Không phát hành công khai.
