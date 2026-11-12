import type { OpenAreaId } from "./world";

export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic";
export type RodId = "wood" | "bamboo" | "carbon";
export type BaitId = "dough" | "worm" | "shrimp";
export interface Species {
  shape?:
    | "slim"
    | "deep"
    | "long"
    | "bill"
    | "catfish"
    | "dolphin"
    | "orca"
    | "whale"
    | "shark";
  color?: string;
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
  mythic: "Huyền thoại",
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
const newFish: [
  string,
  string,
  OpenAreaId,
  Rarity,
  number,
  number,
  NonNullable<Species["shape"]>,
  string,
][] = [
  ["sardine", "Cá mòi", "beach", "common", 50, 500, "slim", "#69b5cc"],
  ["whiting", "Cá đục", "beach", "common", 100, 1000, "slim", "#d6c78c"],
  ["snapper", "Cá hồng", "beach", "uncommon", 500, 12000, "deep", "#ec8175"],
  ["grouper", "Cá mú", "beach", "uncommon", 1000, 30000, "deep", "#a18f58"],
  [
    "barracuda",
    "Cá nhồng",
    "beach",
    "uncommon",
    1000,
    20000,
    "long",
    "#78a8ae",
  ],
  ["wahoo", "Cá thu ngàng", "beach", "rare", 2000, 40000, "slim", "#4479bb"],
  ["swordfish", "Cá kiếm", "beach", "rare", 10000, 100000, "bill", "#506da9"],
  ["marlin", "Cá cờ", "beach", "legendary", 20000, 150000, "bill", "#3363b2"],
  ["tilapia", "Cá rô phi", "village", "common", 200, 4000, "deep", "#7f9c8b"],
  [
    "grasscarp",
    "Cá trắm cỏ",
    "village",
    "uncommon",
    1000,
    25000,
    "slim",
    "#83a76c",
  ],
  [
    "bigheadcarp",
    "Cá mè hoa",
    "village",
    "uncommon",
    1000,
    30000,
    "deep",
    "#a0b3b6",
  ],
  [
    "blackcarp",
    "Cá trắm đen",
    "village",
    "rare",
    3000,
    60000,
    "slim",
    "#495f61",
  ],
  [
    "snakehead",
    "Cá lóc bông",
    "village",
    "rare",
    1000,
    20000,
    "long",
    "#5d8270",
  ],
  [
    "giantcatfish",
    "Cá tra dầu",
    "village",
    "legendary",
    15000,
    150000,
    "catfish",
    "#91adbf",
  ],
  [
    "arapaima",
    "Cá hải tượng",
    "village",
    "legendary",
    10000,
    150000,
    "long",
    "#bc7959",
  ],
];
for (const [
  id,
  name,
  area,
  rarity,
  minGrams,
  maxGrams,
  shape,
  color,
] of newFish) {
  const defaults = {
    common: [100, 20, 30],
    uncommon: [24, 30, 60],
    rare: [6, 50, 160],
    legendary: [1, 100, 650],
    mythic: [1, 200, 2000],
  }[rarity];
  SPECIES.push({
    id,
    name,
    area,
    rarity,
    minGrams,
    maxGrams,
    referenceGrams: (minGrams + maxGrams) / 2,
    weight: defaults[0],
    xp: defaults[1],
    basePrice: defaults[2],
    model: `fish_extra_${id}`,
    shape,
    color,
    affinity: area === "beach" ? "shrimp" : "worm",
  });
}
const giants: [string, string, number, number, Species["shape"], string][] = [
  ["pink_dolphin", "Cá heo hồng", 100000, 300000, "dolphin", "#da8b9d"],
  ["orca", "Cá voi sát thủ", 1000000, 6000000, "orca", "#192833"],
  ["sperm_whale", "Cá nhà táng", 10000000, 50000000, "whale", "#59616b"],
  ["great_white_shark", "Cá mập trắng", 300000, 2000000, "shark", "#657c8a"],
  ["megalodon", "Megalodon", 20000000, 60000000, "shark", "#465969"],
];
for (const [id, name, minGrams, maxGrams, shape, color] of giants)
  SPECIES.push({
    id,
    name,
    minGrams,
    maxGrams,
    shape,
    color,
    area: "beach",
    rarity: "mythic",
    model: `fish_extra_${id}`,
    referenceGrams: (minGrams + maxGrams) / 2,
    weight: 1,
    xp: 200,
    basePrice: 2000,
    affinity: "shrimp",
  });
export function formatFishWeight(grams: number) {
  return grams >= 1000000
    ? `${(grams / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tấn`
    : `${(grams / 1000).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}
export function fishLength(species: Species, grams: number) {
  const reference =
    species.shape === "long" || species.shape === "bill"
      ? 1.1
      : species.shape === "deep"
        ? 0.65
        : 0.85;
  return Math.max(
    0.2,
    Math.min(4, reference * Math.cbrt(Math.max(1, grams) / 1000)),
  );
}
export const isLargeFish = (grams: number) => grams >= 10000;
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
