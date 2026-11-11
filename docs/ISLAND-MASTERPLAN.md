# Đảo liền khối — bố cục theo bản thiết kế tổng thể

Tham chiếu: `design/reference/island-masterplan.png`. Hướng bắc là -Z. Đây là cảnh 3D có thể đi lại và xoay camera, không dùng ảnh concept làm nền giả cho bản đồ.

## Bố cục và tỷ lệ

| Thành phần | Kích thước/vị trí trong game |
|---|---|
| Đảo chính | Khoảng 82 × 57 m, đường bờ hữu cơ 72 đỉnh |
| Bến chữ L | Rộng 4 m, nhánh ngang 24 m, nối bãi biển phía nam |
| Nhân vật | Giữ tỷ lệ 0,84 của nhân vật Harbor v2, khoảng 2 m chiều cao khi chơi |
| Làng | 5 nhà hai tầng mái xanh/đỏ, 2 quầy có mái sọc, quảng trường và đài phun ở giữa đảo |
| Hồ phía đông | Tâm (20, -33), bán kính 10 × 7,2 m, cầu gỗ cong ở bờ bắc |
| Hải đăng phía tây bắc | Tâm (-30, -49), đặt trên đồi có đường đi lên |
| Phía bắc | Đồi, cụm đá, cây và bụi lớn; đường đi vòng hồ nối với làng |
| Bãi biển | Cát phía nam/tây nam, cổng vỏ sò, dù và ghế nằm, nối liên tục với bến/làng |

Kích thước là quy đổi để giữ tương quan giữa các khu, không phải phép đo mét suy ra chính xác từ phối cảnh của ảnh. Cảnh có thêm đèn, dây thừng, ghế, thùng, hoa, đá ven bờ và đáy biển có cá/san hô. Bản đồ trong menu vẽ từ cùng đường bờ và vị trí khu vực; các đảo ngoài khơi vẫn là nội dung chưa mở.

## Luật câu và di chuyển

- Bỏ các ô câu cố định. Một nút Thả câu tìm mặt nước trong tầm 9 m, ưu tiên hướng đang nhìn và tự quay nhân vật về phao. Không cần đứng vào vòng tròn.
- Khoảng thả tối thiểu 5,5 m giúp phao nằm ra vùng nước thoáng thay vì bị thân nhân vật che ở góc camera mặc định.
- Server kiểm tra vị trí đứng hợp lệ, mặt nước, khoảng cách và vật cản; phao không rơi lên đất, sàn bến hoặc cầu. Chừa khoảng cách nhỏ với mép bờ để phao nhìn rõ trên nước.
- Loại nước tại **phao**, thay vì tên vùng người chơi đứng, quyết định cá biển/nước ngọt và được lưu vào lượt câu. Đồng hồ cắn, bù RTT, transaction, XP và chống nhận trùng giữ nguyên.
- Collider và đường bờ dùng chung trong `packages/shared/src/world.ts`. Nhân vật đi theo độ cao đồi và cầu, bị chặn bởi hồ, nhà, quầy, đài phun, thân dừa và cụm đá chính. Di chuyển chia bước nhỏ để tránh xuyên bờ/vật cản.

## Mặt nước

`IslandWater.tsx` tạo trường độ sâu/mặt nước từ cùng dữ liệu shared: mặt nước bán trong suốt, đáy biển thật, chuyển màu nông/sâu, ba lớp sóng dịch chuyển bề mặt, normal sóng, phản sáng mặt trời/Fresnel, vệt sáng đáy và bọt chạy dọc bờ. Hồ dùng mực nước cao hơn và biên độ sóng nhỏ hơn biển. Đây là shader stylized, không phải mô phỏng chất lỏng hoặc phản xạ ray tracing.

Kiểm tra production phát hiện GLTFLoader dùng fetch để đọc bitmap nhúng qua URL blob. CSP đã bổ sung `blob:` riêng cho `connect-src` để texture gỗ tải được; danh sách origin mạng, script policy và kiểm tra HTTP/WebSocket không đổi. Lượt chụp HTTPS kiểm tra cả console error, không chỉ page error.

Địa hình, đường lát, nhà/quầy/cầu và đạo cụ dựng bằng BufferGeometry trong `island-geometry.ts`, `IslandDecor.tsx`, `scenery.tsx`. Nhân vật, dừa, đá, ván bến và một số đạo cụ tiếp tục dùng GLB Harbor v2/starter. Buffer địa hình và trường độ sâu được giữ qua các lần Suspense thử tải model, rồi giải phóng khi cảnh unmount.

## Tái hiện và kiểm chứng

```powershell
pnpm test
pnpm build
$env:PLAYWRIGHT_HARDWARE='true'
pnpm test:browser
pnpm test:cross-browser
node scripts/capture-island-preview.mjs
node scripts/capture-island-game.mjs
```

Trang `island-preview.html` là công cụ dev để chụp năm góc cố định, không phải route production. `capture-island-game.mjs` chạy qua UI thật; đặt `CAPTURE_URL=https://localhost:8443` để kiểm tra bản Docker. Ảnh và log được giữ ở `.local/island-v3/`.

26 unit test đã qua, gồm kiểm tra đường bờ toàn đảo, tầm câu, phân loại nước, đường đi lên bãi biển, hồ/cầu/nhà và đầu vào không hợp lệ. Luồng mạng mới kiểm tra câu tại vị trí bất kỳ trên bến, trên bãi biển và bờ hồ, từ chối câu trong đất liền và chặn đi vào hồ. Báo cáo này tách riêng khỏi M5 và Harbor v2 cũ.

Kiểm thử Chromium đầy đủ có 21/22 bài qua; bài protocol còn dùng tọa độ hồ cũ nên không đạt. Đã đổi fixture sang bờ hồ mới, giữ kiểm tra chặn đi vào nước, thưởng cá nước ngọt và reconnect sau commit; chạy riêng bài này lại đã qua. Tổng cộng 22 bài chức năng khác nhau có kết quả đạt trên mã ứng dụng cuối. Hai luồng Firefox/WebKit cũng đều qua. Không ghi lượt chạy Chromium đầu là một lượt xanh toàn bộ.

Sau khi chốt khoảng thả 5,5 m và sửa CSP texture, chạy lại 26 unit test, 4 bài security/WebGL và 3 luồng câu tự do/hai người/thưởng hồ + reconnect: đều qua. Không thay luật cửa sổ giật hoặc xử lý transaction.

Bản Docker/Caddy tại `https://localhost:8443` đã cập nhật, health đạt, hash HTML/JS/CSS khớp build local và CSP cho phép bitmap nhúng. Lượt UI thật trên HTTPS đã vào phòng, thả/thu cần ở biển, mở bản đồ, dịch chuyển và thả/thu cần ở hồ; không có page error hoặc console error. Kết quả: `docs/validation/island-v3-release.json` và `island-v3-game-preview.json`.

Đo 20 guest qua mạng local, 8 góc camera, Chromium headless sử dụng Intel UHD 730/D3D11, 1280×800, DPR 1, Tiết kiệm, giới hạn 60 FPS: trung bình theo góc **59,0–60,0 FPS**, tối đa **187 draw call / 827.673 triangle**, p95 frame cao nhất 20,8 ms. Lượt đo sẵn sàng sau 4,64 giây, resource khoảng 5,66 MB được server native phục vụ không nén. Báo cáo đầy đủ: `docs/validation/island-v3-render.json`. Đây là phép đo một máy desktop, không phải chứng nhận hiệu năng điện thoại.

Chưa có phép đo Android/iOS thật hoặc đợt chơi thử với 5 người mới. Mỹ thuật vẫn là cảnh stylized dựng trong dự án, chưa có toàn bộ độ chi tiết của ảnh concept.
