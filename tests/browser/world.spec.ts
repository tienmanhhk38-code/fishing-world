import { test, expect } from "@playwright/test";

test("room codes, island map and automatic reconnect preserve one avatar", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let count = 0;
    const NativeWebSocket = window.WebSocket;
    class ObservedWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (new URL(String(url), location.href).pathname.startsWith("/socket/"))
          Object.assign(window, {
            gameTestSocket: this,
            gameTestSocketCount: ++count,
          });
      }
    }
    window.WebSocket = ObservedWebSocket;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Mã phòng", exact: true })
    .fill("NOTREAL");
  await page.getByRole("button", { name: "Vào phòng", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Không tìm thấy phòng");
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled();
  const code = await page.locator(".room span").first().innerText();
  await page.getByRole("button", { name: "Bản đồ", exact: true }).click();
  await page.getByRole("button", { name: "Vùng San Hô", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sắp mở", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Làng Chài", exact: true }).click();
  await page.screenshot({ path: ".local/island-map.png" });
  await page.getByRole("button", { name: "Dịch chuyển", exact: true }).click();
  await expect(page.locator(".location b")).toHaveText("Làng Chài");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".room span").first()).toHaveText(code);
  await page.waitForTimeout(600);
  await page.screenshot({ path: ".local/village.png" });
  const tokenBefore = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("fishing-room")!).token,
  );
  await page.evaluate(() =>
    (window as unknown as { gameTestSocket: WebSocket }).gameTestSocket.close(
      4001,
      "Simulated network drop",
    ),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { gameTestSocketCount: number })
            .gameTestSocketCount,
      ),
    )
    .toBeGreaterThan(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(sessionStorage.getItem("fishing-room")!).token,
      ),
    )
    .not.toBe(tokenBefore);
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled();
  await expect(
    page.locator(".nameplate").filter({ hasText: "Ngư dân" }),
  ).toHaveCount(1);
  await expect(page.locator(".location b")).toHaveText("Làng Chài");
  await expect(page.locator(".room span").first()).toHaveText(code);
  expect(errors).toEqual([]);
});
