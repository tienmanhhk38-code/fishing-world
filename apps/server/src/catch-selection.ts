import { randomInt } from "node:crypto";
import {
  SPECIES,
  RODS,
  FISHING_RULES,
  type OpenAreaId,
  type RodId,
  type BaitId,
} from "@fishing/shared";
export function selectCatch(
  area: OpenAreaId,
  rod: RodId,
  bait: BaitId,
  random: () => number = () => randomInt(0, 16777216) / 16777216,
) {
  const luck = RODS[rod].luck;
  const available = SPECIES.filter((species) => species.area === area);
  const tiers = [...new Set(available.map((s) => s.rarity))];
  const tierWeights = tiers.map(
    (r) =>
      FISHING_RULES[r].encounter *
      (r === "rare" || r === "legendary" ? 1 + luck : 1),
  );
  let tierRoll = random() * tierWeights.reduce((a, b) => a + b, 0),
    rarity = tiers[tiers.length - 1];
  for (let i = 0; i < tiers.length; i++) {
    tierRoll -= tierWeights[i];
    if (tierRoll < 0) {
      rarity = tiers[i];
      break;
    }
  }
  const pool = available
    .filter((species) => species.rarity === rarity)
    .map((species) => ({
      species,
      weight:
        species.weight *
        (bait !== "dough" && species.affinity === bait ? 1.35 : 1),
    }));
  let roll = random() * pool.reduce((sum, item) => sum + item.weight, 0);
  let species = pool[pool.length - 1].species;
  for (const item of pool) {
    roll -= item.weight;
    if (roll < 0) {
      species = item.species;
      break;
    }
  }
  const sizeWeights = [0.45, 0.4, 0.15 * (1 + luck)],
    total = sizeWeights.reduce((sum, n) => sum + n, 0);
  let sizeRoll = random() * total,
    bucket = 2;
  for (let i = 0; i < 3; i++) {
    sizeRoll -= sizeWeights[i];
    if (sizeRoll < 0) {
      bucket = i;
      break;
    }
  }
  const range = species.maxGrams - species.minGrams + 1;
  const min = species.minGrams + Math.floor((range * bucket) / 3),
    max = species.minGrams + Math.floor((range * (bucket + 1)) / 3) - 1;
  const grams = min + Math.floor(random() * (max - min + 1));
  return { species, grams };
}
