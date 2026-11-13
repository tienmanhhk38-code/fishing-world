# Tính năng hiện tại

## Vòng chơi

Vào lobby → chọn/tạo phòng → đi tới nước → thả câu → chờ dấu `!` và giật → server xử lý kéo cá → xem kết quả, câu tiếp hoặc khoe cá → bán/mua trang bị và nhận thưởng nhiệm vụ.

| Nhóm | Hành vi trong code | Nguồn chính |
| --- | --- | --- |
| Danh tính/phòng | Phiên khách bằng cookie; đổi tên và 4 ngoại hình; danh sách phòng, tạo hoặc vào bằng mã; tối đa 20 client/phòng | server `index.ts`, client `RoomPicker.tsx`, `AppearancePanel.tsx` |
| Khám phá | Bãi Biển và Làng Chài; 5 điểm đến mở: beach, dock, village, pond, lighthouse; coral/mystery đang khóa | shared `world.ts`, client `MapPanel.tsx` |
| Di chuyển | Đi/chạy/nhảy, collision, camera xoay; keyboard và joystick/nút cảm ứng; prediction và reconciliation | shared `movement.ts`, client `motion-client.ts`, `scene.tsx` |
| Câu cá | Thả tại vị trí hợp lệ gần nước lộ thiên; nhấp giả, cửa sổ giật theo độ hiếm, kéo tự động và xác suất đứt dây | server `fishing.ts`, `catch-selection.ts`, shared `fishing-rules.ts` |
| Bộ sưu tập | 40 loài (15 nước ngọt, 25 biển), 5 rarity: common/uncommon/rare/legendary/mythic; túi cá chưa bán, album và kỷ lục cân nặng | shared `catalog.ts`, client `InventoryPanel.tsx`, `CollectionPanels.tsx` |
| Kinh tế | Xu, XP, cấp 1–10; 3 cần và 3 loại mồi; bán một/toàn bộ cá qua sale quote, mua và trang bị | server `economy.ts`, client `economy-client.ts` |
| Nhiệm vụ | Intro, daily, tutorial; server kiểm tra tiến độ và chống nhận thưởng trùng; đổi ngày theo UTC+7 | shared/server `quests.ts`, client `QuestPanel.tsx`, `ProgressPanels.tsx` |
| Khoe cá | Khoe cá đang sở hữu, đổi/cất cá; bán con đang khoe sẽ cất; tư thế hai tay từ 10 kg; không cấp thêm thưởng | server `index.ts`, client `HarborCharacter.tsx`, `fish-animation.ts` |
| Xã hội | Chat `world` gửi trong phòng hiện tại; chat `nearby` trong 20 m, bóng thoại 6 giây; emote, mute và report | server `social.ts`, client `CommunityPanel.tsx`, `social-client.ts` |
| Cư dân | 3 NPC: Cô Sáu (shop), Chú Hải (hướng dẫn), Linh (quest); bot trang trí tự câu, không có tài sản | shared `residents.ts`, client `NpcModel.tsx` |
| Trải nghiệm | Chất lượng low/high, 30/60 FPS, âm lượng, camera, reduced motion; WebGL error/context recovery; popup responsive | client `settings.ts`, `GraphicsSupport.tsx`, `viewport.ts`, CSS |
| Âm thanh | Nhạc theo lobby/game, ambience và SFX; Web Audio, fallback HTML media; mapping MP3 hiện được hoán đổi chủ ý | client `audio.ts`, `media-audio.ts`, `music-track.ts` |
| Vận hành | Health/readiness, metrics có bearer token, graceful shutdown, backup/restore và CLI moderation | server `index.ts`, `telemetry.ts`, `moderate.ts`, `scripts/` |

Các đường dẫn rút gọn `client`, `server`, `shared` lần lượt thuộc `apps/client/src/`, `apps/server/src/`, `packages/shared/src/`.

## Điều kiện gameplay đáng chú ý

15 loài nước ngọt có model, texture và thumbnail theo ba poster tham chiếu, với profile thân/vây, mắt, râu, vảy và hoa văn riêng; koi dùng biến thể Showa. Asset, quy trình dựng lại và giới hạn kiểm chứng nằm tại [FRESHWATER-MODELS](FRESHWATER-MODELS.md). Catalog, cân nặng và kinh tế không thay đổi theo đợt chỉnh model này.

Catalog bổ sung cá chình bông (nước ngọt, hiếm, 1–25 kg), cá tầm (nước ngọt, cực hiếm, 5–100 kg), cá cam (biển, hiếm, 1–40 kg), cá ngừ vây xanh (biển, cực hiếm, 20–300 kg) và cá mái chèo (biển, cực hiếm, 10–200 kg). Đây là khoảng khối lượng cấu hình trong game; các loài dùng quy tắc thưởng và mồi theo bậc hiếm hiện có.

Các popup Bản đồ, Túi đồ, Album cá, Nhiệm vụ, Cách chơi và Nhân vật dùng hệ Glass UI trong client `popup-design.css`. Túi cá và album hiển thị danh sách cuộn trong khung 4 hàng, bằng chiều cao preview bên phải trên bố cục hai cột; tab Cần câu có khung xem trước và chọn cần đã sở hữu. Nút cửa hàng trong túi đồ chỉ mở được khi người chơi đứng gần Cô Sáu và đang rảnh. Hướng dẫn Cách chơi trình bày thành ba bước; dữ liệu cá, phần thưởng và trạng thái khóa vẫn lấy từ server.

- Phím `F` thực hiện “Câu tiếp” khi popup kết quả đang mở. `C` mở/đóng chat phòng; `Enter` mở chat gần và gửi khi đang nhập, `Escape` đóng chat gần. Phím gameplay không chạy khi đang gõ trong ô nhập. Chat gần không phủ nền tối; focus input có viền xanh.
- Mồi `dough` vô hạn (`baitCounts.dough = -1`); `worm`/`shrimp` bị trừ lúc bắt đầu lượt. Mua/mở shop cần đang `IDLE`, kết nối và trong 3 m tới Cô Sáu.
- Thả câu cần đứng trên mặt đất, gần mép nước trong 2 m; `findFishingCast` tìm điểm phao hợp lệ, không nằm dưới platform.
- Cửa sổ giật: 900/700/550/400/400 ms theo thứ tự rarity trên; server cộng `min(150, RTT/2)` ms và không chấp nhận giật sớm.
- 5 loài mythic chỉ ở biển. Xác suất chọn dựa vào rarity, cần/mồi và môi trường; số loài trong một rarity không tự quyết định tỷ lệ rarity đó.
- Cá/XP chỉ được ghi khi kéo thành công. Khi bán, `Fish` giữ lịch sử qua `soldAt`, album không bị xóa.
- Vị trí, animation và phòng không phải tiến trình lưu bền vững. Restart làm mất phòng; lượt kéo được phục hồi từ database theo kết quả đã chọn.

## Giới hạn có thể xác nhận từ repository

- Chỉ có đăng nhập khách; chưa có luồng liên kết tài khoản/khôi phục danh tính khi mất cookie.
- Một guest chỉ có một phiên chơi hoạt động; mất kết nối được giữ ghế tối đa 30 giây.
- Backend dùng bộ nhớ và advisory lock, không có kiến trúc nhiều game-server cùng database. `MAX_ROOMS=20` là cấu hình, không phải kết quả nghiệm thu tải.
- Chat tên `world` không phải chat xuyên mọi phòng; lịch sử world trong RAM giữ tối đa 80 tin, bản ghi người chơi gửi được lưu DB.
- Công cụ moderation là CLI phía server, không có dashboard quản trị web trong code.
- Cấu hình triển khai không chứng minh dịch vụ public đang hoạt động; nghiệm thu thiết bị thật xem [PLAYTEST](PLAYTEST.md).
