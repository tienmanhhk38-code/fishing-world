import { db } from "../../apps/server/src/db";
import { test, expect } from "@playwright/test";
test("two guests share the dock, catch exactly once and reload persisted fish", async ({
  browser,
  browserName,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  test.setTimeout(240000);
  for (const context of [a, b])
    await context.addInitScript(() =>
      localStorage.setItem(
        "fishing-player-settings",
        JSON.stringify({
          version: 1,
          state: { quality: "low", fps: 30, soundMuted: true },
        }),
      ),
    );
  const p = await a.newPage(),
    q = await b.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/?diagnostics=1");
  await p.screenshot({ path: ".local/landing.png" });
  await p.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await p.getByRole("button", { name: "Tạo phòng mới" }).click();
  await expect(p.getByRole("button", { name: "Thả câu" })).toBeEnabled({
    timeout: 30000,
  });
  await q.goto("/?diagnostics=1");
  const code = (await p.locator(".room span").first().innerText()).replace(
    "Mã phòng ",
    "",
  );
  await q.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await q.getByRole("textbox", { name: "Mã phòng", exact: true }).fill(code);
  await q.getByRole("button", { name: "Vào phòng", exact: true }).click();
  await expect(p.locator(".location small")).toHaveText("Bến bình yên");
  await p.bringToFront();
  const playerName = await p.locator(".profile b").innerText();
  const avatarSeenByOtherPlayer = q
    .locator(".nameplate")
    .filter({ hasText: playerName });
  await q.bringToFront();
  await q
    .locator(".asset-loading-screen")
    .waitFor({ state: "hidden", timeout: 60000 });
  await p.bringToFront();
  await p
    .locator(".asset-loading-screen")
    .waitFor({ state: "hidden", timeout: 60000 });
  await p.locator(".nameplate").first().waitFor();
  await p.waitForFunction(() => !!window.__fishingDiagnostics?.localPlayer());
  await p.mouse.click(500, 450);
  const initialPose = await p.evaluate(
    () => window.__fishingDiagnostics!.localPlayer()!.server,
  );
  await p.keyboard.down("KeyD");
  await p.waitForTimeout(700);
  await p.keyboard.up("KeyD");
  await expect
    .poll(async () => {
      const other = await q.evaluate(
        (id) => window.__fishingDiagnostics?.players().find((p) => p.id === id),
        initialPose.id,
      );
      return other
        ? Math.hypot(other.x - initialPose.x, other.z - initialPose.z)
        : 0;
    })
    .toBeGreaterThan(1);
  await q.bringToFront();
  await expect(avatarSeenByOtherPlayer).toBeVisible();
  await p.bringToFront();
  const initial = 0;
  await p.screenshot({ path: ".local/game-desktop.png" });
  await p.getByRole("button", { name: "Thả câu" }).click();
  await expect(p.getByText("Thư thả một chút, cá đang đến.")).toBeVisible();
  await p.getByRole("button", { name: "Giật cần" }).click();
  await expect(p.getByText("Bạn giật sớm quá", { exact: false })).toBeVisible();
  await p.waitForTimeout(900);
  let caught = false;
  for (let attempt = 0; attempt < 3 && !caught; attempt++) {
    await p.getByRole("button", { name: "Thả câu" }).click();
    const guestId = (await (await p.request.get("/api/profile")).json()).id;
    const round = await db.fishingRound.findFirstOrThrow({
      where: { guestId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    await db.fishingRound.update({
      where: { id: round.id },
      data: { plan: { ...(round.plan as any), escape: false } },
    });
    await p.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 23000);
          const hook = () => {
            if (
              document.querySelector(".hint b")?.textContent !==
              "Cá cắn! Giật cần ngay!"
            )
              return;
            clearTimeout(timer);
            observer.disconnect();
            for (let i = 0; i < 5; i++)
              document.querySelector<HTMLButtonElement>(".cast")!.click();
            resolve();
          };
          const observer = new MutationObserver(hook);
          observer.observe(document.querySelector(".hint")!, {
            subtree: true,
            childList: true,
            characterData: true,
          });
          hook();
        }),
    );
    await p.waitForFunction(
      () =>
        document.querySelector(".result") ||
        /bơi mất|Đứt dây/.test(
          document.querySelector(".hint b")?.textContent ?? "",
        ),
      null,
      { timeout: 20000 },
    );
    caught = await p
      .getByRole("button", { name: "Khoe cá", exact: true })
      .isVisible();
    if (!caught) {
      console.log("QA: valid missed hook, retrying");
      await p.waitForTimeout(900);
    }
  }
  await expect(p.getByText("BẮT ĐƯỢC RỒI!", { exact: false })).toBeVisible();
  await p.bringToFront();
  await expect(q.locator(".showcase")).toHaveCount(0);
  await p.getByRole("button", { name: "Khoe cá", exact: true }).click();
  await expect(p.getByRole("button", { name: "Cất cá" })).toBeVisible();
  console.log("QA: show acknowledged");
  await q.bringToFront();
  await expect(q.locator(".showcase")).toContainText("kg");
  console.log("QA: remote show visible");
  await p.bringToFront();
  await p.getByRole("button", { name: "Cất cá" }).click();
  await expect(p.locator(".badge")).toHaveText(String(initial + 1));
  await p.screenshot({ path: ".local/catch.png" });
  console.log("QA: stowed, reload");
  await p.reload();
  await p.waitForTimeout(1000);
  await p.getByRole("button", { name: "Chơi khách", exact: true }).click();
  await expect(p.getByRole("button", { name: "Thả câu" })).toBeEnabled({
    timeout: 30000,
  });
  await p.getByRole("button", { name: "Túi đồ" }).click();
  await expect(p.locator(".fish-grid article")).toHaveCount(initial + 1);
  await p.getByRole("tab", { name: "Cần câu", exact: true }).click();
  await expect(p.locator(".owned-equipment .asset-image")).toHaveAttribute(
    "src",
    /rod_wood/,
  );
  await p.getByRole("tab", { name: "Mồi", exact: true }).click();
  await expect(
    p
      .locator(".owned-equipment")
      .filter({ hasText: "Mồi thường" })
      .locator(".asset-image"),
  ).toHaveAttribute("src", /bait_dough/);
  await p.getByRole("tab", { name: "Cá", exact: true }).click();
  await p.screenshot({ path: ".local/inventory.png" });
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});
test("portrait and landscape keep action reachable", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await context.newPage();
  await p.goto("/");
  await p.getByRole("button", { name: "Cài đặt game", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByLabel("Chất lượng đồ họa")
    .selectOption("low");
  await p.screenshot({ path: ".local/settings-mobile.png" });
  await p.getByRole("button", { name: "Đóng cài đặt" }).click();
  await p.getByRole("button", { name: "Chơi khách", exact: true }).click();
  await expect(p.getByRole("button", { name: "Thả câu" })).toBeEnabled({
    timeout: 30000,
  });
  await p.screenshot({ path: ".local/game-mobile.png" });
  for (const button of await p.locator(".hud-emotes button").all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await p.setViewportSize({ width: 844, height: 390 });
  await p.screenshot({ path: ".local/game-landscape.png" });
  await context.close();
});
