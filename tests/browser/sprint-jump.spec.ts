import { test, expect } from "@playwright/test";
test("touch joystick, run toggle and jump work simultaneously", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({
        version: 1,
        state: { quality: "low", fps: 60, soundMuted: true },
      }),
    ),
  );
  const page = await context.newPage();
  try {
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phòng mới" }).click();
    await page.waitForFunction(
      () => !!window.__fishingDiagnostics?.localPlayer(),
      null,
      { timeout: 60000 },
    );
    await page.evaluate(() => window.__fishingDiagnostics!.setCamera(0));
    await page.getByRole("button", { name: "Chạy", exact: true }).tap();
    const joystick = (await page.locator(".joystick").boundingBox())!,
      jump = (await page
        .getByRole("button", { name: "Nhảy", exact: true })
        .boundingBox())!;
    const cdp = await context.newCDPSession(page),
      j = {
        id: 1,
        x: joystick.x + joystick.width / 2,
        y: joystick.y + joystick.height / 2,
      },
      move = { ...j, x: j.x + 35 },
      hop = { id: 2, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 };
    const send = (type: string, points: object[]) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: type as any,
        touchPoints: points as any,
      });
    await send("touchStart", [j]);
    await send("touchMove", [move]);
    await page.waitForTimeout(200);
    const before = await page.evaluate(
      () => window.__fishingDiagnostics!.localPlayer()!.server,
    );
    await send("touchStart", [move, hop]);
    await page.waitForTimeout(150);
    const air = await page.evaluate(
      () => window.__fishingDiagnostics!.localPlayer()!.server,
    );
    expect(air.grounded).toBe(false);
    expect(air.running).toBe(true);
    expect(air.y - before.y).toBeGreaterThan(0.4);
    expect(air.x - before.x).toBeGreaterThan(0.6);
    await send("touchEnd", [move]);
    await page.waitForTimeout(200);
    await send("touchEnd", []);
    await expect(
      page.getByRole("button", { name: "Chạy", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    await context.close();
  }
});
