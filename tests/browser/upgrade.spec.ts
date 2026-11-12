import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Client, type Room } from "colyseus.js";
import { randomUUID } from "node:crypto";
import { db } from "../../apps/server/src/db";
import { DESTINATIONS, type Player } from "../../packages/shared/src/index";
import { mkdir } from "node:fs/promises";

const sdk = new Client("ws://127.0.0.1:2567");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function next(
  room: Room,
  type: string,
  predicate: (d: any) => boolean = () => true,
) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error(`Timeout ${type}`));
    }, 25000);
    const off = room.onMessage(type, (d) => {
      if (predicate(d)) {
        clearTimeout(timer);
        off();
        resolve(d);
      }
    });
  });
}
async function command(room: Room, type: string, body: unknown, reply: string) {
  const response = next(room, reply);
  room.send(type, body);
  return response;
}
async function join(request: APIRequestContext, roomId?: string) {
  const identity = await (await request.get("/api/guest")).json();
  const room = roomId
    ? await sdk.joinById(roomId, { ticket: identity.ticket })
    : await sdk.create("beach", { ticket: identity.ticket });
  let players: Player[] = [];
  const messages: any[] = [];
  room.onMessage("*", () => {});
  room.onMessage("PING", (n) => room.send("PONG", n));
  room.onMessage("WORLD", (p: Player[]) => (players = p));
  room.onMessage("CHAT_MESSAGE", (m) => messages.push(m));
  await expect
    .poll(() => players.some((p) => p.id === room.sessionId))
    .toBe(true);
  return {
    room,
    identity,
    messages,
    players: () => players,
    self: () => players.find((p) => p.id === room.sessionId)!,
  };
}
async function walk(
  actor: Awaited<ReturnType<typeof join>>,
  x: number,
  z: number,
) {
  const start = Date.now();
  let seq = actor.self().ackSeq;
  while (Math.hypot(actor.self().x - x, actor.self().z - z) > 0.001) {
    if (Date.now() - start > 18000)
      throw Error(`Blocked ${JSON.stringify(actor.self())}`);
    const dx = x - actor.self().x,
      dz = z - actor.self().z;
    actor.room.send("PLAYER_INPUT", {
      x: Math.max(-1, Math.min(1, dx / 0.24)),
      z: Math.max(-1, Math.min(1, dz / 0.24)),
      seq: ++seq,
    });
    await sleep(55);
  }
  actor.room.send("PLAYER_INPUT", { x: 0, z: 0, seq: ++seq });
  await sleep(100);
}
test.afterAll(() => db.$disconnect());

test("nearby channel uses authoritative distance, shared cooldown, dedupe, mute, report and no history replay", async ({
  playwright,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({ baseURL: "http://127.0.0.1:5173" }),
    ),
  );
  const a = await join(contexts[0]),
    b = await join(contexts[1], a.room.roomId),
    c = await join(contexts[2], a.room.roomId);
  try {
    await walk(b, a.self().x - 19.9, a.self().z);
    await walk(c, a.self().x - 20.1, a.self().z);
    const requestId = randomUUID(),
      body = { requestId, text: "Chào người ở gần", channel: "nearby" };
    expect(
      await command(a.room, "CHAT_SEND", body, "SOCIAL_ACK"),
    ).toMatchObject({ ok: true });
    await expect.poll(() => b.messages.length).toBe(1);
    expect(c.messages).toHaveLength(0);
    expect(a.messages).toHaveLength(1);
    expect(b.messages[0]).toMatchObject({
      channel: "nearby",
      playerId: a.room.sessionId,
    });
    expect(
      b.messages[0].expiresAt - new Date(b.messages[0].createdAt).getTime(),
    ).toBe(6000);
    await command(a.room, "CHAT_SEND", body, "SOCIAL_ACK");
    expect(b.messages).toHaveLength(1);
    expect(
      await command(
        a.room,
        "CHAT_SEND",
        { requestId: randomUUID(), text: "Quá nhanh" },
        "SOCIAL_ACK",
      ),
    ).toMatchObject({ ok: false });
    await sleep(1050);
    expect(
      await command(
        a.room,
        "CHAT_SEND",
        { requestId: randomUUID(), text: "Tin thế giới cũ" },
        "SOCIAL_ACK",
      ),
    ).toMatchObject({ ok: true });
    await expect.poll(() => c.messages.length).toBe(1);
    const state = await command(
      b.room,
      "MUTE_SET",
      { requestId: randomUUID(), targetId: a.identity.profile.id, muted: true },
      "SOCIAL_STATE",
    );
    expect(state.messages.every((m: any) => m.channel !== "nearby")).toBe(true);
    expect(state.messages).toHaveLength(0);
    await sleep(1050);
    await command(
      a.room,
      "CHAT_SEND",
      { requestId: randomUUID(), text: "Đã tắt tiếng", channel: "nearby" },
      "SOCIAL_ACK",
    );
    expect(b.messages).toHaveLength(2);
    expect(
      await command(
        b.room,
        "REPORT_SEND",
        {
          requestId: randomUUID(),
          targetId: a.identity.profile.id,
          reason: "spam",
          detail: "Kiểm tra chat gần",
        },
        "SOCIAL_ACK",
      ),
    ).toMatchObject({ ok: true });
    const report = await db.playerReport.findFirstOrThrow({
      where: {
        guestId: b.identity.profile.id,
        targetId: a.identity.profile.id,
      },
    });
    expect((report.evidence as any[]).some((m) => m.channel === "nearby")).toBe(
      true,
    );
    const row = await db.chatMessage.findUniqueOrThrow({
      where: {
        guestId_requestId: { guestId: a.identity.profile.id, requestId },
      },
    });
    expect(row.channel).toBe("nearby");
  } finally {
    await Promise.all([a, b, c].map((x) => x.room.leave()));
    await Promise.all(contexts.map((c) => c.dispose()));
  }
});

test("five safe destinations, locked areas and NPC shop boundary/retry are enforced by server", async ({
  request,
}) => {
  test.setTimeout(90000);
  const a = await join(request);
  const buy = {
    action: "buyBait",
    itemId: "worm",
    quantity: 1,
    requestId: randomUUID(),
  };
  try {
    expect((await request.post("/api/economy", { data: buy })).status()).toBe(
      400,
    );
    for (const [destination, definition] of Object.entries(DESTINATIONS)) {
      const result = await command(
        a.room,
        "TELEPORT_REQUEST",
        { destination },
        "TELEPORT_RESULT",
      );
      expect(result.ok).toBe(definition.open);
      if (definition.open) {
        expect(result).toMatchObject(definition.point!);
        await sleep(2050);
      }
    }
    await command(
      a.room,
      "TELEPORT_REQUEST",
      { destination: "village" },
      "TELEPORT_RESULT",
    );
    await walk(a, -21.01, -35);
    await db.guest.update({
      where: { id: a.identity.profile.id },
      data: { coins: 100 },
    });
    expect((await request.post("/api/economy", { data: buy })).status()).toBe(
      200,
    );
    await walk(a, -20.99, -35);
    expect(
      (
        await request.post("/api/economy", {
          data: { ...buy, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(400);
    expect((await request.post("/api/economy", { data: buy })).status()).toBe(
      200,
    );
    expect(
      (
        await db.guest.findUniqueOrThrow({
          where: { id: a.identity.profile.id },
        })
      ).coins,
    ).toBe(95);
  } finally {
    await a.room.leave();
  }
});

test("early hooks and line breaks have distinct server outcomes and cannot award fish", async ({
  request,
}) => {
  test.setTimeout(90000);
  const a = await join(request);
  try {
    const started = await command(a.room, "FISH_START", {}, "FISH_STARTED");
    await next(a.room, "FISH_CUE", (c) => c.phase === "WAITING");
    const ended = await command(
      a.room,
      "FISH_HOOK",
      { roundId: started.roundId },
      "FISH_ENDED",
    );
    expect(ended.reason).toBe("early");
    await sleep(850);
    const second = await command(a.room, "FISH_START", {}, "FISH_STARTED");
    const round = await db.fishingRound.findUniqueOrThrow({
      where: { id: second.roundId },
    });
    await db.fishingRound.update({
      where: { id: second.roundId },
      data: { plan: { ...(round.plan as object), escape: true, reelMs: 1200 } },
    });
    await next(a.room, "FISH_CUE", (c) => c.phase === "BITE_WINDOW");
    const confirmed = await command(
      a.room,
      "FISH_HOOK",
      { roundId: second.roundId },
      "FISH_HOOK_CONFIRMED",
    );
    expect(confirmed.reel.durationMs).toBe(1200);
    const escape = await next(a.room, "FISH_ESCAPED");
    expect(escape.reason).toBe("line_break");
    expect(
      await db.fish.count({ where: { guestId: a.identity.profile.id } }),
    ).toBe(0);
    expect(
      (
        await db.guest.findUniqueOrThrow({
          where: { id: a.identity.profile.id },
        })
      ).xp,
    ).toBe(0);
  } finally {
    await a.room.leave();
  }
});

async function openFeature(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Chức năng", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}
test("six responsive viewports, nearby bubble and NPC shop work through visible UI", async ({
  browser,
}) => {
  test.setTimeout(150000);
  await mkdir(".local/upgrade-v5", { recursive: true });
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1366, height: 768 },
    }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phòng mới" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => !!window.__fishingDiagnostics?.localPlayer()),
      )
      .toBe(true);
    await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
    await page
      .locator(".asset-loading")
      .waitFor({ state: "hidden", timeout: 60000 });
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
      [360, 800],
      [390, 844],
      [844, 390],
      [740, 360],
    ]) {
      await page.setViewportSize({ width, height });
      await sleep(250);
      const cast = await page.locator(".cast").boundingBox();
      expect(cast!.width).toBe(width <= 700 ? 88 : height <= 550 ? 76 : 112);
      const hint = await page.locator(".top-status").boundingBox();
      expect(hint!.y).toBeLessThan(160);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `.local/upgrade-v5/hud-${width}x${height}.png`,
      });
      await openFeature(page, "Bản đồ");
      expect(await page.locator(".map-hotspot").count()).toBe(7);
      await page
        .getByRole("button", { name: "Hòn Đảo Bí Ẩn", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Sắp mở", exact: true }),
      ).toBeDisabled();
      const panel = await page.getByRole("dialog").boundingBox();
      expect(panel!.y).toBeGreaterThanOrEqual(0);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(height);
      await page.screenshot({
        path: `.local/upgrade-v5/map-${width}x${height}.png`,
      });
      await page.getByRole("button", { name: "Đóng bản đồ" }).click();
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole("button", { name: "Chat gần", exact: true }).click();
    const before = await page.evaluate(
      () => window.__fishingDiagnostics!.localPlayer()!.server,
    );
    await page
      .getByRole("textbox", { name: "Tin nhắn gần", exact: true })
      .fill("Xin chào biển xanh");
    await page.keyboard.press("Enter");
    await expect(page.locator(".speech-bubble")).toHaveText(
      "Xin chào biển xanh",
    );
    await page.keyboard.press("Escape");
    const after = await page.evaluate(
      () => window.__fishingDiagnostics!.localPlayer()!.server,
    );
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(
      0.01,
    );
    await page.getByRole("button", { name: "Mở chat", exact: true }).click();
    await expect(page.locator(".chat-log")).not.toContainText(
      "Xin chào biển xanh",
    );
    await page.getByRole("button", { name: "Thu gọn chat" }).click();
    await expect(page.locator(".speech-bubble")).toHaveCount(0, {
      timeout: 8000,
    });
    await openFeature(page, "Bản đồ");
    await page.getByRole("button", { name: "Làng Chài", exact: true }).click();
    await page
      .getByRole("button", { name: "Dịch chuyển", exact: true })
      .click();
    await page.getByRole("button", { name: "Cửa hàng", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Cửa hàng" })).toBeVisible();
    await page.screenshot({ path: ".local/upgrade-v5/shop-glass.png" });
    await page.getByRole("button", { name: "Đóng cửa hàng" }).click();
    await openFeature(page, "Album");
    await expect(page.locator(".album-progress")).toContainText("/ 35 loài");
    await page.screenshot({ path: ".local/upgrade-v5/album-30.png" });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
