# Giao thức và dữ liệu

Nguồn hợp đồng: [shared index](../packages/shared/src/index.ts), [catalog](../packages/shared/src/catalog.ts), [social types](../packages/shared/src/social.ts). Schema kiểm tra runtime nằm trong handler server; bảng dưới là bản đồ tra cứu, không thay cho schema đó.

## HTTP API

Client gọi `/api/*` cùng origin. Khi tách frontend, [Vercel bridge](../api/%5B...path%5D.ts) chỉ chuyển tiếp route/method trong allowlist, Cookie và Set-Cookie; backend origin lấy từ `GAME_SERVER_URL`.

| Method/route | Input chính | Kết quả/mục đích |
| --- | --- | --- |
| `GET /api/guest` | Cookie nếu có | Tạo/khôi phục guest; `{ ticket, profile }`, đặt cookie |
| `GET /api/rooms` | Không có body | Danh sách phòng, số client, sức chứa, locked |
| `GET /api/catalog` | Không có body | Species, rods, baits |
| `GET /api/profile` | Cookie bắt buộc | `Profile` hiện tại |
| `POST /api/sale-quote` | `{ fishId?: UUID }` | Quote cho một cá hoặc tất cả cá chưa bán, hiệu lực 10 phút |
| `POST /api/economy` | `{ requestId: UUID, ...EconomyAction }` | Thành công: `{ ok, message, profile }` |
| `POST /api/quests/claim` | `{ questId, period, requestId: UUID }` | `{ message, profile }` sau kiểm tra/nhận thưởng |
| `POST /api/character` | `{ name, appearanceId }` | `{ profile }`; tên chuẩn hóa 2–20 ký tự, 4 appearance hợp lệ |

Các POST dùng cookie; production kiểm tra origin và HTTPS. `EconomyAction` gồm `sell { quoteId }`, `buyRod/equipRod { itemId }`, `buyBait { itemId, quantity }`, `equipBait { itemId }`, `viewShop`. Số lượng mua mồi là 1–100, không mua mồi thường vô hạn.

Lỗi HTTP thường có `{ error }`; economy thất bại nghiệp vụ có thể kèm profile. Middleware còn trả 403/413/426/429/503 theo nguồn yêu cầu, kích thước, HTTPS, rate hoặc trạng thái dịch vụ; không giả định mọi lỗi đều là cùng một status.

Endpoint vận hành chỉ trên backend: `GET /healthz` kiểm tra lifecycle, `GET /readyz` kiểm tra thêm DB, `GET /internal/metrics` cần `Authorization: Bearer ...` hợp lệ. Không có token metrics thì endpoint trả 404.

## Matchmaking và WebSocket

Room type là `beach`. Colyseus SDK dùng `/matchmake/{create|joinOrCreate|joinById|reconnect}/{target}`. Tạo/join dùng ticket từ guest API; reconnect dùng `reconnectionToken`. Không tự tạo guest ID hoặc truyền cookie qua WebSocket để thay ticket.

| Client → server | Payload/ý nghĩa |
| --- | --- |
| `PLAYER_INPUT` | `{ x, z, sprint?, seq? }`; hướng hữu hạn trong [-1,1], sequence tăng |
| `PLAYER_JUMP` | `{ seq }`; server kiểm tra sequence, phase và grounded |
| `TELEPORT_REQUEST` | `{ destination? , area? }`; dùng ID trong shared, server kiểm tra điểm mở |
| `FISH_START` | Body rỗng; server kiểm tra vị trí và bắt đầu lượt |
| `FISH_HOOK` | `{ roundId: UUID }`; server kiểm tra cửa sổ giật |
| `FISH_CANCEL`, `FISH_CONTINUE`, `FISH_STOW` | Thu cần, câu tiếp từ RESULT, hoặc cất cá |
| `FISH_SHOWCASE_REQUEST` | `{ fishId?: string }`; thiếu ID dùng con vừa câu |
| `CHAT_SEND` | `{ requestId: UUID, text, channel? }`; channel mặc định world |
| `MUTE_SET` | `{ requestId: UUID, targetId: UUID, muted: boolean }` |
| `REPORT_SEND` | `{ requestId: UUID, targetId: UUID, reason, detail }`; detail bắt buộc, có thể rỗng |
| `EMOTE_SEND` | `{ requestId: UUID, emoteId }`; ID hợp lệ trong shared |
| `PONG` | Nonce từ PING |
| `LEAVE_GAME` | Kết thúc phiên chơi để về lobby |

| Server → client | Nội dung |
| --- | --- |
| `WELCOME`, `SESSION`, `PROFILE` | ID phiên/phòng; player/round/profile/result để đồng bộ và reconnect |
| `WORLD` | Mảng `Player` (người thật, NPC và bot), gồm pose/phase và timestamp |
| `FISH_STARTED`, `FISH_CUE` | Round ID, phase/timing/window hiển thị |
| `FISH_HOOK_CONFIRMED` | Timing/seed kéo cá |
| `FISH_RESULT`, `FISH_ESCAPED`, `FISH_ENDED` | Cá đã nhận, cá thoát, hoặc kết thúc lượt |
| `SHOWCASE_STARTED`, `SHOWCASE_ERROR` | Xác nhận cá khoe hoặc thông báo lỗi |
| `SOCIAL_STATE`, `ROOM_MEMBERS`, `CHAT_MESSAGE` | State cộng đồng, thành viên và tin nhắn |
| `SOCIAL_ACK`, `CHAT_MODERATION`, `EMOTE` | Xác nhận theo request ID, mute tới thời điểm, biểu cảm |
| `TELEPORT_RESULT`, `LOBBY_READY` | Kết quả chuyển vị trí hoặc cho phép về lobby |
| `PING`, `RTT`, `NOTICE`, `ANNOUNCEMENT` | Đo mạng và thông báo |

ID của actor/player trong phòng là `sessionId`; ID tài khoản bền vững là `Guest.id`, xuất hiện dưới `publicId` của thành viên và `senderId` tin nhắn. Không dùng hai loại ID thay thế nhau.

## Database

Nguồn: [schema.prisma](../apps/server/prisma/schema.prisma); migrations lần lượt là baseline, experience và nearby_chat trong `apps/server/prisma/migrations/`.

| Nhóm bảng | Vai trò/ràng buộc đáng chú ý |
| --- | --- |
| `Guest` | Token hash unique, ngoại hình, tài sản, `revision`, active round, tutorial và hạn mute/ban |
| `FishingRound` | Owner, status, area/bait, `selected`/`plan` JSON, thời điểm hook và kết thúc kéo |
| `Fish` | Một cá/lượt qua `roundId` unique; cân nặng gram, giá/XP đã lưu, `soldAt` giữ lịch sử bán |
| `OwnedRod`, `BaitStock`, `Album` | Khóa ghép guest/item hoặc guest/species; sở hữu, tồn mồi, số lần bắt và kỷ lục |
| `SaleQuote` | Snapshot danh sách fish ID, tổng giá và hạn dùng |
| `EconomyOperation` | Unique guest/requestId, fingerprint, kết quả nghiệp vụ để replay |
| `CoinLedger` | Biến động Xu với operationId unique |
| `QuestProgress`, `QuestClaim` | Tiến độ theo metric/period; claim unique guest/quest/period và guest/requestId |
| `ChatMessage` | Nội dung, channel/phòng, danh tính tại lúc gửi; unique guest/requestId |
| `PlayerMute`, `PlayerReport`, `ModerationLog` | Mute cá nhân, báo cáo có evidence, log quản trị |

Chỉ `Guest`–`Fish`–`FishingRound` được khai báo relation Prisma; nhiều bảng còn lại giữ `guestId` dạng String mà không khai báo foreign key relation. Không suy ra cascade delete hoặc quan hệ DB từ tên cột.

`FishingRound.status` là String, được domain dùng các giá trị `ACTIVE`, `REELING`, `COMMITTED`, `ESCAPED`, `CANCELLED`, `INTERRUPTED`; không phải Prisma enum. `Phase` realtime chi tiết hơn và không lưu từng cue vào DB. Rarity, tên/đặc tính loài và cấp độ được suy từ catalog/XP; không có bảng catalog riêng.

## Lưu trong trình duyệt

- Cookie session HttpOnly: danh tính khách; DB chỉ giữ hash của token.
- `sessionStorage`: `fishing-room` (reconnection token), `fishing-pending-operation` (giao dịch cần retry).
- Zustand persist/localStorage: `fishing-player-settings` (đồ họa/âm thanh/camera).
- Snapshot, emote, nearby speech và animation state: bộ nhớ client. Chúng không thay cho dữ liệu tài sản trong PostgreSQL.
