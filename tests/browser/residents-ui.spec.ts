import { test, expect } from "@playwright/test";
test("nearby composer, profession residents and hover/hold emote picker", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1366, height: 768 },
    }),
    page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await page.getByRole("button", { name: "Tạo phòng mới" }).click();
    await page.locator(".nameplate").first().waitFor({ timeout: 60000 });
    await expect(page.locator(".nameplate")).not.toContainText(["NPC"]);
    await expect(page.locator(".resident-nameplate")).toHaveCount(0);
    for (const [width, height] of [
      [1366, 768],
      [390, 844],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByRole("button", { name: "Chat gần", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Tin nhắn gần", exact: true })
        .fill("Chào bạn");
      const box = await page.locator(".nearby-composer").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      await page.screenshot({
        path: `.local/upgrade-v5/chat-fixed-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(page.locator(".nearby-composer")).toHaveCount(0);
      const button = page.getByRole("button", {
        name: "Biểu cảm",
        exact: true,
      });
      await button.dispatchEvent("pointerdown", { pointerType: "touch" });
      await page.waitForTimeout(350);
      await button.dispatchEvent("pointerup", { pointerType: "touch" });
      await expect(
        page.getByRole("button", { name: "Vẫy tay", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Đóng biểu cảm", exact: true })
        .dispatchEvent("click");
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole("button", { name: "Bản đồ", exact: true }).click();
    await page.getByRole("button", { name: "Làng Chài", exact: true }).click();
    await page
      .getByRole("button", { name: "Dịch chuyển", exact: true })
      .click();
    await expect(
      page.locator(".resident-nameplate").filter({ hasText: "Cô Sáu" }),
    ).toBeVisible();
    await page.screenshot({ path: ".local/upgrade-v5/profession-npcs.png" });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
