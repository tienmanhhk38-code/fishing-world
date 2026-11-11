import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { db } from "../../apps/server/src/db";
import {
  beginFishing,
  commitCatch,
  finishFishing,
  recordMovement,
} from "../../apps/server/src/economy";
import { speciesFor } from "../../packages/shared/src/index";

async function seedCatch(id: string, speciesId = "mackerel", grams = 1000) {
  const species = speciesFor(speciesId)!;
  const round = randomUUID();
  await beginFishing(id, round, species.area);
  await db.fishingRound.update({where:{id:round},data:{status:'REELING',selected:JSON.parse(JSON.stringify({species,grams})),plan:{escape:false},reelEndsAt:new Date(Date.now()-1)}});
  const result = await commitCatch(id, round, { species, grams });
  await finishFishing(id, round);
  return result;
}
async function seedProgress(id: string) {
  for (let i = 0; i < 10; i++) await seedCatch(id);
  await seedCatch(id, "tuna", 18000);
  await recordMovement(id);
}
const post = (request: APIRequestContext, body: unknown) =>
  request.post("/api/economy", { data: body });
test.afterAll(async () => {
  await db.$disconnect();
});

test("sales, purchases and bait consumption stay atomic under retries and concurrency", async ({
  request,
}) => {
  const { profile: identity } = await (await request.get("/api/guest")).json();
  await seedProgress(identity.id);
  const before = await (await request.get("/api/profile")).json();
  expect(before.tutorialStep).toBe(2);
  expect(before.coins).toBe(0);
  const quote = await (
    await request.post("/api/sale-quote", { data: {} })
  ).json();
  expect(quote.count).toBe(11);
  expect(quote.total).toBe(876);
  const sale = { requestId: randomUUID(), action: "sell", quoteId: quote.id };
  const sales = await Promise.all(
    Array.from({ length: 8 }, () => post(request, sale)),
  );
  for (const response of sales)
    expect(await response.json(), `status ${response.status()}`).toMatchObject({
      ok: true,
    });
  let profile = await (await request.get("/api/profile")).json();
  expect(profile.coins).toBe(876);
  expect(profile.xp).toBe(before.xp);
  expect(profile.fish).toHaveLength(0);
  expect(profile.album).toEqual(before.album);
  expect(profile.tutorialStep).toBe(3);
  expect(await db.coinLedger.count({ where: { guestId: identity.id } })).toBe(
    1,
  );
  expect(
    (
      await post(request, {
        requestId: randomUUID(),
        action: "sell",
        quoteId: quote.id,
      })
    ).status(),
  ).toBe(400);
  const rodA = { requestId: randomUUID(), action: "buyRod", itemId: "bamboo" },
    rodB = { ...rodA, requestId: randomUUID() };
  const rods = await Promise.all([post(request, rodA), post(request, rodB)]);
  expect(rods.map((response) => response.status()).sort()).toEqual([200, 400]);
  const winning = rods[0].ok() ? rodA : rodB;
  expect((await post(request, winning)).ok()).toBe(true);
  expect((await post(request, { ...winning, itemId: "carbon" })).status()).toBe(
    400,
  );
  const bait = {
    requestId: randomUUID(),
    action: "buyBait",
    itemId: "worm",
    quantity: 4,
  };
  const baits = await Promise.all(
    Array.from({ length: 6 }, () => post(request, bait)),
  );
  expect(baits.every((response) => response.ok())).toBe(true);
  profile = await (await request.get("/api/profile")).json();
  expect(profile.coins).toBe(556);
  expect(profile.baitCounts.worm).toBe(4);
  expect(await db.coinLedger.count({ where: { guestId: identity.id } })).toBe(
    3,
  );
  expect(
    (
      await post(request, {
        requestId: randomUUID(),
        action: "buyBait",
        itemId: "worm",
        quantity: -9,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, {
        requestId: randomUUID(),
        action: "buyRod",
        itemId: "carbon",
        price: 1,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, {
        requestId: randomUUID(),
        action: "equipRod",
        itemId: "bamboo",
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await post(request, {
        requestId: randomUUID(),
        action: "equipBait",
        itemId: "worm",
      })
    ).ok(),
  ).toBe(true);
  let round = randomUUID();
  await beginFishing(identity.id, round, "village");
  const blockedEquip = {
    requestId: randomUUID(),
    action: "equipBait",
    itemId: "dough",
  };
  expect((await post(request, blockedEquip)).status()).toBe(400);
  await finishFishing(identity.id, round);
  // Retrying a failed ID must retain its outcome after the condition changes.
  expect((await post(request, blockedEquip)).status()).toBe(400);
  expect(
    (await (await request.get("/api/profile")).json()).baitCounts.worm,
  ).toBe(3);
  round = randomUUID();
  await beginFishing(identity.id, round, "village");
  await finishFishing(identity.id, round, true);
  await finishFishing(identity.id, round, true);
  expect(
    (await (await request.get("/api/profile")).json()).baitCounts.worm,
  ).toBe(3);
  for (let i = 0; i < 3; i++) {
    round = randomUUID();
    await beginFishing(identity.id, round, "village");
    await finishFishing(identity.id, round);
  }
  await expect(
    beginFishing(identity.id, randomUUID(), "village"),
  ).rejects.toThrow("Đã hết mồi");
  expect(
    (
      await post(request, {
        requestId: randomUUID(),
        action: "equipBait",
        itemId: "dough",
      })
    ).ok(),
  ).toBe(true);
  round = randomUUID();
  await beginFishing(identity.id, round, "beach");
  await finishFishing(identity.id, round);
  await post(request, { requestId: randomUUID(), action: "viewShop" });
  profile = await (await request.get("/api/profile")).json();
  expect(profile.tutorialStep).toBe(4);
  expect(profile.coins).toBe(556);
  expect(profile.xp).toBe(before.xp);
});

test("competing spends cannot overdraw and duplicate catches cannot grant a second reward", async ({
  request,
}) => {
  const { profile: identity } = await (await request.get("/api/guest")).json();
  await seedProgress(identity.id);
  const quote = await (
    await request.post("/api/sale-quote", { data: {} })
  ).json();
  await post(request, {
    requestId: randomUUID(),
    action: "sell",
    quoteId: quote.id,
  });
  const spends = await Promise.all(
    Array.from({ length: 2 }, () =>
      post(request, {
        requestId: randomUUID(),
        action: "buyBait",
        itemId: "shrimp",
        quantity: 80,
      }),
    ),
  );
  expect(spends.map((response) => response.status()).sort()).toEqual([
    200, 400,
  ]);
  let profile = await (await request.get("/api/profile")).json();
  expect(profile.coins).toBe(236);
  expect(profile.baitCounts.shrimp).toBe(80);
  await post(request, {
    requestId: randomUUID(),
    action: "equipBait",
    itemId: "shrimp",
  });
  const round = randomUUID();
  await beginFishing(identity.id, round, "beach");
  const selected = { species: speciesFor("mackerel")!, grams: 1200 };
  await db.fishingRound.update({where:{id:round},data:{status:'REELING',selected:JSON.parse(JSON.stringify(selected)),plan:{escape:false},reelEndsAt:new Date(Date.now()-1)}});
  const commits = await Promise.allSettled([
    commitCatch(identity.id, round, selected),
    commitCatch(identity.id, round, selected),
  ]);
  expect(
    commits.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(2);
  await finishFishing(identity.id, round, true);
  profile = await (await request.get("/api/profile")).json();
  expect(profile.coins).toBe(236);
  expect(profile.baitCounts.shrimp).toBe(79);
  expect(profile.xp).toBe(270);
  expect(profile.fish).toHaveLength(1);
  expect(
    profile.album.find(
      (entry: { speciesId: string }) => entry.speciesId === "mackerel",
    ).count,
  ).toBe(11);
});

test("quotes sell the confirmed snapshot and reject another owner", async ({
  request,
  playwright,
}) => {
  const { profile: identity } = await (await request.get("/api/guest")).json();
  await seedCatch(identity.id);
  await seedCatch(identity.id);
  const quote = await (
    await request.post("/api/sale-quote", { data: {} })
  ).json();
  await seedCatch(identity.id);
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:5173",
  });
  await other.get("/api/guest");
  expect(
    (
      await post(other, {
        requestId: randomUUID(),
        action: "sell",
        quoteId: quote.id,
      })
    ).status(),
  ).toBe(400);
  await other.dispose();
  await post(request, {
    requestId: randomUUID(),
    action: "sell",
    quoteId: quote.id,
  });
  const profile = await (await request.get("/api/profile")).json();
  expect(profile.fish).toHaveLength(1);
  expect(profile.coins).toBe(60);
  expect(profile.album[0]).toMatchObject({ count: 3, recordGrams: 1000 });
});

test("legacy fish are priced and added to the album exactly once", async ({
  request,
}) => {
  const token = randomBytes(32).toString("hex");
  const guest = await db.guest.create({
    data: { token, name: "Legacy QA", xp: 40 },
  });
  const round = await db.fishingRound.create({
    data: { id: randomUUID(), guestId: guest.id, status: "COMMITTED" },
  });
  await db.fish.create({
    data: {
      guestId: guest.id,
      roundId: round.id,
      species: "Cá bạc má",
      grams: 1500,
    },
  });
  const first = await (
    await request.get("/api/guest", {
      headers: { Cookie: `fishing_session=${token}` },
    })
  ).json();
  const second = await (await request.get("/api/profile")).json();
  expect(first.profile.fish[0]).toMatchObject({
    speciesId: "mackerel",
    saleValue: 45,
  });
  expect(second.album).toEqual(first.profile.album);
  expect(second.album[0]).toMatchObject({ count: 1, recordGrams: 1500 });
  expect(second.xp).toBe(40);
});

test("the full UI loop sells, buys, equips, keeps album records and survives a lost response", async ({
  page,
}) => {
  const identity = await (await page.request.get("/api/guest")).json();
  await seedProgress(identity.profile.id);
  let dropped = false;
  const saleIds: string[] = [];
  await page.route("**/api/economy", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "sell") {
      saleIds.push(body.requestId);
      if (!dropped) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled();
  await page.getByRole("button", { name: "Túi đồ", exact: false }).click();
  await page.getByRole("button", { name: "Bán tất cả", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bán 11 con cá?" }),
  ).toContainText("876 Xu");
  await page.screenshot({ path: ".local/m3-sale.png" });
  await page.getByRole("button", { name: "Xác nhận bán", exact: true }).click();
  await expect(page.locator(".coin-counter b")).toHaveText("876");
  await expect.poll(() => saleIds.length).toBe(2);
  expect(new Set(saleIds).size).toBe(1);
  await expect(
    page.getByRole("dialog", { name: "Bán 11 con cá?" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Đóng túi đồ" }).click();
  await page.getByRole("button", { name: "Album", exact: true }).click();
  await expect(page.locator(".album-progress")).toHaveText("2 / 15 loài");
  await expect(page.locator(".fish-detail")).toContainText("Đã bắt 10 con");
  await page.screenshot({ path: ".local/m3-album.png" });
  await page.getByRole("button", { name: "Đóng album" }).click();
  await page.getByRole("button", { name: "Cửa hàng", exact: true }).click();
  const bamboo = page.locator(".shop-card").filter({ hasText: "Cần tre" });
  await expect(
    bamboo.getByRole("button", { name: "Mua", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: ".local/m3-shop.png" });
  await bamboo.getByRole("button", { name: "Mua", exact: true }).click();
  await bamboo.getByRole("button", { name: "Trang bị", exact: true }).click();
  await expect(
    bamboo.getByRole("button", { name: "Đang dùng" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Mồi", exact: true }).click();
  await page
    .locator(".shop-card")
    .filter({ hasText: "Mồi giun" })
    .getByRole("button", { name: /Mua 10/ })
    .click();
  await expect(page.locator(".coin-counter b")).toHaveText("526");
  await page.getByRole("button", { name: "Đóng cửa hàng" }).click();
  await page.getByRole("button", { name: "Túi đồ" }).click();
  await page.getByRole("tab", { name: "Mồi", exact: true }).click();
  await page
    .locator(".owned-equipment")
    .filter({ hasText: "Mồi giun" })
    .getByRole("button", { name: "Trang bị", exact: true })
    .click();
  await page.getByRole("button", { name: "Đóng túi đồ" }).click();
  await page.getByRole("button", { name: "Thả câu" }).click();
  await expect(page.getByText("Thư thả một chút, cá đang đến.")).toBeVisible();
  await page.getByRole("button", { name: "Thu cần", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Chơi khách", exact: true }).click();
  await expect(page.locator(".equipment b")).toHaveText("Cần tre");
  await expect(page.locator(".equipment small")).toContainText("Mồi giun · 9");
  await expect(page.locator(".coin-counter b")).toHaveText("526");
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const name of ["Cửa hàng", "Album"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const box = await page.getByRole("dialog").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({
        path: `.local/m3-${name === "Album" ? "album" : "shop"}-${viewport.width}.png`,
      });
      await page
        .getByRole("button", {
          name: name === "Album" ? "Đóng album" : "Đóng cửa hàng",
        })
        .click();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
  }
  expect(errors).toEqual([]);
});
