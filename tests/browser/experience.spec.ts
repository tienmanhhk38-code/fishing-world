import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "colyseus.js";
import { db } from "../../apps/server/src/db";
import {
  beginFishing,
  startReel,
  settleReel,
  recoverFishing,
  finishFishing,
} from "../../apps/server/src/economy";
import { questDay, type Player } from "../../packages/shared/src/index";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function next(
  room: Room,
  type: string,
  predicate: (x: any) => boolean = () => true,
) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error("Timeout " + type));
    }, 22000);
    const off = room.onMessage(type, (d) => {
      if (predicate(d)) {
        clearTimeout(timer);
        off();
        resolve(d);
      }
    });
  });
}
async function fixedRound(
  id: string,
  escape = false,
  area: "beach" | "village" = "beach",
) {
  const round = randomUUID(),
    sample = await beginFishing(id, round, area);
  await db.fishingRound.update({
    where: { id: round },
    data: { plan: { ...sample.plan, escape, reelMs: 100 } },
  });
  return { round, sample };
}
async function due(id: string, round: string) {
  await startReel(id, round);
  await db.fishingRound.update({
    where: { id: round },
    data: { reelEndsAt: new Date(Date.now() - 1) },
  });
  return settleReel(id, round);
}
test.afterAll(() => db.$disconnect());
test("durable reel settles once, does not reward before end and never rewards escape", async ({
  request,
}) => {
  const { profile: g } = await (await request.get("/api/guest")).json();
  const { round, sample } = await fixedRound(g.id);
  await startReel(g.id, round);
  await expect(settleReel(g.id, round)).rejects.toThrow("Đang kéo");
  expect(await db.fish.count({ where: { guestId: g.id } })).toBe(0);
  await db.fishingRound.update({
    where: { id: round },
    data: { reelEndsAt: new Date(Date.now() - 1) },
  });
  const results = await Promise.all([
    settleReel(g.id, round),
    settleReel(g.id, round),
  ]);
  expect(results[0].fish!.id).toBe(results[1].fish!.id);
  expect(results[0].fish!.grams).toBe(sample.selected.grams);
  expect(await db.fish.count({ where: { guestId: g.id } })).toBe(1);
  const escaped = await fixedRound(g.id, true);
  await due(g.id, escaped.round);
  await settleReel(g.id, escaped.round);
  const profile = await (await request.get("/api/profile")).json();
  expect(profile.fish).toHaveLength(1);
  expect(profile.xp).toBe(sample.selected.species.xp);
  expect(profile.quests.find((q: any) => q.id === "daily-catch").progress).toBe(
    1,
  );
});
test("startup recovery honors stored reel outcome and refunds an unhooked bait only once", async ({
  playwright,
}) => {
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({ baseURL: "http://127.0.0.1:5173" }),
    ),
  );
  try {
    const guests = await Promise.all(
      contexts.map(
        async (r) => (await (await r.get("/api/guest")).json()).profile,
      ),
    );
    const win = await fixedRound(guests[0].id),
      lose = await fixedRound(guests[1].id, true);
    await startReel(guests[0].id, win.round);
    await startReel(guests[1].id, lose.round);
    await db.fishingRound.updateMany({
      where: { id: { in: [win.round, lose.round] } },
      data: { reelEndsAt: new Date(Date.now() - 1) },
    });
    await db.guest.update({
      where: { id: guests[2].id },
      data: { equippedBait: "worm" },
    });
    await db.baitStock.upsert({
      where: { guestId_baitId: { guestId: guests[2].id, baitId: "worm" } },
      create: { guestId: guests[2].id, baitId: "worm", quantity: 1 },
      update: { quantity: 1 },
    });
    const interrupted = await fixedRound(guests[2].id);
    await recoverFishing();
    await recoverFishing();
    expect(await db.fish.count({ where: { guestId: guests[0].id } })).toBe(1);
    expect(await db.fish.count({ where: { guestId: guests[1].id } })).toBe(0);
    expect(
      (await db.fishingRound.findUniqueOrThrow({ where: { id: lose.round } }))
        .status,
    ).toBe("ESCAPED");
    expect(
      (
        await db.fishingRound.findUniqueOrThrow({
          where: { id: interrupted.round },
        })
      ).status,
    ).toBe("INTERRUPTED");
    expect(
      (
        await db.baitStock.findUniqueOrThrow({
          where: { guestId_baitId: { guestId: guests[2].id, baitId: "worm" } },
        })
      ).quantity,
    ).toBe(1);
  } finally {
    await Promise.all(contexts.map((c) => c.dispose()));
  }
});
test("quest claims are sequential, atomic, replay safe and reject expired days", async ({
  request,
}) => {
  const { profile: g } = await (await request.get("/api/guest")).json();
  await db.guest.update({
    where: { id: g.id },
    data: { tutorialMoved: true, questJumped: true },
  });
  const claim = (questId: string, period: string, requestId = randomUUID()) =>
    request.post("/api/quests/claim", { data: { questId, period, requestId } });
  expect((await claim("intro-catch", "intro")).status()).toBe(400);
  const requestId = randomUUID();
  const responses = await Promise.all([
    claim("intro-move", "intro", requestId),
    claim("intro-move", "intro", requestId),
    claim("intro-move", "intro"),
  ]);
  expect(responses.every((r) => r.ok())).toBe(true);
  let profile = await (await request.get("/api/profile")).json();
  expect(profile.coins).toBe(30);
  expect(profile.xp).toBe(10);
  expect((await claim("intro-catch", "intro", requestId)).status()).toBe(400);
  for (let i = 0; i < 6; i++) {
    const x = await fixedRound(g.id, false, i < 2 ? "village" : "beach");
    await due(g.id, x.round);
  }
  expect((await claim("daily-catch", "1999-01-01")).status()).toBe(400);
  const day = questDay();
  await Promise.all([claim("daily-catch", day), claim("daily-catch", day)]);
  await claim("daily-pond", day);
  const quote = await (
    await request.post("/api/sale-quote", { data: {} })
  ).json();
  const sale = await request.post("/api/economy", {
    data: { action: "sell", requestId: randomUUID(), quoteId: quote.id },
  });
  expect(sale.ok()).toBe(true);
  profile = await (await request.get("/api/profile")).json();
  expect(profile.quests.find((q: any) => q.id === "daily-sell").progress).toBe(
    150,
  );
  expect(profile.baitCounts.worm).toBe(3);
  expect(await db.questClaim.count({ where: { guestId: g.id } })).toBe(3);
  expect(
    (
      await request.post("/api/quests/claim", { data: { questId: 7 } })
    ).status(),
  ).toBe(400);
});
test("two guests share reeling and manual showcase; movement, replay guards and explicit lobby exit", async ({
  request,
  playwright,
}) => {
  const identity = await (await request.get("/api/guest")).json();
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:5173",
  });
  const guest2 = await (await other.get("/api/guest")).json();
  const sdk = new Client("ws://127.0.0.1:2567");
  const a = await sdk.create("beach", { ticket: identity.ticket }),
    b = await sdk.joinById(a.roomId, { ticket: guest2.ticket });
  let players: Player[] = [];
  let observer: Player[] = [];
  for (const room of [a, b]) {
    room.onMessage("*", () => {});
    room.onMessage("PING", (n) => room.send("PONG", n));
  }
  a.onMessage("WORLD", (p) => (players = p));
  b.onMessage("WORLD", (p) => (observer = p));
  const self = () => players.find((p) => p.id === a.sessionId)!;
  try {
    await expect.poll(() => players.length).toBe(2);
    const startX = self().x;
    a.send("PLAYER_INPUT", { x: 1, z: 0, sprint: true, seq: 10 });
    await sleep(300);
    a.send("PLAYER_INPUT", { x: 0, z: 0, seq: 11 });
    await sleep(150);
    expect(self().x - startX).toBeGreaterThan(1.2);
    expect(self().x - startX).toBeLessThan(3);
    a.send("PLAYER_INPUT", { x: -1, z: 0, seq: 10 });
    const stopped = self().x;
    await sleep(160);
    expect(self().x).toBeCloseTo(stopped, 2);
    a.send("PLAYER_JUMP", { seq: 1 });
    await expect.poll(() => self().grounded).toBe(false);
    a.send("FISH_START", {});
    await sleep(100);
    expect(self().phase).toBe("IDLE");
    await expect.poll(() => self().grounded).toBe(true);
    a.send("PLAYER_JUMP", { seq: 1 });
    await sleep(100);
    expect(self().grounded).toBe(true);
    const bite = next(a, "FISH_CUE", (d) => d.phase === "BITE_WINDOW"),
      started = next(a, "FISH_STARTED");
    a.send("FISH_START", {});
    const round = await started;
    const row = await db.fishingRound.findUniqueOrThrow({
      where: { id: round.roundId },
    });
    await db.fishingRound.update({
      where: { id: row.id },
      data: { plan: { ...(row.plan as any), escape: false, reelMs: 1000 } },
    });
    await bite;
    const hook = next(a, "FISH_HOOK_CONFIRMED"),
      result = next(a, "FISH_RESULT");
    a.send("FISH_HOOK", { roundId: row.id });
    a.send("FISH_HOOK", { roundId: row.id });
    await hook;
    expect(
      (await (await request.get("/api/profile")).json()).fish,
    ).toHaveLength(0);
    await expect
      .poll(() => observer.find((p) => p.id === a.sessionId)?.phase)
      .toBe("REELING");
    expect(observer.find((p) => p.id === a.sessionId)?.reel).toEqual(
      self().reel,
    );
    expect(observer.find((p) => p.id === a.sessionId)).not.toHaveProperty(
      "selected",
    );
    const fish = await result;
    expect(fish.id).toBeTruthy();
    expect(self().showcase).toBeUndefined();
    const show = next(a, "SHOWCASE_STARTED");
    a.send("FISH_SHOWCASE_REQUEST", {});
    await show;
    await expect
      .poll(() => observer.find((p) => p.id === a.sessionId)?.showcase?.grams)
      .toBe(fish.grams);
    a.send("PLAYER_JUMP", { seq: 2 });
    a.send("PLAYER_INPUT", { x: -1, z: 0, sprint: true, seq: 12 });
    await sleep(200);
    expect(self().phase).toBe("SHOWCASING");
    expect(self().grounded).toBe(false);
    a.send("PLAYER_INPUT", { x: 0, z: 0, seq: 13 });
    expect(
      (
        await request.post("/api/economy", {
          data: { action: "equipRod", itemId: "wood", requestId: randomUUID() },
        })
      ).status(),
    ).toBe(400);
    await sleep(600);
    const ended = next(a, "FISH_ENDED");
    a.send("FISH_STOW", {});
    await ended;
    const continued = next(a, "FISH_STARTED");
    a.send("FISH_START", {});
    const unfinished = await continued;
    const ready = next(a, "LOBBY_READY");
    a.send("LEAVE_GAME", {});
    await ready;
    await sleep(200);
    expect(
      (
        await db.fishingRound.findUniqueOrThrow({
          where: { id: unfinished.roundId },
        })
      ).status,
    ).toBe("CANCELLED");
    const profile = await (await request.get("/api/profile")).json();
    expect(profile.fish).toHaveLength(1);
    const fresh = await (await request.get("/api/guest")).json();
    const reentry = await sdk.joinById(b.roomId, { ticket: fresh.ticket });
    reentry.onMessage("*", () => {});
    await sleep(150);
    expect(
      observer.filter((p) => p.name === identity.profile.name).length,
    ).toBeLessThanOrEqual(1);
    await reentry.leave();
  } finally {
    if (a.connection.isOpen) await a.leave();
    await b.leave();
    await other.dispose();
  }
});
