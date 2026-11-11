import type { Rarity, Species } from "./catalog";
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
    shadowScale: rules.shadow[0] + size * (rules.shadow[1] - rules.shadow[0]),
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
