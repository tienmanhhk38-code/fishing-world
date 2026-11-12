import { test, expect, type Locator } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../../apps/server/src/db";
import { speciesFor } from "../../packages/shared/src/index";
const phase = process.env.POPUP_PHASE ?? "after";
const views = [
  [360, 800],
  [390, 844],
  [844, 390],
  [740, 360],
  [1366, 768],
  [1920, 1080],
];
test.afterAll(() => db.$disconnect());
test("all popup layouts across portrait, landscape and desktop", async ({
  browser,
}) => {
  test.setTimeout(360000);
  await mkdir(`.local/popups-v8/${phase}`, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  const metrics: any[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() =>
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({
        version: 1,
        state: { quality: "low", soundMuted: true },
      }),
    ),
  );
  async function capture(name: string, locator: Locator) {
    await locator.waitFor();
    for (const [width, height] of views) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(
        (h) =>
          Math.abs(
            parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--visible-height",
              ),
            ) - h,
          ) < 1,
        height,
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await locator.evaluate((el) => {
        el.scrollTop = 0;
      });
      const data = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect(),
          title = el.querySelector("h2") ?? el.querySelector("b");
        return {
          box: { x: r.x, y: r.y, width: r.width, height: r.height },
          font: title ? getComputedStyle(title).fontSize : "",
          padding: getComputedStyle(el).padding,
          overflow: el.scrollWidth - el.clientWidth,
          buttons: Array.from(el.querySelectorAll("button"))
            .filter(
              (b) =>
                getComputedStyle(b).display !== "none" &&
                b.getBoundingClientRect().width > 0,
            )
            .map((b) => ({
              text: b.getAttribute("aria-label") ?? b.textContent,
              w: b.getBoundingClientRect().width,
              h: b.getBoundingClientRect().height,
            })),
          inputs: Array.from(
            el.querySelectorAll(
              "input:not([type=checkbox]):not([type=range]),select,textarea",
            ),
          ).map((i) => getComputedStyle(i).fontSize),
        };
      });
      metrics.push({ name, width, height, ...data });
      if (phase === "after") {
        expect(data.box.x, name).toBeGreaterThanOrEqual(-1);
        expect(data.box.y, name).toBeGreaterThanOrEqual(-1);
        expect(data.box.x + data.box.width, name).toBeLessThanOrEqual(
          width + 1,
        );
        expect(data.box.y + data.box.height, name).toBeLessThanOrEqual(
          height + 1,
        );
      }
      if (phase === "after" && (width <= 700 || height <= 550)) {
        expect(data.overflow, name).toBeLessThanOrEqual(1);
        for (const b of data.buttons) {
          expect(b.h, name + ":" + b.text).toBeGreaterThanOrEqual(44);
          expect(b.w, name + ":" + b.text).toBeGreaterThanOrEqual(44);
        }
        for (const size of data.inputs)
          expect(parseFloat(size), name).toBeGreaterThanOrEqual(16);
      }
      await page.screenshot({
        path: `.local/popups-v8/${phase}/${name}-${width}x${height}.png`,
      });
      if (phase === "after" && (width <= 700 || height <= 550)) {
        await locator.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const close = locator
          .locator('button[aria-label^="Đóng"],button[aria-label="Hủy bán cá"]')
          .first();
        if (await close.count()) {
          const r = (await close.boundingBox())!;
          expect(r.y, name + " close after scroll").toBeGreaterThanOrEqual(0);
          expect(
            r.y + r.height,
            name + " close after scroll",
          ).toBeLessThanOrEqual(height + 1);
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }
  async function feature(name: string) {
    const button = page.getByRole("button", { name: new RegExp("^" + name) });
    if (!(await button.isVisible()))
      await page
        .getByRole("button", { name: "Chức năng", exact: true })
        .click();
    await button.click();
  }
  async function gameFixture(result: boolean) {
    await page.evaluate(async (result) => {
      const url = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((n) => n.includes("/src/network.ts"))
        .at(-1)!;
      const { useGame } = await import(url);
      useGame.setState({
        result: result
          ? {
              ...useGame.getState().profile.fish[0],
              newSpecies: true,
              newRecord: true,
            }
          : null,
        phase: result ? "RESULT" : "IDLE",
      });
    }, result);
  }
  try {
    const identity = await (
      await context.request.get("http://127.0.0.1:5173/api/guest")
    ).json();
    await db.guest.update({
      where: { id: identity.profile.id },
      data: { coins: 123456789, xp: 400, revision: { increment: 1 } },
    });
    for (let i = 0; i < 14; i++) {
      const s = speciesFor(i === 0 ? "great_white_shark" : "megalodon")!;
      const round = await db.fishingRound.create({
        data: {
          id: randomUUID(),
          guestId: identity.profile.id,
          status: "SETTLED",
        },
      });
      await db.fish.create({
        data: {
          guestId: identity.profile.id,
          roundId: round.id,
          species: s.name,
          speciesId: s.id,
          grams: s.maxGrams,
          saleValue: 2000,
          xp: 200,
        },
      });
      await db.album.upsert({
        where: {
          guestId_speciesId: { guestId: identity.profile.id, speciesId: s.id },
        },
        create: {
          guestId: identity.profile.id,
          speciesId: s.id,
          count: 1,
          recordGrams: s.maxGrams,
        },
        update: { count: { increment: 1 } },
      });
    }
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await capture("rooms", page.locator(".room-panel"));
    await page.getByRole("button", { name: "Đóng chọn phòng" }).click();
    await page.getByRole("button", { name: "Nhân vật", exact: true }).click();
    await capture("appearance", page.locator(".appearance-panel"));
    if (phase === "after") {
      await page.route("**/api/character", (route) =>
        route.fulfill({
          status: 400,
          json: {
            error:
              "Không thể lưu thay đổi lúc này. Vui lòng kiểm tra kết nối và thử lại.",
          },
        }),
      );
      await page
        .getByRole("button", { name: "Lưu nhân vật", exact: true })
        .click();
      await expect(
        page.locator(".appearance-panel .panel-error"),
      ).toContainText("Không thể lưu thay đổi");
      await page.screenshot({
        path: ".local/popups-v8/after/appearance-error.png",
      });
      await page.unroute("**/api/character");
    }
    await page.getByRole("button", { name: "Đóng nhân vật" }).click();
    await page
      .getByRole("button", { name: "Cài đặt game", exact: true })
      .click();
    await capture("settings", page.locator(".settings-panel"));
    await page.getByRole("button", { name: "Đóng cài đặt" }).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(".settings-panel")).toBeHidden();
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page
      .getByRole("button", { name: "Tạo phòng mới", exact: true })
      .click();
    await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
    await feature("Túi đồ");
    await capture("inventory", page.locator(".inventory-panel"));
    await page.getByRole("tab", { name: "Cần câu", exact: true }).click();
    await capture("equipment", page.locator(".inventory-panel"));
    await page.getByRole("tab", { name: "Cá", exact: true }).click();
    await page.getByRole("button", { name: "Bán tất cả", exact: true }).click();
    await capture("sale", page.locator(".sale-panel"));
    if (phase === "after") {
      await page.evaluate(async () => {
        const url = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((n) => n.includes("/src/economy-client.ts"))
          .at(-1)!;
        const { useEconomy } = await import(url);
        useEconomy.setState({ busy: true });
      });
      await expect(
        page.getByRole("button", { name: "Đang bán…", exact: true }),
      ).toBeDisabled();
      await page.screenshot({
        path: ".local/popups-v8/after/sale-pending.png",
      });
      await page.evaluate(async () => {
        const url = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((n) => n.includes("/src/economy-client.ts"))
          .at(-1)!;
        const { useEconomy } = await import(url);
        useEconomy.setState({ busy: false });
      });
    }
    await page.getByRole("button", { name: "Hủy bán cá" }).click();
    await page.getByRole("button", { name: "Đóng túi đồ" }).click();
    await feature("Album");
    await capture("album", page.locator(".album-panel"));
    await page.getByRole("button", { name: "Đóng album" }).click();
    await feature("Nhiệm vụ");
    await capture("quests", page.locator(".quest-panel"));
    await page.getByRole("button", { name: "Đóng nhiệm vụ" }).click();
    await feature("Cách chơi");
    await capture("help", page.locator(".help"));
    await page.getByRole("button", { name: "Đóng hướng dẫn" }).click();
    await expect(
      page.getByRole("button", { name: "Cộng đồng", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".community-people,.member-list")).toHaveCount(0);
    await page.getByRole("button", { name: "Chat gần", exact: true }).click();
    await capture("nearby", page.locator(".nearby-composer"));
    if (phase === "after") {
      await page
        .getByRole("textbox", { name: "Tin nhắn gần", exact: true })
        .fill("Kiểm tra ô nhập — chưa gửi");
      await page.setViewportSize({ width: 390, height: 420 });
      await page.waitForFunction(
        () =>
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--visible-height",
            ),
          ) === 420,
      );
      const input = (await page
        .getByRole("textbox", { name: "Tin nhắn gần", exact: true })
        .boundingBox())!;
      expect(input.y + input.height).toBeLessThanOrEqual(420);
      await page.screenshot({
        path: ".local/popups-v8/after/nearby-keyboard-height.png",
      });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.keyboard.press("Escape");
    await feature("Bản đồ");
    await capture("map", page.locator(".map-panel"));
    await page.getByRole("button", { name: "Làng Chài", exact: true }).click();
    await page
      .getByRole("button", { name: "Dịch chuyển", exact: true })
      .click();
    await page.getByRole("button", { name: "Cửa hàng", exact: true }).click();
    await capture("shop", page.locator(".shop-panel"));
    await page.getByRole("tab", { name: "Mồi", exact: true }).click();
    await capture("shop-baits", page.locator(".shop-panel"));
    await page.getByRole("button", { name: "Đóng cửa hàng" }).click();
    await gameFixture(true);
    await capture("result", page.locator(".result"));
    await gameFixture(false);
    if (phase === "after") {
      const before = await readFile(
        ".local/popups-v8/before/metrics.json",
        "utf8",
      )
        .then(JSON.parse)
        .catch(() => null);
      if (before)
        for (const m of metrics.filter((m) => m.width >= 1300)) {
          const old = before.metrics.find(
            (b: any) => b.name === m.name && b.width === m.width,
          );
          expect(
            { font: m.font, padding: m.padding, width: m.box.width },
            m.name + " desktop unchanged",
          ).toEqual({
            font: old.font,
            padding: old.padding,
            width: old.box.width,
          });
        }
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(
      `.local/popups-v8/${phase}/metrics.json`,
      JSON.stringify({ metrics, errors }, null, 2),
    );
    await context.close();
  }
});
