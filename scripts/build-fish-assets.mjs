import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  const available = await page.evaluate(
    async () => (await import("/src/art/fish-author.ts")).FISH_ASSET_IDS,
  );
  // Optional model IDs keep additions from rewriting unrelated existing assets.
  const requested = process.argv.slice(2);
  for (const id of requested) {
    if (!available.includes(id)) throw new Error(`Unknown fish asset: ${id}`);
  }
  const ids = requested.length
    ? available.filter((id) => requested.includes(id))
    : available;
  const manifestUrl = new URL("asset_manifest.json", root);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
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
    const glb = Buffer.from(base64, "base64");
    const doc = JSON.parse(
      glb.subarray(20, 20 + glb.readUInt32LE(12)).toString(),
    );
    const entry = {
      id,
      category: "fish",
      file: `models/${id}.glb`,
      thumbnail: `thumbnails/${id}.png`,
      source: doc.nodes.some((node) => node.extras?.author === "freshwater-v1")
        ? "apps/client/src/art/freshwater-author.ts"
        : "apps/client/src/art/fish-author.ts",
      status: "rigged_lod",
      gltf_up_axis: "Y",
      materials: doc.materials.length,
      triangles: doc.meshes.reduce(
        (sum, mesh) =>
          sum +
          mesh.primitives.reduce(
            (n, p) => n + doc.accessors[p.indices].count / 3,
            0,
          ),
        0,
      ),
    };
    const previous = manifest.assets.findIndex((asset) => asset.id === id);
    if (previous === -1) manifest.assets.push(entry);
    else manifest.assets[previous] = entry;
  }
  manifest.asset_count = manifest.assets.length;
  await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Exported ${ids.length} fish models and thumbnails.`);
} finally {
  await browser.close();
}
