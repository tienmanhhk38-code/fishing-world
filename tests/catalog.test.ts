import { describe, it, expect } from "vitest";
import {
  SPECIES,
  RODS,
  fishPrice,
  levelProgress,
} from "../packages/shared/src/index";
import { selectCatch } from "../apps/server/src/catch-selection";
function randomGenerator() {
  let seed = 12345;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
describe("M3 catalog and progression", () => {
  it("has fifteen unique species with the planned rarity split", () => {
    expect(SPECIES).toHaveLength(15);
    expect(new Set(SPECIES.map((item) => item.id)).size).toBe(15);
    expect(new Set(SPECIES.map((item) => item.model)).size).toBe(15);
    expect(
      ["common", "uncommon", "rare", "legendary"].map(
        (rarity) => SPECIES.filter((item) => item.rarity === rarity).length,
      ),
    ).toEqual([7, 4, 3, 1]);
  });
  it("uses cumulative XP thresholds and caps level ten", () => {
    expect(levelProgress(49).level).toBe(1);
    expect(levelProgress(50).level).toBe(2);
    expect(levelProgress(190).level).toBe(2);
    expect(levelProgress(191).level).toBe(3);
    expect(levelProgress(100000)).toMatchObject({ level: 10, needed: 0 });
  });
  it("rounds prices from the species reference weight", () => {
    expect(fishPrice(SPECIES[0], 1000)).toBe(30);
    expect(fishPrice(SPECIES[0], 225)).toBe(7);
    expect(fishPrice(SPECIES[0], 1)).toBe(1);
  });
  it("keeps fish and gram ranges valid across both areas and every rod/bait", () => {
    const random = randomGenerator();
    for (const area of ["beach", "village"] as const)
      for (const rod of ["wood", "bamboo", "carbon"] as const)
        for (const bait of ["dough", "worm", "shrimp"] as const)
          for (let i = 0; i < 500; i++) {
            const result = selectCatch(area, rod, bait, random);
            expect(result.species.area).toBe(area);
            expect(result.grams).toBeGreaterThanOrEqual(
              result.species.minGrams,
            );
            expect(result.grams).toBeLessThanOrEqual(result.species.maxGrams);
            expect(Number.isInteger(result.grams)).toBe(true);
          }
  });
  it("allows the wooden rod to encounter the rarest fish", () => {
    expect(
      selectCatch("beach", "wood", "dough", () => 0.999999).species.rarity,
    ).toBe("legendary");
  });
  it("increases rare weight and bait affinity in repeated seeded draws", () => {
    const sample = (
      rod: "wood" | "carbon",
      bait: "dough" | "worm",
      area: "beach" | "village",
    ) => {
      const random = randomGenerator();
      let count = 0;
      for (let i = 0; i < 12000; i++) {
        const { species } = selectCatch(area, rod, bait, random);
        if (
          area === "beach"
            ? species.rarity === "rare" || species.rarity === "legendary"
            : species.affinity === "worm"
        )
          count++;
      }
      return count;
    };
    expect(sample("carbon", "dough", "beach")).toBeGreaterThan(
      sample("wood", "dough", "beach"),
    );
    expect(sample("wood", "worm", "village")).toBeGreaterThan(
      sample("wood", "dough", "village"),
    );
    expect(RODS.carbon.luck).toBe(0.15);
  });
});
