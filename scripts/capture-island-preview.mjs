import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = ".local/island-v3";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--use-angle=d3d11",
    "--use-gl=angle",
    "--disable-software-rasterizer",
  ],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1536, height: 1024 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 500));
  });
  await page.goto("http://127.0.0.1:5173/island-preview.html");
  await page.waitForFunction(() => typeof window.setIslandView === "function");
  await page.waitForTimeout(3000);
  for (const id of ["overview", "top", "sea", "village", "pond"]) {
    await page.evaluate((id) => window.setIslandView(id), id);
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + "/" + id + ".png" });
  }
  await writeFile(
    out + "/preview.json",
    JSON.stringify({ at: new Date().toISOString(), errors }, null, 2),
  );
  console.log(JSON.stringify({ errors }));
} finally {
  await browser.close();
}
