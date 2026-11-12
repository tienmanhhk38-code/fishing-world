import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const sizes = [
  ["desktop", 1366, 768],
  ["desktop-wide", 1920, 1080],
  ["portrait", 390, 844],
  ["portrait-small", 360, 800],
  ["landscape", 844, 390],
  ["landscape-small", 740, 360],
] as const;
for (const [name, width, height] of sizes)
  test(`lobby and HUD layout ${name}`, async ({ browser }) => {
    test.setTimeout(90000);
    await mkdir(".local/layout-v7", { recursive: true });
    const mobile = name.startsWith("portrait") || name.startsWith("landscape");
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto("/?diagnostics=1");
      await page.locator(".landing-actions").waitFor();
      await page
        .locator(".asset-loading")
        .waitFor({ state: "hidden", timeout: 60000 });
      await expect
        .poll(() =>
          page.evaluate(() => window.__fishingDiagnostics?.samples.length ?? 0),
        )
        .toBeGreaterThan(4);
      const logo = (await page.locator(".landing > .logo").boundingBox())!,
        actions = (await page.locator(".landing-actions").boundingBox())!;
      expect(logo.y).toBeLessThan(height * 0.15);
      if (name.startsWith("portrait")) {
        expect(logo.x).toBeLessThan(24);
        expect(
          Math.abs(actions.x + actions.width / 2 - width / 2),
        ).toBeLessThan(2);
        expect(actions.y).toBeGreaterThan(height * 0.6);
      }
      if (name.startsWith("landscape")) {
        const buttons = await page
          .locator(".landing-actions > button")
          .evaluateAll((nodes) =>
            nodes.map((n) => ({
              width: n.getBoundingClientRect().width,
              height: n.getBoundingClientRect().height,
            })),
          );
        expect(new Set(buttons.map((b) => b.width)).size).toBe(1);
        expect(buttons.every((b) => b.height === 44)).toBe(true);
      }
      expect(actions.y + actions.height).toBeLessThan(height);
      await page.screenshot({ path: `.local/layout-v7/lobby-${name}.png` });
      await page
        .getByRole("button", { name: "Chọn phòng", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Tạo phòng mới", exact: true })
        .click();
      await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
      await page
        .locator(".asset-loading")
        .waitFor({ state: "hidden", timeout: 60000 });
      const coin = (await page.locator(".coin-counter").boundingBox())!,
        settings = (await page
          .getByRole("button", { name: "Cài đặt game", exact: true })
          .boundingBox())!;
      expect(settings.x - coin.x - coin.width).toBeCloseTo(8, 0);
      expect(coin.y).toBeCloseTo(settings.y, 0);
      if (!mobile) {
        await expect(page.locator(".camera-reset")).toBeVisible();
        await expect(page.locator(".side .camera-menu")).toBeHidden();
        const sound = (await page
            .getByRole("button", { name: "Âm thanh", exact: true })
            .boundingBox())!,
          camera = (await page.locator(".camera-reset").boundingBox())!;
        expect(camera.x - sound.x - sound.width).toBeCloseTo(10, 0);
      } else {
        const stick = (await page.locator(".joystick").boundingBox())!;
        expect(stick.width).toBe(name.startsWith("portrait") ? 136 : 116);
        const chat = (await page
          .getByRole("button", { name: "Mở chat", exact: true })
          .boundingBox())!;
        await expect(
          page.getByRole("button", { name: "Cộng đồng", exact: true }),
        ).toHaveCount(0);
        if (name.startsWith("portrait")) {
          const room = (await page.locator("main > .room").boundingBox())!;
          expect(room.y).toBeCloseTo(settings.y, 0);
          expect(coin.x - room.x - room.width).toBeGreaterThanOrEqual(8);
          expect(chat.y).toBeCloseTo(settings.y + 58, 0);
          expect(chat.x + chat.width).toBeCloseTo(width - 12, 0);
          const cast = (await page.locator("button.cast").boundingBox())!,
            run = (await page
              .getByRole("button", { name: "Chạy", exact: true })
              .boundingBox())!,
            jump = (await page
              .getByRole("button", { name: "Nhảy", exact: true })
              .boundingBox())!;
          const emote = (await page
              .getByRole("button", { name: "Biểu cảm", exact: true })
              .boundingBox())!,
            nearby = (await page
              .getByRole("button", { name: "Chat gần", exact: true })
              .boundingBox())!;
          expect(run.y - cast.y - cast.height).toBeGreaterThanOrEqual(8);
          expect(jump.y).toBeCloseTo(run.y, 0);
          expect(jump.y + jump.height).toBeLessThanOrEqual(height - 16);
          expect(nearby.y).toBeCloseTo(emote.y, 0);
          expect(nearby.width).toBe(44);
          expect(cast.y - nearby.y - nearby.height).toBeGreaterThanOrEqual(8);
          await expect(page.locator(".nearby-toggle span")).toBeHidden();
        } else {
          expect(chat.height).toBe(44);
          expect(chat.x).toBeGreaterThanOrEqual(stick.x + stick.width + 8);
        }
      }
      await page.screenshot({ path: `.local/layout-v7/game-${name}.png` });
      await page.getByRole("button", { name: "Mở chat", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Thu gọn chat", exact: true }),
      ).toBeVisible();
      const chat = page.locator(".chat-dock");
      const chatBox = (await chat.boundingBox())!;
      expect(chatBox.x).toBeGreaterThanOrEqual(0);
      expect(chatBox.x + chatBox.width).toBeLessThanOrEqual(width);
      if (name === "portrait") {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForFunction(
          () =>
            parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--visible-height",
              ),
            ) === 390,
        );
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        const rotated = (await chat.boundingBox())!;
        expect(rotated.x + rotated.width).toBeLessThanOrEqual(844);
        expect(rotated.y + rotated.height).toBeLessThanOrEqual(390);
        await page.setViewportSize({ width, height });
      }
      await page
        .getByRole("button", { name: "Thu gọn chat", exact: true })
        .click();
      expect(errors).toEqual([]);
      await writeFile(
        `.local/layout-v7/${name}.json`,
        JSON.stringify({ logo, actions, coin, settings, errors }, null, 2),
      );
    } finally {
      await context.close();
    }
  });
