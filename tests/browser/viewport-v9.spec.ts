import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("mobile keyboard keeps game anchored and landscape camera moves closer", async ({
  browser,
}) => {
  test.setTimeout(120000);
  await mkdir(".local/viewport-v9", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({
        version: 1,
        state: { quality: "low", soundMuted: true },
      }),
    );
    const vv = window.visualViewport!;
    const state = { height: 0, top: 0 };
    (window as any).__keyboardFixture = state;
    const height = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(vv),
      "height",
    )!.get!;
    const top = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(vv),
      "offsetTop",
    )!.get!;
    Object.defineProperty(vv, "height", {
      get: () => state.height || height.call(vv),
    });
    Object.defineProperty(vv, "offsetTop", {
      get: () => state.top || top.call(vv),
    });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function keyboard(height: number, top = 0) {
    await page.evaluate(
      ({ height, top }) => {
        Object.assign((window as any).__keyboardFixture, { height, top });
        visualViewport!.dispatchEvent(new Event("resize"));
        visualViewport!.dispatchEvent(new Event("scroll"));
      },
      { height, top },
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.dataset.keyboardOpen ?? "false",
        ),
      )
      .toBe(height ? "true" : "false");
  }
  try {
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phòng mới" }).click();
    await page.waitForFunction(
      () => !!window.__fishingDiagnostics?.localPlayer(),
      null,
      { timeout: 60000 },
    );
    const baseline = (await page.locator("main").boundingBox())!;
    await page.getByRole("button", { name: "Chat gần", exact: true }).click();
    await keyboard(480);
    expect((await page.locator("main").boundingBox())!.height).toBe(
      baseline.height,
    );
    expect((await page.locator("canvas").boundingBox())!.height).toBe(
      baseline.height,
    );
    const input = page.getByRole("textbox", {
      name: "Tin nhắn gần",
      exact: true,
    });
    await input.fill("Kiểm tra bàn phím, không gửi");
    expect(
      (await input.boundingBox())!.y + (await input.boundingBox())!.height,
    ).toBeLessThanOrEqual(480);
    await keyboard(480, 120);
    const root = (await page.locator("main").boundingBox())!;
    expect(root.y).toBe(120);
    const profile = (await page
      .getByRole("button", { name: "Chỉnh sửa nhân vật", exact: true })
      .boundingBox())!;
    expect(profile.y).toBeGreaterThanOrEqual(120);
    const box = (await page.locator(".nearby-composer").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(120);
    expect(box.y + box.height).toBeLessThanOrEqual(600);
    await page.screenshot({
      path: ".local/viewport-v9/keyboard-pan.png",
      clip: { x: 0, y: 120, width: 390, height: 480 },
    });
    await page.keyboard.press("Escape");
    await keyboard(0);
    expect((await page.locator("main").boundingBox())!.y).toBe(0);
    await page.getByRole("button", { name: "Mở chat", exact: true }).click();
    const worldInput = page.getByRole("textbox", {
      name: "Tin nhắn",
      exact: true,
    });
    await worldInput.fill("Chưa gửi");
    await keyboard(420);
    const worldBox = (await worldInput.boundingBox())!;
    expect(worldBox.y + worldBox.height).toBeLessThanOrEqual(420);
    await page.screenshot({
      path: ".local/viewport-v9/world-keyboard.png",
      clip: { x: 0, y: 0, width: 390, height: 420 },
    });
    await worldInput.blur();
    await keyboard(0);
    await page
      .getByRole("button", { name: "Thu gọn chat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Chỉnh sửa nhân vật", exact: true })
      .click();
    const name = page.getByRole("textbox", {
      name: "Tên nhân vật",
      exact: true,
    });
    await name.focus();
    await keyboard(390, 80);
    await name.scrollIntoViewIfNeeded();
    const n = (await name.boundingBox())!;
    expect(n.y + n.height).toBeLessThanOrEqual(470);
    const close = (await page
      .getByRole("button", { name: "Đóng nhân vật" })
      .boundingBox())!;
    expect(close.y).toBeGreaterThanOrEqual(80);
    await page.getByRole("button", { name: "Đóng nhân vật" }).click();
    await keyboard(0);
    await page.evaluate(() => window.__fishingDiagnostics!.setCamera(0, 0.3));
    await page.waitForTimeout(800);
    const distance = () =>
      page.evaluate(() => {
        const d = window.__fishingDiagnostics!;
        return (d.info.camera as number[])[2] - d.localPlayer()!.rendered.z;
      });
    const portrait = await distance();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue(
          "--game-height",
        ) === "390px",
    );
    await expect.poll(distance).toBeLessThan(portrait * 0.91);
    const landscape = await distance();
    expect(landscape).toBeGreaterThan(portrait * 0.84);
    await page.screenshot({ path: ".local/viewport-v9/landscape-zoom.png" });
    await writeFile(
      ".local/viewport-v9/validation.json",
      JSON.stringify({ portrait, landscape, baseline, errors }, null, 2),
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("desktop selected emote is compact", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
  const profile = await (await page.request.get("/api/profile")).json();
  await page.getByRole("button", { name: "Biểu cảm", exact: true }).hover();
  await page.getByRole("button", { name: "Vẫy tay", exact: true }).click();
  const emote = page.getByRole("img", {
    name: `Biểu cảm ${profile.name}`,
    exact: true,
  });
  await expect(emote).toHaveCSS("width", "48px");
  await expect(emote).toHaveCSS("font-size", "30px");
});
