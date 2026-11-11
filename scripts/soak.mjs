import { Client } from "colyseus.js";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../apps/server/package.json", import.meta.url),
);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const minutes = Number(process.env.SOAK_MINUTES ?? 60),
  totalPlayers = Number(process.env.SOAK_PLAYERS ?? 20);
const base = process.env.SOAK_URL ?? "http://127.0.0.1:2568";
const origin = process.env.SOAK_ORIGIN ?? "https://localhost";
const output = process.env.SOAK_OUTPUT ?? ".local/m5/soak";
if (!(minutes > 0 && minutes <= 1440) || totalPlayers < 2 || totalPlayers > 20)
  throw new Error("Invalid soak configuration");
const headers = {
  Origin: origin,
  ...(process.env.SOAK_FORWARDED_HTTPS === "true"
    ? { "X-Forwarded-Proto": "https" }
    : {}),
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stats = {
  casts: 0,
  catchEvents: 0,
  escaped: 0,
  duplicateCatchEvents: 0,
  chats: 0,
  emotes: 0,
  inputs: 0,
  sales: 0,
  purchases: 0,
  reconnects: 0,
  unexpectedDisconnects: 0,
  errors: [],
};
const metricSamples = [],
  bots = [];
let stopping = false,
  measuring = false;
const deadline = () => AbortSignal.timeout(10000);
function sdk() {
  return new Client(base.replace(/^http/, "ws"), { headers });
}
async function http(path, cookie, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...headers,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: deadline(),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${result.error}`);
  return { result, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
class Bot {
  constructor(index) {
    this.index = index;
    this.profile = null;
    this.self = null;
    this.roundId = "";
    this.nextCast = 0;
    this.castPending = 0;
    this.cycle = 0;
    this.trading = false;
    this.offline = false;
    this.messages = [];
    this.seenFish = new Set();
    this.purchased = { worm: 0, shrimp: 0 };
    this.nextChat = performance.now() + index * 1200;
    this.nextEmote = performance.now() + index * 3100;
    this.nextTrade = performance.now() + 40000 + index * 800;
  }
  async connect(roomId) {
    const { result, cookie } = await http("/api/guest");
    this.cookie = cookie;
    this.profile = result.profile;
    this.bind(
      roomId
        ? await sdk().joinById(roomId, { ticket: result.ticket })
        : await sdk().create("beach", { ticket: result.ticket }),
    );
  }
  bind(room) {
    this.room = room;
    this.offline = false;
    room.onMessage("*", () => {});
    room.onMessage("PING", (nonce) => room.send("PONG", nonce));
    room.onMessage("PROFILE", (profile) => {
      if (!this.profile || profile.revision >= this.profile.revision)
        this.profile = profile;
    });
    room.onMessage("SESSION", (data) => {
      this.self = data.player;
      this.roundId = data.roundId;
      this.profile = data.profile;
    });
    room.onMessage("WORLD", (players) => {
      this.self = players.find((p) => p.id === room.sessionId);
      if (
        players.some(
          (p) => "coins" in p || "token" in p || "fish" in p || "selected" in p || "plan" in p,
        )
      )
        stats.errors.push("Private data in WORLD");
    });
    room.onMessage("FISH_STARTED", (data) => {
      this.roundId = data.roundId;
      this.castPending = 0;
      this.cycle++;
      stats.casts++;
      this.mode = (this.cycle + this.index) % 12;
    });
    room.onMessage("FISH_CUE", (cue) => {
      if (stopping) return;
      if (cue.phase === "WAITING" && this.mode === 2)
        setTimeout(() => {
          if (!stopping && room.connection.isOpen) room.send("FISH_CANCEL");
        }, 300);
      if (cue.phase === "NIBBLING" && this.mode === 1 && this.roundId)
        room.send("FISH_HOOK", { roundId: this.roundId });
      if (cue.phase === "BITE_WINDOW" && ![1, 2, 3].includes(this.mode)) {
        const id = this.roundId;
        setTimeout(
          () => {
            if (!stopping && room.connection.isOpen)
              room.send("FISH_HOOK", { roundId: id });
          },
          150 + (this.index % 5) * 75,
        );
      }
    });
    room.onMessage("FISH_RESULT", (fish) => {
        room.send("FISH_STOW", {});
      stats.catchEvents++;
      if (this.seenFish.has(fish.id)) stats.duplicateCatchEvents++;
      this.seenFish.add(fish.id);
    });
    room.onMessage("FISH_ESCAPED", () => {stats.escaped++});
    room.onMessage("FISH_ENDED", () => {
      this.roundId = "";
      this.nextCast = performance.now() + 1200;
    });
    room.onMessage("SOCIAL_ACK", (ack) => {
      if (ack.ok) {
        if (this.messages.includes(ack.requestId)) stats.chats++;
        else stats.emotes++;
      }
      this.messages = this.messages.filter((id) => id !== ack.requestId);
    });
    room.onError((code, message) =>
      stats.errors.push(`socket ${code}: ${message}`),
    );
    room.onLeave(() => {
      if (measuring && !this.offline && !stopping)
        stats.unexpectedDisconnects++;
    });
  }
  async operation(action, duplicate = false) {
    const body = { ...action, requestId: randomUUID() };
    const response = await http("/api/economy", this.cookie, body);
    this.profile = response.result.profile;
    if (duplicate) await http("/api/economy", this.cookie, body);
  }
  async trade() {
    if (this.trading) return;
    this.trading = true;
    try {
      if (this.profile.fish.length) {
        const { result: quote } = await http(
          "/api/sale-quote",
          this.cookie,
          {},
        );
        await this.operation({ action: "sell", quoteId: quote.id }, true);
        stats.sales++;
      }
      if (
        this.profile.xp >= 191 &&
        this.profile.coins >= 300 &&
        !this.profile.ownedRods.includes("bamboo")
      ) {
        await this.operation({ action: "buyRod", itemId: "bamboo" });
        stats.purchases++;
        await this.operation({ action: "equipRod", itemId: "bamboo" });
      }
      const bait = this.self?.area === "village" ? "worm" : "shrimp";
      if (this.profile.coins >= 80 && this.profile.baitCounts[bait] < 4) {
        await this.operation({ action: "buyBait", itemId: bait, quantity: 10 });
        this.purchased[bait] += 10;
        stats.purchases++;
      }
      const equip = this.profile.baitCounts[bait] > 0 ? bait : "dough";
      if (this.profile.equippedBait !== equip)
        await this.operation({ action: "equipBait", itemId: equip });
    } finally {
      this.trading = false;
      this.nextTrade = performance.now() + 45000;
      this.nextCast = performance.now() + 1000;
    }
  }
  tick(now) {
    if (stopping || this.offline || !this.self || !this.room.connection.isOpen)
      return;
    if (now >= this.nextChat) {
      const id = randomUUID();
      this.messages.push(id);
      this.room.send("CHAT_SEND", {
        requestId: id,
        text: `Soak ${this.index + 1}: chào bến câu ${this.cycle}`,
      });
      this.nextChat = now + 30000;
    }
    if (
      this.self.phase !== "IDLE" ||
      this.trading ||
      this.roundId ||
      (this.castPending && now - this.castPending < 3500)
    )
      return;
    if (now >= this.nextEmote) {
      this.room.send("EMOTE_SEND", {
        requestId: randomUUID(),
        emoteId: ["wave", "happy", "heart", "clap"][this.index % 4],
      });
      this.nextEmote = now + 75000;
    }
    if (now >= this.nextTrade) {
      void this.trade().catch((error) => stats.errors.push(error.message));
      return;
    }
    if (
      this.profile.equippedBait !== "dough" &&
      this.profile.baitCounts[this.profile.equippedBait] === 0
    ) {
      this.trading = true;
      void this.operation({ action: "equipBait", itemId: "dough" })
        .catch((error) => stats.errors.push(error.message))
        .finally(() => {
          this.trading = false;
        });
      return;
    }
    const x =
        [-6, -4, -2, 0, 2, 4, 6][
          (this.index + Math.floor(this.cycle / 6)) % 7
        ] +
        Math.sin(this.cycle * 1.7) * 0.4,
      z = 1.8 + (this.cycle % 3) * 0.15;
    const dx = x - this.self.x,
      dz = z - this.self.z,
      d = Math.hypot(dx, dz);
    if (d > 0.15) {
      this.room.send("PLAYER_INPUT", {
        x: dx / Math.max(d, 1),
        z: dz / Math.max(d, 1),
      });
      stats.inputs++;
      return;
    }
    this.room.send("PLAYER_INPUT", { x: 0, z: 0 });
    stats.inputs++;
    if (
      now >= this.nextCast &&
      (!this.castPending || now - this.castPending > 3500)
    ) {
      this.castPending = now;
      this.room.send("FISH_START", {});
    }
  }
  async reconnect() {
    if (this.offline || stopping) return;
    this.offline = true;
    const token = this.room.reconnectionToken;
    await this.room.leave(false);
    await sleep(900);
    this.bind(await sdk().reconnect(token));
    stats.reconnects++;
  }
}
await mkdir(output, { recursive: true });
let tick, metricTimer, reconnectTimer, started;
try {
  for (let i = 0; i < totalPlayers; i++) {
    const bot = new Bot(i);
    await bot.connect(bots[0]?.room.roomId);
    bots.push(bot);
  }
  await sleep(1000);
  started = performance.now();
  measuring = true;
  await writeFile(
    `${output}/state.json`,
    JSON.stringify(
      {
        status: "running",
        startedAt: new Date().toISOString(),
        minutes,
        players: totalPlayers,
        roomId: bots[0].room.roomId,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      event: "soak_started",
      minutes,
      players: totalPlayers,
      roomId: bots[0].room.roomId,
    }),
  );
  tick = setInterval(() => {
    const now = performance.now();
    for (const bot of bots) bot.tick(now);
  }, 50);
  const sample = async () => {
    try {
      const response = await fetch(
        process.env.SOAK_METRICS_URL ?? base + "/internal/metrics",
        {
          headers: {
            ...headers,
            Authorization: `Bearer ${process.env.METRICS_TOKEN}`,
          },
          signal: deadline(),
        },
      );
      if (!response.ok) throw new Error(`metrics ${response.status}`);
      const data = await response.json();
      metricSamples.push(data);
      await appendFile(`${output}/metrics.ndjson`, JSON.stringify(data) + "\n");
    } catch (error) {
      stats.errors.push(error.message);
    }
  };
  await sample();
  metricTimer = setInterval(() => void sample(), 10000);
  let reconnectIndex = 0;
  reconnectTimer = setInterval(
    () =>
      void bots[reconnectIndex++ % bots.length]
        .reconnect()
        .catch((error) => stats.errors.push(`reconnect: ${error.message}`)),
    180000,
  );
  while (performance.now() - started < minutes * 60000) {
    if (stats.errors.length || stats.unexpectedDisconnects)
      throw new Error(
        "Soak aborted after an unexpected transport or operation failure.",
      );
    await sleep(
      Math.min(1000, minutes * 60000 - (performance.now() - started)),
    );
  }
  stopping = true;
  clearInterval(tick);
  clearInterval(reconnectTimer);
  clearInterval(metricTimer);
  for (const bot of bots)
    if (bot.room.connection.isOpen && bot.roundId) bot.room.send("FISH_CANCEL");
  await sleep(6000);
  await sample();
  await Promise.all(
    bots
      .filter((bot) => bot.room.connection.isOpen)
      .map((bot) => bot.room.leave()),
  );
  await sleep(1000);
  const ids = bots.map((bot) => bot.profile.id),
    failures = [];
  const [guests, fish, ledger, album, rounds, stock] = await Promise.all([
    db.guest.findMany({ where: { id: { in: ids } } }),
    db.fish.findMany({ where: { guestId: { in: ids } } }),
    db.coinLedger.findMany({ where: { guestId: { in: ids } } }),
    db.album.findMany({ where: { guestId: { in: ids } } }),
    db.fishingRound.findMany({ where: { guestId: { in: ids } } }),
    db.baitStock.findMany({ where: { guestId: { in: ids } } }),
  ]);
  for (const bot of bots) {
    const id = bot.profile.id,
      guest = guests.find((g) => g.id === id),
      owned = fish.filter((f) => f.guestId === id),
      entries = ledger.filter((e) => e.guestId === id);
    if (
      guest.coins < 0 ||
      guest.xp !== owned.reduce((sum, f) => sum + f.xp, 0) ||
      guest.coins !== entries.reduce((sum, e) => sum + e.delta, 0) ||
      guest.activeRoundId
    )
      failures.push(`Account mismatch ${id}`);
    if (
      owned.filter((f) => f.soldAt).reduce((sum, f) => sum + f.saleValue, 0) !==
      entries.filter((e) => e.delta > 0).reduce((sum, e) => sum + e.delta, 0)
    )
      failures.push(`Sales mismatch ${id}`);
    for (const bait of ["worm", "shrimp"])
      if (
        (stock.find((s) => s.guestId === id && s.baitId === bait)?.quantity ??
          0) !==
        bot.purchased[bait] -
          rounds.filter(
            (r) =>
              r.guestId === id &&
              r.baitId === bait &&
              r.status !== "INTERRUPTED",
          ).length
      )
        failures.push(`Bait mismatch ${id}`);
    const groups = new Map();
    for (const f of owned) {
      const e = groups.get(f.speciesId) ?? { count: 0, record: 0 };
      e.count++;
      e.record = Math.max(e.record, f.grams);
      groups.set(f.speciesId, e);
    }
    for (const [species, e] of groups) {
      const a = album.find((a) => a.guestId === id && a.speciesId === species);
      if (a?.count !== e.count || a?.recordGrams !== e.record)
        failures.push(`Album mismatch ${id}`);
    }
  }
  if (new Set(fish.map((f) => f.roundId)).size !== fish.length)
    failures.push("Duplicate fish round");
  if (rounds.some((round) => ["ACTIVE","REELING"].includes(round.status)))
    failures.push("Unfinished round");
  if (
    metricSamples.some((sample) => sample.gauges.connected < totalPlayers - 1)
  )
    failures.push("Lost room population");
  if (
    metricSamples.at(-1)?.counters.db_errors ||
    metricSamples.at(-1)?.counters.fishing_errors
  )
    failures.push("Server operation errors");
  if (
    stats.unexpectedDisconnects ||
    stats.duplicateCatchEvents ||
    stats.errors.length
  )
    failures.push("Unexpected errors or duplicate events");
  if (fish.length < totalPlayers * Math.max(0.1, minutes * 0.1))
    failures.push("Insufficient successful catches");
  const report = {
    status: failures.length ? "failed" : "passed",
    targetMinutes: minutes,
    durationSeconds: (performance.now() - started) / 1000,
    players: totalPlayers,
    serverUrl: base,
    transport: base.startsWith("https")
      ? "HTTPS/WSS"
      : "loopback HTTP/WS behind simulated trusted HTTPS headers",
    stats,
    integrity: {
      guests: guests.length,
      fish: fish.length,
      rounds: rounds.length,
      ledgerRows: ledger.length,
      albumEntries: album.length,
      failures,
    },
    measurements: {
      samples: metricSamples.length,
      maxRssMiB: Math.max(...metricSamples.map((s) => s.memory.rss)) / 1048576,
      firstRssMiB: metricSamples[0]?.memory.rss / 1048576,
      lastRssMiB: metricSamples.at(-1)?.memory.rss / 1048576,
      maxCpuPercent: Math.max(...metricSamples.map((s) => s.cpuPercent)),
      maxEventLoopP99Ms: Math.max(
        ...metricSamples.map((s) => s.eventLoop.p99Ms),
      ),
      lastTimings: metricSamples.at(-1)?.timings,
    },
    completedAt: new Date().toISOString(),
  };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await writeFile(
    `${output}/state.json`,
    JSON.stringify(
      { status: report.status, completedAt: report.completedAt },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(report));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  const failure = {
    status: "failed",
    failedAt: new Date().toISOString(),
    durationSeconds: started ? (performance.now() - started) / 1000 : 0,
    error: error.message,
    stats,
  };
  await writeFile(`${output}/failure.json`, JSON.stringify(failure, null, 2));
  await writeFile(
    `${output}/state.json`,
    JSON.stringify({ status: "failed", failedAt: failure.failedAt }, null, 2),
  );
  process.exitCode = 1;
} finally {
  stopping = true;
  clearInterval(tick);
  clearInterval(metricTimer);
  clearInterval(reconnectTimer);
  await Promise.allSettled(
    bots
      .filter((bot) => bot.room.connection.isOpen)
      .map((bot) => bot.room.leave()),
  );
  await db.$disconnect();
}
