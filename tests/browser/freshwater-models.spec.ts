import { test, expect } from "@playwright/test";
import { SPECIES } from "../../packages/shared/src/index";

test("all freshwater GLBs render, switch LOD and animate with fixed heads and reduced motion", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/freshwater-preview.html");
  await page.waitForFunction(() => !!(window as any).freshwaterQA);
  for (const s of SPECIES.filter((s) => s.area === "village")) {
    const show = (options: Record<string, unknown>) =>
      page.evaluate((o) => (window as any).freshwaterQA.show(o), {
        id: s.id,
        ...options,
      });
    const high = await show({});
    const low = await show({ low: true });
    expect(high.calls, s.id).toBeLessThanOrEqual(4);
    expect(high.triangles, s.id).toBeLessThanOrEqual(20000);
    expect(low.calls, s.id).toBeLessThanOrEqual(4);
    expect(low.triangles, s.id).toBeLessThanOrEqual(4000);
    expect(low.length, s.id).toBeCloseTo(high.length, 4);
    for (const view of ["opposite", "top", "front", "rear"])
      expect((await show({ view })).triangles).toBeGreaterThan(0);
    for (const grams of [s.minGrams, s.maxGrams]) {
      const normal = await show({ time: 4200, grams });
      const reduced = await show({ time: 4200, grams, reduced: true });
      expect(normal.headFixed, s.id).toBe(true);
      expect(reduced.headFixed, s.id).toBe(true);
      expect(normal.displayLength).toBeGreaterThan(0);
      expect(reduced.maxBoneAngle).toBeLessThanOrEqual(0.025001);
    }
  }
  await page.evaluate(() =>
    (window as any).freshwaterQA.show({
      id: "sturgeon",
      view: "top",
      mask: true,
    }),
  );
  const seamAlpha = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2")!;
      const pixel = new Uint8Array(4);
      return [0.35, 0.45, 0.55, 0.65].map((x) => {
        gl.readPixels(
          Math.round(canvas.width * x),
          Math.round(canvas.height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        return pixel[3];
      });
    });
  expect(seamAlpha).toEqual([255, 255, 255, 255]);
  expect(errors).toEqual([]);
});
