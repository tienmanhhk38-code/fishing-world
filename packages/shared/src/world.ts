export type AreaId = "beach" | "village" | "coral" | "mystery";
export type OpenAreaId = "beach" | "village";
export interface Point {
  x: number;
  z: number;
}
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export const AREAS = {
  beach: {
    name: "Bãi Biển",
    description:
      "Bãi cát phía nam và bến câu chữ L. Mọi bờ biển trong tầm cần đều câu được.",
    water: "Biển",
    open: true,
  },
  village: {
    name: "Làng Chài",
    description:
      "Quảng trường, hải đăng phía tây và hồ nước ngọt phía đông. Đi bộ liên tục quanh đảo.",
    water: "Biển · Nước ngọt",
    open: true,
  },
  coral: {
    name: "Vùng San Hô",
    description: "Rạn san hô ngoài khơi. Sắp mở.",
    water: "Biển",
    open: false,
  },
  mystery: {
    name: "Hòn Đảo Bí Ẩn",
    description: "Một hòn đảo còn chờ được khám phá. Sắp mở.",
    water: "Biển",
    open: false,
  },
} as const;
// Metres; north = -Z. One contour for rendering, water and server collision.
const controls: Point[] = [
  [-39, -28],
  [-32, -19],
  [-27, -12],
  [-18, -10],
  [-8, -13],
  [-4, -18],
  [8, -18],
  [16, -14],
  [29, -17],
  [37, -24],
  [41, -37],
  [36, -51],
  [27, -60],
  [10, -66],
  [-8, -66],
  [-26, -61],
  [-37, -52],
  [-41, -39],
].map(([x, z]) => ({ x, z }));
export const WORLD_SCALE = 1.5;
export const worldPoint = (p: Point): Point => ({
  x: p.x * WORLD_SCALE,
  z: p.z * WORLD_SCALE,
});
export const ISLAND_OUTLINE: Point[] = controls.flatMap((p, i) => {
  const a = controls[(i + controls.length - 1) % controls.length],
    b = controls[(i + 1) % controls.length],
    c = controls[(i + 2) % controls.length];
  return Array.from({ length: 4 }, (_, j) => {
    const t = j / 4;
    const sample = (key: "x" | "z") =>
      0.5 *
      (2 * p[key] +
        (-a[key] + b[key]) * t +
        (2 * a[key] - 5 * p[key] + 4 * b[key] - c[key]) * t * t +
        (-a[key] + 3 * p[key] - 3 * b[key] + c[key]) * t * t * t);
    return worldPoint({ x: sample("x"), z: sample("z") });
  });
});
export const POND_CENTER = { x: 30, z: -49.5 };
export const POND_RADII = { x: 15, z: 10.8 };
export const POND: Rect = { minX: 15, maxX: 45, minZ: -60.3, maxZ: -38.7 };
export const VILLAGE: Rect = {
  minX: -64.5,
  maxX: 64.5,
  minZ: -103.5,
  maxZ: -28.5,
};
export const BEACH_DECK: Rect = { minX: -24, maxX: 12, minZ: 0, maxZ: 4 };
export const DOCK_STEM: Rect = { minX: -24, maxX: -20, minZ: -27, maxZ: 4 };
export const POND_BRIDGE: Rect = {
  minX: 15.75,
  maxX: 44.25,
  minZ: -58.75,
  maxZ: -56.75,
};
export const LIGHTHOUSE = worldPoint({ x: -30, z: -49 });
export const PALM_POSITIONS: Point[] = [
  [-24, -42],
  [-16, -52],
  [-10, -57],
  [0, -53],
  [12, -59],
  [22, -54],
  [27, -41],
  [33, -37],
  [26, -24],
  [12, -23],
  [-32, -24],
  [-28, -16],
  [-17, -15],
  [-9, -19],
  [-29, -20],
  [-30, -25],
  [-24, -12],
  [-11, -15],
  [-6, -19],
  [-34, -34],
  [-35, -41],
  [-32, -55],
  [-24, -55],
  [-18, -58],
  [-4, -57],
  [7, -62],
  [20, -58],
  [29, -51],
  [34, -42],
  [35, -29],
  [28, -21],
  [17, -21],
  [7, -22],
  [5, -41],
  [13, -46],
  [-23, -44],
  [-5, -49],
  [-35, -29],
  [31, -34],
].map(([x, z]) => worldPoint({ x, z }));
export const ROCK_OUTCROPS: Point[] = [
  [3, -57],
  [12, -59],
  [17, -54],
  [-34, -47],
  [-32, -53],
  [30, -51],
].map(([x, z]) => worldPoint({ x, z }));
export const HOUSE_POSITIONS: Point[] = [
  { x: -19, z: -35 },
  { x: -10, z: -43 },
  { x: -1, z: -38 },
  { x: -23, z: -25 },
  { x: 1, z: -27 },
].map(worldPoint);
export const MARKET_POSITIONS: Point[] = [
  { x: -16, z: -25 },
  { x: -4, z: -26 },
].map(worldPoint);
export const SPAWNS: Record<OpenAreaId, Point> = {
  beach: { x: -1, z: 1.9 },
  village: { x: 13.2, z: -49.5 },
};
export const DESTINATIONS = {
  beach: {
    name: "Bãi Biển",
    area: "beach",
    open: true,
    point: { x: -20, z: -20 },
    left: "16%",
    top: "73%",
  },
  dock: {
    name: "Bến câu biển",
    area: "beach",
    open: true,
    point: { x: -1, z: 1.9 },
    left: "50%",
    top: "90%",
  },
  village: {
    name: "Làng Chài",
    area: "village",
    open: true,
    point: { x: -24, z: -34 },
    left: "45%",
    top: "28%",
  },
  pond: {
    name: "Hồ nước ngọt",
    area: "village",
    open: true,
    point: { x: 13.2, z: -49.5 },
    left: "66%",
    top: "35%",
  },
  lighthouse: {
    name: "Hải đăng",
    area: "village",
    open: true,
    point: { x: -42, z: -73.5 },
    left: "31%",
    top: "14%",
  },
  coral: {
    name: "Vùng San Hô",
    area: "coral",
    open: false,
    point: null,
    left: "89%",
    top: "82%",
  },
  mystery: {
    name: "Hòn Đảo Bí Ẩn",
    area: "mystery",
    open: false,
    point: null,
    left: "89%",
    top: "59%",
  },
} as const;
export type DestinationId = keyof typeof DESTINATIONS;
export const WALKABLE = [BEACH_DECK, DOCK_STEM];
export const OBSTACLES: Rect[] = [
  ...PALM_POSITIONS.map(({ x, z }) => ({
    minX: x - 0.35,
    maxX: x + 0.35,
    minZ: z - 0.35,
    maxZ: z + 0.35,
  })),
  ...ROCK_OUTCROPS.map(({ x, z }) => ({
    minX: x - 2.7,
    maxX: x + 2.7,
    minZ: z - 2,
    maxZ: z + 2,
  })),
  ...HOUSE_POSITIONS.map(({ x, z }) => ({
    minX: x - 2.25,
    maxX: x + 2.25,
    minZ: z - 1.95,
    maxZ: z + 1.95,
  })),
  ...MARKET_POSITIONS.map(({ x, z }) => ({
    minX: x - 1.85,
    maxX: x + 1.85,
    minZ: z - 1.15,
    maxZ: z + 1.15,
  })),
  {
    minX: LIGHTHOUSE.x - 1.6,
    maxX: LIGHTHOUSE.x + 1.6,
    minZ: LIGHTHOUSE.z - 1.6,
    maxZ: LIGHTHOUSE.z + 1.6,
  },
  { minX: -16.6, maxX: -13.4, minZ: -49.6, maxZ: -46.4 },
];
export function inside(p: Point, r: Rect) {
  return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
}
export function onIsland(p: Point) {
  let hit = false;
  for (
    let i = 0, j = ISLAND_OUTLINE.length - 1;
    i < ISLAND_OUTLINE.length;
    j = i++
  ) {
    const a = ISLAND_OUTLINE[i],
      b = ISLAND_OUTLINE[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      hit = !hit;
  }
  return hit;
}
export function shoreDistance(p: Point) {
  let distance = Infinity;
  for (let i = 0; i < ISLAND_OUTLINE.length; i++) {
    const a = ISLAND_OUTLINE[i],
      b = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length],
      dx = b.x - a.x,
      dz = b.z - a.z,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz),
        ),
      );
    distance = Math.min(
      distance,
      Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz),
    );
  }
  return distance;
}
export function inPond(p: Point, margin = 0) {
  return (
    Math.hypot(
      (p.x - POND_CENTER.x) / (POND_RADII.x + margin),
      (p.z - POND_CENTER.z) / (POND_RADII.z + margin),
    ) < 1
  );
}
export function waterAt(p: Point): OpenAreaId | undefined {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
  if (inPond(p)) return "village";
  if (!onIsland(p)) return "beach";
}
export function onPlatform(p: Point) {
  return WALKABLE.some((r) => inside(p, r)) || inside(p, POND_BRIDGE);
}
export function waterHeightAt(p: Point) {
  return inPond(p) ? 0.48 : 0;
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function landHeightAt(p: Point) {
  const hill = (x: number, z: number, rx: number, rz: number, h: number) =>
    h * Math.exp(-2.5 * (((p.x - x) / rx) ** 2 + ((p.z - z) / rz) ** 2));
  return (
    0.25 +
    0.47 * smooth(0, 4, shoreDistance(p) / WORLD_SCALE) +
    hill(-45, -73.5, 15, 16.5, 4.6) +
    hill(13.5, -85.5, 30, 13.5, 7.8)
  );
}
export function groundHeightAt(p: Point) {
  if (WALKABLE.some((r) => inside(p, r))) return 0.72;
  if (inside(p, POND_BRIDGE))
    return 0.76 + Math.sin(((p.x - 15.75) / 28.5) * Math.PI) * 1.45;
  return landHeightAt(p);
}
export function canWalk(p: Point) {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    (onPlatform(p) ||
      (onIsland(p) && shoreDistance(p) > 0.55 && !inPond(p, 0.45))) &&
    !OBSTACLES.some((r) => inside(p, r))
  );
}
export function moveOnMap(p: Point, dx: number, dz: number): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.18));
  let current = p;
  for (let i = 0; i < steps; i++) {
    const next = { x: current.x + dx / steps, z: current.z + dz / steps };
    if (canWalk(next)) {
      current = next;
      continue;
    }
    const horizontal = { x: next.x, z: current.z },
      vertical = { x: current.x, z: next.z };
    if (canWalk(horizontal)) current = horizontal;
    else if (canWalk(vertical)) current = vertical;
  }
  return current;
}
export function areaAt(p: Point): OpenAreaId {
  return inside(p, VILLAGE) ? "village" : "beach";
}
export interface FishingPoint extends Point {
  id: string;
  area: OpenAreaId;
  bobber: Point;
}
export const CAST_RANGE = 9;
export function findFishingCast(
  p: Point,
  yaw = Math.PI,
): FishingPoint | undefined {
  if (!canWalk(p) || !nearFishingWater(p)) return;
  let best: FishingPoint | undefined,
    bestScore = Infinity;
  for (let i = 0; i < 48; i++) {
    const angle = yaw + (i / 48) * Math.PI * 2,
      turn = Math.abs(Math.atan2(Math.sin(angle - yaw), Math.cos(angle - yaw)));
    // Leave enough water between the avatar and float for the default camera.
    for (let d = 5.5; d <= CAST_RANGE; d += 0.5) {
      const target = {
          x: p.x + Math.sin(angle) * d,
          z: p.z + Math.cos(angle) * d,
        },
        area = waterAt(target);
      if (!area || onPlatform(target)) continue;
      if (
        area === "beach" ? shoreDistance(target) < 0.6 : !inPond(target, -0.6)
      )
        continue;
      let blocked = false;
      for (let s = 0.5; s < d; s += 0.5) {
        const along = {
          x: p.x + Math.sin(angle) * s,
          z: p.z + Math.cos(angle) * s,
        };
        if (OBSTACLES.some((r) => inside(along, r))) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      const score = d + turn * 1.3;
      if (score < bestScore) {
        bestScore = score;
        best = { ...p, id: "water", area, bobber: target };
      }
      break;
    }
  }
  return best;
}
export interface RoomInfo {
  id: string;
  name: string;
  clients: number;
  maxClients: number;
  locked: boolean;
}

// Distance to actual exposed water edges, never to the water hidden under a deck.
const bankSegments: [Point, Point][] = [
  ...ISLAND_OUTLINE.map(
    (p, i) =>
      [p, ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length]] as [Point, Point],
  ),
  ...Array.from({ length: 256 }, (_, i) => {
    const at = (n: number) => ({
      x: POND_CENTER.x + Math.cos((n / 256) * Math.PI * 2) * POND_RADII.x,
      z: POND_CENTER.z + Math.sin((n / 256) * Math.PI * 2) * POND_RADII.z,
    });
    return [at(i), at(i + 1)] as [Point, Point];
  }),
  ...[...WALKABLE, POND_BRIDGE].flatMap((r) => {
    const corners = [
      { x: r.minX, z: r.minZ },
      { x: r.maxX, z: r.minZ },
      { x: r.maxX, z: r.maxZ },
      { x: r.minX, z: r.maxZ },
    ];
    return corners.flatMap((a, i) => {
      const b = corners[(i + 1) % 4],
        n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      return Array.from(
        { length: n },
        (_, j) =>
          [
            { x: a.x + ((b.x - a.x) * j) / n, z: a.z + ((b.z - a.z) * j) / n },
            {
              x: a.x + ((b.x - a.x) * (j + 1)) / n,
              z: a.z + ((b.z - a.z) * (j + 1)) / n,
            },
          ] as [Point, Point],
      );
    });
  }),
];
export function nearFishingWater(p: Point, radius = 2) {
  for (const [a, b] of bankSegments) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz),
        ),
      );
    const q = { x: a.x + t * dx, z: a.z + t * dz };
    if (Math.hypot(p.x - q.x, p.z - q.z) > radius + 1e-6) continue;
    for (let i = 0; i < 8; i++) {
      const r = {
        x: q.x + Math.cos((i * Math.PI) / 4) * 0.04,
        z: q.z + Math.sin((i * Math.PI) / 4) * 0.04,
      };
      if (waterAt(r) && !onPlatform(r)) return true;
    }
  }
  return false;
}
