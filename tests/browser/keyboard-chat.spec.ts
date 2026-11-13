import { test, expect } from "@playwright/test";

test("keyboard shortcuts and nearby composer preserve gameplay UI", async ({ page }) => {
  const sent: string[] = [];
  page.on("websocket", (socket) => socket.on("framesent", ({ payload }) => {
    sent.push(payload.toString());
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await expect(page.getByRole("button", { name: "Thả câu F", exact: true })).toBeVisible();
  await page.locator("canvas").click();
  await page.keyboard.press("c");
  await expect(page.locator(".chat-dock")).toHaveClass(/expanded/);
  await page.keyboard.press("c");
  await expect(page.locator(".chat-dock")).not.toHaveClass(/expanded/);
  await page.keyboard.press("Enter");
  const nearby = page.getByRole("textbox", { name: "Tin nhắn gần", exact: true });
  await expect(nearby).toBeFocused();
  await nearby.fill("c và f vẫn nhập được");
  await expect(nearby).toHaveValue("c và f vẫn nhập được");
  await expect(nearby).toHaveCSS("outline-color", "rgb(160, 231, 251)");
  await expect(page.locator(".nearby-dismiss")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.screenshot({ path: ".local/keyboard-chat-nearby.png" });
  await page.keyboard.press("Escape");
  await expect(nearby).toHaveCount(0);
  await expect(page.locator("main")).not.toHaveClass(/chat-typing/);

  for (const [width, height] of [[1366, 768], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const location = page.locator(".location");
    await expect(location).toBeVisible();
    const box = await location.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    const padding = await location.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
    expect(padding).toBeGreaterThan(0);
    await location.screenshot({ path: `.local/keyboard-chat-location-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  // Simulate a received result to isolate the shortcut from random fishing outcomes.
  await page.evaluate(async () => {
    const path = "/src/network.ts";
    const { useGame } = await import(/* @vite-ignore */ path);
    useGame.setState({ phase: "RESULT", result: {
      id: "shortcut-fixture", species: "Cá thu", grams: 1000,
      caughtAt: new Date().toISOString(), rarity: "common",
    } });
  });
  await expect(page.getByRole("button", { name: "Câu tiếp", exact: true })).toBeVisible();
  await page.keyboard.press("f");
  await expect.poll(() => sent.filter((frame) => frame.includes("FISH_CONTINUE")).length).toBe(1);
});
