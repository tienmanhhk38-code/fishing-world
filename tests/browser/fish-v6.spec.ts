import { test, expect } from "@playwright/test";
import { Client, type Room } from "colyseus.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../apps/server/src/db";
import { speciesFor, type Player } from "../../packages/shared/src/index";
async function seed(id: string, speciesId: string, grams: number) {
  const species = speciesFor(speciesId)!;
  const round = await db.fishingRound.create({
    data: { id: randomUUID(), guestId: id, status: "SETTLED" },
  });
  return db.fish.create({
    data: {
      guestId: id,
      species: species.name,
      speciesId,
      grams,
      saleValue: 2000,
      xp: 200,
      roundId: round.id,
    },
  });
}
function next(room: Room, type: string) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error(type));
    }, 12000);
    const off = room.onMessage(type, (d) => {
      clearTimeout(timer);
      off();
      resolve(d);
    });
  });
}
test.afterAll(() => db.$disconnect());
test("inventory showcase validates ownership, synchronizes, swaps, stows and ends on sale", async ({
  request,
  playwright,
}) => {
  const a = await (await request.get("/api/guest")).json();
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:5173",
  });
  const b = await (await other.get("/api/guest")).json();
  const small = await seed(a.profile.id, "mackerel", 9990),
    giant = await seed(a.profile.id, "megalodon", 60000000),
    foreign = await seed(b.profile.id, "orca", 1000000);
  const sdk = new Client("ws://127.0.0.1:2567");
  const room = await sdk.create("beach", { ticket: a.ticket }),
    observer = await sdk.joinById(room.roomId, { ticket: b.ticket });
  let seen: Player[] = [];
  for (const r of [room, observer]) {
    r.onMessage("*", () => {});
    r.onMessage("PING", (n) => r.send("PONG", n));
  }
  observer.onMessage("WORLD", (p) => (seen = p));
  try {
    let event = next(room, "SHOWCASE_ERROR");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: foreign.id });
    await event;
    event = next(room, "SHOWCASE_STARTED");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: giant.id });
    const first = await event;
    expect(first).toMatchObject({ fishId: giant.id, grams: 60000000 });
    expect(first.startedAt).toBeGreaterThan(0);
    await expect
      .poll(() => seen.find((p) => p.id === room.sessionId)?.showcase)
      .toEqual(first);
    event = next(room, "SHOWCASE_STARTED");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: giant.id });
    expect(await event).toEqual(first);
    event = next(room, "SHOWCASE_STARTED");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: small.id });
    expect((await event).fishId).toBe(small.id);
    event = next(room, "FISH_ENDED");
    room.send("FISH_STOW");
    await event;
    event = next(room, "SHOWCASE_ERROR");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: giant.id });
    room.send("FISH_STOW");
    await event;
    await expect
      .poll(() => seen.find((p) => p.id === room.sessionId)?.phase)
      .toBe("IDLE");
    event = next(room, "SHOWCASE_STARTED");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: giant.id });
    await event;
    const quote = await (
      await request.post("/api/sale-quote", { data: { fishId: giant.id } })
    ).json();
    const sold = await request.post("/api/economy", {
      data: { action: "sell", requestId: randomUUID(), quoteId: quote.id },
    });
    expect(sold.ok()).toBe(true);
    await expect
      .poll(() => seen.find((p) => p.id === room.sessionId)?.phase)
      .toBe("IDLE");
    event = next(room, "SHOWCASE_ERROR");
    room.send("FISH_SHOWCASE_REQUEST", { fishId: giant.id });
    await event;
    const p = await (await request.get("/api/profile")).json();
    expect(p.fish.map((f: any) => f.id)).toEqual([small.id]);
    expect(p.xp).toBe(0);
  } finally {
    await room.leave();
    await observer.leave();
    await other.dispose();
  }
});

test("bag carries rigged giants across responsive layouts and low graphics", async ({
  browser,
}) => {
  test.setTimeout(180000);
  await mkdir(".local/fish-v6/video", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: {
      dir: ".local/fish-v6/video",
      size: { width: 1024, height: 576 },
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const identity = await (
      await context.request.get("http://127.0.0.1:5173/api/guest")
    ).json();
    for (let i = 0; i < 13; i++)
      await seed(identity.profile.id, "mackerel", 1000);
    await seed(identity.profile.id, "megalodon", 60000000);
    await seed(identity.profile.id, "orca", 1000000);
    await seed(identity.profile.id, "tuna", 9990);
    await seed(identity.profile.id, "tuna", 10000);
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phòng mới" }).click();
    await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
    await page.getByRole("button", { name: /^Túi đồ/ }).click();
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    await expect(page.locator(".fish-grid article")).toHaveCount(5);
    await page
      .getByRole("button", { name: "Trang trước", exact: true })
      .click();
    for (const [label, large] of [
      ["Cá ngừ, 9,99 kg", false],
      ["Cá ngừ, 10,00 kg", true],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page
        .getByRole("button", { name: "Mang ra khoe", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () => window.__fishingDiagnostics!.localPlayer()!.server.phase,
          ),
        )
        .toBe("SHOWCASING");
      await expect
        .poll(() =>
          page.evaluate(() => {
            const d = window.__fishingDiagnostics!;
            return d
              .presentations()
              .find((p) => p.id === d.localPlayer()!.server.id)?.rodVisible;
          }),
        )
        .toBe(!large);
      await page.getByRole("button", { name: /^Túi đồ/ }).click();
    }
    await page.getByRole("button", { name: /Megalodon, 60 tấn/ }).click();
    await page
      .getByRole("button", { name: "Mang ra khoe", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Túi đồ", exact: true }),
    ).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window
              .__fishingDiagnostics!.presentations()
              .find(
                (p) =>
                  p.id ===
                  window.__fishingDiagnostics!.localPlayer()!.server.id,
              )?.fishJoints.length ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    const pose = () =>
      page.evaluate(() => {
        const d = window.__fishingDiagnostics!;
        return d
          .presentations()
          .find((p) => p.id === d.localPlayer()!.server.id)!;
      });
    await expect
      .poll(async () => (await pose()).fishLength)
      .toBeGreaterThan(3.7);
    const first = await pose();
    expect(first.rodVisible).toBe(false);
    expect(first.fishLength).toBeLessThan(4.05);
    expect(first.arms.every((a) => a < -2.8)).toBe(true);
    await page.waitForTimeout(350);
    expect((await pose()).fishJoints).not.toEqual(first.fishJoints);
    await page.screenshot({ path: ".local/fish-v6/showcase-desktop.png" });
    await page.keyboard.down("Shift");
    await page.keyboard.down("KeyD");
    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    await page.keyboard.up("KeyD");
    await page.keyboard.up("Shift");
    expect((await pose()).rodVisible).toBe(false);
    await page
      .getByRole("button", { name: "Cài đặt game", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: /Chất lượng đồ họa/ })
      .selectOption("low");
    await page.getByRole("switch", { name: /Giảm chuyển động/ }).check();
    await page.getByRole("button", { name: /Đóng cài đặt/ }).click();
    await expect.poll(async () => (await pose()).fishLod).toBe("fish-lod-low");
    for (const [name, width, height] of [
      ["portrait", 390, 844],
      ["landscape", 844, 390],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `.local/fish-v6/showcase-${name}.png` });
      await page.locator("button.cast").click();
      await expect
        .poll(() =>
          page.evaluate(
            () => window.__fishingDiagnostics!.localPlayer()!.server.phase,
          ),
        )
        .toBe("IDLE");
      if (!(await page.getByRole("button", { name: /^Túi đồ/ }).isVisible()))
        await page
          .getByRole("button", { name: "Chức năng", exact: true })
          .click();
      await page.getByRole("button", { name: /^Túi đồ/ }).click();
      await page.getByRole("button", { name: /Megalodon, 60 tấn/ }).click();
      const button = page.getByRole("button", {
        name: "Mang ra khoe",
        exact: true,
      });
      await expect(button).toBeVisible();
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `.local/fish-v6/bag-${name}.png` });
      await button.click();
    }
    await writeFile(
      ".local/fish-v6/browser.json",
      JSON.stringify(
        {
          first,
          errors,
          graphics: await page.evaluate(
            () => window.__fishingDiagnostics!.info,
          ),
          samples: await page.evaluate(() =>
            window.__fishingDiagnostics!.samples.slice(-60),
          ),
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
