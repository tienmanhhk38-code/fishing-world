import { fishLength, type Rarity, type Species } from "./catalog";
import { waterAt, onPlatform, type Point } from "./world";
export const FISHING_RULES: Record<
  Rarity,
  {
    encounter: number;
    hookMs: number;
    reelMs: [number, number];
    escape: number;
    shadow: [number, number];
  }
> = {
  common: {
    encounter: 70,
    hookMs: 900,
    reelMs: [4000, 5000],
    escape: 0.05,
    shadow: [0.75, 1],
  },
  uncommon: {
    encounter: 22,
    hookMs: 700,
    reelMs: [5000, 7000],
    escape: 0.12,
    shadow: [1.15, 1.45],
  },
  rare: {
    encounter: 7,
    hookMs: 550,
    reelMs: [7000, 9000],
    escape: 0.22,
    shadow: [1.6, 2],
  },
  mythic: {
    encounter: 0.1,
    hookMs: 400,
    reelMs: [12000, 16000],
    escape: 0.35,
    shadow: [4, 8],
  },
  legendary: {
    encounter: 1,
    hookMs: 400,
    reelMs: [10000, 12000],
    escape: 0.35,
    shadow: [2.2, 2.8],
  },
};
export interface ReelPlan {
  startedAt: number;
  durationMs: number;
  seed: number;
  origin: Point;
  angler: Point;
}
export type FishingEndReason = "early" | "late" | "line_break" | "cancelled";
export function floatPresentation(
  phase: string,
  elapsedMs: number,
  durationMs = 300,
  seed = 0,
) {
  const t = Math.max(0, elapsedMs) / 1000;
  const angle = t * 1.8 + seed;
  let x = Math.sin(angle) * 0.95,
    z = Math.cos(angle) * 0.95,
    dip = 0,
    yaw = angle + Math.PI / 2;
  if (phase === "NIBBLING") {
    const progress = Math.min(1, elapsedMs / Math.max(1, durationMs));
    // Touch at the halfway point; the float responds only after contact.
    const radius =
      progress < 0.5
        ? 0.95 * (1 - progress * 2)
        : 0.95 * ((progress - 0.5) * 2);
    x = Math.sin(angle) * radius;
    z = Math.cos(angle) * radius;
    yaw = angle + (progress < 0.5 ? Math.PI : 0);
    dip = progress < 0.5 ? 0 : -0.2 * Math.sin((progress - 0.5) * Math.PI * 2);
  } else if (phase === "BITE_WINDOW") {
    dip =
      t < 0.12
        ? Math.sin(t * 95) * 0.065
        : -0.6 * Math.min(1, (t - 0.12) / 0.12);
    x *= Math.max(0, 1 - t * 6);
    z *= Math.max(0, 1 - t * 6);
  } else dip = Math.sin(t * 2) * 0.025;
  return {
    x,
    z,
    dip,
    yaw,
    contactMs: durationMs / 2,
  };
}
export function catchPresentation(species: Species, grams: number) {
  const rules = FISHING_RULES[species.rarity],
    size = Math.max(
      0,
      Math.min(
        1,
        (grams - species.minGrams) /
          Math.max(1, species.maxGrams - species.minGrams),
      ),
    );
  return {
    hookMs: rules.hookMs,
    reelMs: Math.round(
      rules.reelMs[0] + size * (rules.reelMs[1] - rules.reelMs[0]),
    ),
    shadowScale:
      species.rarity === "mythic" ? 4 + size * 4 : fishLength(species, grams),
    escapeChance: rules.escape,
  };
}
export function reelPosition(plan: ReelPlan, now: number): Point {
  const t = Math.max(0, Math.min(1, (now - plan.startedAt) / plan.durationMs));
  const dx = plan.origin.x - plan.angler.x,
    dz = plan.origin.z - plan.angler.z,
    d = Math.max(0.01, Math.hypot(dx, dz)),
    nx = dx / d,
    nz = dz / d;
  const fight =
    Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 5 + plan.seed) * 1.1;
  const distance = d * (1 - 0.55 * t) + Math.sin(t * Math.PI * 4) * 0.65;
  const candidate = {
    x: plan.angler.x + nx * distance - nz * fight,
    z: plan.angler.z + nz * distance + nx * fight,
  };
  const habitat = waterAt(plan.origin);
  // Project each candidate back towards the known valid origin. The same pure
  // function is used by server snapshots and rendering, including reconnects.
  for (let blend = 1; blend > 0; blend -= 0.1) {
    const p = {
      x: plan.origin.x + (candidate.x - plan.origin.x) * blend,
      z: plan.origin.z + (candidate.z - plan.origin.z) * blend,
    };
    if (waterAt(p) === habitat && !onPlatform(p)) return p;
  }
  return plan.origin;
}
