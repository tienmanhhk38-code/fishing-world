import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const base = process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:5173";
const out = ".local/freshwater-v1";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--use-gl=angle"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 960, height: 640 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/freshwater-preview.html`);
  await page.waitForFunction(() => !!window.freshwaterQA);
  await page.evaluate(
    (path) => window.freshwaterQA.baselineRoot(path),
    resolve(`${out}/baseline`).replaceAll("\\", "/"),
  );
  const species = await page.evaluate(
    async (path) => (await import(path)).SPECIES,
    `/@fs/${resolve("packages/shared/src/index.ts").replaceAll("\\", "/")}`,
  );
  const chosen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const fresh = species.filter(
    (s) => s.area === "village" && (!chosen.length || chosen.includes(s.id)),
  );
  const onlyBenchmark = process.argv.includes("--benchmark-only");
  const previous = onlyBenchmark
    ? JSON.parse(await readFile(`${out}/qa.json`, "utf8"))
    : null;
  const metrics = previous?.metrics ?? [];
  for (const s of onlyBenchmark ? [] : fresh) {
    const dir = `${out}/renders/${s.id}`;
    await mkdir(dir, { recursive: true });
    for (const view of [
      "reference",
      "opposite",
      "top",
      "front",
      "rear",
      "threeQuarter",
    ]) {
      const result = await page.evaluate((o) => window.freshwaterQA.show(o), {
        id: s.id,
        view,
      });
      await page.locator("canvas").screenshot({ path: `${dir}/${view}.png` });
      if (view === "reference") metrics.push({ id: s.id, ...result });
    }
    for (const low of [false, true]) {
      await page.evaluate((o) => window.freshwaterQA.show(o), {
        id: s.id,
        mask: true,
        low,
      });
      const data = await page
        .locator("canvas")
        .evaluate((c) => c.toDataURL("image/png").split(",")[1]);
      await writeFile(
        `${dir}/${low ? "low-mask" : "mask"}.png`,
        Buffer.from(data, "base64"),
      );
    }
    await page.evaluate((o) => window.freshwaterQA.show(o), {
      id: s.id,
      low: true,
    });
    await page.locator("canvas").screenshot({ path: `${dir}/low.png` });
    await page.evaluate((o) => window.freshwaterQA.show(o), {
      id: s.id,
      baseline: true,
    });
    await page.locator("canvas").screenshot({ path: `${dir}/before.png` });
    console.log(`Captured ${s.id}`);
  }
  const performanceResults = [];
  if (process.argv.includes("--benchmark") || onlyBenchmark)
    for (const id of ["perch", "koi", "marbled_eel"])
      for (const low of [false, true]) {
        const before = await page.evaluate(
          (o) => window.freshwaterQA.benchmark(o.id, true, o.low),
          { id, low },
        );
        const after = await page.evaluate(
          (o) => window.freshwaterQA.benchmark(o.id, false, o.low),
          { id, low },
        );
        performanceResults.push({
          id,
          low,
          before,
          after,
          medianRatio: after.frames.median / before.frames.median,
          p95Ratio: after.frames.p95 / before.frames.p95,
        });
        console.log(`Benchmarked ${id} ${low ? "low" : "high"}`);
      }
  const sea = [];
  const baseline = JSON.parse(
    (await readFile(`${out}/baseline/hashes.json`, "utf8")).replace(
      /^\uFEFF/,
      "",
    ),
  );
  for (const s of species.filter((s) => s.area === "beach"))
    for (const ext of ["glb", "png"]) {
      const path = `apps/client/public/assets/starter/${ext === "glb" ? "models" : "thumbnails"}/${s.model}.${ext}`;
      const hash = createHash("sha256")
        .update(await readFile(path))
        .digest("hex")
        .toUpperCase();
      const old = baseline.find((b) =>
        b.Path.replaceAll("\\", "/").endsWith(path),
      );
      sea.push({ path, unchanged: old?.Hash === hash, hash });
    }
  await writeFile(
    `${out}/qa.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        metrics,
        performance: performanceResults,
        sea,
        errors,
      },
      null,
      2,
    ),
  );
  if (process.argv.includes("--video")) {
    const data = await page.evaluate(
      (ids) => window.freshwaterQA.record(ids),
      fresh.map((s) => s.id),
    );
    await writeFile(`${out}/turntable.webm`, Buffer.from(data, "base64"));
  }
  await context.close();
  if (errors.length || sea.some((s) => !s.unchanged))
    throw Error(
      JSON.stringify({ errors, changedSea: sea.filter((s) => !s.unchanged) }),
    );
} finally {
  await browser.close();
}
