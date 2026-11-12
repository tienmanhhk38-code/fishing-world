import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const selections = [
  ["inventory", "Túi đồ"],
  ["shop", "Cửa hàng"],
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
    deviceScaleFactor: 1,
  });
  let html =
    '<meta charset="utf-8"><style>body{margin:20px;background:#14384a;color:#f4fcff;font:16px Arial}h1{font-size:24px;margin:0 0 18px}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}article{background:#22566b;border-radius:16px;padding:12px}h2{font-size:18px;margin:0 0 10px}section{display:flex;gap:8px}figure{margin:0;flex:1;min-width:0}img{width:100%;display:block;border-radius:10px}figcaption{text-align:center;padding:8px;font-weight:bold}</style><h1>Popup mobile — trước và sau</h1><main>';
  for (const [id, title] of selections) {
    html += `<article><h2>${title}</h2><section>`;
    for (const [phase, label] of [
      ["before", "Trước"],
      ["after", "Sau"],
    ]) {
      const bytes = await readFile(
        `.local/popups-v8/${phase}/${id}-390x844.png`,
      );
      html += `<figure><img src="data:image/png;base64,${bytes.toString("base64")}"><figcaption>${label}</figcaption></figure>`;
    }
    html += "</section></article>";
  }
  await page.setContent(html + "</main>");
  await mkdir("docs/images", { recursive: true });
  await page.screenshot({
    path: "docs/images/popups-v8-comparison.png",
    fullPage: true,
  });
  const before = JSON.parse(
      await readFile(".local/popups-v8/before/metrics.json", "utf8"),
    ),
    after = JSON.parse(
      await readFile(".local/popups-v8/after/metrics.json", "utf8"),
    );
  const summary = {
    states: new Set(after.metrics.map((m) => m.name)).size,
    viewports: 6,
    errors: after.errors,
    checks: after.metrics.map((m) => ({
      name: m.name,
      width: m.width,
      height: m.height,
      title: m.font,
      padding: m.padding,
      overflow: m.overflow,
      minButtonWidth: Math.min(...m.buttons.map((b) => b.w)),
      minButtonHeight: Math.min(...m.buttons.map((b) => b.h)),
      inputFonts: m.inputs,
      oldTitle: before.metrics.find(
        (b) => b.name === m.name && b.width === m.width,
      )?.font,
    })),
  };
  await mkdir("docs/validation", { recursive: true });
  await writeFile(
    "docs/validation/popups-v8.json",
    JSON.stringify(summary, null, 2),
  );
} finally {
  await browser.close();
}
