import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = new URL(
  "../apps/client/public/assets/starter/thumbnails/",
  import.meta.url,
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
  await page.goto("http://127.0.0.1:5173/asset-preview.html");
  await page.waitForFunction(() => typeof window.renderAsset === "function");
  for (const id of [
    ...Array.from(
      { length: 15 },
      (_, index) => `fish_concept_${String(index + 1).padStart(2, "0")}`,
    ),
    "chibi_fisher_blockout",
    ...["sailor", "sunny", "coral", "ocean"].flatMap((id) => [
      `avatar-${id}`,
      `character-${id}`,
    ]),
    "rod_wood",
    "rod_bamboo",
    "rod_carbon",
    "bait_dough",
    "bait_worm",
    "bait_shrimp",
  ]) {
    await page.evaluate((id) => window.renderAsset(id), id);
    await page.locator("canvas").screenshot({
      path: fileURLToPath(new URL(`${id}.png`, output)),
      omitBackground: true,
    });
    console.log(`Rendered ${id}`);
  }
} finally {
  await browser.close();
}
