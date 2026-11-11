import { describe, it, expect } from "vitest";
import {
  canWalk,
  moveOnMap,
  SPAWNS,
  findFishingCast,
  waterAt,
  onPlatform,
  nearFishingWater,
  groundHeightAt,
  landHeightAt,
  ISLAND_OUTLINE,
  shoreDistance,
  HOUSE_POSITIONS,
  CAST_RANGE,
  LIGHTHOUSE,
  POND_CENTER,
  POND_RADII,
  POND_BRIDGE,
  BEACH_DECK,
  WORLD_SCALE,
} from "../packages/shared/src/index";
describe("expanded island and exposed water banks", () => {
  it("connects both spawns and the L pier to the beach", () => {
    for (const p of Object.values(SPAWNS))
      expect(canWalk(p), JSON.stringify(p)).toBe(true);
    let p = { x: -22, z: 2 };
    for (let i = 0; i < 220; i++) p = moveOnMap(p, 0, -0.18);
    expect(p.z).toBeLessThan(-28);
    expect(canWalk(p)).toBe(true);
    expect(canWalk({ x: 11, z: 2 })).toBe(true);
    expect(canWalk({ x: 11, z: 6 })).toBe(false);
  });
  it("allows exposed banks but rejects points beyond two metres or water underneath a pier", () => {
    const x = POND_CENTER.x - POND_RADII.x,
      z = POND_CENTER.z;
    expect(nearFishingWater({ x: x - 1.99, z })).toBe(true);
    expect(nearFishingWater({ x: x - 2.01, z })).toBe(false);
    expect(findFishingCast({ x: x - 2.01, z })).toBeUndefined();
    for (const p of [
      { x: 6.3, z: 1.2 },
      { x: -22, z: -5 },
      SPAWNS.village,
      { x: POND_CENTER.x, z: POND_CENTER.z + POND_RADII.z + 1.2 },
    ]) {
      const cast = findFishingCast(p);
      expect(cast, JSON.stringify(p)).toBeDefined();
      if (!cast) continue;
      expect(waterAt(cast.bobber)).toBe(cast.area);
      expect(onPlatform(cast.bobber)).toBe(false);
      expect(
        Math.hypot(cast.bobber.x - p.x, cast.bobber.z - p.z),
      ).toBeLessThanOrEqual(CAST_RANGE + 0.001);
    }
  });
  it("blocks houses and lake water and invalid coordinates", () => {
    expect(canWalk(POND_CENTER)).toBe(false);
    expect(findFishingCast(POND_CENTER)).toBeUndefined();
    for (const p of HOUSE_POSITIONS) {
      expect(canWalk(p)).toBe(false);
      expect(findFishingCast(p)).toBeUndefined();
    }
    expect(findFishingCast({ x: NaN, z: 2 })).toBeUndefined();
    expect(waterAt({ x: Infinity, z: 2 })).toBeUndefined();
  });
  it("uses the same bridge and hill heights as rendering", () => {
    const p = {
      x: (POND_BRIDGE.minX + POND_BRIDGE.maxX) / 2,
      z: (POND_BRIDGE.minZ + POND_BRIDGE.maxZ) / 2,
    };
    expect(canWalk(p)).toBe(true);
    expect(groundHeightAt(p)).toBeCloseTo(2.21, 2);
    expect(landHeightAt(LIGHTHOUSE)).toBeGreaterThan(5);
    let point = SPAWNS.village;
    for (let i = 0; i < 100; i++) point = moveOnMap(point, 0.18, 0);
    expect(point.x).toBeLessThan(POND_CENTER.x - POND_RADII.x);
  });
  it("keeps freely selected shoreline locations fishable around the expanded island", () => {
    expect(ISLAND_OUTLINE).toHaveLength(72);
    let checked = 0;
    for (const edge of ISLAND_OUTLINE) {
      const dx = -WORLD_SCALE - edge.x,
        dz = -36 * WORLD_SCALE - edge.z,
        l = Math.hypot(dx, dz),
        p = { x: edge.x + (dx / l) * 1.2, z: edge.z + (dz / l) * 1.2 };
      if (!canWalk(p) || onPlatform(p) || shoreDistance(p) > 1.9) continue;
      expect(findFishingCast(p), JSON.stringify(p)).toBeDefined();
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  });
});
