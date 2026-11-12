import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const root = new URL("../apps/client/public/assets/starter/", import.meta.url);
await mkdir(new URL("models/", root), { recursive: true });
await mkdir(new URL("thumbnails/", root), { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--use-gl=angle"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173/asset-preview.html");
  await page.waitForFunction(() => typeof window.renderAsset === "function");
  const ids = await page.evaluate(
    async () => (await import("/src/art/fish-author.ts")).FISH_ASSET_IDS,
  );
  for (const id of ids) {
    const base64 = await page.evaluate(
      async (id) => (await import("/src/art/fish-author.ts")).exportFish(id),
      id,
    );
    await writeFile(
      new URL(`models/${id}.glb`, root),
      Buffer.from(base64, "base64"),
    );
    await page.waitForFunction(async (id) => {
      const r = await fetch(`/assets/starter/models/${id}.glb?ready=1`);
      return (
        r.ok &&
        (await r.arrayBuffer()).byteLength > 1000 &&
        !r.headers.get("content-type")?.includes("text/html")
      );
    }, id);
    await page.evaluate((id) => window.renderAsset(id), id);
    const png = await page
      .locator("canvas")
      .evaluate((c) => c.toDataURL("image/png").split(",")[1]);
    await writeFile(
      new URL(`thumbnails/${id}.png`, root),
      Buffer.from(png, "base64"),
    );
  }
  console.log(`Exported ${ids.length} fish models and thumbnails.`);
} finally {
  await browser.close();
}
