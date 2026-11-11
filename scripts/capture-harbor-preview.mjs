import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = ".local/harbor-v2";
const base = process.env.CAPTURE_URL ?? "http://127.0.0.1:5173";
// The standalone model preview is a development entry, not a production route.
const previewBase = process.env.ASSET_PREVIEW_URL ?? "http://127.0.0.1:5173";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args:
    process.platform === "win32"
      ? ["--use-angle=d3d11", "--use-gl=angle", "--disable-software-rasterizer"]
      : ["--enable-webgl"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({ version: 1, state: { soundMuted: true } }),
    ),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/?diagnostics=1");
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await page.getByRole("button", { name: "Thả câu" }).waitFor();
  await page.waitForTimeout(1500);
  const collapse = page.getByRole("button", { name: "Thu gọn hướng dẫn" });
  if (await collapse.isVisible()) await collapse.click();
  await page.screenshot({ path: output + "/dock.png" });
  await page.evaluate(() => window.__fishingDiagnostics.setCamera(0, 0.42));
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(5300);
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(900);
  await page.screenshot({ path: output + "/promenade.png" });
  await page.getByRole("button", { name: "Bản đồ", exact: true }).click();
  await page.getByRole("button", { name: "Bãi Biển", exact: true }).click();
  await page.getByRole("button", { name: "Dịch chuyển", exact: true }).click();
  await page.evaluate(() => window.__fishingDiagnostics.setCamera(0.48, 0.34));
  await page.getByRole("button", { name: "Thả câu" }).waitFor();
  await page.getByRole("button", { name: "Thả câu" }).click();
  await page.getByText("Thư thả một chút, cá đang đến.").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: output + "/fishing.png" });
  await page.getByRole("button", { name: "Thu cần", exact: true }).click();
  await page.close();
  const preview = await context.newPage();
  await preview.goto(previewBase + "/asset-preview.html");
  await preview.waitForFunction(() => typeof window.renderAsset === "function");
  await preview.evaluate(() => window.renderAsset("character-sailor", 768));
  await preview
    .locator("canvas")
    .screenshot({ path: output + "/character.png", omitBackground: true });
  await writeFile(
    output + "/preview.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        url: base,
        characterPreviewUrl: previewBase,
        quality: "high, cached static shadows",
        errors,
        files: ["dock.png", "promenade.png", "fishing.png", "character.png"],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ errors, output }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
