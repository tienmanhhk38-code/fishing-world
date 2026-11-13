# Production beta: Vercel + Render + Neon

Hướng dẫn cấu hình theo source ngày 13/11/2026, một backend Colyseus cho mỗi database. Tài liệu không xác nhận trạng thái dịch vụ public hoặc giá/điều kiện plan của nhà cung cấp. Xem [kiến trúc](ARCHITECTURE.md) và [chạy local](DEVELOPMENT.md) trước khi triển khai.

## Chọn kiến trúc

| Thành phần | Nền tảng | Trách nhiệm |
| --- | --- | --- |
| Web React/Vite, assets, `/api/*` proxy | Vercel | CDN, UI và cookie khách cùng origin |
| Node/Express/Colyseus | Render Web Service | Matchmaking HTTPS, WSS, mô phỏng, xác thực và giao dịch |
| PostgreSQL | Neon | Cá, Xu, XP, trang bị, phiên, nhiệm vụ, lịch sử lượt kéo |

Backend giữ phòng trong RAM, có khóa độc quyền database và startup recovery. Cấu hình repository tách backend chạy lâu dài trên Render; `api/` trên Vercel chỉ là HTTP bridge. Matchmaking/WSS đi trực tiếp tới backend. Muốn nhiều backend cần thiết kế thêm room routing, state/presence, lifecycle và recovery.

Nguồn: [Vercel WebSocket](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), [Render WebSocket](https://render.com/docs/websocket).

## 1. Chuẩn bị Neon

1. Tạo project/branch **production riêng**, chọn PostgreSQL 17 nếu có. Đặt Render và Neon cùng khu vực gần nhau; ví dụ Singapore nếu cả hai tài khoản hỗ trợ khu vực đó. Không dùng branch test/preview chung production.
2. Dùng owner/migration role làm chủ schema. Trong SQL Editor, tạo runtime role bằng SQL, không dùng role mặc định được Console/API cấp `neon_superuser`:

   ```sql
   CREATE ROLE fishing_app LOGIN PASSWORD 'THAY_BANG_MAT_KHAU_NGAU_NHIEN'
     NOSUPERUSER NOCREATEDB NOCREATEROLE;
   ```

   Chỉ nhập mật khẩu thật trong giao diện secrets/SQL riêng, không lưu vào Git hoặc chat. Chạy `deploy/neon-grants.sql` **bằng đúng role owner dùng để migrate**. Nếu database không tên `neondb`, sửa dòng GRANT CONNECT tương ứng. Default privileges cấp quyền các bảng sẽ tạo sau này; migrate xong chạy lại grant và lệnh REVOKE `_prisma_migrations` ở cuối file.
3. Lấy ba URL của **cùng project, branch và database**:

   | Biến backend | Kết nối | Role |
   | --- | --- | --- |
   | `DATABASE_URL` | Pooled, hostname chứa `-pooler`, TLS | `fishing_app` |
   | `DIRECT_DATABASE_URL` | Direct/unpooled, TLS | `fishing_app` |
   | `MIGRATION_DATABASE_URL` | Direct/unpooled, TLS | Owner/migration |

   Tham khảo cú pháp trong `deploy/render.env.example`. Giữ `sslmode=require`, giới hạn pool ban đầu 8 kết nối; điều chỉnh theo hạn mức Neon và số đo thực tế. Không bỏ TLS verification để chữa lỗi kết nối.

`instance-lock.ts` dùng `DIRECT_DATABASE_URL`, fallback về `DATABASE_URL` khi thiếu. Nếu runtime URL đi qua transaction pooler, phải cung cấp URL direct cho session advisory lock. Các URL phải cùng project/branch/database; code chỉ so sánh pathname, không xác minh toàn bộ danh tính cluster. Migration và backup cũng cần kết nối phù hợp để chạy PostgreSQL CLI/giữ snapshot. Theo dõi quota, compute và backup retention trên môi trường triển khai.

Nguồn: [Neon pooling](https://neon.com/docs/connect/connection-pooling), [Neon roles](https://neon.com/docs/manage/roles).

## 2. Tạo Render backend

Kết nối GitHub repository và tạo **Blueprint** từ `render.yaml` ở gốc. File hiện khai báo Docker, `plan: free`, region Singapore, một instance, health `/readyz`, auto-deploy tắt và `AUTO_MIGRATE=true`. **Không có disk hoặc pre-deploy command trong file.** Khả năng áp dụng plan và cấu hình dịch vụ cần kiểm tra trên Dashboard; repository không xác nhận điều đó.

| Biến Render | Giá trị |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `10000`, cùng cổng HTTP và WebSocket |
| `TRUST_PROXY` | `1`, tin đúng proxy cuối của Render; không đặt `true` tùy tiện |
| `APP_ORIGINS` | Origin frontend chính xác, ví dụ `https://fishing-world.vercel.app` |
| `DATABASE_URL` | Neon pooled runtime URL |
| `DIRECT_DATABASE_URL` | Neon direct runtime URL |
| `MIGRATION_DATABASE_URL` | Neon direct owner URL dùng bởi entrypoint khi migrate |
| `AUTO_MIGRATE` | `true` theo Blueprint: migrate trước khi spawn game server |
| `METRICS_TOKEN` | Secret ngẫu nhiên ≥32 ký tự; Blueprint tự tạo |
| `MAX_ROOMS` | `20`; cấu hình trần, chưa chứng nhận 400 người |

Không đặt `DATABASE_PASSWORD_FILE` hoặc `METRICS_TOKEN_FILE` trên Render khi dùng env URL/secrets. Các biến file dành cho Docker Compose local. Entrypoint hỗ trợ cả hai cách, không cần đổi lệnh khởi động Docker.

### Quan trọng: không chạy chồng hai backend

Code chỉ cho một backend/database. Khi tranh advisory lock, startup còn thử `pg_terminate_backend` với kết nối giữ lock cũ; nếu không lấy được lock thì thoát. Vì vậy chạy chồng có thể ngắt backend cũ hoặc làm bản mới không lên. `numInstances: 1` không tự chứng minh quá trình thay phiên bản không chạy chồng; file Blueprint hiện không khai báo cơ chế ngăn điều đó.

Giữ `numInstances: 1`, `autoDeployTrigger: off`. Trước khi phát hành, thiết lập và kiểm tra quy trình bảo trì dừng backend cũ trước khi migrate/khởi động bản mới. Không dùng hai services/preview backend cùng database. Room trong RAM sẽ mất khi cập nhật; tiến trình đã lưu vẫn ở Neon.

Nguồn: [Render deployment lifecycle](https://render.com/docs/deploys), [Render disk limitations](https://render.com/docs/disks), [Blueprint reference](https://render.com/docs/blueprint-spec).

### Migration và khởi động

Theo `render.yaml`, Docker entrypoint chạy `prisma migrate deploy` khi `AUTO_MIGRATE=true`, rồi mới spawn game server. Migration chọn URL theo thứ tự `MIGRATION_DATABASE_URL` → `DIRECT_DATABASE_URL` → `DATABASE_URL`; lỗi migration chặn startup. Không dùng `db push`/`migrate reset` để phát hành.

`node scripts/container-entry.mjs --migrate` là chế độ hỗ trợ sẵn để migrate rồi thoát, **chưa được khai báo thành pre-deploy command**. Entrypoint bỏ `MIGRATION_DATABASE_URL` trước khi spawn game child; secret owner vẫn ở cấu hình dịch vụ. Nếu migrate từ CI/máy quản trị riêng, tắt `AUTO_MIGRATE` và bỏ owner URL khỏi runtime sau khi đã áp dụng migration. Migration diễn ra trước khi game lấy instance lock, nên vẫn phải dừng backend cũ trước bước này.

Với database mới rỗng, lần deploy đầu áp dụng cả baseline và migration nâng cấp. Runtime role đã có default privileges từ bước Neon trước đó. Sau migration, chạy REVOKE quyền bảng `_prisma_migrations` và kiểm tra lại runtime role đọc/ghi game thành công.

Chưa có frontend URL thì dùng trước tên domain Production dự kiến hoặc một origin HTTPS cụ thể bạn sở hữu; sau khi Vercel cấp URL, cập nhật chính xác và redeploy Render. Không dùng wildcard.

Kiểm tra `https://YOUR-SERVICE.onrender.com/readyz` trả `{"ok":true}`. Health check không cần Origin; browser API/matchmaking cần origin được cho phép. Lưu HTTPS origin backend này cho bước Vercel.

## 3. Tạo Vercel frontend

Import GitHub repository. **Root Directory: gốc repository**, không chọn `apps/client` vì Vercel cần cả gói shared và thư mục `api/`.

| Cấu hình | Giá trị |
| --- | --- |
| Framework | Vite |
| Node | 22.x |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm --filter @fishing/client build` |
| Output | `apps/client/dist` |
| `VITE_GAME_SERVER_URL` | `https://YOUR-SERVICE.onrender.com` |
| `GAME_SERVER_URL` | Cùng HTTPS origin trên |

`vercel.json` và `package.json` đã đặt lệnh/phiên bản. Cả hai URL phải là HTTPS origin, không có `/api`, path, query, hash hoặc thông tin đăng nhập. `VITE_*` được công khai và nhúng lúc build: thay URL phải redeploy. Không đưa URL Neon, token hoặc password vào `VITE_*` hay Vercel frontend.

`api/[...path].ts` giữ cookie khách tại domain frontend và chuyển tiếp các route trong allowlist, gồm nhiệm vụ. Không thêm rewrite `/api/*` bỏ qua handler. Matchmaking/WSS đi trực tiếp từ trình duyệt tới Render bằng ticket. `/internal/metrics` không được proxy ra frontend.

Sau khi có URL Vercel thật, đặt nó vào `APP_ORIGINS` Render rồi deploy lại backend. Nếu có domain riêng, thêm origin chính xác; cookie của domain Vercel và domain riêng là hai phiên khác nhau. Chốt một domain chính cho người chơi. Preview dùng env riêng và origin allowlist cụ thể, không nối tùy tiện vào production.

Nguồn: [Vite trên Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Kiểm tra trước khi mời người chơi

- Hai hồ sơ trình duyệt độc lập vào cùng mã phòng, thấy di chuyển/thả/kéo/khoe cá.
- Bắt được cá, reload/reconnect: giữ đúng cá/XP và nhảy vẫn hoạt động; không nhân avatar.
- Bán/mua/trang bị/nhận thưởng gửi lặp không tăng tiền/cá/thưởng trùng.
- Network chỉ dùng HTTPS/WSS; cookie `__Host-fishing_session` Secure/HttpOnly; không xuất hiện URL database/password trong bundle.
- Console không có lỗi origin, mixed content, GLB texture hoặc âm thanh; MP3 hỗ trợ Range.
- Mời thử ít người trước; đo phòng 20 người trên chính môi trường mới. Các số đo local không thay cho số đo Render/Neon thực tế.

## 5. Dữ liệu, backup và cập nhật

Neon mới bắt đầu rỗng, không tự mang tiến trình local. Muốn giữ dữ liệu local: chọn một nguồn dữ liệu, dừng backend nguồn, backup bằng `scripts/backup.mjs`, kiểm tra restore trên Neon branch thử bằng direct owner URL, cấp lại runtime grants và so dữ liệu. Chỉ chuyển production sau khi đối chiếu đạt. Không nhập dump chồng lên database đã migrate/có người chơi; dùng database/branch trống và quy trình backup/restore trong [DEPLOYMENT](DEPLOYMENT.md).

Trước mỗi bản cập nhật: thông báo bảo trì → backup và xác nhận đường khôi phục → chạy migration tương thích → Manual Deploy đúng commit trên Render → kiểm tra `/readyz` → deploy frontend Vercel nếu hợp đồng mạng đổi → thử hai người → mở lại. Với thay đổi giao thức không tương thích cần đồng bộ cả hai deploy trong thời gian bảo trì, tránh frontend tự deploy trước backend. Cấu hình webhook/auto-deploy Vercel phù hợp lịch phát hành.

Phòng RAM không tồn tại sau deploy; người chơi vào lại, tiến trình đã lưu giữ nguyên. Lượt đang kéo được giải quyết theo trạng thái database. Không scale ngang/clone backend cùng DB để tăng sức chứa. Rollback schema không tự động: giữ backup và thử khôi phục sang branch mới nếu cần.

Theo dõi readiness, CPU/RAM, event-loop, RTT, `db_errors`, `fishing_errors`, số kết nối và quota Neon, outbound WebSocket/nhạc/assets. `/internal/metrics` trên Render cần bearer token; không đưa secret vào browser. Dùng Render logs và giới hạn quyền nhóm quản trị. Xem [hướng dẫn Docker/backup chi tiết](DEPLOYMENT.md).
