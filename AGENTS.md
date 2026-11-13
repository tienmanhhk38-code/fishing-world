# Hướng dẫn Developer và AI Agent

## Đọc trước khi làm việc

- [Mục lục, công nghệ và cấu trúc](docs/README.md).
- [Kiến trúc và luồng xử lý](docs/ARCHITECTURE.md).
- [Chạy local, kiểm thử và phát triển](docs/DEVELOPMENT.md).
- Khi sửa gameplay: đọc [tính năng](docs/FEATURES.md) và [giao thức, dữ liệu](docs/PROTOCOL-DATA.md).
- Khi triển khai: đọc [Vercel/Render/Neon](docs/PRODUCTION.md) hoặc [Docker/backup](docs/DEPLOYMENT.md).

## Vị trí thay đổi

| Phạm vi | Nơi bắt đầu |
| --- | --- |
| UI, điều khiển và popup | `apps/client/src/main.tsx`, các `*Panel.tsx`, CSS |
| Cảnh 3D, camera, chuyển động | `scene.tsx`, `motion-client.ts`, `scenery.tsx` trong client |
| Luật map, catalog, type dùng chung | `packages/shared/src/` |
| Phòng game, lifecycle, HTTP API | `apps/server/src/index.ts` |
| Giao dịch, thưởng và phục hồi lượt câu | `apps/server/src/economy.ts`, `quests.ts` |
| Chat, mute, report | `apps/server/src/social.ts`, client `social-client.ts` |
| Schema và migration | `apps/server/prisma/` |
| HTTP bridge Vercel | `api/[...path].ts`, `api/quests/claim.ts` |
| Model được tạo bằng code | client `src/art/`, `scripts/build-*-assets.mjs` |

## Quy tắc cần giữ

- Dùng pnpm theo `packageManager`; dự án dùng TypeScript strict và ESM. Giữ phong cách code hiện có; không format lại file ngoài phạm vi.
- Server quyết định vị trí hợp lệ, trạng thái lượt câu, cá, Xu, XP và nhiệm vụ. Client gửi ý định, không gửi kết quả để được cấp thưởng.
- Luật và type dùng chung đặt trong `packages/shared`; đồng bộ handler server, client và test khi đổi giao thức. HTTP route mới trên Vercel cần cập nhật allowlist proxy.
- Giữ transaction khóa hàng `Guest`, `requestId`/fingerprint chống lặp và `Profile.revision` chống dữ liệu cũ ghi đè. Retry cùng thao tác phải giữ nguyên `requestId`.
- Chỉ cấp cá/XP sau khi kéo thành công; dùng `selected`/`plan` đã lưu khi recovery, không lấy mẫu lại. NPC/bot chỉ là actor trang trí, không tham gia kinh tế.
- Map hiển thị và collision phải dùng quy tắc trong shared; kiểm tra cả vị trí NPC, teleport và điểm thả câu khi sửa map.
- Giữ origin validation, giới hạn payload/rate và cookie HttpOnly. Không đưa secret vào `VITE_*`, log hoặc tài liệu.
- Không bỏ overrides/patches Colyseus nếu chưa kiểm tra lại ESM và WebSocket từ Node/browser.
- Chỉ chạy một backend trên mỗi database. Startup có thể gọi `pg_terminate_backend` để giành advisory lock; không dùng database của server khác để thử nghiệm.
- Không tự reset/xóa database hoặc volume. Với thay đổi schema, tạo migration có thể review; chỉ áp dụng lên môi trường được giao và có phương án backup.
- Giữ nguồn tạo asset, GLB, thumbnail và manifest nhất quán. Không tự chạy script tái tạo asset nếu nhiệm vụ không cần.

## Kiểm tra và bàn giao

- Thay đổi logic/type: chạy test liên quan và `pnpm build`; unit suite là `pnpm test`.
- Thay đổi UI/network/persistence: chọn Playwright spec phù hợp; cần server và database test riêng đã migrate. Config không tự bật server.
- `test:release` có thao tác dừng/kill/start container; soak tạo dữ liệu. Chỉ chạy trên beta test được chỉ định.
- Với thay đổi chỉ tài liệu, kiểm tra liên kết, đường dẫn và lệnh theo source; không cần khởi động game hoặc ghi database.
- Báo rõ file thay đổi, kiểm tra đã chạy, phần chưa kiểm chứng. Không dùng kết quả trong báo cáo cũ như kết quả mới.
- Cập nhật đúng tài liệu phụ trách chủ đề; các báo cáo V5–V9/M5 là lịch sử, không chép toàn bộ vào tài liệu hiện trạng.
