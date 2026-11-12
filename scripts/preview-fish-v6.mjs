import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:5173/asset-preview.html");
  const species = (
    await (await page.request.get("http://127.0.0.1:5173/api/catalog")).json()
  ).species;
  const cards = [];
  for (const s of species) {
    const path = `apps/client/public/assets/starter/thumbnails/${s.model}.png`;
    const b = await readFile(path);
    let old;
    try {
      old = execFileSync("git", ["show", `HEAD:${path}`], {
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {}
    cards.push(
      `<article><b>${s.name}</b><div><figure>${old ? `<img src="data:image/png;base64,${old.toString("base64")}"><figcaption>Trước</figcaption>` : "<figcaption>Chưa có ảnh baseline</figcaption>"}</figure><figure><img src="data:image/png;base64,${b.toString("base64")}"><figcaption>Sau</figcaption></figure></div></article>`,
    );
  }
  await page.setContent(
    `<html><meta charset="utf-8"><style>body{margin:24px;background:#12313d;color:#eef8fc;font:16px Arial}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:#214756;border-radius:12px;padding:12px}article div{display:flex}figure{margin:0;width:50%;text-align:center}img{width:100%;height:120px;object-fit:contain}figcaption{font-size:12px;color:#b3d4df}</style><h1>Fishing World — 35 loài cá 3D</h1><p>So sánh ảnh trong repository với mô hình thân liền, có xương và LOD.</p><main>${cards.join("")}</main></html>`,
  );
  await mkdir("docs/images", { recursive: true });
  await page.screenshot({
    path: "docs/images/fish-v6-models.png",
    fullPage: true,
  });
  await writeFile(
    ".local/fish-v6/assets.json",
    JSON.stringify(
      { species: species.length, models: species.map((s) => s.model) },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
