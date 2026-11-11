import type { OpenAreaId } from "./world";

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type RodId = "wood" | "bamboo" | "carbon";
export type BaitId = "dough" | "worm" | "shrimp";
export interface Species {
  id: string;
  name: string;
  area: OpenAreaId;
  rarity: Rarity;
  model: string;
  minGrams: number;
  maxGrams: number;
  referenceGrams: number;
  basePrice: number;
  xp: number;
  weight: number;
  affinity?: BaitId;
}
export const RARITIES: Record<Rarity, string> = {
  common: "Phổ biến",
  uncommon: "Ít gặp",
  rare: "Hiếm",
  legendary: "Cực hiếm",
};
export const SPECIES: Species[] = [
  {
    id: "mackerel",
    name: "Cá bạc má",
    area: "beach",
    rarity: "common",
    model: "fish_concept_01",
    minGrams: 180,
    maxGrams: 2200,
    referenceGrams: 1000,
    basePrice: 30,
    xp: 20,
    weight: 100,
  },
  {
    id: "herring",
    name: "Cá trích",
    area: "beach",
    rarity: "common",
    model: "fish_concept_03",
    minGrams: 80,
    maxGrams: 650,
    referenceGrams: 300,
    basePrice: 18,
    xp: 20,
    weight: 100,
    affinity: "shrimp",
  },
  {
    id: "anchovy",
    name: "Cá cơm",
    area: "beach",
    rarity: "common",
    model: "fish_concept_05",
    minGrams: 20,
    maxGrams: 150,
    referenceGrams: 100,
    basePrice: 10,
    xp: 20,
    weight: 100,
  },
  {
    id: "mullet",
    name: "Cá đối",
    area: "beach",
    rarity: "common",
    model: "fish_concept_06",
    minGrams: 200,
    maxGrams: 2400,
    referenceGrams: 1000,
    basePrice: 28,
    xp: 20,
    weight: 100,
    affinity: "shrimp",
  },
  {
    id: "perch",
    name: "Cá rô",
    area: "village",
    rarity: "common",
    model: "fish_concept_07",
    minGrams: 100,
    maxGrams: 2200,
    referenceGrams: 700,
    basePrice: 25,
    xp: 20,
    weight: 100,
    affinity: "worm",
  },
  {
    id: "crucian",
    name: "Cá diếc",
    area: "village",
    rarity: "common",
    model: "fish_concept_08",
    minGrams: 80,
    maxGrams: 1200,
    referenceGrams: 500,
    basePrice: 20,
    xp: 20,
    weight: 100,
  },
  {
    id: "carp",
    name: "Cá chép",
    area: "village",
    rarity: "common",
    model: "fish_concept_10",
    minGrams: 300,
    maxGrams: 4500,
    referenceGrams: 1500,
    basePrice: 40,
    xp: 20,
    weight: 100,
    affinity: "worm",
  },
  {
    id: "clownfish",
    name: "Cá hề",
    area: "beach",
    rarity: "uncommon",
    model: "fish_concept_02",
    minGrams: 40,
    maxGrams: 260,
    referenceGrams: 150,
    basePrice: 45,
    xp: 30,
    weight: 24,
    affinity: "shrimp",
  },
  {
    id: "seabass",
    name: "Cá vược",
    area: "beach",
    rarity: "uncommon",
    model: "fish_concept_11",
    minGrams: 600,
    maxGrams: 8500,
    referenceGrams: 2000,
    basePrice: 65,
    xp: 30,
    weight: 24,
  },
  {
    id: "pangasius",
    name: "Cá tra",
    area: "village",
    rarity: "uncommon",
    model: "fish_concept_12",
    minGrams: 800,
    maxGrams: 9000,
    referenceGrams: 2500,
    basePrice: 60,
    xp: 30,
    weight: 24,
  },
  {
    id: "catfish",
    name: "Cá trê",
    area: "village",
    rarity: "uncommon",
    model: "fish_concept_13",
    minGrams: 350,
    maxGrams: 4200,
    referenceGrams: 1500,
    basePrice: 55,
    xp: 30,
    weight: 24,
    affinity: "worm",
  },
  {
    id: "tuna",
    name: "Cá ngừ",
    area: "beach",
    rarity: "rare",
    model: "fish_concept_15",
    minGrams: 2000,
    maxGrams: 18000,
    referenceGrams: 5000,
    basePrice: 160,
    xp: 50,
    weight: 6,
    affinity: "shrimp",
  },
  {
    id: "butterflyfish",
    name: "Cá bướm",
    area: "beach",
    rarity: "rare",
    model: "fish_concept_04",
    minGrams: 50,
    maxGrams: 500,
    referenceGrams: 250,
    basePrice: 100,
    xp: 50,
    weight: 6,
  },
  {
    id: "koi",
    name: "Cá koi",
    area: "village",
    rarity: "rare",
    model: "fish_concept_09",
    minGrams: 300,
    maxGrams: 6500,
    referenceGrams: 2000,
    basePrice: 140,
    xp: 50,
    weight: 6,
    affinity: "worm",
  },
  {
    id: "sunfish",
    name: "Cá mặt trời",
    area: "beach",
    rarity: "legendary",
    model: "fish_concept_14",
    minGrams: 6000,
    maxGrams: 35000,
    referenceGrams: 10000,
    basePrice: 650,
    xp: 100,
    weight: 1,
    affinity: "shrimp",
  },
];
export const RODS: Record<
  RodId,
  { name: string; price: number; level: number; luck: number; model: string }
> = {
  wood: { name: "Cần gỗ", price: 0, level: 1, luck: 0, model: "rod_wood" },
  bamboo: {
    name: "Cần tre",
    price: 300,
    level: 3,
    luck: 0.08,
    model: "rod_bamboo",
  },
  carbon: {
    name: "Cần carbon",
    price: 1200,
    level: 6,
    luck: 0.15,
    model: "rod_carbon",
  },
};
export const BAITS: Record<
  BaitId,
  { name: string; price: number; model: string }
> = {
  dough: { name: "Mồi thường", price: 0, model: "bait_dough" },
  worm: { name: "Mồi giun", price: 5, model: "bait_worm" },
  shrimp: { name: "Mồi tôm", price: 8, model: "bait_shrimp" },
};
export function speciesFor(idOrName: string) {
  return SPECIES.find(
    (species) => species.id === idOrName || species.name === idOrName,
  );
}
export function fishPrice(species: Species, grams: number) {
  return Math.max(
    1,
    Math.round((species.basePrice * grams) / species.referenceGrams),
  );
}
export function levelProgress(xp: number) {
  let level = 1,
    remaining = xp;
  while (level < 10) {
    const needed = Math.round(50 * Math.pow(level, 1.5));
    if (remaining < needed) return { level, current: remaining, needed };
    remaining -= needed;
    level++;
  }
  return { level: 10, current: remaining, needed: 0 };
}
export interface AlbumEntry {
  speciesId: string;
  count: number;
  recordGrams: number;
}
export interface SaleQuote {
  id: string;
  count: number;
  total: number;
  expiresAt: string;
}
export type EconomyAction =
  | { action: "sell"; quoteId: string }
  | { action: "buyRod" | "equipRod"; itemId: RodId }
  | { action: "buyBait"; itemId: "worm" | "shrimp"; quantity: number }
  | { action: "equipBait"; itemId: BaitId }
  | { action: "viewShop" };
