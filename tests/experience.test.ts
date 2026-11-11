import { describe, it, expect } from "vitest";
import {
  FISHING_RULES,
  catchPresentation,
  simulateMovement,
  groundHeightAt,
  SPAWNS,
  canWalk,
  questDay,
  questResetAt,
  reelPosition,
  waterAt,
  SPECIES,
  hookAllowed,
  type Motion,
} from "../packages/shared/src/index";
import { selectCatch } from "../apps/server/src/catch-selection";
describe("experience v4 rules", () => {
  it("samples rarity tiers independently of species counts and keeps freshwater pools valid", () => {
    let seed = 1749;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const counts = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    for (let i = 0; i < 50000; i++)
      counts[selectCatch("beach", "wood", "dough", random).species.rarity]++;
    for (const rarity of Object.keys(counts) as (keyof typeof counts)[])
      expect(counts[rarity] / 50000).toBeCloseTo(
        FISHING_RULES[rarity].encounter / 100,
        2,
      );
    for (let i = 0; i < 500; i++)
      expect(
        selectCatch("village", "wood", "dough", random).species.rarity,
      ).not.toBe("legendary");
  });
  it("applies every reaction deadline including bounded RTT and does not accept early hooks", () => {
    for (const rules of Object.values(FISHING_RULES)) {
      expect(hookAllowed(999, 1000, 300, rules.hookMs)).toBe(false);
      expect(
        hookAllowed(1000 + rules.hookMs + 150, 1000, 1000, rules.hookMs),
      ).toBe(true);
      expect(
        hookAllowed(1001 + rules.hookMs + 150, 1000, 1000, rules.hookMs),
      ).toBe(false);
    }
  });
  it("increases shadow and reel duration with weight and keeps deterministic fish paths inside water", () => {
    for (const s of SPECIES) {
      const a = catchPresentation(s, s.minGrams),
        b = catchPresentation(s, s.maxGrams);
      expect(b.shadowScale).toBeGreaterThan(a.shadowScale);
      expect(b.reelMs).toBeGreaterThan(a.reelMs);
    }
    const plan = {
      startedAt: 1000,
      durationMs: 8000,
      seed: 42,
      origin: { x: 0, z: -5 },
      angler: SPAWNS.beach,
    };
    for (let now = 1000; now <= 9000; now += 50) {
      const p = reelPosition(plan, now);
      expect(waterAt(p)).toBe("beach");
      expect(reelPosition(plan, now)).toEqual(p);
    }
  });
  it("runs at seven metres per second and lands a safe one metre jump without crossing water", () => {
    const base: Motion = {
      ...SPAWNS.beach,
      y: groundHeightAt(SPAWNS.beach),
      vy: 0,
      grounded: true,
      running: false,
      moving: false,
      yaw: 0,
    };
    let p = { ...base };
    for (let i = 0; i < 60; i++)
      p = simulateMovement(p, { x: 1, z: 0, sprint: true }, 1 / 60);
    expect(p.x - base.x).toBeCloseTo(7, 2);
    p = { ...base, grounded: false, vy: 6 };
    let peak = base.y;
    for (let i = 0; i < 120; i++) {
      p = simulateMovement(p, { x: 0, z: -1 }, 1 / 60);
      peak = Math.max(peak, p.y);
      expect(canWalk(p)).toBe(true);
    }
    expect(peak - base.y).toBeGreaterThan(0.85);
    expect(peak - base.y).toBeLessThan(1.05);
    expect(p.grounded).toBe(true);
    expect(p.z).toBeGreaterThanOrEqual(0);
  });
  it("rolls Vietnamese quest days at midnight rather than at UTC midnight", () => {
    expect(questDay(new Date("2026-11-11T16:59:59Z"))).toBe("2026-11-11");
    expect(questDay(new Date("2026-11-11T17:00:00Z"))).toBe("2026-11-12");
    expect(questResetAt(new Date("2026-11-11T16:59:59Z"))).toBe(
      "2026-11-11T17:00:00.000Z",
    );
  });
});
