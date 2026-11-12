import { test, expect } from "@playwright/test";
import { db } from "../../apps/server/src/db";
import { speciesFor } from "../../packages/shared/src/index";
import { mkdir, writeFile } from "node:fs/promises";

test.afterAll(() => db.$disconnect());
test("nibbles, line break, water motion and 150 kg two-hand carry render in the real scene", async ({
  browser,
}) => {
  test.setTimeout(180000);
  await mkdir(".local/upgrade-v5/video", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: {
      dir: ".local/upgrade-v5/video",
      size: { width: 1024, height: 576 },
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() =>
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({
        version: 1,
        state: {
          quality: "high",
          fps: 60,
          soundMuted: false,
          musicVolume: 0,
          ambienceVolume: 0,
        },
      }),
    ),
  );
  try {
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phòng mới" }).click();
    await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
    await page
      .locator(".asset-loading")
      .waitFor({ state: "hidden", timeout: 60000 });
    const profile = await (await page.request.get("/api/profile")).json();
    for (const escape of [true, false]) {
      await page.getByRole("button", { name: "Thả câu" }).click();
      await expect
        .poll(() =>
          db.fishingRound.findFirst({
            where: { guestId: profile.id, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
          }),
        )
        .not.toBeNull();
      const round = await db.fishingRound.findFirstOrThrow({
        where: { guestId: profile.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      await db.fishingRound.update({
        where: { id: round.id },
        data: {
          plan: { ...(round.plan as object), escape, reelMs: 3200 },
          selected: JSON.parse(
            JSON.stringify({ species: speciesFor("marlin")!, grams: 150000 }),
          ),
        },
      });
      await page.evaluate(() => {
        const w = window as any;
        w.fishingVisualPhases = [];
        w.fishingVisualHooked = false;
        const observer = new MutationObserver(() => {
          const text = document.querySelector(".hint b")?.textContent ?? "";
          w.fishingVisualPhases.push(text);
          if (text === "Cá cắn! Giật cần ngay!") {
            observer.disconnect();
            setTimeout(() => {
              document.querySelector<HTMLButtonElement>(".cast")?.click();
              w.fishingVisualHooked = true;
            }, 150);
          }
        });
        observer.observe(document.querySelector(".hint")!, {
          subtree: true,
          childList: true,
          characterData: true,
        });
      });
      // A nibble may last only 200 ms; persist the observed cue rather than
      // polling visible text at Playwright's increasing retry intervals.
      await page.waitForFunction(
        () =>
          (window as any).fishingVisualPhases.some((text: string) =>
            text.includes("Cá đang nhấp"),
          ),
        null,
        { timeout: 22000 },
      );
      await page.screenshot({
        path: `.local/upgrade-v5/${escape ? "break" : "giant"}-nibble.png`,
      });
      await page.waitForFunction(
        () => (window as any).fishingVisualHooked,
        null,
        { timeout: 25000 },
      );
      await expect(
        page.getByRole("button", { name: "Đang kéo", exact: false }),
      ).toBeVisible();
      await page.screenshot({
        path: `.local/upgrade-v5/${escape ? "break" : "giant"}-reeling.png`,
      });
      if (escape) {
        await expect(page.locator(".hint")).toContainText("Đứt dây rồi!", {
          timeout: 10000,
        });
        await page.screenshot({ path: ".local/upgrade-v5/line-break.png" });
        expect(await db.fish.count({ where: { guestId: profile.id } })).toBe(0);
        await page.waitForTimeout(900);
      } else {
        await page
          .getByRole("button", { name: "Khoe cá", exact: true })
          .click();
        await expect(page.locator(".showcase")).toContainText("150,00 kg");
        await page.waitForTimeout(350);
        const pose = await page.evaluate(() => {
          const d = window.__fishingDiagnostics!;
          return d
            .presentations()
            .find((p) => p.id === d.localPlayer()!.server.id)!;
        });
        expect(pose.rodVisible).toBe(false);
        expect(pose.arms.every((a) => a < -2.8)).toBe(true);
        expect(pose.fishLength).toBeGreaterThan(3.7);
        await page.screenshot({ path: ".local/upgrade-v5/giant-showcase.png" });
        await page.keyboard.down("KeyD");
        await page.waitForTimeout(200);
        await page.keyboard.up("KeyD");
        await page.keyboard.press("Space");
        await page.waitForTimeout(150);
        expect(
          await page.evaluate(() => {
            const d = window.__fishingDiagnostics!;
            return d
              .presentations()
              .find((p) => p.id === d.localPlayer()!.server.id)!.rodVisible;
          }),
        ).toBe(false);
        await writeFile(
          ".local/upgrade-v5/giant-pose.json",
          JSON.stringify({ pose, errors }, null, 2),
        );
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
