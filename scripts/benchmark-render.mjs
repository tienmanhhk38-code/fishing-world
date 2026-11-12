import { chromium } from "@playwright/test";
import { Client } from "colyseus.js";
import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname } from "node:path";
const base = process.env.BENCH_URL ?? "https://localhost:8443",
  output = process.env.BENCH_OUTPUT ?? ".local/m5/render-before.json";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  bots = [];
let movement;
const hardware = process.env.BENCH_HARDWARE === "true";
const quality = process.env.BENCH_QUALITY === "high" ? "high" : "low";
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    ...(hardware
      ? ["--use-angle=d3d11", "--use-gl=angle", "--disable-software-rasterizer"]
      : []),
  ],
});
try {
  const sdk = new Client(
    process.env.BENCH_SOCKET_URL ?? base.replace(/^http/, "ws"),
    {
      headers: { Origin: base },
    },
  );
  for (let i = 0; i < 19; i++) {
    const { ticket } = await (
      await fetch(base + "/api/guest", { headers: { Origin: base } })
    ).json();
    const room = i
      ? await sdk.joinById(bots[0].room.roomId, { ticket })
      : await sdk.create("beach", { ticket });
    const bot = {
      room,
      self: null,
      round: "",
      next: performance.now() + 1000 + i * 80,
      index: i,
    };
    bots.push(bot);
    room.onMessage("*", () => {});
    room.onMessage("PING", (nonce) => room.send("PONG", nonce));
    room.onMessage("WORLD", (players) => {
      bot.self = players.find((p) => p.id === room.sessionId);
    });
    room.onMessage("FISH_STARTED", (data) => {
      bot.round = data.roundId;
    });
    room.onMessage("FISH_RESULT", () => room.send("FISH_STOW", {}));
    room.onMessage("FISH_ENDED", () => {
      bot.round = "";
      bot.next = performance.now() + 1200;
    });
    room.onMessage("FISH_CUE", (cue) => {
      if (cue.phase === "BITE_WINDOW")
        setTimeout(() => {
          if (room.connection.isOpen)
            room.send("FISH_HOOK", { roundId: bot.round });
        }, 180);
    });
  }
  movement = setInterval(() => {
    for (const bot of bots) {
      if (!bot.self || bot.self.phase !== "IDLE") continue;
      const targetX = [-6, -4, -2, 0, 2, 4, 6][bot.index % 7],
        targetZ = 1.9,
        dx = targetX - bot.self.x,
        dz = targetZ - bot.self.z,
        d = Math.hypot(dx, dz);
      bot.room.send(
        "PLAYER_INPUT",
        d > 0.2
          ? { x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }
          : { x: 0, z: 0 },
      );
      if (d < 0.3 && !bot.round && performance.now() > bot.next) {
        bot.next = performance.now() + 3000;
        bot.room.send("FISH_START", {});
      }
    }
  }, 50);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    (quality) =>
      localStorage.setItem(
        "fishing-player-settings",
        JSON.stringify({
          version: 1,
          state: {
            quality,
            fps: 60,
            volume: 0,
            ambienceVolume: 0,
            musicVolume: 0,
            soundMuted: true,
            reducedMotion: true,
          },
        }),
      ),
    quality,
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const loadStarted = performance.now();
  await page.goto(base + "/?diagnostics=1");
  await page.waitForFunction(() => !!window.__fishingDiagnostics);
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Mã phòng", exact: true })
    .fill(bots[0].room.roomId);
  await page.getByRole("button", { name: "Vào phòng", exact: true }).click();
  await page.getByRole("button", { name: "Thả câu" }).waitFor();
  await page.waitForFunction(
    () =>
      window.__fishingDiagnostics
        ?.players()
        .filter((p) => !p.kind || p.kind === "player").length === 20 &&
      document.querySelectorAll(".nameplate").length >= 20,
  );
  const readyMs = performance.now() - loadStarted,
    views = [];
  await sleep(2000);
  for (let angle = 0; angle < 8; angle++) {
    await page.evaluate(
      (angle) => window.__fishingDiagnostics.setCamera((angle * Math.PI) / 4),
      angle,
    );
    await sleep(900);
    await page.evaluate(() => window.__fishingDiagnostics.reset());
    await sleep(3000);
    views.push(
      await page.evaluate((angle) => {
        const data = window.__fishingDiagnostics.samples,
          sorted = data.map((s) => s.dt).sort((a, b) => a - b);
        return {
          angleDegrees: angle * 45,
          frames: data.length,
          fpsMean:
            1000 / (data.reduce((sum, s) => sum + s.dt, 0) / data.length),
          frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
          maxDrawCalls: Math.max(...data.map((s) => s.calls)),
          maxTriangles: Math.max(...data.map((s) => s.triangles)),
        };
      }, angle),
    );
    if (angle === 0)
      await page.screenshot({ path: output.replace(/\.json$/, ".png") });
  }
  const info = await page.evaluate(() => ({
    renderer: window.__fishingDiagnostics.info,
    encodedResourceBytes: performance
      .getEntriesByType("resource")
      .reduce((sum, entry) => sum + (entry.encodedBodySize ?? 0), 0),
  }));
  const report = {
    at: new Date().toISOString(),
    scope: `Desktop Chromium, ${quality} quality, 60 FPS cap, reduced motion, 20 real network guests, eight camera angles; headless browser measurement, not mobile-device certification.`,
    hardwareRequested: hardware,
    url: base,
    readyMs,
    ...info,
    views,
    errors,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (
    errors.length ||
    views.some((view) => !view.frames) ||
    (hardware && /SwiftShader|Software/i.test(info.renderer.renderer))
  )
    process.exitCode = 1;
} finally {
  clearInterval(movement);
  await Promise.allSettled(
    bots
      .filter((bot) => bot.room.connection.isOpen)
      .map((bot) => bot.room.leave()),
  );
  await browser.close();
}
