import { test, expect } from "@playwright/test";

test("lobby preferences persist and affect render resolution", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 700 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: ".local/art-lobby.png" });
  await page.getByRole("button", { name: "Cài đặt game", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Chất lượng đồ họa").selectOption("low");
  await dialog.getByLabel("Giới hạn khung hình").selectOption("60");
  await dialog.getByLabel("Âm lượng hiệu ứng", { exact: true }).focus();
  await page.keyboard.press("Home");
  await dialog.getByLabel("Âm thanh môi trường", { exact: true }).focus();
  await page.keyboard.press("End");
  await dialog.getByLabel("Nhạc nền", { exact: true }).focus();
  await page.keyboard.press("Home");
  await dialog.getByRole("switch", { name: "Tắt toàn bộ âm thanh" }).check();
  await dialog.getByLabel("Độ nhạy xoay camera", { exact: true }).focus();
  await page.keyboard.press("End");
  await dialog.getByRole("switch", { name: "Đảo chiều trục dọc" }).check();
  await dialog.getByRole("switch", { name: "Giảm chuyển động" }).check();
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) => canvas.width),
    )
    .toBe(1000);
  await dialog
    .getByRole("switch", { name: "Hiện khoe cá của người khác" })
    .uncheck();
  await page.screenshot({ path: ".local/lobby-settings.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Cài đặt game", exact: true }).click();
  await expect(dialog.getByLabel("Chất lượng đồ họa")).toHaveValue("low");
  await expect(dialog.getByLabel("Giới hạn khung hình")).toHaveValue("60");
  await expect(
    dialog.getByLabel("Âm lượng hiệu ứng", { exact: true }),
  ).toHaveValue("0");
  await expect(
    dialog.getByLabel("Âm thanh môi trường", { exact: true }),
  ).toHaveValue("100");
  await expect(dialog.getByLabel("Nhạc nền", { exact: true })).toHaveValue("0");
  await expect(
    dialog.getByRole("switch", { name: "Tắt toàn bộ âm thanh" }),
  ).toBeChecked();
  await expect(
    dialog.getByLabel("Độ nhạy xoay camera", { exact: true }),
  ).toHaveValue("200");
  await expect(
    dialog.getByRole("switch", { name: "Đảo chiều trục dọc" }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("switch", { name: "Hiện khoe cá của người khác" }),
  ).not.toBeChecked();
  await dialog.getByRole("button", { name: "Mặc định" }).click();
  await expect(dialog.getByLabel("Chất lượng đồ họa")).toHaveValue("high");
  await expect(
    dialog.getByLabel("Âm thanh môi trường", { exact: true }),
  ).toHaveValue("45");
  await expect(dialog.getByLabel("Nhạc nền", { exact: true })).toHaveValue(
    "50",
  );
  await expect(
    dialog.getByRole("switch", { name: "Tắt toàn bộ âm thanh" }),
  ).not.toBeChecked();
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) => canvas.width),
    )
    .toBe(1500);
  expect(errors).toEqual([]);
  await context.close();
});
