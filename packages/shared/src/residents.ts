import {
  canWalk,
  onPlatform,
  onIsland,
  inPond,
  groundHeightAt,
  moveOnMap,
  areaAt,
  findFishingCast,
  type Point,
} from "./world";
import type { Player, Phase } from "./index";

export const INTERACTION_RADIUS = 3;
export const NEARBY_CHAT_RADIUS = 20;
export function overheadVisible(
  actor: Pick<Player, "id" | "kind" | "x" | "z">,
  viewer: Pick<Player, "id" | "x" | "z"> | undefined,
) {
  return (
    !!viewer &&
    (actor.id === viewer.id ||
      within(actor, viewer, actor.kind === "npc" ? 8 : NEARBY_CHAT_RADIUS))
  );
}
export const NPCS = [
  {
    id: "merchant",
    name: "Cô Sáu",
    role: "Chủ sạp",
    action: "Cửa hàng",
    x: -24,
    z: -35,
    appearanceId: "sunny",
  },
  {
    id: "guide",
    name: "Chú Hải",
    role: "Hướng dẫn",
    action: "Hỏi cách chơi",
    x: -20,
    z: -23,
    appearanceId: "sailor",
  },
  {
    id: "quest",
    name: "Linh",
    role: "Nhiệm vụ",
    action: "Xem nhiệm vụ",
    x: -13,
    z: -46,
    appearanceId: "coral",
  },
] as const;
export function within(
  a: Point | undefined,
  b: Point | undefined,
  radius: number,
) {
  return (
    !!a &&
    !!b &&
    Number.isFinite(a.x) &&
    Number.isFinite(a.z) &&
    Math.hypot(a.x - b.x, a.z - b.z) <= radius
  );
}
export function canShop(
  p: Pick<Player, "x" | "z" | "phase" | "connected"> | undefined,
) {
  return (
    !!p &&
    p.connected &&
    p.phase === "IDLE" &&
    within(p, NPCS[0], INTERACTION_RADIUS)
  );
}
export function desiredBotCount(real: number, current: number) {
  return real === 0 ? 0 : real < 5 ? Math.max(current, 5) : current;
}
export function residentPlayer(
  id: string,
  name: string,
  point: Point,
  kind: "npc" | "bot",
  appearanceId: Player["appearanceId"] = "sailor",
): Player {
  return {
    id,
    name,
    x: point.x,
    z: point.z,
    kind,
    appearanceId,
    area: areaAt(point),
    connected: true,
    level: 1,
    rodId: "wood",
    baitId: "dough",
    yaw: Math.PI,
    moving: false,
    y: groundHeightAt(point),
    vy: 0,
    grounded: true,
    running: false,
    ackSeq: 0,
    snapshotAt: Date.now(),
    phase: "IDLE",
    phaseStartedAt: Date.now(),
    bobber: { x: point.x, z: point.z + 6 },
  };
}
// Cosmetic actors never enter the account/economy paths. Server owns every pose.
export const BOT_ZONES = ["dock", "dock", "beach", "beach", "pond"] as const;
export const BOT_CHAT_LINES = [
  "Chào mọi người, hôm nay câu ở đâu vui nhỉ?",
  "Ngồi câu một chút cho thư giãn nào.",
  "Mặt nước hôm nay đẹp ghê.",
  "Có ai đang đợi cá cắn giống mình không?",
  "Cứ bình tĩnh, cá sẽ tới thôi.",
  "Suýt nữa thì mình giật cần sớm rồi.",
  "Đổi góc câu một chút xem sao.",
  "Ai có mẹo chọn mồi hay không?",
  "Nghe tiếng sóng thấy dễ chịu quá.",
  "Chúc mọi người gặp cá lớn nhé!",
] as const;
const pools = {
  dock: [] as Point[],
  beach: [] as Point[],
  pond: [] as Point[],
};
let prepared = false;
function prepare() {
  if (prepared) return;
  prepared = true;
  for (let x = -60; x <= 60; x += 1)
    for (let z = -100; z <= 4; z += 1) {
      const p = { x, z };
      if (!canWalk(p)) continue;
      if (onPlatform(p) && z >= 0 && x <= 10) pools.dock.push(p);
      else if (
        onIsland(p) &&
        !onPlatform(p) &&
        z > -36 &&
        findFishingCast(p)?.area === "beach"
      )
        pools.beach.push(p);
      else if (!onPlatform(p) && findFishingCast(p)?.area === "village")
        pools.pond.push(p);
    }
}
export class Residents {
  private serial = 0;
  private lastRetire = 0;
  private lastChatAt = -Infinity;
  private bots = new Map<
    string,
    {
      actor: Player;
      slot: number;
      born: number;
      duration: number;
      mode: number;
      retireAt?: number;
      target: Point;
      anchor: Point;
      cast?: ReturnType<typeof findFishingCast>;
      nextChatAt: number;
      lastLine?: string;
    }
  >();
  constructor(private random: () => number = Math.random) {}
  readonly npcs = NPCS.map((n) => ({
    ...residentPlayer(`npc:${n.id}`, n.name, n, "npc", n.appearanceId),
    // The guide stands east of the path; face across it, parallel to the pier.
    yaw: n.id === "guide" ? -Math.PI / 2 : Math.atan2(-8 - n.x, 1.9 - n.z),
  }));
  update(real: number, now: number, dt: number): Player[] {
    if (!real) {
      this.bots.clear();
      this.lastRetire = 0;
      this.lastChatAt = -Infinity;
      return [];
    }
    prepare();
    while (this.bots.size < desiredBotCount(real, this.bots.size)) {
      const n = ++this.serial,
        used = new Set([...this.bots.values()].map((b) => b.slot));
      const available = BOT_ZONES.map((_, i) => i).filter((i) => !used.has(i));
      const slot = available[Math.floor(this.random() * available.length)],
        pool = pools[BOT_ZONES[slot]];
      const occupied = [...this.bots.values()].map((b) => b.actor);
      const choices = pool.filter((p) =>
        occupied.every((q) => !within(p, q, 3)),
      );
      const source = choices.length ? choices : pool;
      const point = source[Math.floor(this.random() * source.length)] ?? {
        x: 13.2,
        z: -49.5,
      };
      const actor = residentPlayer(
        `bot:${n}`,
        ["An Nhiên", "Bắp", "Mây", "Cá Con", "Minh"][n % 5],
        point,
        "bot",
        ["sailor", "sunny", "coral", "ocean"][
          Math.floor(this.random() * 4)
        ] as Player["appearanceId"],
      );
      actor.level = 1 + Math.floor(this.random() * 10);
      actor.motionSeed = Math.floor(this.random() * 100000);
      this.bots.set(actor.id, {
        actor,
        slot,
        born: now - this.random() * 16000,
        duration: 24000 + this.random() * 12000,
        mode: Math.floor(this.random() * 4),
        target: point,
        anchor: point,
        cast: findFishingCast(point),
        nextChatAt: now + 15000 + this.random() * 25000,
      });
    }
    if (real > 10 && now - this.lastRetire >= 5000) {
      const b = [...this.bots.values()].find((b) => !b.retireAt);
      if (b) {
        b.retireAt = now;
        b.target = { x: b.actor.x + 1, z: b.actor.z + 1 };
        this.lastRetire = now;
      }
    }
    for (const [id, b] of this.bots) {
      const p = b.actor;
      if (b.retireAt && now - b.retireAt >= 5000) {
        this.bots.delete(id);
        continue;
      }
      if (now - b.born >= b.duration) {
        b.born = now;
        b.duration = 24000 + this.random() * 12000;
        b.mode = Math.floor(this.random() * 4);
        const pool = pools[BOT_ZONES[b.slot]].filter((q) =>
          within(q, b.anchor, 5),
        );
        b.target = pool[Math.floor(this.random() * pool.length)] ?? b.anchor;
        b.cast = findFishingCast(p);
      }
      const age = (now - b.born) / b.duration;
      let phase: Phase = "IDLE";
      p.moving = false;
      p.emote = undefined;
      if (b.retireAt || (b.mode === 1 && age < 0.35)) {
        const dx = b.target.x - p.x,
          dz = b.target.z - p.z,
          d = Math.max(1, Math.hypot(dx, dz));
        const q = moveOnMap(p, (dx / d) * dt * 1.8, (dz / d) * dt * 1.8);
        p.moving = Math.hypot(q.x - p.x, q.z - p.z) > 0.001;
        if (p.moving) p.yaw = Math.atan2(dx, dz);
        Object.assign(p, q);
        b.cast = findFishingCast(p);
      } else if (b.mode === 2 && age < 0.45)
        p.emote = (["wave", "happy", "heart", "clap"] as const)[
          p.motionSeed! % 4
        ];
      else if (b.mode !== 3 && b.cast) {
        p.bobber = b.cast.bobber;
        p.yaw = Math.atan2(p.bobber.x - p.x, p.bobber.z - p.z);
        phase =
          age < 0.06
            ? "CASTING"
            : age < 0.36
              ? "WAITING"
              : age < 0.55
                ? "APPROACHING"
                : age < 0.57
                  ? "NIBBLING"
                  : age < 0.7
                    ? "APPROACHING"
                    : age < 0.74
                      ? "BITE_WINDOW"
                      : age < 0.95
                        ? "REELING"
                        : "IDLE";
        p.shadowScale = 0.5 + (p.motionSeed! % 15) / 10;
        if (phase === "REELING" && !p.reel)
          p.reel = {
            startedAt: now,
            durationMs: b.duration * 0.21,
            seed: p.motionSeed!,
            origin: p.bobber,
            angler: { x: p.x, z: p.z },
          };
      }
      if (phase !== "REELING") delete p.reel;
      if (phase !== p.phase) {
        p.phase = phase;
        p.phaseStartedAt = now;
        p.phaseDurationMs =
          phase === "NIBBLING" ? b.duration * 0.02 : undefined;
      }
      p.y = groundHeightAt(p);
      p.area = areaAt(p);
      p.snapshotAt = now;
      if (p.speech && p.speech.until <= now) delete p.speech;
      if (
        !b.retireAt &&
        !p.moving &&
        ["IDLE", "WAITING", "APPROACHING"].includes(p.phase) &&
        now >= b.nextChatAt &&
        now - this.lastChatAt >= 12000
      ) {
        const lines = BOT_CHAT_LINES.filter((line) => line !== b.lastLine);
        const text = lines[Math.floor(this.random() * lines.length)];
        p.speech = { text, until: now + 6000 };
        b.lastLine = text;
        b.nextChatAt = now + 45000 + this.random() * 65000;
        this.lastChatAt = now;
      }
    }
    for (const n of this.npcs) n.snapshotAt = now;
    return [...this.npcs, ...[...this.bots.values()].map((b) => b.actor)];
  }
}
