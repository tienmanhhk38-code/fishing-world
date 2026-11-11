import { test, expect } from "@playwright/test";

test("all 39 supplied GLB models parse and render", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/asset-preview.html");
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { renderAsset: unknown }).renderAsset ===
      "function",
  );
  const count = await page.evaluate(async () => {
    const manifest = await fetch("/assets/starter/asset_manifest.json").then(
      (response) => response.json(),
    );
    const render = (
      window as unknown as { renderAsset: (id: string) => Promise<void> }
    ).renderAsset;
    for (const asset of manifest.assets) await render(asset.id);
    return manifest.assets.length;
  });
  expect(count).toBe(39);
  expect(errors).toEqual([]);
});
