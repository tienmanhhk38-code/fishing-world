import { describe, it, expect } from "vitest";
import {
  SPECIES,
  RODS,
  fishPrice,
  levelProgress,
  FISHING_RULES,
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
  it("has forty unique species with freshwater giants", () => {
    expect(SPECIES).toHaveLength(40);
    expect(new Set(SPECIES.map((item) => item.id)).size).toBe(40);
    expect(new Set(SPECIES.map((item) => item.model)).size).toBe(40);
    expect(
      ["common", "uncommon", "rare", "legendary", "mythic"].map(
        (rarity) => SPECIES.filter((item) => item.rarity === rarity).length,
      ),
    ).toEqual([10, 9, 9, 7, 5]);
    expect(SPECIES.filter((s) => s.area === "village")).toHaveLength(15);
    expect(SPECIES.filter((s) => s.area === "beach")).toHaveLength(25);
  });
  it("can select each added species in its configured water and weight range", () => {
    for (const id of [
      "marbled_eel",
      "sturgeon",
      "amberjack",
      "bluefin_tuna",
      "oarfish",
    ]) {
      const species = SPECIES.find((s) => s.id === id)!;
      const tiers = [
        ...new Set(
          SPECIES.filter((s) => s.area === species.area).map((s) => s.rarity),
        ),
      ];
      const tierWeights = tiers.map((r) =>
        r === "common" && species.area === "beach"
          ? 69.9
          : FISHING_RULES[r].encounter,
      );
      const index = tiers.indexOf(species.rarity);
      const tierRoll =
        (tierWeights.slice(0, index).reduce((a, b) => a + b, 0) +
          tierWeights[index] / 2) /
        tierWeights.reduce((a, b) => a + b, 0);
      const pool = SPECIES.filter(
        (s) => s.area === species.area && s.rarity === species.rarity,
      );
      const offset = pool
        .slice(0, pool.indexOf(species))
        .reduce((a, s) => a + s.weight, 0);
      const speciesRoll =
        (offset + species.weight / 2) / pool.reduce((a, s) => a + s.weight, 0);
      const draws = [tierRoll, speciesRoll, 0.5, 0.5];
      const caught = selectCatch(
        species.area,
        "wood",
        "dough",
        () => draws.shift()!,
      );
      expect(caught.species.id).toBe(id);
      expect(caught.grams).toBeGreaterThanOrEqual(species.minGrams);
      expect(caught.grams).toBeLessThanOrEqual(species.maxGrams);
    }
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
    ).toBe("mythic");
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
            ? species.rarity === "rare" ||
              species.rarity === "legendary" ||
              species.rarity === "mythic"
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
