# Fishing World Online

Bản thế giới chung có Bãi Biển và Làng Chài, phòng online, giữ phiên 30 giây và cơ chế nhấp–giật theo độ hiếm, bo cá tự động có tỷ lệ hụt. Có 15 loài cá, bán lấy Xu, 3 cần/3 mồi, XP/cấp độ, album/kỷ lục và hướng dẫn di chuyển → bắt → bán → xem nâng cấp. M4 thêm cộng đồng trong phòng, chat/emote, tắt tiếng/báo cáo, chọn ngoại hình/tên và âm thanh. Tiến trình lưu trong PostgreSQL.

M5 đã bổ sung cấu hình web Vercel + backend Linux riêng, bảo vệ HTTP/WebSocket/phiên khách, telemetry, backup/restore, kiểm thử đa trình duyệt và tối ưu mesh. [Hướng dẫn triển khai](DEPLOYMENT.md) và [phiếu nghiệm thu người/thiết bị thật](PLAYTEST.md). Chưa phát hành công khai; không cần có sẵn VPS để chạy beta local.

Bản nâng cấp trải nghiệm mở đảo lên khoảng 123 × 86 m, giảm nhân vật còn 0,672, thêm chạy/nhảy, dự đoán di chuyển và nội suy người khác. Đứng trong 2 m tới nước lộ thiên mới được câu; phao rơi cách người 5,5–9 m. Bản đồ menu dùng ảnh thiết kế đã cung cấp. Có nhiệm vụ khởi đầu/ngày, khoe/cất cá chủ động, về lobby từ cài đặt và hai bài MP3 streaming theo cảnh. Xem [chi tiết nâng cấp và kiểm chứng](EXPERIENCE-UPGRADE.md). Các báo cáo M5/Harbor v2/bản đồ v3 là kết quả lịch sử.

[Báo cáo kiểm chứng M5](M5-REPORT.md): soak 20 người/60 phút qua HTTPS/WSS đạt, 3.790 cá lưu, không có lỗi hoặc sai lệch tài sản. Kiểm tra thiết bị di động và thử với 5 người mới còn chờ thực hiện.

## Chạy trên máy này

Cần Node.js 22, pnpm và PostgreSQL 17. Chạy từ thư mục dự án.

```powershell
pnpm install
Copy-Item apps/server/.env.example apps/server/.env
powershell -ExecutionPolicy Bypass -File scripts/local-db.ps1
pnpm db:generate
pnpm db:push
pnpm dev
```

Mở http://127.0.0.1:5173. Máy này đang có dịch vụ khác sử dụng `localhost:5173` qua IPv6, vì vậy dùng địa chỉ IPv4 ở trên. Mở thêm trình duyệt khác hoặc cửa sổ riêng tư, truy cập đúng cùng địa chỉ để chơi cùng phòng. Hai tab cùng hồ sơ trình duyệt dùng chung khách và chỉ một tab được vào bến.

Script `local-db.ps1` tạo cụm dữ liệu riêng tại `.local/postgres`, chỉ nghe trên 127.0.0.1:55432 và dùng xác thực trust phục vụ phát triển local. Nếu dùng Docker, chạy `docker compose up -d` thay script. Hai cách dùng cùng cổng, chọn một cách cho mỗi lần chạy. Dữ liệu local tồn tại sau khi dừng game.

## Điều khiển

- WASD hoặc phím mũi tên để đi. Kéo chuột trên cảnh để xoay camera.
- Shift chạy 7 m/s; Space nhảy khoảng 1 m; F hoặc nút Thả câu/Giật cần. Chờ phao chìm và dấu `!`; cửa sổ giật 900/700/550/400 ms tùy độ hiếm.
- Bấm sớm hoặc quá hạn sẽ hụt. Giữ phím không tự giật.
- Nút Thu cần kết thúc lượt đang chờ. Cài đặt luôn mở được khi câu, có nút Về lobby. Sau kết quả: Câu tiếp / Khoe cá / Xem túi. Đang khoe được đi/chạy/nhảy, cần Cất cá để câu lại.
- Điện thoại có joystick trái, kéo vùng cảnh để xoay, nút bật/tắt chạy, nhảy và câu riêng. Có thể dùng đồng thời hai ngón.
- Túi đồ chứa cá đã bắt. Cookie phiên khách nhận diện tiến trình. Xóa cookie tạo khách mới.
- Enter mở chat; Space nhập chữ khi ô chat được focus. Chat thu gọn vẫn dùng được khi câu.
- Nút người chơi cạnh Trò chuyện mở Cộng đồng. Emote ở HUD và trong bảng cộng đồng, chỉ dùng khi đã thu cần.
- Nút Nhân vật ở lobby hoặc bấm hồ sơ trên HUD để chọn ngoại hình/tên. Chỉ đổi khi không câu.

## Kiểm tra và bản build

```powershell
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm exec playwright test
```

Playwright cần `pnpm dev` đang chạy và database đã khởi tạo. Bài thử tạo khách và cá kiểm thử riêng trong database. Ảnh kiểm tra nằm ở `.local/`.

Sau `pnpm build`, chạy `pnpm --filter @fishing/server start`, mở http://127.0.0.1:2567 để dùng bản build. Server phục vụ cả client, API và WebSocket. Khi triển khai công khai cần PostgreSQL có mật khẩu, reverse proxy hỗ trợ WebSocket, HTTPS và `NODE_ENV=production`. Sao lưu database trước khi thay đổi schema. `db:push` dành cho môi trường phát triển của bản này.

## Quy tắc server

Client gửi hướng di chuyển và ý định thả, giật, hủy. Server giới hạn tốc độ và kiểm tra vùng đi được, ao/hồ, nhà, quầy và chướng ngại trên dữ liệu map XZ, chọn trọng lượng và lịch nhấp. Client chỉ nhận cue đang diễn ra, không nhận lịch hay con cá trước kết quả. RTT đo bằng nonce ping một lần, bù một nửa RTT và tối đa 150 ms, không chấp nhận bấm trước khi mở cửa sổ.

Server lưu lựa chọn cá và kế hoạch bo cá một lần khi bắt đầu. Giật hợp lệ chuyển ACTIVE → REELING và lưu hạn kết thúc. Chỉ khi kéo thành công mới chốt COMMITTED, tạo cá với roundId duy nhất, cộng XP và album trong một transaction; quest bắt cá lấy tiến độ từ chính dữ liệu này. Cá hụt chuyển ESCAPED, không nhận cá/XP. Khi restart, server hoàn tất REELING theo kết quả/hạn đã lưu, không bốc lại xác suất; lượt ACTIVE bị gián đoạn hoàn mồi hữu hạn một lần. Chủ động hủy/về lobby không hoàn mồi.

Nhận thưởng nhiệm vụ khóa tài khoản và có khóa duy nhất người/nhiệm vụ/kỳ cùng request ID. Chuỗi khởi đầu nhận lần lượt; nhiệm vụ ngày đổi lúc 00:00 Việt Nam. Bán cá, tiền và tiến độ bán được cập nhật cùng transaction. Cá cũ giữ saleValue đã lưu.

## Mỹ thuật và phạm vi kiểm chứng

Bộ GLB gốc từ `Fishing_World_3D_Starter_Assets_v1.zip` vẫn được giữ tại `apps/client/public/assets/starter/`. Harbor v2 thêm 13 GLB tự dựng tại `apps/client/public/assets/harbor-v2/`: bốn nhân vật, ván cầu, cọc, dừa, nhà, bụi, đá, thùng, hải đăng và nền đảo bờ cong. Cảnh dùng asset mới qua registry trong assets.tsx, còn cá/cần/phao, quầy và một số đồ trang trí tiếp tục dùng bộ nguồn. Mesh tĩnh vẫn ghép/instancing; ván gỗ dùng thêm texture hạt/vân nhúng trong GLB.

Nhân vật v2 chứa skin sáu joint và mười clip animation: Idle, Walk, Cast, Wait, Hook, Reel, Celebrate, Run, Jump, ShowFish; Idle có morph nháy mắt. Mỗi avatar clone skeleton và AnimationMixer riêng, chuyển clip bằng crossfade; không còn dựng lại rig bằng cách đoán bộ phận từ mesh blockout khi chơi. Nguồn hình học và keyframe là `apps/client/src/art/harbor-author.ts`, dựng bằng Three.js rồi xuất GLB, không phải file Blender điêu khắc tay. Nhân vật 7.096–7.432 tam giác; bốn preset và thumbnail được đồng bộ từ cùng model. Xem [ghi chú mỹ thuật](ART-PASS.md).

Chất lượng Đẹp dùng bóng mặt trời tĩnh được cache, bóng tiếp xúc nhẹ, ánh sáng ấm và nước có phản sáng theo góc nhìn. Chất lượng Tiết kiệm tắt shadow map. Renderer buộc tạo lại bóng tĩnh sau khôi phục WebGL. Font Nunito và icon Lucide vẫn được đóng gói local; thumbnail sinh lại bằng `node scripts/render-asset-thumbnails.mjs`.

Ba bảng thiết kế gốc nằm trong `design/reference/`. Lobby, HUD, thông báo câu, thẻ kết quả, túi, cửa hàng, album, cộng đồng, chọn nhân vật và cài đặt dùng panel xanh và nút vàng theo các bảng này. Túi có tab Cá/Cần câu/Mồi, chọn cá để xem chi tiết và phân trang 12 cá. M3 gán đủ 15 model concept cho catalog loài trong `packages/shared/src/catalog.ts`; hình học nguồn vẫn là mẫu concept, chưa phải model sinh học chi tiết của từng loài. M4 thêm palette trang phục, tóc/kính, mắt có điểm sáng, má và nụ cười trên nhân vật nguồn; màu gỗ/dừa, hoa instancing, dây thừng, cờ màu và chim biển bổ sung cho bến. Harbor v2 đã thay các model chính và clip chuyển động; đây vẫn là cảnh mẫu stylized, chưa phải tái tạo toàn bộ độ chi tiết của ảnh concept hoặc một bộ asset điêu khắc tay trong Blender. Liên kết tài khoản email chưa triển khai.

Manifest, báo cáo kiểm tra và README gốc của bộ asset được giữ cùng các model. Theo thông tin tác giả đi kèm, đây là hình học procedural nguyên gốc. Các mẫu đều ở chất lượng prototype low-poly, có độ chi tiết thấp hơn ảnh concept.

Cài đặt mặc định là chất lượng Đẹp, giới hạn 30 FPS. Có thể chọn 60 FPS và chế độ Tiết kiệm (DPR 1), chế độ Đẹp giới hạn DPR tối đa 1.5. Đây là giới hạn render được chọn, FPS thực tế phụ thuộc thiết bị. Trước khi thay bản đồ tổng thể, lượt Harbor v2 đo 20 avatar ở 8 hướng trên Chromium headless/GPU Intel UHD 730, 1280×800, DPR 1: Tiết kiệm đạt 54,3–57,0 FPS, tối đa 175 draw call; Đẹp đạt 54,3–58,3 FPS sau khi cache bóng tĩnh. Xem điều kiện và báo cáo tại [ART-PASS](ART-PASS.md). Lượt M5 trước khi mở rộng cảnh đạt 59,7–60,0 FPS và được giữ riêng trong báo cáo gốc. Chưa xác nhận Android/Safari iOS hoặc khả năng dùng của 5 người mới. Reconnect trong 30 giây giữ cùng avatar, vị trí, khu vực và lượt câu theo đồng hồ server. Token reconnect chỉ lưu trong sessionStorage của tab. Server restart xử lý lượt chưa giật và lượt đang kéo theo quy tắc lưu trạng thái ở trên.


## Cài đặt người chơi tại lobby

Nút bánh răng ở góc trên phải mở cài đặt trước khi vào chơi và trong lúc đứng ở bến. Các thay đổi áp dụng ngay và tự lưu vào localStorage của trình duyệt. Cài đặt bao gồm chất lượng đồ họa, giới hạn 30/60 FPS, âm lượng hiệu ứng/môi trường/nhạc nền, tắt toàn bộ âm thanh, độ nhạy camera, đảo trục dọc và giảm chuyển động. Nút loa trên HUD bật/tắt toàn bộ âm thanh và giữ các mức âm lượng đã chọn. Nút Mặc định khôi phục cấu hình ban đầu. Tiến trình cá và XP tiếp tục lưu trong PostgreSQL.

Các model GLB thay thế cảnh và nhân vật dựng bằng primitive trước đây. Lobby có nhân vật giơ cá, túi và thẻ kết quả hiển thị thumbnail từ chính model trong bộ asset. Chế độ giảm chuyển động tắt zoom câu tự động và hiệu ứng nhấp nháy của UI.

Bài thử `assets.spec.ts` tải, parse và render toàn bộ 39 model, các bài thử gameplay kiểm tra hai người thấy nhau di chuyển, khoe cá, lưu tiến trình và thao tác các tab trong túi. Render lại thumbnail bằng `node scripts/render-asset-thumbnails.mjs` khi `pnpm dev` đang chạy.


## Thế giới chung M2

- Chơi khách vào nhanh một phòng đang mở. Nút Chọn phòng cho xem phòng đang có, tạo phòng mới hoặc nhập mã phòng 8 ký tự. Nhập mã cụ thể luôn dùng đúng phòng đó. Phòng đầy hoặc mã sai có thông báo.
- Bản đồ mở từ HUD. Bãi Biển và Làng Chài mở, Vùng San Hô và Hòn Đảo Bí Ẩn khóa Sắp mở. Dịch chuyển cùng phòng tới spawn đã xác thực, có cooldown 2 giây và bị chặn trong lượt câu.
- Đứng trên nền đi được và trong 2 m tới nước lộ thiên để thả cần tự do; không còn các điểm câu cố định. Nhân vật đi qua bến, đường làng và cầu hồ.
- Fish.area và FishingRound.area được thêm với giá trị mặc định beach, giữ khả năng đọc các cá cũ. Khu bắt hiển thị trên thẻ kết quả và túi.
- Server giữ chỗ 30 giây khi rớt mạng, tắt di chuyển của avatar vắng mặt và tiếp tục deadline câu. Client tự thử reconnect, refresh tab cũng dùng token của chính tab để phục hồi. Hồ sơ đồng bộ lại sau reconnect, không cộng XP trùng khi thẻ kết quả tới sau hồ sơ.
- WORLD chứa vị trí, sequence xác nhận, độ cao, trạng thái hoạt ảnh, bóng cá và kế hoạch bo cá. Tên/trọng lượng cá chỉ công bố sau khi bắt thành công và người chơi chọn Khoe cá. Cài đặt cho phép ẩn khoe cá người khác.
- Nhịp câu dùng cấu hình ở apps/server/src/fishing.ts, gồm 1–6 nhấp theo nhóm trọng lượng và cửa sổ giật theo bảng độ hiếm 900/700/550/400 ms. Deadline đóng được đặt khi cửa sổ thực sự mở để giữ đủ thời gian nếu timer server chạy trễ.

## Đối chiếu lộ trình

| Mốc | Trạng thái và việc tiếp theo |
| --- | --- |
| M0 | Có workspace, kết nối, DB, contracts và build/test local. M5 đã viết CI và đo desktop tham chiếu; chưa chạy CI trên GitHub, còn benchmark điện thoại. |
| M1 | Có vòng câu online và lưu thưởng, điều khiển desktop/cảm ứng, camera zoom và thu HUD. Đã thêm prediction/reconciliation và nội suy; còn playtest 5 người và đo mạng/thiết bị thật. |
| M2 | Có hai khu, ao, đường nối, collision, câu tự do gần bờ, bản đồ ảnh/dịch chuyển, danh sách/mã phòng, reconnect và tách sự kiện khoe cá theo khoảng cách. Có kiểm thử chức năng tự động. |
| M3 | Đã có catalog 15 loài, 3 cần/3 mồi, Xu, mua/bán/trang bị, album/kỷ lục, XP/cấp độ và tutorial. Có kiểm thử giao dịch đồng thời, gửi lặp, mất phản hồi và tải lại. Còn đo cân bằng và khả năng tự hoàn thành vòng chơi với người mới thực tế. |
| M4 | Có bảng cộng đồng/chat, danh sách người chơi, 4 emote, mute/report bền vững, CLI quản trị, 4 ngoại hình/tên, âm thanh gốc và settings/responsive. Có kiểm thử hai phiên, lưu/khôi phục và màn hình dọc/ngang. Mỹ thuật đang dùng bộ low-poly nguồn có bổ sung chi tiết; vẫn cần duyệt hình ảnh, nghe âm thanh và kiểm chứng cue trên thiết bị thật. |
| M5 | Soak Linux 20 người/60 phút qua HTTPS/WSS đạt; đã thử backup/restore và đọc tiến trình bằng role game, bảo vệ mạng/phiên, Chromium/Firefox/WebKit, GPU desktop và tối ưu draw call. Có cấu hình Vercel/backend và CI. Chưa deploy public, đo Android/Safari iOS hoặc playtest 5 người. |

Kiểm thử hiện có gồm nhịp nhấp theo trọng lượng, collision và đường đi, toàn bộ GLB, hai người di chuyển/câu/khoe cá, phòng đầy 20 kết nối, dịch chuyển hợp lệ/giả mạo/khi đang câu, bắt cá nước ngọt, reconnect sau commit và reconnect sau khi cửa sổ cắn đã hết. M5 thêm harness soak và số đo renderer riêng; các phép đo headless chưa thay cho FPS của 20 avatar trên thiết bị thật.

## Nội dung và kinh tế M3

- Catalog gồm 7 loài phổ biến, 4 ít gặp, 3 hiếm và 1 cực hiếm, chia theo Bãi Biển/Làng Chài. Server chọn loài và trọng lượng; cần gỗ vẫn có thể gặp mọi loài hợp lệ. Cá cực hiếm có thông báo toàn phòng sau khi đã lưu.
- Bắt cá nhận XP theo độ hiếm: 20/30/50/100. Cấp tối đa 10, XP cần cho mỗi cấp là `round(50 × level^1.5)`. Thanh tiến độ hiển thị XP của cấp hiện tại.
- Bán một cá hoặc tất cả cần xác nhận số lượng và tổng Xu. Giá bằng `round(basePrice × grams / referenceGrams)`, tối thiểu 1 Xu, được chốt trên từng cá. Báo giá giữ đúng tập cá lúc xác nhận, hết hạn sau 10 phút. Cá bán được đánh dấu, không xóa lịch sử. Bán không cộng XP và không xóa album.
- Cần gỗ miễn phí; cần tre cấp 3, 300 Xu, Luck +8%; cần carbon cấp 6, 1.200 Xu, Luck +15%. Mua xong chọn Trang bị. Luck nhân trọng số Hiếm/Cực hiếm và phần trọng lượng lớn, không thay đổi cửa sổ giật hay thêm lần quay thất bại.
- Mồi thường vô hạn; giá thử nghiệm mồi giun 5 Xu, mồi tôm 8 Xu. Mồi có affinity nhân trọng số tương ứng 1,35. Mồi hữu hạn trừ một đơn vị khi chấp nhận lượt, hụt/thu cần/tự ngắt mạng không hoàn; lỗi hệ thống trước commit được hoàn đúng một lần. Hết mồi vẫn chọn lại mồi thường trong túi.
- Tài sản dùng transaction khóa theo khách và requestId duy nhất. Số Xu, giá, cấp yêu cầu, quyền sở hữu, số lượng và trang bị đều được server kiểm tra. Nhật ký tiền và kết quả thao tác lưu cùng transaction; gửi lại cùng ID trả kết quả cũ, kể cả thao tác thất bại. Client giữ ID đang chờ trong sessionStorage để thử lại sau mất phản hồi, không lưu tài sản ở đó.
- Khách/cá cũ được bổ sung giá và album một lần khi tải hồ sơ, giữ nguyên cá và XP hiện có. Trước khi thay đổi schema trên máy này đã lưu bản sao `.local/before-m3.dump`.
- Hướng dẫn lưu tiến độ trên server: di chuyển thật → bắt cá → bán cá → xem cửa hàng. Các panel và thao tác trang bị được khóa khi câu, hướng dẫn thu gọn được.

Các trọng số, dải trọng lượng, giá và affinity tập trung ở `packages/shared/src/catalog.ts`; thuật toán chọn nằm ở `apps/server/src/catch-selection.ts`. Đây là thông số khởi điểm để chơi thử, chưa phải cân bằng đã được người chơi xác nhận.

Bài thử M3 kiểm tra gửi lặp/đồng thời, không âm tiền, không nhân đôi cá/XP, tiêu/hoàn mồi, báo giá giữ nguyên tập cá, từ chối báo giá của khách khác, chuyển dữ liệu cũ và vòng UI có mất phản hồi rồi tải lại. Test tích hợp tạo phần thưởng qua service thật bằng fixture cố định để kiểm tra kinh tế; bài gameplay riêng vẫn bắt cá qua tín hiệu server và cú giật thật. Ảnh cửa hàng/album/xác nhận bán nằm tại `.local/m3-*.png`, gồm màn hình dọc và ngang. Playtest với 5 người mới và đo thời gian tiến triển vẫn chưa thực hiện.

## Hình ảnh và cộng đồng M4

- Chat phòng dùng tên/ngoại hình lấy từ server, render text qua React, chuẩn hóa ký tự điều khiển và giới hạn 160 ký tự/1 tin mỗi giây. UUID chống gửi lại cùng tin. Mỗi phòng giữ 80 tin gần nhất để đồng bộ lại; tin được lưu DB để làm ngữ cảnh báo cáo. Phòng khác không nhận chat/emote của nhau.
- Cộng đồng hiển thị người trong phòng, cấp, ngoại hình, trạng thái kết nối và bốn emote: vẫy tay, vui vẻ, thả tim, vỗ tay. Emote hiện 3 giây trên đầu người chơi, cooldown 2 giây. Khi câu, bảng cộng đồng và emote được ẩn/khóa, chat thu gọn vẫn dùng được. Nhập chat dừng điều khiển di chuyển; Space không giật câu trong ô nhập.
- Tắt tiếng lưu theo định danh người chơi trong PostgreSQL, tồn tại qua tải lại/đổi phòng. Server lọc cả tin mới, lịch sử và emote cho người đã tắt tiếng; người khác vẫn nhận bình thường. Có danh sách đã tắt tiếng để bỏ chặn cả khi người đó rời phòng.
- Báo cáo có lý do/mô tả, requestId chống trùng và tối đa 20 tin gần đây của người bị báo cáo do server đính kèm. Chỉ báo cáo người cùng phòng, tối đa 5 báo cáo/10 phút và một báo cáo cho cùng người trong 10 phút. Không tự khóa người bị báo cáo.
- Bốn preset miễn phí: Thủy thủ, Nắng hè, San hô, Biển ngọc. Tên 2–20 ký tự, ngoại hình lưu DB và đồng bộ tới người cùng phòng. Không có hệ phối đồ nhiều lớp. Ảnh chân dung và ảnh toàn thân được render từ cùng model/palette bằng script thumbnail.
- Bộ âm thanh WAV gốc sinh bằng `python scripts/generate-audio.py`: sóng/chim biển, nhạc nền, quăng cần, cắn, giật, bắt cá, hụt và click. Không dùng âm thanh từ game khác. Chỉ phát sau tương tác người dùng; âm nền hạ khi câu, tạm dừng khi tab ẩn. Nhấp giả không phát âm báo cắn. Các mức âm lượng và nút tắt tiếng áp dụng ngay.
- Schema mới được bổ sung sau bản sao lưu `.local/before-m4.dump`; khách cũ mặc định preset Thủy thủ, giữ nguyên tài sản.

### Quản trị local

Chạy trên máy có quyền truy cập database, không có API quản trị công khai hay khóa quản trị trong client:

```powershell
pnpm --filter @fishing/server moderate reports
pnpm --filter @fishing/server moderate mute <guestId> 60 "Spam đã xác minh"
pnpm --filter @fishing/server moderate unmute <guestId> "Đã xem xét"
pnpm --filter @fishing/server moderate ban <guestId> 60 "Vi phạm đã xác minh"
pnpm --filter @fishing/server moderate unban <guestId> "Đã xem xét"
pnpm --filter @fishing/server moderate resolve <reportId>
```

Lấy guestId người bị báo cáo từ `targetId` trong danh sách report. Mute/ban có thời hạn từ 1 phút đến 7 ngày và lưu lý do vào ModerationLog. Server kiểm tra chat ngay khi gửi, đồng bộ hạn tắt chat và ngắt phiên bị ban trong vòng khoảng 3 giây. Ban chặn lần vào phòng tiếp theo. Công cụ này cần được bảo vệ ở cấp máy/database trước khi phát hành công khai; report không được gửi tới dịch vụ ngoài.

Kiểm thử M4 bao gồm chat gửi lặp/giả mạo/spam, tách phòng, tắt tiếng qua lần vào lại, report có ngữ cảnh và chống trùng, CLI mute/ban/resolve, hai người thấy emote/ngoại hình, Space khi đang nhập và câu, tải lại nhân vật, layout 390×844/844×390, giải mã cả 8 WAV, lưu/khôi phục cấu hình âm thanh. Ảnh kiểm tra `.local/m4-*.png`. Những kiểm thử tự động này chưa thay cho playtest, đánh giá âm thanh bằng tai, benchmark thiết bị thật hoặc kiểm định mỹ thuật theo ảnh concept.
