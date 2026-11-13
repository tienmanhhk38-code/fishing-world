# Phát triển và kiểm thử

## Khởi động local

Yêu cầu Node.js **22.x**, pnpm **12.18.0**, PostgreSQL (Compose dùng **17**), browser hỗ trợ WebGL. Chạy lệnh ở gốc repository.

```powershell
pnpm install --frozen-lockfile
if (!(Test-Path apps/server/.env)) { Copy-Item apps/server/.env.example apps/server/.env }
docker compose up -d
```

Chỉ sao chép `.env.example` nếu chưa có `.env`; giữ nguyên cấu hình riêng đã tồn tại. Compose trên chỉ bật PostgreSQL development ở `127.0.0.1:55432`, không chạy app. Nếu dùng PostgreSQL cài trên Windows, thay lệnh Docker bằng:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-db.ps1
```

Script Windows tạo cluster tại `.local/postgres`, dùng trust auth trên loopback; chỉ dành cho development. Không chạy cả hai database cùng cổng.

Đặt `DATABASE_URL` trong `.env` cho Prisma CLI. Đồng thời truyền biến vào shell để server/test nhận đúng database; `loadConfig` chỉ đọc `process.env`, không có bước nạp toàn bộ file env trong source server:

```powershell
# Giá trị ví dụ chỉ dành cho database local từ compose.yaml.
$env:DATABASE_URL = 'postgresql://fishing:fishing@127.0.0.1:55432/fishing'
pnpm db:generate
pnpm --filter @fishing/server exec prisma migrate deploy
pnpm dev
```

Lệnh migration trên dành cho database mới hoặc đã quản lý bằng Prisma migrations. Với DB cũ dùng `db push`, cần backup và baseline/đối chiếu trước; xem [DEPLOYMENT](DEPLOYMENT.md). `pnpm db:push` có sẵn nhưng không thay thế quy trình migration khi phát hành.

Mở [http://127.0.0.1:5173](http://127.0.0.1:5173); backend ở cổng 2567. Không đặt `VITE_GAME_SERVER_URL` khi dùng Vite proxy local. Dùng hai profile/browser độc lập để thử hai guest; hai tab cùng profile chia sẻ cookie.

## Build và chạy bundle

```powershell
pnpm build
pnpm --filter @fishing/server start
```

Dừng backend development trước khi chạy bundle trên cùng DB. Build client tạo `apps/client/dist/`; server dùng esbuild tạo `apps/server/dist/index.mjs`, bundle shared và để dependency runtime bên ngoài. Express phục vụ web/API/WS tại cổng 2567 khi có client dist.

`pnpm build` chạy typecheck qua script shared/server; riêng `pnpm --filter @fishing/client build` chỉ là Vite build. `tsconfig.json` include source apps/shared và tests, không include `api/`; proxy được kiểm tra hành vi trong `tests/security.test.ts`.

## Kiểm thử

| Lệnh | Điều kiện/phạm vi |
| --- | --- |
| `pnpm test` | Vitest: `tests/*.test.ts`; luật game, security/proxy, catalog, model, viewport |
| `pnpm exec vitest run tests/world.test.ts` | Ví dụ chạy unit test theo phạm vi |
| `pnpm test:browser` | Chromium UI/API/integration; server/Vite đang chạy, DB test đã migrate |
| `pnpm exec playwright test tests/browser/economy.spec.ts` | Ví dụ kiểm tra giao dịch và persistence |
| `pnpm test:cross-browser` | Một số luồng game/audio trên Firefox và WebKit, không phải toàn bộ suite |
| `pnpm test:latency` | Script kiểm tra latency theo harness riêng |
| `pnpm test:render` | Benchmark render; mặc định nhắm `https://localhost:8443` |
| `pnpm test:release` | Beta local; script có dừng/kill/start Docker để thử recovery |
| `pnpm test:soak:beta` | Tạo tải và dữ liệu trên beta; đọc script/env trước khi chạy |

Cài browser khi cần: `pnpm exec playwright install chromium firefox webkit`. Playwright dùng base URL `http://127.0.0.1:5173`, một worker, **không có `webServer` tự khởi động app**. Một số spec gọi domain function và sửa DB trực tiếp; giữ `DATABASE_URL` của test và server trùng nhau trên DB dùng riêng cho test, không trỏ production.

Chọn spec theo phạm vi: `protocol/world/free-fishing/sprint-jump` cho movement/map; `experience/economy/upgrade` cho progression/recovery; `social/residents-ui/security` cho cộng đồng; `settings/audio/fish-v6/layout-v7/popup-density/viewport-v9` cho UI/media. Tên đầy đủ nằm trong `tests/browser/`.

CI trong [checks.yml](../.github/workflows/checks.yml) tạo PostgreSQL riêng, generate/migrate, build, audit dependency, unit test, bật app rồi chạy browser/cross-browser/latency. Báo cáo lịch sử trong docs không thay cho kết quả chạy ở commit hiện tại.

`pnpm exec playwright test tests/browser/popup-design.spec.ts` kiểm tra riêng các popup Glass UI bằng component thật và API mô phỏng: responsive, tab, danh sách cuộn 4 hàng, chọn/trang bị vật phẩm, xem giá bán, nhiệm vụ và nhân vật. Spec này cần Vite đang chạy ở base URL của Playwright, không cần backend/database; kết quả không xác nhận giao dịch thật.

## Làm việc với asset

- Model nguồn: `apps/client/src/art/harbor-author.ts`, `fish-author.ts`. Đầu ra: `public/assets/harbor-v2/` và `public/assets/starter/models/`, kèm thumbnail/manifest.
- 15 loài nước ngọt dùng `art/freshwater-author.ts`; nguồn tham chiếu, ngân sách riêng và lệnh QA có tại [FRESHWATER-MODELS](FRESHWATER-MODELS.md). Preview `/freshwater-preview.html` kiểm tra model/rig độc lập, không kết nối database.
- Khi Vite ở 5173 và đã cài Chromium, dùng `node scripts/build-harbor-assets.mjs` hoặc `node scripts/build-fish-assets.mjs` nếu cần tái tạo. Các script ghi đè asset; kiểm tra diff sau khi chạy.
- Xem model bằng `/asset-preview.html`, cảnh đảo bằng `/island-preview.html` trên Vite development. Các trang này không được khai báo thành input riêng trong cấu hình production build.
- Khi chỉ thêm một số loài, truyền model ID vào `node scripts/build-fish-assets.mjs fish_extra_marbled_eel fish_extra_sturgeon` để chỉ tạo GLB/thumbnail cho các ID đó. Không truyền ID sẽ tái tạo toàn bộ cá.
- `scripts/generate-audio.py`, `generate-reel-machine.py` tạo WAV; MP3 hiện có và `music-track.ts` quyết định nhạc theo cảnh. Không tự đổi tên/mapping vì tên file đang được hoán đổi có chủ ý.
- Kiểm tra geometry/skin/LOD bằng unit tests liên quan và `scripts/check-fish-assets.mjs`; quy trình cá chi tiết ở [FISH-V6](FISH-V6.md).

Ảnh phong cảnh trong popup Bản đồ được chụp từ scene và model hiện có bằng `node scripts/capture-destination-previews.mjs` khi Vite đang chạy (mặc định `http://127.0.0.1:5173`, có thể đổi bằng `PREVIEW_BASE_URL`). Script chỉ ghi `apps/client/public/assets/ui/destinations/*.png`, không kết nối phòng game hay database. Camera nguồn nằm ở `apps/client/src/island-preview.tsx`; chỉ chụp lại khi thay cảnh hoặc ảnh preview.

## Chẩn đoán nhanh

| Triệu chứng | Nơi kiểm tra |
| --- | --- |
| Server không khởi động | `DATABASE_URL`, migration, `/readyz`, backend khác đang giữ instance lock |
| Không vào được phòng | Origin, ticket hết 30 giây, guest đang ở tab khác, phòng đầy |
| UI vào được nhưng WS lỗi | Vite `/socket` hoặc `VITE_GAME_SERVER_URL`, allowlist origin và HTTPS/WSS |
| Thao tác mua bị từ chối | Phase `IDLE`, khoảng cách 3 m tới Cô Sáu, cấp/Xu/tồn kho |
| Giao dịch báo chưa xác nhận | Retry cùng `requestId`, kiểm tra profile/revision và operation đã lưu |
| Mất tiến trình sau đổi browser/domain | Cookie khách khác nhau; không có account recovery |
| Trang preview chạy nhưng production không có | Build Vite hiện chỉ dùng entry chính `index.html` |

Không commit `.env`, dump, cookie, secrets hoặc `.local/`. Backup/restore yêu cầu PostgreSQL CLI và quyền phù hợp; tham khảo [DEPLOYMENT](DEPLOYMENT.md) trước khi thao tác dữ liệu.
