import { test, expect } from "@playwright/test";
import { Client } from "colyseus.js";
import { db } from "../../apps/server/src/db";
test.afterAll(async () => db.$disconnect());
test("HTTP origin, payload, cookie hashing and matchmaking reject invalid input before creating rooms", async ({
  request,
}) => {
  const response = await request.get("/api/guest");
  const session = await response.json();
  const cookie = response.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  const stored = await db.guest.findUniqueOrThrow({
    where: { id: session.profile.id },
  });
  expect(stored.token).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(cookie).not.toContain(stored.token);
  expect(
    (
      await request.get("/api/profile", {
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/character", {
        data: { name: "Forged", appearanceId: "ocean" },
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/character", {
        data: { name: "x".repeat(5000), appearanceId: "ocean" },
      })
    ).status(),
  ).toBe(413);
  const rooms = await (await request.get("/api/rooms")).json();
  expect(
    (
      await request.post("http://127.0.0.1:2567/matchmake/create/beach", {
        data: { ticket: "0".repeat(64) },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("http://127.0.0.1:2567/matchmake/create/beach", {
        data: { ticket: "x".repeat(5000) },
      })
    ).status(),
  ).toBe(413);
  expect((await (await request.get("/api/rooms")).json()).length).toBe(
    rooms.length,
  );
  expect((await request.get("http://127.0.0.1:2567/internal/metrics")).status()).toBe(404);
  expect((await request.get("http://127.0.0.1:2567/readyz")).ok()).toBe(true);
});
test("oversized and malformed WebSocket frames close their own session without taking down the server", async ({
  request,
}) => {
  const sdk = new Client("ws://127.0.0.1:2567");
  for (const payload of [Buffer.alloc(5000), Buffer.from([13])]) {
    const identity = await (await fetch("http://127.0.0.1:2567/api/guest")).json();
    const room = await sdk.create("beach", { ticket: identity.ticket });
    room.onMessage("*", () => {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    const closed = new Promise<number>((resolve) => room.onLeave(resolve));
    room.connection.send(payload);
    expect(await closed).toBeGreaterThanOrEqual(1000);
    expect((await request.get("http://127.0.0.1:2567/readyz")).ok()).toBe(true);
  }
});
test("WebSocket rejects a foreign browser origin", async ({ browser }) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.route("http://foreign.invalid/", (route) =>
    route.fulfill({
      body: "<html>Foreign origin</html>",
      contentType: "text/html",
    }),
  );
  await page.goto("http://foreign.invalid/");
  expect(
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const socket = new WebSocket(
            "ws://127.0.0.1:2567/invalid/invalid?sessionId=x",
          );
          socket.onopen = () => {
            socket.close();
            resolve(false);
          };
          socket.onerror = () => resolve(true);
        }),
    ),
  ).toBe(true);
  await context.close();
});
test("lost WebGL context reports clearly and recovers", async ({ page }) => {
  await page.goto("/?diagnostics=1");
  await page.waitForFunction(()=>!!window.__fishingDiagnostics);
  await page.getByRole("button", { name: "Chơi khách", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled({timeout:30000});
  await page.locator(".asset-loading-screen").waitFor({state:"hidden",timeout:60000});
  const supported = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    (window as any).__lostContext = extension;
    extension.loseContext();
    return true;
  });
  expect(supported).toBe(true);
  await expect(page.getByRole("alert")).toContainText("Cảnh 3D tạm ngắt");
  await page.evaluate(() => (window as any).__lostContext.restoreContext());
  await expect(
    page.getByText("Cảnh 3D tạm ngắt.", { exact: false }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled({timeout:30000});
});
