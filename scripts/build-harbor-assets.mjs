import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const directory = new URL(
  "../apps/client/public/assets/harbor-v2/",
  import.meta.url,
);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--use-gl=angle"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173/asset-preview.html");
  const manifest = {
    version: 2,
    author: "Fishing World Online",
    source: "apps/client/src/art/harbor-author.ts",
    assets: [],
  };
  for (const id of [
    "fisher_sailor",
    "fisher_sunny",
    "fisher_coral",
    "fisher_ocean",
    "dock",
    "dock_post",
    "palm",
    "house",
    "bush",
    "rocks",
    "crate",
    "lighthouse",
    "island",
  ]) {
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await page.evaluate(async (id) => {
          const { exportHarborAsset } = await import(
            "/src/art/harbor-author.ts"
          );
          return exportHarborAsset(id);
        }, id);
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await page.waitForTimeout(1500);
      }
    }
    const { base64, ...info } = result;
    const data = Buffer.from(base64, "base64");
    await writeFile(new URL(id + ".glb", directory), data);
    manifest.assets.push({ id, bytes: data.length, ...info });
    console.log(JSON.stringify(manifest.assets.at(-1)));
  }
  await writeFile(
    new URL("manifest.json", directory),
    JSON.stringify(manifest, null, 2),
  );
} finally {
  await browser.close();
}
