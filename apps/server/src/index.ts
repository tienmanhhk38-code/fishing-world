import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { Room, Client, matchMaker, type ClientPrivate } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { db } from "./db";
import { loadConfig } from "./config";
import {
  secureHeaders,
  permittedOrigin,
  RateGate,
  clientIp,
  bearerMatches,
  rejected,
} from "./security";
import { sessionGuest, sessionHash, validSession } from "./sessions";
import { protectedServer, type Ticket } from "./matchmaking";
import { acquireInstanceLock } from "./instance-lock";
import { count, observe, snapshot } from "./telemetry";
import { RoomSocial, ensureNotBanned } from "./social";
import {
  getProfile,
  customizeProfile,
  prepareSale,
  economyOperation,
  operationSchema,
  beginFishing,
  commitCatch,
  startReel,
  settleReel,
  recordJump,
  claimQuest,
  finishFishing,
  recoverFishing,
  recordMovement,
  GameError,
} from "./economy";
import type { selectCatch } from "./catch-selection";
import { z } from "zod";
import { fishingSchedule } from "./fishing";
import {
  Residents,
  canShop,
  DESTINATIONS,
  type DestinationId,
  type FishingEndReason,
} from "@fishing/shared";
import {
  moveOnMap,
  areaAt,
  findFishingCast,
  SPAWNS,
  AREAS,
  type OpenAreaId,
  hookAllowed,
  BITE_MS,
  WALK_SPEED,
  simulateMovement,
  movable,
  JUMP_SPEED,
  groundHeightAt,
  catchPresentation,
  reelPosition,
  type Player,
  type Profile,
  levelProgress,
  SPECIES,
  RODS,
  BAITS,
} from "@fishing/shared";

const config = loadConfig();
const instanceLock = await acquireInstanceLock();
await db.$connect();
await recoverFishing();
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
let shuttingDown = false;
const authGate = new RateGate(120),
  apiGate = new RateGate(600),
  actionGate = new RateGate(120);
app.use((req, res, next) => {
  secureHeaders(res, config);
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
    if (shuttingDown) {
      res.status(503).json({ error: "Bến đang bảo trì. Hãy kết nối lại sau." });
      return;
    }
    if (
      !permittedOrigin(
        req.headers.origin,
        config,
        config.production && req.method === "POST",
      ) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      rejected("origin");
      res.status(403).json({ error: "Nguồn yêu cầu không hợp lệ." });
      return;
    }
    if (config.production && !req.secure) {
      res.status(426).json({ error: "Cần kết nối HTTPS." });
      return;
    }
    const gate = req.path === "/api/guest" ? authGate : apiGate;
    if (!gate.allow(clientIp(req, config))) {
      rejected("http_rate");
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Quá nhiều yêu cầu. Hãy thử lại sau." });
      return;
    }
  }
  next();
});
app.get("/healthz", (_req, res) =>
  res.status(shuttingDown ? 503 : 200).json({ ok: !shuttingDown }),
);
app.get("/readyz", async (_req, res) => {
  try {
    if (shuttingDown) throw new Error("DRAINING");
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
app.get("/internal/metrics", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!bearerMatches(req.headers.authorization, config.metricsToken)) {
    res.status(404).json({ error: "Không tìm thấy." });
    return;
  }
  const [source, sink] = await Promise.all([
    db.coinLedger.aggregate({
      where: { delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    db.coinLedger.aggregate({
      where: { delta: { lt: 0 } },
      _sum: { delta: true },
    }),
  ]);
  res.json(
    snapshot({
      rooms: roomIds.size,
      players: activeGuests.size,
      connected: [...liveRooms].reduce(
        (sum, room) => sum + room.clients.length,
        0,
      ),
      rounds: [...liveRooms].reduce((sum, room) => sum + room.rounds.size, 0),
      tickets: tickets.size,
      coinsSource: source._sum.delta ?? 0,
      coinsSink: -(sink._sum.delta ?? 0),
    }),
  );
});
app.use(express.json({ limit: "4kb" }), cookieParser());
const tickets = new Map<string, Ticket>();
const guestTickets = new Map<string, string>();
const activeGuests = new Set<string>();
const roomIds = new Set<string>();
const liveRooms = new Set<Beach>();
const sessions = new Map<string, { room: Beach; client: Client }>();
app.get("/api/rooms", async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: "beach", private: false });
    res.json(
      rooms.map((room) => ({
        id: room.roomId,
        name: room.metadata?.name ?? `Biển Xanh ${room.roomId}`,
        clients: room.clients,
        maxClients: room.maxClients,
        locked: room.locked,
      })),
    );
  } catch {
    res.status(503).json({ error: "Không thể tải danh sách phòng." });
  }
});
app.get("/api/guest", async (req, res) => {
  try {
    let token = req.cookies[config.cookieName];
    let guest = await sessionGuest(token);
    if (!guest) {
      token = randomBytes(32).toString("hex");
      guest = await db.guest.create({
        data: {
          token: sessionHash(token),
          name: `Ngư dân ${randomInt(100, 999)}`,
        },
      });
    }
    res.cookie(config.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.production,
      path: "/",
      maxAge: 31536000000,
    });
    const ticket = randomBytes(32).toString("hex");
    const old = guestTickets.get(guest.id);
    if (old) tickets.delete(old);
    guestTickets.set(guest.id, ticket);
    tickets.set(ticket, { guestId: guest.id, expires: Date.now() + 30000 });
    res.json({
      ticket,
      profile: await getProfile(guest.id),
    });
  } catch {
    res.status(503).json({ error: "Không thể tải hồ sơ. Hãy thử lại." });
  }
});
setInterval(() => {
  for (const [key, value] of tickets)
    if (value.expires < Date.now()) {
      tickets.delete(key);
      if (guestTickets.get(value.guestId) === key)
        guestTickets.delete(value.guestId);
    }
}, 30000).unref();

type Round = {
  id: string;
  area: OpenAreaId;
  selected: ReturnType<typeof selectCatch> | null;
  opens: number;
  busy: boolean;
  timers: ReturnType<typeof setTimeout>[];
  plan?: Awaited<ReturnType<typeof beginFishing>>["plan"];
};
async function authenticated(req: express.Request) {
  const token = req.cookies[config.cookieName];
  const guest = await sessionGuest(token);
  if (!guest) throw new GameError("Phiên khách đã hết hạn. Hãy vào game lại.");
  ensureNotBanned(guest);
  if (req.method === "POST" && !actionGate.allow(guest.id))
    throw new GameError("Quá nhiều thao tác. Hãy thử lại sau.");
  return guest.id;
}
function apiError(res: express.Response, error: unknown) {
  count(error instanceof GameError ? "api_rejected" : "db_errors");
  if (!(error instanceof GameError))
    console.error("Account operation failed", error);
  res.status(error instanceof GameError ? 400 : 503).json({
    error:
      error instanceof GameError
        ? error.message
        : "Không thể lưu dữ liệu. Hãy thử lại cùng thao tác.",
  });
}
app.get("/api/catalog", (_req, res) =>
  res.json({ species: SPECIES, rods: RODS, baits: BAITS }),
);
app.get("/api/profile", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getProfile(await authenticated(req)));
  } catch (error) {
    apiError(res, error);
  }
});
app.post("/api/sale-quote", async (req, res) => {
  try {
    const parsed = z
      .object({ fishId: z.string().uuid().optional() })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) throw new GameError("Yêu cầu bán cá không hợp lệ.");
    res.json(await prepareSale(await authenticated(req), parsed.data.fishId));
  } catch (error) {
    apiError(res, error);
  }
});
app.post("/api/economy", async (req, res) => {
  try {
    const parsed = operationSchema.safeParse(req.body);
    if (!parsed.success)
      throw new GameError("Yêu cầu hành trang không hợp lệ.");
    const id = await authenticated(req);
    const result = await economyOperation(id, parsed.data, () => {
      const session = sessions.get(id);
      const player = session?.room.players.get(session.client.sessionId);
      if (player?.phase === "SHOWCASING" && parsed.data.action !== "sell")
        throw new GameError("Hãy cất cá trước khi thay đổi hành trang.");
      if (
        ["viewShop", "buyRod", "buyBait"].includes(parsed.data.action) &&
        !canShop(player)
      )
        throw new GameError("Hãy đến gần Cô Sáu ở sạp hàng để mua đồ.");
    });
    const session = sessions.get(id);
    session?.room.syncProfile(session.client, result.profile);
    if (!result.ok) {
      res.status(400).json({ error: result.message, profile: result.profile });
      return;
    }
    res.json(result);
  } catch (error) {
    apiError(res, error);
  }
});
app.post("/api/quests/claim", async (req, res) => {
  try {
    const data = z
      .object({
        questId: z.string().max(64),
        period: z.string().max(16),
        requestId: z.string().uuid(),
      })
      .strict()
      .safeParse(req.body);
    if (!data.success) throw new GameError("Yêu cầu nhận thưởng không hợp lệ.");
    const id = await authenticated(req),
      result = await claimQuest(
        id,
        data.data.questId,
        data.data.period,
        data.data.requestId,
      );
    const session = sessions.get(id);
    session?.room.syncProfile(session.client, result.profile);
    res.json(result);
  } catch (error) {
    apiError(res, error);
  }
});
app.post("/api/character", async (req, res) => {
  try {
    const parsed = z
      .object({
        name: z.string().max(100),
        appearanceId: z.enum(["sailor", "sunny", "coral", "ocean"]),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      throw new GameError("Ngoại hình hoặc tên không hợp lệ.");
    const id = await authenticated(req),
      profile = await customizeProfile(
        id,
        parsed.data.name,
        parsed.data.appearanceId,
      );
    const session = sessions.get(id);
    session?.room.syncProfile(session.client, profile);
    res.json({ profile });
  } catch (error) {
    apiError(res, error);
  }
});
class Beach extends Room {
  residents = new Residents();
  maxClients = 20;
  players = new Map<string, Player>();
  rounds = new Map<string, Round>();
  inputs = new Map<
    string,
    { x: number; z: number; sprint: boolean; seq: number; at: number }
  >();
  jumpSequences = new Map<string, number>();
  jumpSaved = new Set<string>();
  leavingSessions = new Set<string>();
  showcaseEpoch = new Map<string, number>();
  lastCatches = new Map<string, import("@fishing/shared").Fish>();
  rtt = new Map<string, number>();
  pings = new Map<string, { nonce: string; at: number }>();
  cooldown = new Map<string, number>();
  teleports = new Map<string, number>();
  movementSaved = new Set<string>();
  profileRevisions = new Map<string, number>();
  social!: RoomSocial;
  moderation = new Map<string, string | null>();
  bannedSessions = new Set<string>();
  private operations = new Set<Promise<unknown>>();
  private messagesGate = new RateGate(100, 1000, 100);
  private framesGate = new RateGate(200, 1000, 100);
  protected _onMessage(client: Client & ClientPrivate, buffer: Buffer) {
    if (!this.framesGate.allow(client.sessionId)) {
      rejected("ws_rate");
      this.bannedSessions.add(client.sessionId);
      client.leave(4008);
      return;
    }
    try {
      super._onMessage(client, buffer);
    } catch {
      rejected("ws_frame");
      this.bannedSessions.add(client.sessionId);
      client.leave(4002);
    }
  }
  private draining = false;
  private track(operation: Promise<unknown>) {
    this.operations.add(operation);
    void operation
      .finally(() => this.operations.delete(operation))
      .catch(() => {});
    return operation;
  }
  async prepareShutdown() {
    this.draining = true;
    this.inputs.clear();
    for (const round of this.rounds.values())
      round.timers.forEach(clearTimeout);
    await Promise.allSettled([...this.operations]);
    for (const [id, round] of this.rounds) {
      round.timers.forEach(clearTimeout);
      const guestId = this.memberAccounts.get(id);
      if (guestId) await finishFishing(guestId, round.id, true);
    }
  }
  async onAuth(_client: Client, options: { ticket: string }) {
    const parsed = z
      .object({ ticket: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .safeParse(options);
    if (!parsed.success || shuttingDown)
      throw new Error("Yêu cầu vào phòng không hợp lệ.");
    const ticket = tickets.get(parsed.data.ticket);
    tickets.delete(parsed.data.ticket);
    if (ticket && guestTickets.get(ticket.guestId) === parsed.data.ticket)
      guestTickets.delete(ticket.guestId);
    if (
      !ticket ||
      ticket.expires < Date.now() ||
      ticket.roomId !== this.roomId ||
      ticket.sessionId !== _client.sessionId
    )
      throw new Error("Phiên đăng nhập hết hạn.");
    ensureNotBanned(
      await db.guest.findUniqueOrThrow({ where: { id: ticket.guestId } }),
    );
    if (activeGuests.has(ticket.guestId))
      throw new Error("Tài khoản đang chơi ở cửa sổ khác.");
    activeGuests.add(ticket.guestId);
    return ticket.guestId;
  }
  async onCreate() {
    let code = randomBytes(4).toString("hex").toUpperCase();
    while (roomIds.has(code))
      code = randomBytes(4).toString("hex").toUpperCase();
    roomIds.add(code);
    liveRooms.add(this);
    this.roomId = code;
    await this.setMetadata({ name: `Biển Xanh ${code.slice(0, 3)}` });
    this.social = new RoomSocial({
      roomId: this.roomId,
      clients: this.clients,
      idle: (id) => this.players.get(id)?.phase === "IDLE",
      position: (id) => this.players.get(id),
      members: () =>
        Array.from(this.players.values()).map((p) => ({
          id: p.id,
          publicId:
            this.clients.find((client) => client.sessionId === p.id)?.auth ??
            this.memberAccounts.get(p.id)!,
          name: p.name,
          appearanceId: p.appearanceId,
          level: p.level,
          connected: p.connected,
        })),
    });
    for (const kind of ["CHAT_SEND", "MUTE_SET", "REPORT_SEND", "EMOTE_SEND"])
      this.onMessage(
        kind,
        (c, data) =>
          this.messagesGate.allow(c.sessionId) &&
          !this.draining &&
          void this.social
            .handle(c, kind, data)
            .catch((error) => console.error("Social response failed", error)),
      );
    this.clock.setInterval(
      () =>
        void this.checkModeration().catch((error) =>
          console.error("Moderation refresh failed", error),
        ),
      3000,
    );
    this.onMessage("TELEPORT_REQUEST", (c, data) => this.teleport(c, data));
    this.onMessage("PLAYER_INPUT", (c, data) => {
      if (!this.messagesGate.allow(c.sessionId) || this.draining) return;
      const parsed = z
        .object({
          x: z.number().finite().min(-1).max(1),
          z: z.number().finite().min(-1).max(1),
          sprint: z.boolean().optional().default(false),
          seq: z.number().int().nonnegative().max(2147483647).optional(),
        })
        .strict()
        .safeParse(data);
      if (parsed.success) {
        const previous = this.inputs.get(c.sessionId)?.seq ?? 0;
        if (parsed.data.seq !== undefined && parsed.data.seq <= previous)
          return;
        this.inputs.set(c.sessionId, {
          ...parsed.data,
          seq: parsed.data.seq ?? previous + 1,
          at: performance.now(),
        });
      }
    });
    this.onMessage("PLAYER_JUMP", (c, data) => {
      const parsed = z
        .object({ seq: z.number().int().nonnegative() })
        .strict()
        .safeParse(data);
      const p = this.players.get(c.sessionId);
      if (
        !parsed.success ||
        !p ||
        !p.grounded ||
        !movable(p.phase) ||
        !this.messagesGate.allow(c.sessionId) ||
        parsed.data.seq <= (this.jumpSequences.get(c.sessionId) ?? -1)
      )
        return;
      this.jumpSequences.set(c.sessionId, parsed.data.seq);
      p.jumpSeq = parsed.data.seq;
      p.grounded = false;
      p.vy = JUMP_SPEED;
      if (!this.jumpSaved.has(c.sessionId)) {
        this.jumpSaved.add(c.sessionId);
        void recordJump(c.auth)
          .then((profile) => this.syncProfile(c, profile))
          .catch(() => this.jumpSaved.delete(c.sessionId));
      }
    });
    this.onMessage("FISH_CONTINUE", (c) => {
      if (!this.messagesGate.allow(c.sessionId)) return;
      const p = this.players.get(c.sessionId);
      if (p?.phase !== "RESULT") return;
      this.stow(c);
      void this.track(this.startFishing(c)).catch((e) => this.error(c, e));
    });
    this.onMessage("FISH_SHOWCASE_REQUEST", (c, data) => {
      if (this.messagesGate.allow(c.sessionId))
        void this.track(this.showFish(c, data)).catch(() =>
          c.send("SHOWCASE_ERROR", {
            message: "Không thể lấy cá. Hãy thử lại.",
          }),
        );
      else
        c.send("SHOWCASE_ERROR", { message: "Hãy chờ một chút rồi thử lại." });
    });
    this.onMessage("FISH_STOW", (c) => {
      if (this.messagesGate.allow(c.sessionId)) this.stow(c);
    });
    this.onMessage("LEAVE_GAME", (c) => {
      void this.track(this.leaveGame(c)).catch((e) => this.error(c, e));
    });
    this.onMessage("FISH_START", (c, data) => {
      if (
        z
          .object({})
          .strict()
          .safeParse(data ?? {}).success &&
        this.messagesGate.allow(c.sessionId) &&
        !this.draining
      )
        void this.track(this.startFishing(c)).catch((error) =>
          this.error(c, error),
        );
    });
    this.onMessage("FISH_HOOK", (c, data) => {
      const parsed = z
        .object({ roundId: z.string().uuid() })
        .strict()
        .safeParse(data);
      if (
        parsed.success &&
        this.messagesGate.allow(c.sessionId) &&
        !this.draining
      )
        void this.track(this.hook(c, parsed.data.roundId)).catch((error) =>
          this.error(c, error),
        );
    });
    this.onMessage("FISH_CANCEL", (c) => {
      if (this.messagesGate.allow(c.sessionId) && !this.draining)
        void this.track(this.end(c, "Đã thu cần.")).catch((error) =>
          this.error(c, error),
        );
    });
    this.onMessage("PONG", (c, nonce) => {
      const ping = this.pings.get(c.sessionId);
      if (ping && ping.nonce === nonce) {
        this.rtt.set(c.sessionId, performance.now() - ping.at);
        observe("rtt_ms", performance.now() - ping.at);
        this.pings.delete(c.sessionId);
        c.send("RTT", this.rtt.get(c.sessionId));
      }
    });
    this.setSimulationInterval((deltaTime) => {
      const now = performance.now();
      for (const [id, p] of this.players) {
        const input = this.inputs.get(id);
        p.moving = false;
        if (p.connected && movable(p.phase)) {
          const command =
            input && now - input.at < 250
              ? input
              : { x: 0, z: 0, sprint: false };
          const next = simulateMovement(
            p,
            command,
            Math.min(0.1, Math.max(0, deltaTime / 1000)),
          );
          Object.assign(p, next, {
            area: areaAt(next),
            ackSeq: input?.seq ?? p.ackSeq,
          });
          if (p.moving && !this.movementSaved.has(id)) {
            this.movementSaved.add(id);
            const client = this.clients.find((c) => c.sessionId === id);
            if (client)
              void recordMovement(client.auth)
                .then((profile) => this.syncProfile(client, profile))
                .catch(() => this.movementSaved.delete(id));
          }
        }
        p.snapshotAt = Date.now();
      }
      const actors = this.residents.update(
        [...this.players.values()].filter((p) => p.connected).length,
        Date.now(),
        Math.min(0.1, deltaTime / 1000),
      );
      this.broadcast("WORLD", [...this.players.values(), ...actors]);
    }, 50);
    this.clock.setInterval(() => {
      for (const c of this.clients) {
        const nonce = randomUUID();
        this.pings.set(c.sessionId, { nonce, at: performance.now() });
        c.send("PING", nonce);
      }
    }, 2000);
  }
  async onJoin(c: Client) {
    try {
      const guest = await db.guest.findUniqueOrThrow({ where: { id: c.auth } });
      const profile = await getProfile(c.auth);
      if (profile.tutorialStep > 0) this.movementSaved.add(c.sessionId);
      const index = this.players.size;
      if (guest.questJumped) this.jumpSaved.add(c.sessionId);
      this.memberAccounts.set(c.sessionId, c.auth);
      this.players.set(c.sessionId, {
        id: c.sessionId,
        name: guest.name,
        appearanceId: profile.appearanceId,
        area: "beach",
        connected: true,
        level: levelProgress(profile.xp).level,
        rodId: profile.equippedRod,
        baitId: profile.equippedBait,
        x: [-1, 1, -3, 3, -5, 5, 0][index % 7],
        z: SPAWNS.beach.z + Math.floor(index / 7) * 0.6,
        yaw: Math.PI,
        moving: false,
        y: groundHeightAt({
          x: [-1, 1, -3, 3, -5, 5, 0][index % 7],
          z: SPAWNS.beach.z + Math.floor(index / 7) * 0.6,
        }),
        vy: 0,
        grounded: true,
        running: false,
        ackSeq: 0,
        snapshotAt: Date.now(),
        phase: "IDLE",
        bobber: { x: 0, z: -3 },
      });
      sessions.set(c.auth, { room: this, client: c });
      count("joins");
      c.send("WELCOME", { id: c.sessionId, roomId: this.roomId });
      await this.sendSession(c);
      await this.social.join(c);
    } catch (error) {
      activeGuests.delete(c.auth);
      throw error;
    }
  }
  cue(c: Client, phase: Player["phase"]) {
    const p = this.players.get(c.sessionId);
    if (!p) return;
    p.phase = phase;
    p.phaseStartedAt = Date.now();
    if (phase === "APPROACHING")
      p.shadowScale = this.rounds.get(c.sessionId)?.plan?.shadowScale;
    c.send("FISH_CUE", {
      phase,
      serverTime: Date.now(),
      windowMs: this.rounds.get(c.sessionId)?.plan?.hookMs ?? 900,
      phaseStartedAt: p.phaseStartedAt,
      durationMs: p.phaseDurationMs,
    });
  }
  async startFishing(c: Client) {
    const p = this.players.get(c.sessionId);
    if (
      !p ||
      p.phase !== "IDLE" ||
      !p.grounded ||
      performance.now() < (this.cooldown.get(c.sessionId) ?? 0)
    )
      return;
    const point = findFishingCast(p, p.yaw);
    if (!point) {
      c.send(
        "NOTICE",
        "Cần đứng gần nước để thả cần (trong 2 m tới mép nước).",
      );
      return;
    }
    p.phase = "CASTING";
    p.phaseStartedAt = Date.now();
    p.motionSeed = randomInt(1, 1000000);
    count("fishing_starts");
    p.moving = false;
    p.bobber = point.bobber;
    p.yaw = Math.atan2(p.bobber.x - p.x, p.bobber.z - p.z);
    const round: Round = {
      id: randomUUID(),
      area: point.area,
      selected: null,
      opens: Infinity,
      busy: true,
      timers: [],
    };
    this.rounds.set(c.sessionId, round);
    const accepted = await beginFishing(c.auth, round.id, point.area);
    round.selected = accepted.selected;
    round.plan = accepted.plan;
    this.syncProfile(c, accepted.profile);
    if (
      !this.players.has(c.sessionId) ||
      this.rounds.get(c.sessionId) !== round
    ) {
      await finishFishing(c.auth, round.id);
      this.rounds.delete(c.sessionId);
      return;
    }
    round.busy = false;
    c.send("FISH_STARTED", { roundId: round.id });
    const schedule = fishingSchedule(accepted.selected.grams);
    for (const [index, cue] of schedule.entries()) {
      round.timers.push(
        setTimeout(() => {
          if (cue.phase === "BITE_WINDOW") {
            round.opens = performance.now();
            round.timers.push(
              setTimeout(() => {
                void this.end(
                  c,
                  "Cá đã bơi mất! Lần sau giật khi thấy dấu !",
                  "late",
                ).catch((error) => this.error(c, error));
              }, accepted.plan.hookMs + 151),
            );
          }
          p.phaseDurationMs =
            (schedule[index + 1]?.at ?? cue.at + accepted.plan.hookMs) - cue.at;
          this.cue(c, cue.phase);
        }, cue.at),
      );
    }
  }

  async hook(c: Client, roundId: string) {
    const round = this.rounds.get(c.sessionId);
    const p = this.players.get(c.sessionId);
    if (
      !round ||
      !p ||
      !round.selected ||
      round.id !== roundId ||
      round.busy ||
      ["CASTING", "REELING", "RESULT", "SHOWCASING"].includes(p.phase)
    )
      return;
    if (
      !hookAllowed(
        performance.now(),
        round.opens,
        this.rtt.get(c.sessionId) ?? 0,
        round.plan?.hookMs ?? 900,
      )
    ) {
      const early = performance.now() < round.opens;
      await this.end(
        c,
        early
          ? "Bạn giật sớm quá"
          : "Cá đã bơi mất! Lần sau giật khi thấy dấu !",
        early ? "early" : "late",
      );
      return;
    }
    round.busy = true;
    round.timers.forEach(clearTimeout);
    p.phase = "REELING";
    p.phaseStartedAt = Date.now();
    observe("hook_reaction_ms", performance.now() - round.opens);
    const timing = await startReel(c.auth, round.id);
    if (this.rounds.get(c.sessionId) !== round) return;
    p.reel = { ...timing, origin: { ...p.bobber }, angler: { x: p.x, z: p.z } };
    c.send("FISH_HOOK_CONFIRMED", { reel: p.reel });
    round.timers.push(
      setTimeout(() => void this.finishReel(c, round), timing.durationMs + 20),
    );
  }
  async finishReel(c: Client, round: Round) {
    if (this.rounds.get(c.sessionId) !== round) return;
    try {
      const result = await settleReel(c.auth, round.id),
        p = this.players.get(c.sessionId);
      if (!p) return;
      this.rounds.delete(c.sessionId);
      const escapeOrigin = p.reel ? reelPosition(p.reel, Date.now()) : p.bobber;
      delete p.reel;
      this.syncProfile(c, result.profile);
      if (result.fish) {
        delete p.shadowScale;
        count("catches");
        p.phase = "RESULT";
        this.lastCatches.set(c.sessionId, result.fish);
        if (p.connected) c.send("FISH_RESULT", result.fish);
        if (["legendary", "mythic"].includes(result.fish.rarity ?? ""))
          this.broadcast("ANNOUNCEMENT", {
            playerName: p.name,
            species: result.fish.species,
            rarity: result.fish.rarity,
          });
      } else {
        const origin = escapeOrigin;
        p.phase = "IDLE";
        p.escape = { at: Date.now(), origin, reason: "line_break" };
        setTimeout(() => {
          delete p.escape;
        }, 950);
        this.cooldown.set(c.sessionId, performance.now() + 800);
        if (p.connected) {
          c.send("FISH_ESCAPED", { position: origin, reason: "line_break" });
          c.send("FISH_ENDED", { reason: "line_break" });
          c.send("NOTICE", "Đứt dây rồi! Cá đã thoát.");
        }
      }
    } catch (error) {
      console.error("Reel settlement will retry", error);
      if (this.rounds.get(c.sessionId) === round)
        round.timers.push(
          setTimeout(() => void this.finishReel(c, round), 2000),
        );
    }
  }
  stow(c: Client) {
    this.showcaseEpoch.set(
      c.sessionId,
      (this.showcaseEpoch.get(c.sessionId) ?? 0) + 1,
    );
    const p = this.players.get(c.sessionId);
    if (!p || !["RESULT", "SHOWCASING"].includes(p.phase)) return;
    delete p.showcase;
    this.lastCatches.delete(c.sessionId);
    p.phase = "IDLE";
    c.send("FISH_ENDED", {});
  }
  async showFish(c: Client, data?: unknown) {
    const parsed = z
      .object({ fishId: z.string().min(1).max(100).optional() })
      .strict()
      .safeParse(data ?? {});
    const p = this.players.get(c.sessionId);
    const reject = (message: string) => c.send("SHOWCASE_ERROR", { message });
    if (
      !parsed.success ||
      !p ||
      !p.connected ||
      !["IDLE", "RESULT", "SHOWCASING"].includes(p.phase)
    ) {
      reject("Hãy thu cần trước khi khoe cá.");
      return;
    }
    const fishId = parsed.data.fishId ?? this.lastCatches.get(c.sessionId)?.id;
    const epoch = (this.showcaseEpoch.get(c.sessionId) ?? 0) + 1;
    this.showcaseEpoch.set(c.sessionId, epoch);
    const profile = await getProfile(c.auth);
    if (
      this.showcaseEpoch.get(c.sessionId) !== epoch ||
      !p.connected ||
      this.leavingSessions.has(c.sessionId) ||
      !["IDLE", "RESULT", "SHOWCASING"].includes(p.phase) ||
      profile.revision < (this.profileRevisions.get(c.sessionId) ?? -1)
    ) {
      reject("Trạng thái đã thay đổi. Hãy chọn lại cá.");
      return;
    }
    const fish = profile.fish.find((f) => f.id === fishId);
    if (!fish) {
      reject("Con cá này không còn trong túi.");
      return;
    }
    if (p.phase !== "SHOWCASING" || p.showcase?.fishId !== fish.id)
      p.showcase = {
        fishId: fish.id,
        species: fish.species,
        grams: fish.grams,
        startedAt: Date.now(),
        animationSeed: Math.random() * 10000,
      };
    p.phase = "SHOWCASING";
    c.send("SHOWCASE_STARTED", p.showcase);
  }
  async leaveGame(c: Client) {
    this.showcaseEpoch.set(
      c.sessionId,
      (this.showcaseEpoch.get(c.sessionId) ?? 0) + 1,
    );
    if (this.leavingSessions.has(c.sessionId)) return;
    this.leavingSessions.add(c.sessionId);
    this.inputs.delete(c.sessionId);
    const round = this.rounds.get(c.sessionId);
    round?.timers.forEach(clearTimeout);
    this.rounds.delete(c.sessionId);
    if (round) await finishFishing(c.auth, round.id);
    this.lastCatches.delete(c.sessionId);
    const p = this.players.get(c.sessionId);
    if (p) {
      delete p.showcase;
      p.phase = "IDLE";
    }
    c.send("LOBBY_READY", {});
    c.leave(1000);
  }

  async end(
    c: Client,
    message: string,
    reason: FishingEndReason = "cancelled",
  ) {
    const round = this.rounds.get(c.sessionId);
    if (
      !round ||
      (round.busy && this.players.get(c.sessionId)?.phase !== "REELING")
    )
      return;
    round.busy = true;
    round.timers.forEach(clearTimeout);
    const profile = await finishFishing(c.auth, round.id);
    count(
      reason === "early"
        ? "missed_early"
        : reason === "late"
          ? "missed_late"
          : "cancelled",
    );
    this.syncProfile(c, profile);
    this.rounds.delete(c.sessionId);
    const p = this.players.get(c.sessionId);
    if (p) {
      p.phase = "IDLE";
      delete p.reel;
      delete p.shadowScale;
    }
    this.cooldown.set(c.sessionId, performance.now() + 800);
    c.send("FISH_ENDED", { reason });
    c.send("NOTICE", message);
  }
  async error(c: Client, error?: unknown) {
    count("fishing_errors");
    if (!(error instanceof GameError))
      console.error("Fishing operation failed", error ?? c.sessionId);
    const round = this.rounds.get(c.sessionId);
    round?.timers.forEach(clearTimeout);
    if (round) {
      const profile = await finishFishing(c.auth, round.id, true).catch(
        () => null,
      );
      if (profile) this.syncProfile(c, profile);
    }
    this.rounds.delete(c.sessionId);
    const player = this.players.get(c.sessionId);
    if (player) player.phase = "IDLE";
    c.send("FISH_ENDED", {});
    c.send(
      "NOTICE",
      error instanceof GameError
        ? error.message
        : "Kết nối dữ liệu gặp lỗi. Tải lại để kiểm tra túi cá.",
    );
  }
  syncProfile(c: Client, profile: Profile) {
    if (profile.revision < (this.profileRevisions.get(c.sessionId) ?? -1))
      return;
    this.profileRevisions.set(c.sessionId, profile.revision);
    const player = this.players.get(c.sessionId);
    this.showcaseEpoch.set(
      c.sessionId,
      (this.showcaseEpoch.get(c.sessionId) ?? 0) + 1,
    );
    if (
      player?.showcase?.fishId &&
      !profile.fish.some((f) => f.id === player.showcase!.fishId)
    )
      this.stow(c);
    const changed =
      player &&
      (player.name !== profile.name ||
        player.appearanceId !== profile.appearanceId ||
        player.level !== levelProgress(profile.xp).level);
    if (player)
      Object.assign(player, {
        name: profile.name,
        appearanceId: profile.appearanceId,
        level: levelProgress(profile.xp).level,
        rodId: profile.equippedRod,
        baitId: profile.equippedBait,
      });
    c.send("PROFILE", profile);
    if (changed) this.social.members();
  }
  teleport(c: Client, data: unknown) {
    if (!this.messagesGate.allow(c.sessionId) || this.draining) return;
    const parsed = z
      .object({
        area: z.enum(["beach", "village", "coral", "mystery"]).optional(),
        destination: z
          .enum([
            "beach",
            "dock",
            "village",
            "pond",
            "lighthouse",
            "coral",
            "mystery",
          ])
          .optional(),
      })
      .strict()
      .safeParse(data);
    const player = this.players.get(c.sessionId);
    const reject = (message: string) =>
      c.send("TELEPORT_RESULT", { ok: false, message });
    if (
      !parsed.success ||
      !player ||
      (!parsed.data.destination && !parsed.data.area)
    ) {
      reject("Điểm đến không hợp lệ.");
      return;
    }
    const destination: DestinationId =
      parsed.data.destination ??
      (parsed.data.area === "beach"
        ? "dock"
        : parsed.data.area === "village"
          ? "pond"
          : parsed.data.area!);
    const target = DESTINATIONS[destination];
    if (!target.open || !target.point) {
      reject("Khu vực này sắp mở.");
      return;
    }
    if (player.phase !== "IDLE") {
      reject("Hãy thu cần trước khi dịch chuyển.");
      return;
    }
    if (performance.now() < (this.teleports.get(c.sessionId) ?? 0)) {
      reject("Hãy chờ một chút trước khi dịch chuyển tiếp.");
      return;
    }
    const area = target.area as OpenAreaId;
    Object.assign(player, target.point, {
      area,
      moving: false,
      y: groundHeightAt(target.point),
      vy: 0,
      grounded: true,
      running: false,
    });
    this.inputs.delete(c.sessionId);
    this.teleports.set(c.sessionId, performance.now() + 2000);
    c.send("TELEPORT_RESULT", {
      ok: true,
      area,
      destination,
      x: player.x,
      z: player.z,
    });
  }
  async sendSession(c: Client) {
    const player = this.players.get(c.sessionId);
    if (!player) return;
    const guest = await db.guest.findUniqueOrThrow({ where: { id: c.auth } });
    if (guest.activeRoundId && !this.rounds.has(c.sessionId))
      await finishFishing(c.auth, guest.activeRoundId, true);
    const profile = await getProfile(c.auth);
    this.syncProfile(c, profile);
    c.send("SESSION", {
      player,
      roundId: this.rounds.get(c.sessionId)?.id ?? "",
      profile,
      result: this.lastCatches.get(c.sessionId) ?? null,
    });
  }

  async onLeave(c: Client, consented: boolean) {
    this.showcaseEpoch.set(
      c.sessionId,
      (this.showcaseEpoch.get(c.sessionId) ?? 0) + 1,
    );
    const player = this.players.get(c.sessionId);
    if (player) {
      player.connected = false;
      player.moving = false;
      if (player.phase === "SHOWCASING") {
        delete player.showcase;
        player.phase = "IDLE";
        this.lastCatches.delete(c.sessionId);
      }
    }
    this.social.members();
    this.inputs.delete(c.sessionId);
    if (
      !consented &&
      player &&
      !this.bannedSessions.has(c.sessionId) &&
      !this.leavingSessions.has(c.sessionId)
    ) {
      try {
        const returned = await this.allowReconnection(c, 30);
        count("reconnects");
        player.connected = true;
        sessions.set(c.auth, { room: this, client: returned });
        await this.sendSession(returned).catch(() =>
          returned.send("NOTICE", "Tải lại để kiểm tra tiến trình đã lưu."),
        );
        await this.social.join(returned);
        return;
      } catch {
        /* The reserved seat expired. Finalize the abandoned round below. */
      }
    }
    const round = this.rounds.get(c.sessionId);
    round?.timers.forEach(clearTimeout);
    this.rounds.delete(c.sessionId);
    this.players.delete(c.sessionId);
    try {
      if (round) await finishFishing(c.auth, round.id);
    } finally {
      this.players.delete(c.sessionId);
      this.inputs.delete(c.sessionId);
      this.rtt.delete(c.sessionId);
      this.pings.delete(c.sessionId);
      this.cooldown.delete(c.sessionId);
      this.teleports.delete(c.sessionId);
      activeGuests.delete(c.auth);
      sessions.delete(c.auth);
      this.movementSaved.delete(c.sessionId);
      this.profileRevisions.delete(c.sessionId);
      this.memberAccounts.delete(c.sessionId);
      this.lastCatches.delete(c.sessionId);
      this.jumpSequences.delete(c.sessionId);
      this.showcaseEpoch.delete(c.sessionId);
      this.jumpSaved.delete(c.sessionId);
      this.leavingSessions.delete(c.sessionId);
      this.moderation.delete(c.auth);
      this.bannedSessions.delete(c.sessionId);
      this.social.leave(c.auth);
      this.messagesGate.delete(c.sessionId);
      this.framesGate.delete(c.sessionId);
      count("leaves");
    }
  }
  memberAccounts = new Map<string, string>();
  async checkModeration() {
    const guests = await db.guest.findMany({
      where: { id: { in: [...this.memberAccounts.values()] } },
      select: { id: true, bannedUntil: true, chatMutedUntil: true },
    });
    for (const guest of guests) {
      const client = this.clients.find((c) => c.auth === guest.id);
      if (!client) continue;
      if (guest.bannedUntil && guest.bannedUntil.getTime() > Date.now()) {
        this.bannedSessions.add(client.sessionId);
        client.send(
          "NOTICE",
          "Tài khoản đang bị tạm khóa. Hãy liên hệ quản trị viên.",
        );
        client.leave(4003);
      }
      const until = guest.chatMutedUntil?.toISOString() ?? null;
      if (this.moderation.get(guest.id) !== until) {
        this.moderation.set(guest.id, until);
        client.send("CHAT_MODERATION", { until });
      }
    }
  }
  onDispose() {
    liveRooms.delete(this);
    roomIds.delete(this.roomId);
    for (const round of this.rounds.values())
      round.timers.forEach(clearTimeout);
  }
}
const http = createServer(app);
http.requestTimeout = 10000;
http.headersTimeout = 10000;
http.keepAliveTimeout = 5000;
const clientDist = fileURLToPath(
  new URL("../../client/dist/", import.meta.url),
);
if (existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: config.production ? "1h" : 0,
      setHeaders: (res, path) => {
        if (path.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
        if (/[/\\]assets[/\\]index-[\w-]+\.(js|css)$/.test(path))
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
  app.get("/", (_req, res) => res.sendFile(`${clientDist}/index.html`));
}
app.use((_req, res) => res.status(404).json({ error: "Không tìm thấy." }));
app.use(
  (
    error: { type?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) =>
    res
      .status(error.type === "entity.too.large" ? 413 : 400)
      .json({ error: "Yêu cầu không hợp lệ." }),
);
const SecuredServer = protectedServer(
  config,
  tickets,
  () => !shuttingDown && roomIds.size < config.maxRooms,
);
const server = new SecuredServer({
  greet: false,
  transport: new WebSocketTransport({
    server: http,
    maxPayload: 4096,
    perMessageDeflate: false,
    verifyClient: (info, done) => {
      const ok = permittedOrigin(info.origin, config, config.production);
      if (!ok) rejected("ws_origin");
      done(ok, ok ? 200 : 403, "Forbidden");
    },
  }),
});
server.onBeforeShutdown(async () => {
  shuttingDown = true;
  console.log(JSON.stringify({ event: "draining" }));
  await Promise.all([...liveRooms].map((room) => room.prepareShutdown()));
});
server.onShutdown(async () => {
  await db.$disconnect();
  await instanceLock.release();
});
setInterval(
  () =>
    void instanceLock.verify().catch((error) => {
      console.error(error.message);
      void server.gracefullyShutdown(true, error);
    }),
  5000,
).unref();
setInterval(
  () =>
    console.log(
      JSON.stringify({
        event: "metrics",
        ...snapshot({ rooms: roomIds.size, players: activeGuests.size }),
      }),
    ),
  30000,
).unref();
server.define("beach", Beach);
await server.listen(config.port, config.host);
console.log(
  JSON.stringify({
    event: "ready",
    port: config.port,
    production: config.production,
  }),
);
