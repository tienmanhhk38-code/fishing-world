# Triển khai beta: Docker/VPS và vận hành

> Với Vercel + Render + Neon, dùng [hướng dẫn production mới](PRODUCTION.md) và `render.yaml`. Phần dưới giữ hướng dẫn Docker/VPS cùng quy trình backup/restore.

Trạng thái: cấu hình đã chuẩn bị và thử local. Chưa tạo dự án Vercel, thuê máy chủ, cấu hình DNS hay phát hành công khai.

## Kiến trúc

```text
Trình duyệt ── HTTPS ── Vercel (React/Vite + /api/* proxy)
     └────── WSS / matchmaking HTTPS ── Caddy ── một tiến trình Colyseus
                                                     └── PostgreSQL 17
```

Cookie khách chỉ cần tồn tại trên domain web Vercel: API proxy chuyển Cookie tới backend và trả Set-Cookie về trình duyệt. Matchmaking/WebSocket dùng ticket ngắn hạn gắn với phòng và phiên, không cần cookie bên thứ ba. Không đặt DATABASE_URL hay METRICS_TOKEN trong biến `VITE_*`.

Vercel có WebSocket public beta từ 22/06/2026. Tuy nhiên bản game này giữ phòng trong bộ nhớ và có khóa độc quyền một server/database; cấu hình dưới giữ một backend sống lâu, không đưa nguyên server vào Functions tự co giãn. Muốn nhiều tiến trình cần thiết kế lại presence/driver, định tuyến phòng và khóa khôi phục trước.

Tài liệu chính thức: [Vite](https://vercel.com/docs/frameworks/frontend/vite), [Node Functions](https://vercel.com/docs/functions/runtimes/node-js), [WebSocket beta](https://vercel.com/changelog/websocket-support-is-now-in-public-beta).

## Chạy bản production thử trên máy này

Yêu cầu Docker Compose, Node 22 và pnpm 12.18.0. Trong thư mục gốc:

```powershell
node scripts/init-beta.mjs
docker compose -p fishing-beta-m5 -f compose.beta.yaml up -d --build --wait
```

Mở `https://localhost:8443`. Caddy dùng CA local nên trình duyệt chưa tin chứng chỉ này. Chỉ môi trường local dùng CA đó; bản public dùng chứng chỉ ACME thật. Chạy `stop` để dừng, chạy `up -d --wait` để bật lại. Dữ liệu nằm trong volume riêng của project; không dùng `down -v`.

`init-beta.mjs` tạo ba secret ngẫu nhiên trong `.local/beta/`, giữ nguyên giá trị đã có. Không đưa thư mục này lên Git hay Vercel. Database không mở cổng ra host. App chạy UID 10001, filesystem chỉ đọc, bỏ Linux capabilities; role `fishing_app` chỉ có quyền dữ liệu. Dịch vụ `migrate` riêng dùng `fishing_admin`, chạy Prisma migration trước app. Init role áp dụng cho volume PostgreSQL mới; volume prototype cũ dùng role `fishing` không tự chuyển quyền.

## Chuẩn bị backend public khi có VPS/domain

1. Sao chép mã nguồn và các file build vào máy Linux có Docker; tạo secrets mới bằng `node scripts/init-beta.mjs` trên chính máy đó. Giữ bản sao secret trong kho riêng có kiểm soát truy cập.
2. Sao chép `deploy/production.env.example` thành `.env.production` ở gốc. Điền `GAME_HOST` (domain backend), `APP_ORIGINS` (origin HTTPS chính xác của web Vercel/domain web). Nhiều origin cách nhau bằng dấu phẩy; không dùng wildcard. Có thể thêm URL preview cụ thể khi cần thử, rồi bỏ sau.
3. DNS backend trỏ tới VPS, mở 80/443 cho Caddy, chỉ mở SSH có kiểm soát. Không mở PostgreSQL/2567 ra Internet. Caddy tự cấp chứng chỉ; `TRUST_PROXY=uniquelocal` chỉ phù hợp vì app nằm sau proxy trong mạng Docker riêng và không publish cổng.
4. Chạy:

```powershell
docker compose --env-file .env.production -p fishing-prod -f compose.beta.yaml up -d --build --wait
```

5. Kiểm tra `/healthz`, `/readyz`, log app, hai phiên khách độc lập và một lần bắt cá/tải lại túi. Health không thay cho thử gameplay. Chưa có cấu hình autoscaling hay triển khai không gián đoạn; restart sẽ kết thúc phòng và yêu cầu người chơi vào lại.

## Cấu hình Vercel sau khi có backend

Import repository với **Root Directory là thư mục gốc workspace**, không chọn riêng `apps/client`. `vercel.json` chọn Vite, build `pnpm --filter @fishing/client build`, output `apps/client/dist`; Node cố định 22.x, pnpm 12.18.0 trong package.json.

Đặt hai biến cho đúng môi trường Production/Preview:

| Biến | Giá trị ví dụ | Nơi dùng |
| --- | --- | --- |
| `VITE_GAME_SERVER_URL` | `https://game-api.example.com` | Được nhúng vào build client; matchmaking HTTPS và WSS trực tiếp |
| `GAME_SERVER_URL` | `https://game-api.example.com` | Chỉ Vercel Function HTTP proxy, không nhúng vào client |

Cả hai phải là HTTPS origin, không có path/query/hash, không có user/password. Thay `VITE_*` cần build lại. Thêm đúng origin frontend vào `APP_ORIGINS` backend rồi restart backend. Không cấu hình rewrite `/api` trực tiếp bỏ qua proxy; API giữ cookie ở frontend. Không cần Vercel Postgres vì tiến trình game sử dụng PostgreSQL backend.

Thư mục `api/[...path].ts` chỉ chuyển tiếp các route game có trong allowlist; chặn POST khác origin, giới hạn 4 KiB, timeout 8 giây, giữ cookie Secure/HttpOnly và không cache. `.vercelignore` loại dữ liệu local, secret, dump và design khỏi upload. Khi chưa có URL backend, API trả thông báo chưa cấu hình thay vì tạo tiến trình tạm không lưu dữ liệu.

Sau khi deploy thật: mở hai profile trình duyệt, vào cùng mã phòng, đi lại/câu/khoe cá; kiểm tra reload giữ túi; kiểm tra Network không có HTTP/WS không mã hóa, `/api/guest` có cookie và CORS chỉ cho origin đã khai báo. Chạy lại load/soak trên môi trường thật trước khi coi M5 nghiệm thu phát hành.

## Theo dõi và giới hạn vận hành

```powershell
docker compose -p fishing-beta-m5 -f compose.beta.yaml ps
docker compose -p fishing-beta-m5 -f compose.beta.yaml logs --tail 100 app
```

App xuất JSON metrics mỗi 30 giây: số người/phòng/lượt, catch/miss/lỗi, RSS/heap/CPU, event loop và RTT. `/internal/metrics` cần bearer secret và bị Caddy chặn từ ngoài. Thu thập từ mạng nội bộ/container, không đưa token vào frontend hoặc log. Theo dõi `db_errors`, `fishing_errors`, room population, RSS tăng liên tục, readiness, ổ đĩa và backup mới nhất. CPU/event-loop local chịu ảnh hưởng các bài dựng ảnh/build chạy chung máy; chưa là SLA production.

Mặc định tối đa 20 phòng, 20 người/phòng; kiểm thử tải hiện chỉ đo **một phòng 20 người**, không xác nhận 400 người. WebSocket 4 KiB/frame, rate limit message/API/chat, xác thực ticket trước tạo phòng, token cookie lưu SHA-256 trong DB. Token khách dạng cũ được đổi hash khi đọc; không chủ động xóa tiến trình cũ.

Khóa PostgreSQL dùng một connection `pg` riêng với heartbeat, ngăn hai server cùng sửa một database và ngăn khôi phục ACTIVE khi server khác còn chạy. Nếu mất khóa thì server dừng để tránh ghi chồng. Khi dùng pooler, `DIRECT_DATABASE_URL` phải trỏ cùng database bằng kết nối session trực tiếp; transaction pooling không giữ advisory lock qua phiên.

## Sao lưu, khôi phục và cập nhật

Các script Node cần PostgreSQL 17 client và URL database truy cập được từ máy quản trị (mạng riêng/SSH tunnel). Không mở cổng public chỉ để chạy backup. Có thể dùng `BACKUP_DATABASE_URL` riêng thay cho DATABASE_URL; chỉ role quản trị backup mới có quyền tạo database restore.

```powershell
$env:PG_BIN='C:/Program Files/PostgreSQL/17/bin'
$env:BACKUP_OUTPUT='.local/backups/before-update.dump'
node scripts/backup.mjs
$env:RESTORE_DUMP='.local/backups/before-update.dump'
$env:RESTORE_DATABASE_NAME='fishing_restore_trial_20261110'
node scripts/restore-verify.mjs
```

Backup dùng exported snapshot/repeatable-read, nên manifest và dump cùng một thời điểm dù đang có người chơi. Manifest gồm SHA-256 của dump và số hàng/hash từng bảng. Restore kiểm tra hash trước, chỉ tạo database `fishing_restore_*` mới, không ghi đè database tồn tại; sau đó so từng bảng. Giữ cả dump lẫn manifest trong bản sao mã hóa ngoài máy chủ, giới hạn quyền truy cập vì chứa phiên khách/chat. Chọn lịch và retention theo vận hành thực tế; chưa tự cài cron hay gửi dữ liệu sang dịch vụ ngoài.

Với backend tách role quản trị và role game, đặt `RESTORE_APP_ROLE=fishing_app` khi chạy restore bằng tài khoản quản trị. Script yêu cầu role đã tồn tại, không có superuser/createdb/createrole, rồi cấp lại CONNECT, USAGE và quyền dữ liệu trong database mới; không cấp CREATE schema, không cho sửa bảng lịch sử migration. Điều này cần thiết vì dump được khôi phục với `--no-acl`. Môi trường dev dùng cùng role làm chủ dữ liệu có thể bỏ biến này. Sau restore, kiểm tra bằng chính tài khoản game và chạy startup recovery/getProfile trước khi chuyển backend sang database phục hồi; chỉ khớp hash bằng tài khoản quản trị chưa đủ để xác nhận game đọc được dữ liệu.

Với PostgreSQL trong Docker có thể tạo dump mà không mở cổng hoặc đưa mật khẩu vào câu lệnh:

```powershell
docker compose -p fishing-beta-m5 -f compose.beta.yaml exec -T postgres pg_dump -U fishing_admin -d fishing -Fc --no-owner --no-acl -f /tmp/fishing.dump
docker cp fishing-beta-m5-postgres-1:/tmp/fishing.dump .local/backups/docker-fishing.dump
```

Lệnh Docker này chỉ tạo dump, không thay cho quy trình kiểm tra manifest của script Node. Trước cập nhật: thông báo bảo trì, dừng app để kết thúc phòng, sao lưu và thử restore, chạy migration rồi app mới, kiểm tra readiness và gameplay. Giữ image cũ và backup đã thử. Không tự chạy migration ngược; nếu schema không tương thích, khôi phục vào database mới rồi đổi cấu hình trong thời gian bảo trì, chấp nhận mất dữ liệu phát sinh sau thời điểm backup đã chọn.

Database dev cũ của máy này được tạo bằng `db push`. Không chạy baseline migration tạo bảng trực tiếp vào đó. Trước chuyển sang migration: backup/restore thử, so schema bằng Prisma migrate diff; chỉ khi schema trùng hoàn toàn mới đánh dấu baseline `202611100001_baseline` đã áp dụng bằng `prisma migrate resolve --applied`. Database mới dùng `migrate deploy`, không dùng `db push` production.

## Chạy lại bộ kiểm chứng M5

```powershell
pnpm test
pnpm exec playwright test
pnpm exec playwright test -c playwright.cross.config.ts
node scripts/check-latency.mjs
```

Các bài trên cần `pnpm dev` + database test; tạo dữ liệu kiểm thử riêng. `check-release.mjs` **tắt/kill/restart app Docker** để kiểm tra khôi phục; chỉ chạy trên project beta thử nghiệm, không chạy trên production có người chơi. Cài trust CA cho tiến trình test Node bằng `NODE_EXTRA_CA_CERTS` trỏ bản copy CA local, không tắt kiểm tra TLS toàn cục. `benchmark-render.mjs` tạo 19 SDK guest và một browser, đo 8 hướng camera; `?diagnostics=1` bật dữ liệu đo, mặc định không bật.

Soak local trên đúng image Linux với HTTPS/WSS và PostgreSQL Docker:

```powershell
docker compose -p fishing-beta-m5 -f compose.beta.yaml -f deploy/compose.load.yaml up -d --wait
docker cp fishing-beta-m5-proxy-1:/data/caddy/pki/authorities/local/root.crt .local/beta/caddy-root.crt
$env:NODE_EXTRA_CA_CERTS=(Resolve-Path '.local/beta/caddy-root.crt').Path
$env:SOAK_MINUTES='60'
$env:SOAK_OUTPUT='.local/m5/soak-linux-60'
pnpm test:soak:beta
```

Overlay load chỉ mở cổng quản trị trên loopback cho harness. Giữ nguyên image/container suốt phép đo, không restart/migrate, không chạy kiểm thử phá kết nối cùng lúc. Bỏ overlay bằng `compose up` cấu hình bình thường sau khi phép đo kết thúc để đóng cổng. `/internal/metrics` vẫn bị Caddy chặn; harness truy cập cổng loopback có bearer. Kết quả ghi state/metrics/report, lỗi dừng phép đo và ghi failure; không tính lượt lỗi hoặc test ngắn thành 60 phút đạt.

CI trong `.github/workflows/checks.yml` khởi tạo PostgreSQL tạm, migrate, build, audit, unit test và browser test. Workflow đã được viết nhưng chưa chạy trên GitHub vì chưa push repository.

Workflow cố định phiên bản action đã đối chiếu từ release chính thức: [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [pnpm setup](https://github.com/pnpm/action-setup/releases/tag/v6.1.1), [Node setup](https://github.com/actions/setup-node/releases/tag/v7.1.0), [artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2). Token CI chỉ có quyền đọc nội dung.
