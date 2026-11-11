import { test, expect } from "@playwright/test";
test("all thirteen authored harbor GLBs load and render, including skinned characters", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/asset-preview.html");
  await page.waitForFunction(
    () => typeof (window as any).renderAsset === "function",
  );
  const result = await page.evaluate(async () => {
    const manifest = await (
      await fetch("/assets/harbor-v2/manifest.json")
    ).json();
    for (const asset of manifest.assets)
      await (window as any).renderAsset("harbor-" + asset.id);
    return manifest.assets.length;
  });
  expect(result).toBe(13);
  expect(errors).toEqual([]);
});
