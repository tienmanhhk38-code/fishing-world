// Capture the map's destination cards from the authored island, without a game server.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  args: [
    "--use-angle=d3d11",
    "--use-gl=angle",
    "--disable-software-rasterizer",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 512, height: 256 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    `${process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:5173"}/island-preview.html`,
  );
  await page.waitForFunction(() => typeof window.setIslandView === "function");
  await page.waitForTimeout(3000);
  await mkdir("apps/client/public/assets/ui/destinations", { recursive: true });
  for (const [id, view] of [
    ["dock", "dock"],
    ["beach", "sea"],
    ["village", "map-village"],
    ["pond", "map-pond"],
    ["lighthouse", "lighthouse"],
  ]) {
    await page.evaluate((view) => window.setIslandView(view), view);
    await page.waitForTimeout(600);
    await page
      .locator("canvas")
      .screenshot({
        path: `apps/client/public/assets/ui/destinations/${id}.png`,
      });
  }
} finally {
  await browser.close();
}
