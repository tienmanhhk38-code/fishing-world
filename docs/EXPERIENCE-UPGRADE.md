# Nâng cấp trải nghiệm — 11/11/2026

Bản này giữ thế giới 3D online và dữ liệu cá/Xu/XP/trang bị, bổ sung toàn bộ luồng di chuyển, bo cá, nhiệm vụ và âm thanh trong kế hoạch. Chạy thử local ở https://localhost:8443; chưa phát hành công khai và chưa thay cấu hình hosting Vercel.

## Thay đổi trong game

- Đảo mở rộng khoảng 123 × 86 m; nhà/cây giữ kích thước, thêm cây và đồ trang trí. Bến chính dài 36 m, rộng 4 m; bến nối và cầu hồ dùng cùng dữ liệu va chạm/độ cao giữa client và server.
- Nhân vật trong phòng scale 0,672. Bóng tiếp xúc nằm trên nền khi nhảy; nhãn tên, cần và cá theo rig. GLB nhân vật có 10 clip, thêm Run/Jump/ShowFish; khi khoe, chuyển động chân được trộn riêng với tư thế tay.
- Bản đồ menu dùng nguyên ảnh PNG người dùng cung cấp, có vùng chọn trong suốt và hai khu khóa. Cảnh thêm cửa sổ, mái/viền mái, chậu cây, quầy, kết cấu đỡ bến và phao cứu sinh. Vật nhỏ dùng instancing và ẩn theo khoảng cách.
- Mặt biển có ba dải bọt tiến dần vào đường bờ, tan theo chu kỳ và lớp nước tràn trên cát. Hồ có biên độ gợn thấp; giữ đáy, san hô và vật thể dưới nước. Đây vẫn là cảnh stylized procedural, chưa có độ chi tiết như minh họa concept.
- WASD/mũi tên đi 4,4 m/s, Shift chạy 7 m/s, Space nhảy khoảng 1 m, F câu. Điện thoại có joystick, nút bật/tắt chạy, nhảy và câu riêng. Không nhảy khi đang câu; va chạm nền XZ vẫn chặn nhà/mép nước trong lúc nhảy.
- Máy chủ xác nhận sequence input, trạng thái chạy/tiếp đất/độ cao và thời gian snapshot. Máy người chơi dự đoán, hòa giải mềm; người khác nội suy đệm 100 ms. Camera dùng cùng vị trí hiển thị của nhân vật; lịch render dùng RAF với lựa chọn 30/60 FPS.

## Câu cá và lưu kết quả

Chỉ thả khi đã tiếp đất, đứng trên nền hợp lệ, trong 2 m tới nước lộ thiên. Nước dưới sàn không tính. Server chọn phao trong nước cách người 5,5–9 m.

| Độ hiếm | Tỷ lệ gốc | Giật | Kéo tự động | Hụt |
| --- | ---: | ---: | ---: | ---: |
| Phổ biến | 70% | 900 ms | 4–5 s | 5% |
| Ít gặp | 22% | 700 ms | 5–7 s | 12% |
| Hiếm | 7% | 550 ms | 7–9 s | 22% |
| Cực hiếm | 1% | 400 ms | 10–12 s | 35% |

Bảng tập trung ở `packages/shared/src/fishing-rules.ts`. Chuẩn hóa hạng theo loài hiện có trong vùng; giữ 15 loài, may mắn của cần và ưu tiên mồi trong hạng đã chọn. Bóng cá lớn dần theo hạng và tỷ lệ trọng lượng trong loài. Tên/trọng lượng/kết quả hụt chưa được gửi trước khi bắt.

Server lưu lựa chọn cá, seed, kế hoạch kéo, xác suất đã lấy mẫu và hạn kết thúc trong FishingRound. Khi giật đúng, ACTIVE → REELING. Bóng chạy ngang/ra/vào, dây theo cùng kế hoạch trên các máy; có hoạt ảnh ghì và thu dây. Khi hết hạn, thành công mới tạo cá/cộng XP/cập nhật album trong một transaction, khóa roundId duy nhất. Nhiệm vụ bắt cá lấy tiến độ từ dữ liệu Fish đó nên không có bộ đếm có thể lệch transaction. Cá cũ giữ nguyên giá đã lưu.

Reconnect trong 30 s tiếp tục lượt hoặc trả lại thẻ kết quả. Restart hoàn tất REELING theo hạn/kết quả đã lưu, không lấy mẫu lại; ACTIVE bị gián đoạn hoàn mồi hữu hạn đúng một lần. Hủy chủ động/về lobby không hoàn mồi. Database tạm lỗi khi chốt được thử lại theo cùng lượt.

## Khoe cá, nhiệm vụ và lobby

Thẻ kết quả có Câu tiếp, Khoe cá, Xem túi. Khoe giữ cá ở tay trái và cần ở tay phải, có bong bóng tên/trọng lượng kg; được đi/chạy/nhảy. Phải Cất cá để câu lại; bán/thay trang bị bị server chặn khi đang khoe. Ẩn khoe cá người khác áp dụng cả model và bong bóng. Về lobby hoặc ngắt kết nối chỉ bỏ tư thế, cá đã lưu vẫn giữ.

Có năm nhiệm vụ khởi đầu và ba nhiệm vụ ngày, đúng các mức thưởng Xu/XP/mồi giun đã chốt trong `packages/shared/src/quests.ts`. Khởi đầu nhận tuần tự và đối chiếu lịch sử; nhảy bắt đầu ghi từ bản này. Ngày đổi lúc 00:00 Việt Nam. API POST `/api/quests/claim` xác thực khách, request ID và kỳ; transaction khóa tài khoản, claim duy nhất theo người/nhiệm vụ/kỳ. Tiến độ bán được cập nhật cùng giao dịch bán. Tab đang mở tải lại khi sang ngày.

Về lobby nằm trong cài đặt, mở được khi đang câu. Server hủy lượt, giải phóng phiên chủ động; client xóa input, phòng và token reconnect. Có kiểm tra vào lại ngay không giữ avatar cũ.

## Âm thanh

- Lobby: Bài Ca Tôm Cá; trong phòng: Câu Cả Niềm Vui, sao chép từ đúng hai MP3 được cung cấp. Lưu ở `apps/client/public/assets/audio/music/`.
- Dùng HTMLAudioElement + MediaElementAudioSourceNode để streaming, lặp, crossfade 1,2 s; không decode hai MP3 thành AudioBuffer. Server hỗ trợ HTTP Range. Mở menu không khởi động lại bài.
- Gain nền mặc định khoảng 0,12, giảm còn 35% lúc cá cắn/kéo rồi hồi mềm. Nhạc stereo, hiệu ứng/sóng có panner 3D. Tối đa 8 tiếng hiệu ứng; tiếng của người khác giới hạn phạm vi 28 m và số tiếng, ưu tiên tiếng cá cắn của chủ máy.
- Firefox dùng fallback vị trí/orientation AudioListener cũ khi thiếu AudioParam; các trình duyệt có Web Audio dùng panner 3D. Port WebKit trên Windows không có Web Audio: dùng HTMLAudio streaming cho nhạc/hiệu ứng, giảm âm theo khoảng cách, không có HRTF 3D. Cần kiểm tra riêng Safari trên thiết bị thật.
- Thêm nibble/reel WAV, vòng cuốn dây dừng khi kết thúc/hủy/thoát. Các WAV được tạo bằng code gốc; script `scripts/generate-audio.py` chứa công thức. Unlock sau tương tác đầu tiên, tạm dừng khi tab ẩn; lỗi nhạc không chặn câu hoặc hiệu ứng.

## Dữ liệu và chạy local

Migration: `apps/server/prisma/migrations/202611110002_experience/migration.sql`. Thêm questJumped, dữ liệu kéo bền vững và bảng QuestProgress/QuestClaim; giữ các bảng và giá trị cũ. PostgreSQL runtime role nhận quyền bảng mới qua default privileges của role migration; không cấp quyền quản trị cho game.

```powershell
pnpm db:generate
pnpm --filter @fishing/server exec prisma migrate deploy
pnpm dev
```

Môi trường cũ dùng db:push cần baseline đúng schema trước khi migrate, không chạy reset database. Trên máy này baseline native đã được xác nhận và migration đã áp dụng. Docker local đã migrate bằng image mới, giữ nguyên volume.

```powershell
docker compose -p fishing-beta-m5 -f compose.beta.yaml build app
docker image tag fishing-beta-m5-app:latest fishing-beta-m5-migrate:latest
docker compose -p fishing-beta-m5 -f compose.beta.yaml up -d --no-build --wait
```

Sao lưu trước nâng cấp ở `.local/experience-v4/before.dump` và `docker-before.dump`. Backup schema mới đã restore vào database kiểm chứng riêng, so sánh digest 16 bảng đạt. Không ghi đè database nguồn. `scripts/backup.mjs` và `restore-verify.mjs` bao gồm tự động các bảng nhiệm vụ mới.

## Kiểm chứng bản này

Bằng chứng nằm trong `.local/experience-v4/`, tách khỏi báo cáo M5 cũ. Các fixture kiểm thử có thể sửa RNG/kết quả trong database local để phủ thành công và hụt; không có API ép kết quả trong game.

- Build TypeScript/Vite đạt; bundle HTTPS khớp hash bản build local. CSP cho phép texture GLB; map, WAV, GLB và hai MP3 khớp file nguồn; HTTP Range cho MP3 đạt.
- 31 unit test đạt: bảng tỷ lệ, cửa sổ giật, trọng lượng/bóng, đường bo cá xác định, nước dưới sàn, khoảng cách 1,99/2,01 m, va chạm/nhảy, ngày Việt Nam.
- Integration gồm kéo chưa đến hạn không nhận cá, chốt đồng thời đúng một cá, hụt không nhận XP, recovery bền vững, hoàn mồi một lần, quest nhận đồng thời/gửi lặp/hết hạn, hai khách thấy cùng kế hoạch/khoe cá, chạy/nhảy, input cũ, thoát/vào lại.
- TCP delay hai chiều RTT 50/150/300 ms + jitter 10 ms: phản ứng 180 ms được giật hợp lệ với mọi hạng; giật nhấp giả bị từ chối. Giới hạn biên từng hạng kiểm tra bằng RNG/clock xác định trong unit test.
- Docker production Linux qua HTTPS: SIGKILL trong lượt thắng và lượt hụt đều khôi phục đúng kết quả; kiểm tra không có cá trước kéo xong, không nhân cá/XP/hoàn mồi khi restart lần nữa. Cookie/role không đặc quyền/container nonroot đạt.
- Chuyển động Chromium desktop local: đi 1 s đo 4,49 m ở 60 FPS, 4,30 m ở 30 FPS; chạy 700 ms đo 5,07 m. Mẫu nhảy ở 250 ms cao thêm 0,87 m. Sai lệch giữa snapshot và hiển thị tối đa khoảng 0,36 m gồm độ trễ snapshot; bước hòa giải lùi lớn nhất khoảng 2,7 mm trong bài đo đường thẳng. Đây không phải chứng nhận mạng Internet/điện thoại.

- Bộ browser Chromium có 28 trường hợp: 27 qua trong lượt tổng; trường hợp WebGL cold-start quá 10 s được sửa điều kiện chờ tải và chạy lại qua. Luồng hai khách, kinh tế, chat, responsive, cài đặt, bảo vệ phiên/WebSocket và mất/khôi phục WebGL đã được kiểm chứng. Bản sửa âm thanh cuối được kiểm tra Chromium riêng: cả hai trường hợp streaming/chuyển cảnh và nhạc lỗi đều qua.
- Firefox: ba trường hợp âm nhạc/lỗi nhạc/hai khách qua. WebKit: hai trường hợp nhạc qua; luồng hai khách qua sau khi harness chờ ACK khoe trước đổi tab và chấp nhận lượt giật hụt để thử lại. Harness không sửa cửa sổ giật trên game. Các test không phải đánh giá âm thanh bằng tai.
- Tải Docker HTTPS/WSS 20 người, 3 phút: 264 lượt, 170 cá lưu, 9 lượt hụt khi kéo; 120 chat, 44 emote, 60 bán và 25 mua. Không ngắt kết nối bất ngờ, không sự kiện cá trùng, không sai lệch tài sản. Peak RSS 129,4 MiB; CPU cao nhất 23,0%; event loop p99 cao nhất 29,7 ms. Đây là lượt ngắn của bản nâng cấp; báo cáo soak 60 phút M5 vẫn chỉ áp dụng bản cũ.

## Giới hạn nghiệm thu

Chưa có playtest năm người mới hoặc đo thiết bị Android/iOS thật. Chưa chứng nhận FPS/âm thanh của Safari iOS. Cảnh vẫn là mô hình stylized do code tạo, chưa đạt toàn bộ độ tinh xảo của ảnh minh họa. Số đo frame/touch cuối lưu riêng cùng bằng chứng local.

## Số đo render và cảm ứng

Chromium headless dùng GPU Intel UHD 730/D3D11, 1280 × 800, DPR 1, giới hạn 60 FPS, giảm chuyển động, 20 khách mạng thật và tám hướng camera:

| Chế độ | FPS trung bình theo góc | Frame p95 cao nhất | Draw call tối đa |
| --- | --- | --- | --- |
| Tiết kiệm | 54,5–58,9 | 26,4 ms | 181 |
| Đẹp | 50,3–58,7 | 29,6 ms | 182 |

Thời gian vào đủ 20 avatar khoảng 6,7 s trong hai lượt đo. Không có page error. Đây là số đo headless trên máy phát triển, không phải cam kết 60 FPS cho mọi thiết bị. Mặc định game vẫn là 30 FPS; chọn 60 trong cài đặt nếu thiết bị phù hợp.

Cảm ứng Chromium giả lập 390 × 844: hai pointer đồng thời điều khiển joystick và kéo camera, đi 2,65 m và đổi góc khoảng 0,42 rad; nút nhảy đo cao thêm 0,90 m và nút chạy bật đúng trạng thái. Có ảnh dọc/ngang tại `.local/experience-v4/touch-portrait.png` và `touch-landscape.png`. Chưa thay thế thử cảm ứng trên điện thoại thật.

Smoke cuối qua HTTPS kiểm tra đi/nhảy → câu → kéo → thẻ kết quả → khoe/cất → nhận nhiệm vụ → bản đồ ảnh → về lobby; không có lỗi trang hoặc console. Bộ JS/CSS đang phục vụ được so hash trực tiếp với bản build cuối. Server image Linux được giữ nguyên; lượt sửa tương thích âm thanh cuối cập nhật artifact client đã build vào image local và kiểm tra hash lại.
 Không phát hành public; dữ liệu thử nghiệm dùng các khách riêng.

Kiểm tra nhảy sau reload/reconnect cũng qua: giữ cùng avatar, lần nhảy đầu sequence 1, sau tải lại nhận snapshot và gửi sequence 2, server xác nhận đang trên không. Client khôi phục sequence nhảy từ SESSION để không bị chặn bởi bộ chống gửi lại.
