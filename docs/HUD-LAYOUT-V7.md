# Bố cục lobby và HUD V7

Đã chỉnh theo sáu ảnh tham chiếu của người dùng.

- Lobby desktop: logo và cụm nút lên trên, dịch trái (cạnh trái khoảng 4% màn hình).
- Lobby điện thoại dọc: logo góc trên trái; ba nút nằm giữa phía dưới, tách khỏi vùng nhân vật.
- Lobby điện thoại ngang: logo lên sát trên; cả ba nút cùng chiều rộng và chiều cao 44 px.
- HUD desktop: Xu nằm bên trái Cài đặt, cách 8 px; icon Góc nhìn nằm cạnh Âm thanh, bỏ mục Góc nhìn trong thanh chức năng desktop.
- HUD điện thoại dọc (điều chỉnh lần 2): mã phòng rút gọn và số người cùng hàng trên cùng, giữa Âm thanh và Xu; Trò chuyện nằm bên phải ở vị trí mã phòng cũ. Mã phòng đầy đủ có nhãn truy cập và tooltip. Chạy/Nhảy xuống dưới nút câu. Chat gần chỉ còn icon, xếp ngang cạnh cảm xúc ở vị trí Chạy/Nhảy cũ.
- HUD điện thoại ngang: nút Trò chuyện cao 44 px, chữ không xuống dòng; nằm ngoài vùng joystick.
- Xu trên cả hai chế độ điện thoại cách Cài đặt 8 px.
- Joystick dọc tăng từ 104 lên 136 px (nút giữa 60 px); ngang từ 92 lên 116 px (nút giữa 54 px). Hành trình kéo tỉ lệ theo kích thước, giữ hướng và giới hạn đầu vào -1…1.
- Góc nhìn trên điện thoại tiếp tục nằm trong menu chức năng. Không thay đổi logic camera, chat, số dư hoặc câu cá.

## Kiểm chứng

- Build đạt; 47 unit test đạt; kiểm tra diff không có lỗi khoảng trắng.
- 6 browser test bố cục đạt: 1366×768, 1920×1080, 390×844, 360×800, 844×390, 740×360. Kiểm tra tọa độ, kích thước, giới hạn màn hình, chat mở/đóng và xoay khi chat mở.
- Kiểm tra multi-touch giữ joystick, bật chạy và nhảy: đạt khi chạy riêng. Lượt chạy cùng bộ bố cục bị trượt tại phép đo trạng thái sau 150 ms; chạy lại cùng mã kiểm tra đã qua, không cần thay đổi logic nhảy.
- Kiểm tra lại hai bố cục dọc 360×800 và 390×844 sau điều chỉnh lần 2: đạt; xác nhận khoảng cách nút, hàng đầu không chồng và mở chat/xoay màn hình.
- Chụp bằng Chromium trên Windows, viewport và cảm ứng được mô phỏng. Chưa kiểm tra trực tiếp Android/iOS.

## Ảnh

| Chế độ | Lobby | Trong game |
|---|---|---|
| Desktop | [Ảnh](images/layout-v7-lobby-desktop.png) | [Ảnh](images/layout-v7-game-desktop.png) |
| Điện thoại dọc | [Ảnh](images/layout-v7-lobby-portrait.png) | [Ảnh](images/layout-v7-game-portrait.png) |
| Điện thoại ngang | [Ảnh](images/layout-v7-lobby-landscape.png) | [Ảnh](images/layout-v7-game-landscape.png) |

Bản local: http://127.0.0.1:5173. Không phát hành công khai.
