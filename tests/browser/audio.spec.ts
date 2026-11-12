import { test, expect } from "@playwright/test";

test.describe("lobby startup", () => {
  test.use({ hasTouch: true });
  test("lobby attempts music on load, unlocks on a background gesture and defaults to 50 percent", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      (window as any).__lobbyAttempts = [];
      HTMLMediaElement.prototype.play = function () {
        if (this.src.includes("/music/lobby-song.mp3"))
          (window as any).__lobbyAttempts.push(this);
        return play.call(this);
      };
    });
    await page.goto("/");
    await expect
      .poll(() => page.evaluate(() => (window as any).__lobbyAttempts.length))
      .toBeGreaterThan(0);
    await page.touchscreen.tap(950, 640);
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (window as any).__lobbyAttempts.some(
              (a: HTMLAudioElement) => !a.paused && a.currentTime > 0.1,
            ),
          ),
        { timeout: 5000 },
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Cài đặt game", exact: true })
      .click();
    await expect(page.getByLabel("Nhạc nền", { exact: true })).toHaveValue(
      "50",
    );
  });
});
test("music streams, crossfades on room changes and survives menus and hidden tab", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const audio: HTMLAudioElement[] = [];
    (window as any).__music = audio;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (
        this.src.includes("/music/") &&
        !audio.includes(this as HTMLAudioElement)
      )
        audio.push(this as HTMLAudioElement);
      return play.call(this);
    };
    (window as any).__decodedHeaders = [];
    if (typeof AudioContext !== "undefined") {
      const decode = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = function (
        b: ArrayBuffer,
        ...rest: any[]
      ) {
        (window as any).__decodedHeaders.push(
          Array.from(new Uint8Array(b, 0, 4)),
        );
        return decode.call(this, b, ...(rest as []));
      };
    }
    localStorage.setItem(
      "fishing-player-settings",
      JSON.stringify({
        version: 1,
        state: { quality: "low", fps: 30, musicVolume: 0.25, volume: 0.5 },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Cài đặt game", exact: true }).click();
  await page.getByRole("button", { name: "Đóng cài đặt" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__music.find((a: HTMLAudioElement) =>
            a.src.includes("lobby"),
          )?.currentTime ?? 0,
      ),
    )
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await page.getByRole("button", { name: "Thả câu" }).waitFor();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__music.find((a: HTMLAudioElement) =>
            a.src.includes("game"),
          )?.currentTime ?? 0,
      ),
    )
    .toBeGreaterThan(0.3);
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(
      () =>
        (window as any).__music.find((a: HTMLAudioElement) =>
          a.src.includes("lobby"),
        ).paused,
    ),
  ).toBe(true);
  const before = await page.evaluate(
    () =>
      (window as any).__music.find((a: HTMLAudioElement) =>
        a.src.includes("game"),
      ).currentTime,
  );
  await page.getByRole("button", { name: "Cài đặt game", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Đóng cài đặt" }).click();
  expect(
    await page.evaluate(
      () =>
        (window as any).__music.find((a: HTMLAudioElement) =>
          a.src.includes("game"),
        ).currentTime,
    ),
  ).toBeGreaterThan(before);
  const media = await page.evaluate(() =>
    (window as any).__music.map((a: HTMLAudioElement) => ({
      duration: a.duration,
      preload: a.preload,
      loop: a.loop,
    })),
  );
  expect(
    media.every((m: any) => m.duration > 100 && m.preload === "auto" && m.loop),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      (window as any).__decodedHeaders.every(
        (h: number[]) => String.fromCharCode(...h) === "RIFF",
      ),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(
    await page.evaluate(() =>
      (window as any).__music.every((a: HTMLAudioElement) => a.paused),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__music.find((a: HTMLAudioElement) =>
            a.src.includes("game"),
          ).paused,
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Cài đặt game", exact: true }).click();
  await page.getByRole("button", { name: "Về lobby", exact: true }).click();
  await page.getByRole("button", { name: "Chơi khách", exact: true }).waitFor();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__music.find((a: HTMLAudioElement) =>
            a.src.includes("lobby"),
          ).currentTime,
      ),
    )
    .toBeGreaterThan(0.2);
  await page.waitForTimeout(1300);
  expect(
    await page.evaluate(
      () =>
        (window as any).__music.find((a: HTMLAudioElement) =>
          a.src.includes("game"),
        ).paused,
    ),
  ).toBe(true);
});
test("unavailable music does not block fishing or effect loading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__effectAttempts = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes("/music/"))
        return Promise.reject(
          new DOMException("Fixture: music unavailable", "NotSupportedError"),
        );
      if (this.src.endsWith("/cast.wav")) (window as any).__effectAttempts++;
      return play.call(this);
    };
  });
  await page.route("**/music/*.mp3", (r) => r.abort());
  const effects: string[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith("/cast.wav") && r.ok()) effects.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await page.getByRole("button", { name: "Thả câu" }).click();
  await expect(page.getByRole("button", { name: "Giật cần" })).toBeVisible();
  await expect
    .poll(
      async () =>
        effects.length +
        (await page.evaluate(() => (window as any).__effectAttempts)),
    )
    .toBeGreaterThan(0);
});
