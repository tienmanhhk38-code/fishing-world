# Điều chỉnh NPC, người chơi ảo và chat gần

- NPC có model procedural riêng theo nghề: chủ sạp mặc tạp dề, mang giỏ; người hướng dẫn có râu, mũ rộng và bản đồ; nhân vật nhiệm vụ có túi và sổ. Không dùng rig/trang phục người chơi. Tên chỉ hiện trong 8 m, nền màu nâu vàng khác bảng tên người chơi, không có nhãn NPC.
- Người chơi ảo dùng bảng tên/level giống người chơi, level ngẫu nhiên 1–10. Phòng vắng có năm người ảo: hai trên cầu gỗ, hai ở bãi biển, một quanh hồ. Vị trí chọn từ nền hợp lệ và cách nhau; mỗi người có thời điểm bắt đầu, thời lượng, ngoại hình, biểu cảm và hành động riêng. Đi lại được giới hạn quanh khu của họ, không tụ về một điểm chung. Vẫn rút dần khi trên 10 người thật và dọn khi phòng trống.
- Chat gần dùng portal độc lập với HUD, có nền đóng bên ngoài và khung cố định trong chiều cao nhìn thấy khi bàn phím mở; không còn bị cắt hoặc nhảy theo cụm nút cảm xúc.
- Cảm xúc thu thành một nút. Desktop hover mở, rời vùng chọn đóng; điện thoại nhấn giữ 300 ms mở, chọn hoặc chạm bên ngoài để đóng. Có Escape và nút đóng cho bàn phím.

Build đạt, 39 unit test đạt. Hai bài browser kiểm tra chat gần/nhấn giữ/NPC và sáu bố cục đã qua. Ảnh mới: `.local/upgrade-v5/chat-fixed-1366.png`, `chat-fixed-390.png`, `chat-fixed-844.png`, `profession-npcs.png`.

Bản build: http://127.0.0.1:2567. Chưa phát hành công khai; kiểm tra mobile là giả lập Chromium.

## Hướng nhìn, chat và tiếng máy câu

NPC cố định nhìn về giữa cầu gỗ (hướng người đến từ bến). Người ảo nói các câu ngắn trên đầu khi nghỉ/chờ cá, có hiệu lực trong 20 m và tồn tại 6 giây. Lần đầu sau 15–40 giây; mỗi người nghỉ 45–110 giây giữa các câu, toàn phòng cách ít nhất 12 giây; không lặp ngay câu trước và không phát khi đang bo cá hoặc rời map.

Tiếng bo mới dùng `reel-machine-v2.wav`: mô phỏng guồng máy, lẫy bánh răng và drag nhả dây, thay tiếng dao động trầm cũ. Mẫu gốc tạo bằng `scripts/generate-reel-machine.py`, vòng lặp một giây, đường Web Audio và fallback dùng cùng file. Nhịp phát của người khác cách 1,05 giây để không chồng mẫu.

Build đạt; 40 unit test đạt, bao gồm hướng nhìn và lịch chat/giới hạn chống dồn tin. Bốn bài browser về chat/NPC và âm thanh liên quan đã qua.
