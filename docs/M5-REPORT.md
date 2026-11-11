# Báo cáo M5 local — Fishing World Online

Ngày ghi nhận: 2026-11-11T02:09:41.867Z. **Đã chuẩn bị Vercel + backend riêng; chưa phát hành beta công khai.** Kết quả dưới đây là phép đo local, không thay cho nghiệm thu trên môi trường triển khai thật.

## Tải và tính đúng dữ liệu

- Soak Linux/Docker: **passed**, 20 client trong 60.12 phút qua HTTPS/WSS; một phòng có đi lại, chat, emote, câu, mua/bán/trang bị và reconnect có chủ đích.
- 5066 lượt thả, 3790 cá lưu, 1402 giao dịch bán, 523 lần mua, 19 reconnect; 0 mất kết nối ngoài dự kiến, 0 sự kiện cá trùng; lỗi: [].
- Đối chiếu transaction: 0 sai lệch cá/XP/Xu/ledger/album/kỷ lục/mồi/lượt ACTIVE. RSS lớn nhất 133.8 MiB; CPU mẫu lớn nhất 110.7% theo quy ước process.cpuUsage (100% = một lõi); event-loop p99 lớn nhất trong các mẫu 24.5 ms.
- Trước đó lượt native Windows dừng khoảng phút 45 do một API sale-quote trả 503, nên **không đạt 60 phút**. Đối chiếu sau dừng không lệch tài sản, không còn ACTIVE. Log PostgreSQL Windows có lỗi cấp phát shared memory gần thời điểm lỗi; chưa đủ bằng chứng quy nguyên nhân dứt khoát. Giữ riêng failure/metrics, không cộng thời gian các lượt để tuyên bố đạt.
- Một lượt thử sớm khác phát hiện advisory lock dùng connection pool bị thu hồi theo lifetime. Đã chuyển khóa sang connection pg riêng có heartbeat, rồi mới chạy các lượt trên.

## Kiểm thử chức năng và vận hành

24 unit test, 20 Chromium browser/integration và 2 luồng gameplay Firefox/WebKit đã qua trên máy Windows. Có test cookie hash/origin/ticket/payload/frame/rate limit, mất/khôi phục WebGL, toàn bộ 39 GLB, gameplay hai người, kinh tế đồng thời/gửi lại/mất phản hồi và giao diện dọc/ngang. WebKit được sửa lỗi khởi tạo WebSocket trong SDK bằng pnpm patch; khởi động lại Vite để loại cache dependency cũ. Bài thử quan sát người thứ hai ở foreground vì WebKit dừng frame 3D trong tab nền.

Audit dependency: {"info":0,"low":0,"moderate":0,"high":0,"critical":0}. Bản dependency đã khóa và có patch tương thích nanoid/Colyseus; kết quả audit chỉ có giá trị tại thời điểm chạy.

TCP proxy kiểm tra RTT 50/150/300 ms với jitter ±10 ms mỗi chiều: phản ứng 900 ms bắt được cá; giật sớm bị từ chối. Unit test kiểm tra biên mở/đóng và giới hạn bù 150 ms. Test reconnect riêng bao gồm sau commit và hết cửa sổ. Đây không phải mô phỏng đầy đủ mất gói hoặc mạng di động thực.

Production image Linux qua Caddy HTTPS local CA đã kiểm tra cookie Secure/HttpOnly/__Host, CSP, metrics riêng, UID 10001 và role database không có superuser/createdb/createrole/schema-create. Kill ngay sau commit vẫn giữ cá/XP, không hoàn mồi đã dùng; lượt chưa chốt hoàn mồi đúng một lần sau startup. Dừng có trật tự và restart lần hai không nhân thưởng/hoàn mồi. Backend thứ hai dùng cùng DB bị từ chối trước khi khôi phục lượt.

Vercel bridge được kiểm tra trong browser ở origin frontend riêng, dùng build Vite thực và HTTP proxy handler thực nối backend HTTPS/WSS local. Cookie chỉ ở frontend, backend không cần cookie bên thứ ba; tải lại túi và POST bán cá giữ đúng XP. Frontend hosting được chặn route local và cấp quyền local-network cho fixture; chưa chạy trên hạ tầng Vercel.

Backup đang có tải và restore vào DB mới khớp hash **14 bảng**, bao gồm bảng migration. Hai bản backup native trước đó khớp 13 bảng. Restore từ chối dump sai SHA-256 và database đích đã tồn tại. Dump chứa dữ liệu riêng, được giữ trong .local; báo cáo này không đóng gói dump/token.

Database phục hồi được cấp lại quyền cho role fishing_app qua RESTORE_APP_ROLE (không có quyền quản trị/schema-create). Sau đó chạy recoverFishing và getProfile thực bằng chính role này: giữ nguyên 209 cá đã khôi phục, đọc đúng cá/XP/Xu, không còn ACTIVE. Cài mới từ database trống cũng đã chạy migration và kiểm tra role app đọc/ghi được mà không có quyền tạo schema/database/role.

## Đồ họa

20 guest, viewport 1280×800, DPR 1, chất lượng thấp, giới hạn chọn 60 FPS, 8 góc yaw. Trước tối ưu tối đa 530 draw call, sau tối đa **170**, giảm 67.9%. Ghép mesh tĩnh/nhân vật bằng màu vertex, instancing và frustum culling; giữ rig sáu bone. Cả bốn ngoại hình được kiểm tra dưới 8.000 triangle. Dữ liệu resource nén đã quan sát 3.39 MB; thời gian sẵn sàng 4.75 giây trên máy này.

| Yaw | Draw call lớn nhất | Triangle lớn nhất | FPS trung bình | Frame p95 (ms) |
| --- | --- | --- | --- | --- |
| 0° | 170 | 158,248 | 7.8 | 142.4 |
| 45° | 149 | 155,487 | 12.8 | 119.6 |
| 90° | 124 | 148,451 | 9.6 | 113.4 |
| 135° | 135 | 150,096 | 9.3 | 121.2 |
| 180° | 113 | 142,032 | 8.5 | 130.6 |
| 225° | 88 | 132,234 | 12.4 | 124.8 |
| 270° | 114 | 145,105 | 7.3 | 148.6 |
| 315° | 123 | 145,347 | 9.0 | 117.6 |

Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver). **SwiftShader là GPU phần mềm**; FPS bảng này không xác nhận mục tiêu desktop 60 / mobile 30 FPS. Lượt GPU thật được ghi riêng bên dưới; Android tầm trung và Safari iOS chưa thử. Tám góc là mẫu đo, chưa thay cho mọi góc pitch/trạng thái nhiều người đồng loạt cắn/khoe cá.

Đo bổ sung bằng **ANGLE (Intel, Intel(R) UHD Graphics 730 (0x00004692) Direct3D11 vs_5_0 ps_5_0, D3D11)**, cùng production client build ở HTTP loopback backend dev riêng để không thêm người vào phòng soak: 20 guest, 1280×800, DPR 1, chất lượng thấp, giảm chuyển động, chọn 60 FPS, 8 hướng yaw. FPS trung bình theo góc **59.7–60.0**, frame p95 lớn nhất 19.3 ms, tối đa 171 draw call, lỗi JS 0. Renderer được xác nhận Intel Direct3D11, không fallback phần mềm. Đây là số đo desktop headless có GPU thật cho cấu hình cụ thể này; không chứng nhận điện thoại, mọi độ phân giải/chất lượng hoặc trải nghiệm bằng tay. Dữ liệu HTTP trực tiếp không có Caddy nén nên không dùng số byte của lượt này thay cho ngân sách tải nén.

## Bàn giao và các phần chưa nghiệm thu

- [Hướng dẫn Vercel/backend, backup và vận hành](DEPLOYMENT.md), vercel.json, Dockerfile, Compose/Caddy, env mẫu và GitHub Actions đã có. CI chưa thực thi trên GitHub vì chưa push.
- [Phiếu thử thiết bị và 5 người mới](PLAYTEST.md) chưa có kết quả thực tế; chưa xác nhận mục tiêu 4/5 người bắt cá đầu trong 3 phút hoặc cân bằng kinh tế.
- Chưa có VPS/URL backend, domain hoặc project Vercel; theo lựa chọn của người dùng chỉ chuẩn bị cấu hình triển khai sau. Cần nghiệm thu lại trên môi trường public trước khi đánh dấu M5 phát hành đạt.
- Các phần còn từ mốc trước: camera bị vật che, prediction/reconciliation khi mạng trễ, animation Blender và chất lượng model gần concept hơn. M5 local không tự đánh dấu các mục đó hoàn thành.

Dữ liệu tổng hợp đọc máy: [validation/m5.json](validation/m5.json). Evidence thô, ảnh và metrics nằm tại .local/m5, không được commit hoặc upload lên Vercel.
