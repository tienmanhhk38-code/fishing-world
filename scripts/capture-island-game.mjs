import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const base = process.env.CAPTURE_URL ?? "http://127.0.0.1:5173",
  out = ".local/island-v3";
const b = await chromium.launch({
  args: [
    "--use-angle=d3d11",
    "--use-gl=angle",
    "--disable-software-rasterizer",
  ],
});
try {
  const c = await b.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await c.addInitScript(() =>
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({
        version: 1,
        state: { soundMuted: true, quality: "high" },
      }),
    ),
  );
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 500));
  });
  await p.goto(base + "/?diagnostics=1");
  await p.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await p.getByRole("button", { name: "Tạo phòng mới", exact: true }).click();
  await p.getByRole("button", { name: "Thả câu" }).waitFor();
  const guide = p.getByRole("button", { name: "Thu gọn hướng dẫn" });
  if (await guide.isVisible()) await guide.click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + "/game-dock.png" });
  await p.getByRole("button", { name: "Thả câu" }).click();
  await p.getByText("Thư thả một chút, cá đang đến.").waitFor();
  await p.screenshot({ path: out + "/game-fishing.png" });
  await p.getByRole("button", { name: "Thu cần", exact: true }).click();
  await p.getByRole("button", { name: "Bản đồ", exact: true }).click();
  await p.screenshot({ path: out + "/game-map.png" });
  await p.getByRole("button", { name: "Làng Chài", exact: true }).click();
  await p.getByRole("button", { name: "Dịch chuyển", exact: true }).click();
  await p.evaluate(() =>
    window.__fishingDiagnostics.setCamera(-Math.PI / 2, 0.4),
  );
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + "/game-pond.png" });
  await p.getByRole("button", { name: "Thả câu" }).click();
  await p.getByText("Thư thả một chút, cá đang đến.").waitFor();
  await p.screenshot({ path: out + "/game-pond-fishing.png" });
  await p.getByRole("button", { name: "Thu cần", exact: true }).click();
  await writeFile(
    out + "/game-preview.json",
    JSON.stringify({ at: new Date().toISOString(), base, errors }, null, 2),
  );
  console.log(JSON.stringify({ base, errors }));
  if (errors.length) process.exitCode = 1;
} finally {
  await b.close();
}
