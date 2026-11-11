# Harbor v2 — lượt nâng cấp mỹ thuật bến cảng

Ngày kiểm chứng: 11/11/2026. Đã thay model chính trong cảnh chơi thực, không chỉ tạo ảnh minh họa. Đây là lượt hoàn thiện một cảnh cảng đại diện; độ chi tiết vẫn còn thấp hơn ảnh concept.

## Những phần đã thay

- Bốn nhân vật chibi: mặt và mắt nhiều lớp, điểm sáng mắt, má, tóc, mũ có vành/vân, cổ áo, dây áo, viền tay, quần và giày. Mỗi model có skin sáu joint, morph nháy mắt và bảy clip Idle/Walk/Cast/Wait/Hook/Reel/Celebrate. Mỗi người chơi có skeleton và AnimationMixer riêng.
- Chín model môi trường: ván cầu có cạnh bo/vân gỗ/đinh, cọc có vòng đầu gỗ và dây quấn, dừa thân cong/lá gập, nhà có cửa sổ/cửa chớp/mái chia lớp, bụi, đá, thùng, hải đăng và nền đảo có bờ cát cong.
- Ánh sáng ấm, mặt nước phản sáng theo góc nhìn và vùng nước nông ven đảo. Chất lượng Đẹp dùng bóng mặt trời tĩnh được cache; nhân vật dùng bóng tiếp xúc. Tiết kiệm tắt shadow map. Sau khôi phục WebGL, bóng tĩnh được tạo lại.
- Thumbnail ngoại hình lấy từ cùng model đang dùng trong game.

Toàn bộ 13 GLB nằm ở `apps/client/public/assets/harbor-v2/`, tổng dung lượng dưới 4 MB; mỗi nhân vật 7.096–7.432 tam giác. Bộ starter vẫn được giữ nguyên, cá/cần/phao/quầy/ghế và một số đồ trang trí tiếp tục dùng bộ này.

## Nguồn và cách sửa

Nguồn chỉnh sửa là `apps/client/src/art/harbor-author.ts`: hình học, vertex paint, texture gỗ và keyframe được dựng bằng Three.js rồi xuất GLB. Đây không phải file Blender điêu khắc tay, không tải model/texture bên thứ ba mới.

Với dev server đang chạy:

```powershell
node scripts/build-harbor-assets.mjs
node scripts/render-asset-thumbnails.mjs
node scripts/capture-harbor-preview.mjs
pnpm test
pnpm build
```

Registry trong `assets.tsx` thay model mà vẫn giữ ID và footprint dùng bởi cảnh. Vùng đi và luật câu tiếp tục dùng hợp đồng shared/server.

## Kiểm chứng

- 26 unit test qua, gồm ngân sách GLB, skin weights và bảy clip của cả bốn ngoại hình.
- 21 Chromium browser/integration qua với bộ mới trước lần thay nền đảo; Firefox/WebKit qua hai luồng gameplay. Sau khi thêm nền đảo, chạy lại kiểm tra cả 13 GLB, hai người câu/lưu/tải lại và mất/khôi phục WebGL: 3/3 qua.
- `pnpm build` qua. Ảnh chụp thực tế ở `.local/harbor-v2/`: `dock.png`, `promenade.png`, `fishing.png`, `character.png`. Không có page error trong lượt chụp.
- Docker/Caddy tại `https://localhost:8443` đã cập nhật và healthy. Hash cả 13 GLB được phục vụ khớp file nguồn; lượt chụp qua lobby, đi bộ, dịch chuyển, thả/thu cần trên bản HTTPS không có page error. Ảnh cận cảnh nhân vật lấy từ trang preview dev; trang này không phải route production. Kết quả ở `docs/validation/harbor-release.json` và `harbor-preview.json`.
- Đo 20 guest thật qua mạng local, 8 hướng camera, Chromium headless dùng Intel UHD 730/D3D11, viewport 1280×800, DPR 1, giới hạn 60 FPS: chế độ Tiết kiệm đạt 54,3–57,0 FPS trung bình theo góc, tối đa 175 draw call. Đây là phép đo desktop, chưa chứng nhận điện thoại. Báo cáo riêng ở `docs/validation/harbor-low.json`.
- Cùng cấu hình, chế độ Đẹp đạt 54,3–58,3 FPS, tối đa 168 draw call sau khi bóng tĩnh đã được cache; báo cáo `docs/validation/harbor-high.json`. Dao động giữa lượt đo và góc nhìn không có nghĩa chế độ Đẹp luôn nhanh hơn. Resource của hai lượt này được phục vụ trực tiếp bởi server native, chưa nén qua Caddy.

Chưa thực hiện thử với 5 người mới và thiết bị Android/iOS thật. Chưa thay toàn bộ đạo cụ hoặc đạt mức hoàn thiện của bộ concept. Báo cáo M5/soak cũ được giữ riêng, không dùng số đo cũ để đại diện cho lượt mỹ thuật này.
