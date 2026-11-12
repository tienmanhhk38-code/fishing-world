# Cá 3D và khoe cá V6

Bản chạy local: http://127.0.0.1:5173 (Vite + server tại 2567). Chưa phát hành công khai.

## Thay đổi

- 35 loài dùng model GLB mới: thân và đầu là một bề mặt liên tục, màu lưng/bụng, hoa văn, mắt, miệng, mang, vây dày và đuôi bo mềm. Cá mặt trời có đuôi cụt/vây lớn; cá voi có đuôi ngang; hai loài cá mập có khe mang và răng. Tất cả model được tạo trong repository, không phụ thuộc tài sản bên ngoài.
- Mỗi model có hai LOD, dùng xương thân–đuôi và hai xương vây ngực. Client clone bộ xương riêng cho mỗi cá, dùng chung geometry/material và giải phóng skeleton khi đổi/cất cá. Khoe cá giẫy theo giờ server, có đợt mạnh mỗi 4–7 giây; giảm chuyển động vẫn giữ vẫy nhẹ. Cá trên tay tối đa khoảng 4 m.
- Túi có nút Mang ra khoe, chờ xác nhận rồi đóng. Có thể đổi con đang khoe; cá bị bán được tự cất. Khoe không tạo cá, Xu hoặc XP. Nút bị khóa khi đang câu/mất kết nối.
- Thêm cá heo hồng (100–300 kg), cá voi sát thủ (1–6 tấn), cá nhà táng (10–50 tấn), cá mập trắng (300–2.000 kg), Megalodon (20–60 tấn). Đây là cân nặng thiết kế game; cá heo hồng ở biển và Megalodon là yếu tố giả tưởng.
- Hạng `mythic` / Huyền thoại: tổng 0,1% cơ bản ở biển; các tỷ lệ còn lại là 69,9/22/7/1%. Không xuất hiện ở nước ngọt. May mắn tăng trọng số hạng cao trước khi chuẩn hóa. Năm loài có trọng số bằng nhau. Giật 400 ms, bo 12–16 giây, đứt dây 35%, 200 XP, giá tham chiếu 2.000 Xu. Bóng dài 4–8 m; cước vẫn móc ở đầu cá.
- Trọng lượng từ 1.000 kg được ghi bằng tấn trên túi, kết quả, lời khoe và album. Cá cũ giữ nguyên giá đã lưu và kỷ lục.

## Giao thức và dữ liệu

`FISH_SHOWCASE_REQUEST` nhận `{ fishId?: string }`; gói cũ không có ID vẫn khoe con vừa câu. Server tra cá trong túi, kiểm tra trạng thái/quyền sở hữu và phát `SHOWCASE_STARTED` gồm `fishId`, `species`, `grams`, `startedAt`, `animationSeed`. Lỗi dùng `SHOWCASE_ERROR { message }`.

Khoe cùng một cá là idempotent và giữ nguyên thời điểm/seed. Bộ đếm phiên yêu cầu cùng revision hành trang chặn kết quả đọc bất đồng bộ ghi đè thao tác cất, bán, rời phòng hoặc ngắt kết nối. Bán cá được phép khi đang khoe; đổi trang bị vẫn giữ quy tắc hiện tại.

Không cần migration: hạng hiếm được suy từ catalog; gram và kỷ lục 60.000.000 vẫn nằm trong cột Int hiện có. Client và server mới cần triển khai cùng nhau nếu phát hành sau này.

## Kiểm chứng

- `pnpm build`: đạt.
- `pnpm test`: 47 kiểm thử đạt. Kiểm tra catalog, ranh giới tỷ lệ chính xác, mô phỏng 100.000 lượt, cá nước ngọt, 35 GLB/ảnh, giới hạn tam giác/draw call, bộ xương và tổng skin weight, chuyển động xác định và giảm chuyển động.
- 7 kiểm thử trình duyệt/tích hợp trong `fish-v6`, `experience`, `fishing-visual`: đạt. Bao gồm luồng khoe cũ, hai client cùng thấy trạng thái/seed, đổi cá, cất, bán, chống truy cập cá người khác, gửi trùng, yêu cầu chậm sau cất, kết quả câu/restart không nhân đôi thưởng và lượt câu 150 kg.
- Kiểm tra giao diện bổ sung: túi nhiều trang, mốc 9,99/10 kg, Megalodon 60 tấn, đi/chạy/nhảy khi bưng, đồ họa thấp và giảm chuyển động; viewport 1366×768, 390×844, 844×390.
- Hình so sánh: `images/fish-v6-models.png`. Ảnh/video thao tác và thông tin GPU/lỗi trình duyệt: `.local/fish-v6/`.
- Thống kê model: `validation/fish-v6-assets.json`. Mỗi LOD tối đa 4 draw call; mức cao dưới 12.000 tam giác, mức thấp dưới 4.000. Model ngoài ba loài trang trí được tải khi cần.

Đã kiểm tra bằng Chromium trên Windows với WebGL phần cứng và viewport mô phỏng điện thoại. Chưa kiểm chứng trực tiếp trên thiết bị Android/iOS, Safari hoặc đo pin/nhiệt trên điện thoại. Thống kê khung hình trong bản ghi là dữ liệu phiên kiểm tra local, không phải cam kết hiệu năng cho mọi thiết bị.

## Tạo lại tài sản

Khi Vite đang chạy ở cổng 5173:

```sh
node scripts/build-fish-assets.mjs
node scripts/check-fish-assets.mjs
node scripts/preview-fish-v6.mjs
```

Hai LOD nằm trong cùng GLB và được chọn bởi client; công cụ chụp thumbnail chỉ hiển thị mức cao. Ảnh baseline lấy từ HEAD nếu có, các loài chưa được lưu trong HEAD được đánh dấu thiếu baseline.
