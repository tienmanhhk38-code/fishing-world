import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
await build({
  entryPoints: ["api/[...path].ts"],
  outfile: ".local/m5/vercel-proxy.mjs",
  platform: "node",
  format: "esm",
  bundle: true,
});
const { proxy } = await import("../.local/m5/vercel-proxy.mjs");
const origin = "https://127.0.0.1:9443",
  backend = "https://localhost:8443",
  root = resolve(".local/m5/vercel-dist");
const browser = await chromium.launch({ args: ["--enable-webgl"] });
const errors = [],
  calls = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  try {
    return await nativeFetch(...args);
  } catch (error) {
    errors.push(
      `upstream ${error.message}: ${error.cause?.code ?? ""} ${error.cause?.message ?? ""}`,
    );
    throw error;
  }
};
let page;
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1100, height: 700 },
  });
  // The hosted-frontend fixture contacts a loopback backend; allow only local-network
  // access for this test origin. Browser CORS and WebSocket origin checks stay enabled.
  await context.grantPermissions(["local-network-access"], { origin });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route(origin + "/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      const response = await proxy(
        new Request(request.url(), {
          method: request.method(),
          headers: await request.allHeaders(),
          ...(request.method() === "POST"
            ? { body: request.postData() ?? "" }
            : {}),
        }),
        backend,
      );
      calls.push({
        path: url.pathname,
        status: response.status,
        ...(response.status >= 400
          ? { message: await response.clone().text() }
          : {}),
      });
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
      return;
    }
    const file = resolve(
      root,
      "." +
        (url.pathname === "/"
          ? "/index.html"
          : decodeURIComponent(url.pathname)),
    );
    if (!file.startsWith(root + sep)) {
      await route.abort();
      return;
    }
    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
      ".glb": "model/gltf-binary",
      ".wav": "audio/wav",
    };
    try {
      await route.fulfill({
        body: await readFile(file),
        contentType: types[extname(file)] ?? "application/octet-stream",
      });
    } catch {
      await route.fulfill({ status: 404, body: "Not found" });
    }
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "Chơi khách", exact: true }).click();
  await page.getByRole("button", { name: /^Thả câu/ }).waitFor();
  const cookies = await context.cookies(origin);
  assert.ok(
    cookies.some(
      (cookie) =>
        cookie.name === "__Host-fishing_session" &&
        cookie.httpOnly &&
        cookie.secure,
    ),
  );
  assert.equal(
    (await context.cookies(backend)).length,
    0,
    "Backend must not require a cross-site guest cookie",
  );
  await page.getByRole("button", { name: /^Thả câu/ }).click();
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        let observer;
        const timer = setTimeout(() => {
          observer?.disconnect();
          reject(new Error("Bite cue timeout"));
        }, 28000);
        const hook = () => {
          if (
            document.querySelector(".hint b")?.textContent !==
            "Cá cắn! Giật cần ngay!"
          )
            return;
          observer?.disconnect();
          clearTimeout(timer);
          document.querySelector(".cast").click();
          resolve();
        };
        observer = new MutationObserver(hook);
        observer.observe(document.querySelector(".hint"), {
          subtree: true,
          childList: true,
          characterData: true,
        });
        hook();
      }),
  );
  await page.getByText("BẮT ĐƯỢC RỒI!", { exact: false }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Chơi khách", exact: true }).click();
  await page.getByRole("button", { name: "Túi đồ" }).click();
  await page.locator(".fish-grid article").first().waitFor();
  assert.equal(await page.locator(".fish-grid article").count(), 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: ".local/m5/vercel-bridge.png" });
  const sold = await page.evaluate(async () => {
    const profile = await (await fetch("/api/profile")).json();
    const quote = await (
      await fetch("/api/sale-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).json();
    const response = await fetch("/api/economy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        action: "sell",
        quoteId: quote.id,
      }),
    });
    const sale = await response.json();
    return {
      status: response.status,
      ok: sale.ok,
      beforeFish: profile.fish.length,
      afterFish: sale.profile?.fish.length,
      beforeXp: profile.xp,
      afterXp: sale.profile?.xp,
    };
  });
  assert.equal(sold.status, 200);
  assert.equal(sold.ok, true);
  assert.equal(sold.beforeFish, 1);
  assert.equal(sold.afterFish, 0);
  assert.equal(sold.beforeXp, sold.afterXp);
  await writeFile(
    ".local/m5/vercel-bridge.json",
    JSON.stringify(
      {
        status: "passed",
        at: new Date().toISOString(),
        scope:
          "Browser on isolated HTTPS frontend origin, actual HTTP proxy handler and production Vite build, real cross-origin CORS matchmaking/WSS backend. Frontend hosting intercepted locally; not deployed to Vercel.",
        checks: [
          "Frontend-only HttpOnly/Secure guest cookie",
          "No backend cookie required",
          "Cross-origin credentialed matchmaking and WSS",
          "Catch saved and inventory restored after reload",
          "Cookie-authenticated profile and same-origin POST sale through the real proxy handler",
        ],
        calls,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Vercel bridge browser smoke passed.");
} catch (error) {
  await page?.screenshot({ path: ".local/m5/vercel-bridge-failed.png" });
  await writeFile(
    ".local/m5/vercel-bridge-failed.json",
    JSON.stringify(
      {
        error: String(error),
        calls,
        errors,
        text: await page?.locator("body").innerText(),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
