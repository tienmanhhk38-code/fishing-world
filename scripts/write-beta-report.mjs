import { readFile, writeFile, mkdir } from "node:fs/promises";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const soak = await read(
  process.env.SOAK_REPORT ?? ".local/m5/soak-linux-60/report.json",
);
const before = await read(".local/m5/render-before-verified.json"),
  render = await read(".local/m5/render-final.json");
const hardware = await read(".local/m5/render-intel.json");
const latency = await read(".local/m5/latency.json"),
  release = await read(".local/m5/release.json"),
  bridge = await read(".local/m5/vercel-bridge.json"),
  audit = await read(".local/m5/audit-final.json");
const backup = await read(".local/m5/linux-live.dump.restore-report.json"),
  aborted = await read(".local/m5/soak60-final/failure.json"),
  integrity = await read(".local/m5/soak60-final/integrity-after-abort.json");
const restoredApplication = await read(".local/m5/restored-application.json");
const maxCalls = Math.max(...render.views.map((view) => view.maxDrawCalls));
const result = {
  recordedAt: new Date().toISOString(),
  releaseStatus:
    "Prepared and validated locally; public deployment, mobile-device QA and human playtest pending.",
  tests: {
    unit: 24,
    chromiumBrowserAndIntegration: 20,
    firefoxAndWebkitGameplay: 2,
    ciExecutedOnGithub: false,
  },
  audit: audit.metadata.vulnerabilities,
  soak,
  render: {
    ...render,
    baselineMaxDrawCalls: Math.max(
      ...before.views.map((view) => view.maxDrawCalls),
    ),
    maxDrawCalls: maxCalls,
  },
  hardwareRender: hardware,
  latency,
  release,
  bridge,
  backup: {
    status: backup.status,
    tables: Object.keys(backup.tables).length,
    sourceSha256: backup.sourceSha256,
  },
  restoredApplication,
  priorAbortedWindowsRun: {
    status: "failed",
    reason: aborted.error,
    stats: aborted.stats,
    integrity,
  },
  remaining: [
    "Public Vercel/backend deployment and environment-specific soak",
    "Midrange Android / Safari iOS FPS and input; desktop manual visual QA and additional resolutions/quality modes",
    "Five new-player playtests and economy pacing",
    "Previously recorded M1 camera occlusion and local movement prediction/reconciliation",
  ],
};
await mkdir("docs/validation", { recursive: true });
await writeFile("docs/validation/m5.json", JSON.stringify(result, null, 2));
const table = render.views
  .map(
    (view) =>
      `| ${view.angleDegrees}° | ${view.maxDrawCalls} | ${view.maxTriangles.toLocaleString("en-US")} | ${view.fpsMean.toFixed(1)} | ${view.frameP95Ms.toFixed(1)} |`,
  )
  .join("\n");
const md = `# Báo cáo M5 local — Fishing World Online

Ngày ghi nhận: ${result.recordedAt}. **Đã chuẩn bị Vercel + backend riêng; chưa phát hành beta công khai.** Kết quả dưới đây là phép đo local, không thay cho nghiệm thu trên môi trường triển khai thật.

## Tải và tính đúng dữ liệu

- Soak Linux/Docker: **${soak.status}**, ${soak.players} client trong ${(soak.durationSeconds / 60).toFixed(2)} phút qua ${soak.transport}; một phòng có đi lại, chat, emote, câu, mua/bán/trang bị và reconnect có chủ đích.
- ${soak.stats.casts} lượt thả, ${soak.integrity.fish} cá lưu, ${soak.stats.sales} giao dịch bán, ${soak.stats.purchases} lần mua, ${soak.stats.reconnects} reconnect; ${soak.stats.unexpectedDisconnects} mất kết nối ngoài dự kiến, ${soak.stats.duplicateCatchEvents} sự kiện cá trùng; lỗi: ${JSON.stringify(soak.stats.errors)}.
- Đối chiếu transaction: ${soak.integrity.failures.length} sai lệch cá/XP/Xu/ledger/album/kỷ lục/mồi/lượt ACTIVE. RSS lớn nhất ${soak.measurements.maxRssMiB.toFixed(1)} MiB; CPU mẫu lớn nhất ${soak.measurements.maxCpuPercent.toFixed(1)}% theo quy ước process.cpuUsage (100% = một lõi); event-loop p99 lớn nhất trong các mẫu ${soak.measurements.maxEventLoopP99Ms.toFixed(1)} ms.
- Trước đó lượt native Windows dừng khoảng phút 45 do một API sale-quote trả 503, nên **không đạt 60 phút**. Đối chiếu sau dừng không lệch tài sản, không còn ACTIVE. Log PostgreSQL Windows có lỗi cấp phát shared memory gần thời điểm lỗi; chưa đủ bằng chứng quy nguyên nhân dứt khoát. Giữ riêng failure/metrics, không cộng thời gian các lượt để tuyên bố đạt.
- Một lượt thử sớm khác phát hiện advisory lock dùng connection pool bị thu hồi theo lifetime. Đã chuyển khóa sang connection pg riêng có heartbeat, rồi mới chạy các lượt trên.

## Kiểm thử chức năng và vận hành

24 unit test, 20 Chromium browser/integration và 2 luồng gameplay Firefox/WebKit đã qua trên máy Windows. Có test cookie hash/origin/ticket/payload/frame/rate limit, mất/khôi phục WebGL, toàn bộ 39 GLB, gameplay hai người, kinh tế đồng thời/gửi lại/mất phản hồi và giao diện dọc/ngang. WebKit được sửa lỗi khởi tạo WebSocket trong SDK bằng pnpm patch; khởi động lại Vite để loại cache dependency cũ. Bài thử quan sát người thứ hai ở foreground vì WebKit dừng frame 3D trong tab nền.

Audit dependency: ${JSON.stringify(result.audit)}. Bản dependency đã khóa và có patch tương thích nanoid/Colyseus; kết quả audit chỉ có giá trị tại thời điểm chạy.

TCP proxy kiểm tra RTT 50/150/300 ms với jitter ±10 ms mỗi chiều: phản ứng 900 ms bắt được cá; giật sớm bị từ chối. Unit test kiểm tra biên mở/đóng và giới hạn bù 150 ms. Test reconnect riêng bao gồm sau commit và hết cửa sổ. Đây không phải mô phỏng đầy đủ mất gói hoặc mạng di động thực.

Production image Linux qua Caddy HTTPS local CA đã kiểm tra cookie Secure/HttpOnly/__Host, CSP, metrics riêng, UID 10001 và role database không có superuser/createdb/createrole/schema-create. Kill ngay sau commit vẫn giữ cá/XP, không hoàn mồi đã dùng; lượt chưa chốt hoàn mồi đúng một lần sau startup. Dừng có trật tự và restart lần hai không nhân thưởng/hoàn mồi. Backend thứ hai dùng cùng DB bị từ chối trước khi khôi phục lượt.

Vercel bridge được kiểm tra trong browser ở origin frontend riêng, dùng build Vite thực và HTTP proxy handler thực nối backend HTTPS/WSS local. Cookie chỉ ở frontend, backend không cần cookie bên thứ ba; tải lại túi và POST bán cá giữ đúng XP. Frontend hosting được chặn route local và cấp quyền local-network cho fixture; chưa chạy trên hạ tầng Vercel.

Backup đang có tải và restore vào DB mới khớp hash **${Object.keys(backup.tables).length} bảng**, bao gồm bảng migration. Hai bản backup native trước đó khớp 13 bảng. Restore từ chối dump sai SHA-256 và database đích đã tồn tại. Dump chứa dữ liệu riêng, được giữ trong .local; báo cáo này không đóng gói dump/token.

Database phục hồi được cấp lại quyền cho role fishing_app qua RESTORE_APP_ROLE (không có quyền quản trị/schema-create). Sau đó chạy recoverFishing và getProfile thực bằng chính role này: giữ nguyên ${restoredApplication.restoredFish} cá đã khôi phục, đọc đúng cá/XP/Xu, không còn ACTIVE. Cài mới từ database trống cũng đã chạy migration và kiểm tra role app đọc/ghi được mà không có quyền tạo schema/database/role.

## Đồ họa

20 guest, viewport 1280×800, DPR 1, chất lượng thấp, giới hạn chọn 60 FPS, 8 góc yaw. Trước tối ưu tối đa 530 draw call, sau tối đa **${maxCalls}**, giảm ${(100 * (1 - maxCalls / 530)).toFixed(1)}%. Ghép mesh tĩnh/nhân vật bằng màu vertex, instancing và frustum culling; giữ rig sáu bone. Cả bốn ngoại hình được kiểm tra dưới 8.000 triangle. Dữ liệu resource nén đã quan sát ${(render.encodedResourceBytes / 1e6).toFixed(2)} MB; thời gian sẵn sàng ${(render.readyMs / 1000).toFixed(2)} giây trên máy này.

| Yaw | Draw call lớn nhất | Triangle lớn nhất | FPS trung bình | Frame p95 (ms) |
| --- | --- | --- | --- | --- |
${table}

Renderer: ${render.renderer.renderer}. **SwiftShader là GPU phần mềm**; FPS bảng này không xác nhận mục tiêu desktop 60 / mobile 30 FPS. Lượt GPU thật được ghi riêng bên dưới; Android tầm trung và Safari iOS chưa thử. Tám góc là mẫu đo, chưa thay cho mọi góc pitch/trạng thái nhiều người đồng loạt cắn/khoe cá.

Đo bổ sung bằng **${hardware.renderer.renderer}**, cùng production client build ở HTTP loopback backend dev riêng để không thêm người vào phòng soak: 20 guest, 1280×800, DPR 1, chất lượng thấp, giảm chuyển động, chọn 60 FPS, 8 hướng yaw. FPS trung bình theo góc **${Math.min(...hardware.views.map((view) => view.fpsMean)).toFixed(1)}–${Math.max(...hardware.views.map((view) => view.fpsMean)).toFixed(1)}**, frame p95 lớn nhất ${Math.max(...hardware.views.map((view) => view.frameP95Ms)).toFixed(1)} ms, tối đa ${Math.max(...hardware.views.map((view) => view.maxDrawCalls))} draw call, lỗi JS ${hardware.errors.length}. Renderer được xác nhận Intel Direct3D11, không fallback phần mềm. Đây là số đo desktop headless có GPU thật cho cấu hình cụ thể này; không chứng nhận điện thoại, mọi độ phân giải/chất lượng hoặc trải nghiệm bằng tay. Dữ liệu HTTP trực tiếp không có Caddy nén nên không dùng số byte của lượt này thay cho ngân sách tải nén.

## Bàn giao và các phần chưa nghiệm thu

- [Hướng dẫn Vercel/backend, backup và vận hành](DEPLOYMENT.md), vercel.json, Dockerfile, Compose/Caddy, env mẫu và GitHub Actions đã có. CI chưa thực thi trên GitHub vì chưa push.
- [Phiếu thử thiết bị và 5 người mới](PLAYTEST.md) chưa có kết quả thực tế; chưa xác nhận mục tiêu 4/5 người bắt cá đầu trong 3 phút hoặc cân bằng kinh tế.
- Chưa có VPS/URL backend, domain hoặc project Vercel; theo lựa chọn của người dùng chỉ chuẩn bị cấu hình triển khai sau. Cần nghiệm thu lại trên môi trường public trước khi đánh dấu M5 phát hành đạt.
- Các phần còn từ mốc trước: camera bị vật che, prediction/reconciliation khi mạng trễ, animation Blender và chất lượng model gần concept hơn. M5 local không tự đánh dấu các mục đó hoàn thành.

Dữ liệu tổng hợp đọc máy: [validation/m5.json](validation/m5.json). Evidence thô, ảnh và metrics nằm tại .local/m5, không được commit hoặc upload lên Vercel.
`;
await writeFile("docs/M5-REPORT.md", md);
console.log("Wrote docs/M5-REPORT.md and docs/validation/m5.json.");
