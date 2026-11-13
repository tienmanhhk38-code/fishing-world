# Tài liệu Fishing World Online

Đối chiếu source ngày **13/11/2026**. Đây là game câu cá 3D multiplayer trên trình duyệt: vào bằng phiên khách, chọn phòng, khám phá đảo, câu/bán cá, mua trang bị và nhận thưởng nhiệm vụ. Server lưu tiến trình trong PostgreSQL; trạng thái phòng đang chơi nằm trong bộ nhớ backend, cảnh 3D được render tại client.

## Đọc theo nhu cầu

| Tài liệu | Nội dung |
| --- | --- |
| [README dự án](../README.md) | Giới thiệu và thao tác chơi |
| [AGENTS](../AGENTS.md) | Điểm sửa code, nguyên tắc và cách bàn giao cho Developer/AI Agent |
| [FEATURES](FEATURES.md) | Tính năng và giới hạn đang có trong code |
| [ARCHITECTURE](ARCHITECTURE.md) | Module, luồng realtime, giao dịch và recovery |
| [PROTOCOL-DATA](PROTOCOL-DATA.md) | HTTP API, WebSocket message và các nhóm bảng dữ liệu |
| [DEVELOPMENT](DEVELOPMENT.md) | Thiết lập local, build, test, asset và xử lý lỗi thường gặp |
| [PRODUCTION](PRODUCTION.md) | Cấu hình Vercel + Render + Neon theo repository |
| [DEPLOYMENT](DEPLOYMENT.md) | Docker/VPS, backup/restore và harness beta |
| [PLAYTEST](PLAYTEST.md) | Hạng mục cần người chơi và thiết bị thật nghiệm thu |
| [FRESHWATER-MODELS](FRESHWATER-MODELS.md) | Nguồn dựng, ảnh tham chiếu và QA 15 model cá nước ngọt |

## Công nghệ

Phiên bản dưới đây là khai báo trong manifests, không phải cam kết tương thích với các bản mới hơn.

| Thành phần | Công nghệ |
| --- | --- |
| Runtime/workspace | Node.js `22.x`, pnpm `12.18.0`, pnpm workspaces |
| Ngôn ngữ | TypeScript `~5.8.3`, strict, ESM |
| Client | React `^19.1.0`, Vite `^6.3.5`, Zustand `^5.0.8` |
| Đồ họa | Three.js `^0.180.0`, React Three Fiber `^9.3.0`, Drei `^10.7.6`, GLB |
| Backend/realtime | Express `^4.21.2`, Colyseus core `0.16.26`, WebSocket transport |
| Database/validation | PostgreSQL (Compose dùng 17), Prisma `6.19.0`, `pg`, Zod |
| Build/QA | esbuild, Vitest `4.1.12`, Playwright `^1.51.1`, GitHub Actions |
| Cấu hình triển khai | Docker Compose/Caddy; Vercel frontend/proxy; Render backend; Neon PostgreSQL |

Nguồn: các `package.json`, [workspace](../pnpm-workspace.yaml), [TypeScript](../tsconfig.json), [Compose](../compose.yaml). Phiên bản resolve nằm trong `pnpm-lock.yaml`; workspace có overrides và hai patch Colyseus cần giữ khi cài đặt.

## Cấu trúc thư mục

```text
apps/
  client/src/          UI React, scene 3D, network, âm thanh, art authoring
  client/public/       GLB, thumbnail, UI image, WAV và MP3
  server/src/          HTTP, phòng Colyseus, economy, social, security
  server/prisma/       Schema và SQL migrations
packages/shared/src/  Type, catalog, map/collision, movement, fishing, quest, resident
api/                  Vercel Functions HTTP bridge
deploy/               Caddy, env ví dụ, khởi tạo role/quyền database
scripts/              Build, backup/restore, chụp ảnh, benchmark, soak/release
tests/                Vitest unit test
  browser/            Playwright UI, API và integration với database
patches/              Bản vá dependency được pnpm áp dụng
.github/workflows/    CI build, audit, test và latency
design/reference/     Tài liệu hình ảnh tham chiếu
docs/                 Hướng dẫn, báo cáo, images/ và validation/
.local/               Dữ liệu/log/secret/backup local, bị Git bỏ qua
```

Root chứa cấu hình build/test, `Dockerfile`, `compose*.yaml`, `render.yaml`, `vercel.json`. Không coi `node_modules/`, `dist/` hoặc dữ liệu `.local/` là source.

## Tài liệu lịch sử

- [PROJECT-HISTORY](PROJECT-HISTORY.md), [M5-REPORT](M5-REPORT.md): các mốc và số đo cũ.
- [ISLAND-MASTERPLAN](ISLAND-MASTERPLAN.md), [ART-PASS](ART-PASS.md): bố cục đảo và nguồn tạo mỹ thuật.
- [EXPERIENCE-UPGRADE](EXPERIENCE-UPGRADE.md), [ISLAND-EXPERIENCE-V5](ISLAND-EXPERIENCE-V5.md), [RESIDENTS-UI-FOLLOWUP](RESIDENTS-UI-FOLLOWUP.md): nâng cấp gameplay/NPC.
- [FISH-V6](FISH-V6.md), [HUD-LAYOUT-V7](HUD-LAYOUT-V7.md), [POPUPS-MOBILE-V8](POPUPS-MOBILE-V8.md), [VIEWPORT-AUDIO-V9](VIEWPORT-AUDIO-V9.md): thay đổi và kiểm chứng theo từng đợt.

Các báo cáo mô tả thời điểm thực hiện. Khi số liệu/hành vi khác nhau, đối chiếu source và cấu hình hiện tại; kết quả local không chứng minh production hoặc thiết bị thật đã đạt.
