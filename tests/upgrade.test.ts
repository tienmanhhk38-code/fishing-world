import { describe, it, expect } from "vitest";
import {
  DESTINATIONS,
  canWalk,
  NPCS,
  canShop,
  within,
  Residents,
  floatPresentation,
  SPECIES,
  fishLength,
  isLargeFish,
  NEARBY_CHAT_RADIUS,
  BOT_CHAT_LINES,
  overheadVisible,
  onPlatform,
  findFishingCast,
} from "../packages/shared/src/index";
import { readFileSync } from "node:fs";

describe("island experience upgrade", () => {
  it("hides distant overhead UI and restores it near the viewer, keeping own labels", () => {
    const viewer = { id: "self", x: 0, z: 0 };
    for (const kind of ["player", "bot"] as const) {
      expect(
        overheadVisible({ id: "other", kind, x: 19.9, z: 0 }, viewer),
      ).toBe(true);
      expect(
        overheadVisible({ id: "other", kind, x: 20.1, z: 0 }, viewer),
      ).toBe(false);
    }
    expect(
      overheadVisible({ id: "npc", kind: "npc", x: 8.1, z: 0 }, viewer),
    ).toBe(false);
    expect(overheadVisible({ ...viewer, kind: "player" }, viewer)).toBe(true);
    expect(
      overheadVisible({ id: "other", kind: "player", x: 1, z: 0 }, undefined),
    ).toBe(false);
  });
  it("faces profession NPCs towards the wooden pier and staggers cosmetic speech", () => {
    let seed = 22;
    const rng = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const residents = new Residents(rng);
    for (const npc of residents.npcs)
      expect(npc.yaw).toBeCloseTo(
        npc.id === "npc:guide"
          ? -Math.PI / 2
          : Math.atan2(-8 - npc.x, 1.9 - npc.z),
        8,
      );
    const seen = new Map<string, number>(),
      lines = new Map<string, string>();
    let last = -Infinity,
      count = 0;
    for (let now = 100000; now < 400000; now += 1000) {
      const actors = residents
        .update(1, now, 0.05)
        .filter((p) => p.kind === "bot");
      const fresh = actors.filter(
        (p) => p.speech && p.speech.until !== seen.get(p.id),
      );
      expect(fresh.length).toBeLessThanOrEqual(1);
      for (const p of fresh) {
        const speech = p.speech!;
        expect(now - last).toBeGreaterThanOrEqual(12000);
        expect(speech.until - now).toBe(6000);
        expect(BOT_CHAT_LINES).toContain(speech.text);
        expect(speech.text).not.toBe(lines.get(p.id));
        seen.set(p.id, speech.until);
        lines.set(p.id, speech.text);
        last = now;
        count++;
      }
      for (const p of actors)
        if (p.speech) expect(p.speech.until).toBeGreaterThan(now);
    }
    expect(count).toBeGreaterThan(5);
  });
  it("all five open destinations and NPC interaction positions are safe ground", () => {
    expect(Object.values(DESTINATIONS).filter((d) => d.open)).toHaveLength(5);
    for (const d of Object.values(DESTINATIONS))
      if (d.point) expect(canWalk(d.point), d.name).toBe(true);
    for (const n of NPCS) expect(canWalk(n), n.name).toBe(true);
    expect(new Residents().npcs.map((p) => p.id)).toEqual([
      "npc:merchant",
      "npc:guide",
      "npc:quest",
    ]);
  });
  it("enforces shop and nearby chat boundaries, including invalid coordinates", () => {
    const n = NPCS[0],
      p = { x: n.x + 2.99, z: n.z, phase: "IDLE" as const, connected: true };
    expect(canShop(p)).toBe(true);
    expect(canShop({ ...p, x: n.x + 3.01 })).toBe(false);
    expect(canShop({ ...p, connected: false })).toBe(false);
    expect(canShop({ ...p, phase: "REELING" })).toBe(false);
    expect(within({ x: 0, z: 0 }, { x: 19.9, z: 0 }, NEARBY_CHAT_RADIUS)).toBe(
      true,
    );
    expect(within({ x: 0, z: 0 }, { x: 20.1, z: 0 }, NEARBY_CHAT_RADIUS)).toBe(
      false,
    );
    expect(within({ x: NaN, z: 0 }, n, 3)).toBe(false);
  });
  it("fills quiet rooms, holds at 5–10, retires gradually above ten and clears empty rooms", () => {
    const r = new Residents(),
      bots = (real: number, now: number) =>
        r.update(real, now, 0.05).filter((p) => p.kind === "bot");
    expect(bots(1, 100000)).toHaveLength(5);
    expect(bots(4, 101000)).toHaveLength(5);
    expect(bots(5, 102000)).toHaveLength(5);
    expect(bots(10, 103000)).toHaveLength(5);
    expect(bots(11, 104000)).toHaveLength(5);
    expect(bots(11, 109000)).toHaveLength(4);
    expect(bots(11, 114000)).toHaveLength(3);
    expect(bots(0, 115000)).toHaveLength(0);
    expect(bots(4, 116000)).toHaveLength(5);
  });
  it("spreads five independent actors across two piers, two beaches and one pond", () => {
    let seed = 48;
    const rng = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const residents = new Residents(rng),
      actors = residents
        .update(1, 100000, 0.05)
        .filter((p) => p.kind === "bot");
    expect(actors.filter((p) => onPlatform(p))).toHaveLength(2);
    expect(
      actors.filter(
        (p) => !onPlatform(p) && findFishingCast(p)?.area === "beach",
      ),
    ).toHaveLength(2);
    expect(
      actors.filter((p) => findFishingCast(p)?.area === "village"),
    ).toHaveLength(1);
    expect(new Set(actors.map((p) => p.phaseStartedAt)).size).toBeGreaterThan(
      1,
    );
    expect(new Set(actors.map((p) => p.level)).size).toBeGreaterThan(1);
    for (const p of actors) expect(canWalk(p)).toBe(true);
  });
  it("never dips the float before fish contact, then sinks on a real bite", () => {
    expect(floatPresentation("NIBBLING", 149, 300, 1).dip).toBe(0);
    const contact = floatPresentation("NIBBLING", 150, 300, 1);
    expect(Math.hypot(contact.x, contact.z)).toBeCloseTo(0);
    expect(floatPresentation("NIBBLING", 225, 300, 1).dip).toBeLessThan(-0.15);
    expect(floatPresentation("BITE_WINDOW", 300).dip).toBe(-0.6);
    const end = floatPresentation("NIBBLING", 300, 300, 1),
      orbit = floatPresentation("APPROACHING", 0, 1000, 1 + 0.3 * 1.8);
    expect(Math.hypot(end.x - orbit.x, end.z - orbit.z)).toBeLessThan(0.0001);
  });
  it("sizes real weights consistently and distinguishes giant carry at exactly ten kg", () => {
    const small = SPECIES.find((s) => s.id === "anchovy")!,
      giant = SPECIES.find((s) => s.id === "marlin")!;
    expect(fishLength(giant, 150000)).toBeGreaterThan(
      fishLength(small, 50) * 8,
    );
    for (const s of SPECIES)
      for (const grams of [s.minGrams, s.maxGrams]) {
        expect(fishLength(s, grams)).toBeGreaterThanOrEqual(0.2);
        expect(fishLength(s, grams)).toBeLessThanOrEqual(4);
      }
    expect(isLargeFish(9990)).toBe(false);
    expect(isLargeFish(10000)).toBe(true);
  });
  it("ships sea extras within five MB and the freshwater set within 32 MB", () => {
    let bytes = 0,
      freshwaterBytes = 0;
    for (const s of SPECIES) {
      const root = new URL(
        "../apps/client/public/assets/starter/",
        import.meta.url,
      );
      const glb = readFileSync(new URL(`models/${s.model}.glb`, root));
      expect(glb.readUInt32LE(0)).toBe(0x46546c67);
      const thumbnail = readFileSync(
        new URL(`thumbnails/${s.model}.png`, root),
      );
      if (s.area === "village")
        freshwaterBytes += glb.length + thumbnail.length;
      else if (s.model.startsWith("fish_extra_")) bytes += glb.length;
      expect(
        readFileSync(new URL(`thumbnails/${s.model}.png`, root))
          .subarray(1, 4)
          .toString(),
      ).toBe("PNG");
    }
    expect(bytes).toBeLessThan(5_000_000);
    expect(freshwaterBytes).toBeLessThanOrEqual(32_000_000);
  });
});
