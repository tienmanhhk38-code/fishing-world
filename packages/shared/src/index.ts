import type { OpenAreaId } from "./world";
import type { RodId, BaitId, Rarity, AlbumEntry } from "./catalog";
import type { AppearanceId } from "./social";
export * from "./social";
export * from "./catalog";
export * from "./world";
export * from "./fishing-rules";
export * from "./quests";
export * from "./movement";
export type Phase =
  | "IDLE"
  | "CASTING"
  | "WAITING"
  | "APPROACHING"
  | "NIBBLING"
  | "BITE_WINDOW"
  | "REELING"
  | "RESULT"
  | "SHOWCASING";
export interface Fish {
  id: string;
  species: string;
  grams: number;
  caughtAt: string;
  area?: OpenAreaId;
  speciesId?: string;
  saleValue?: number;
  xp?: number;
  rarity?: Rarity;
  newRecord?: boolean;
  newSpecies?: boolean;
}
export interface Player {
  id: string;
  name: string;
  appearanceId: AppearanceId;
  area: OpenAreaId;
  connected: boolean;
  level: number;
  rodId: RodId;
  baitId: BaitId;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  y: number;
  vy: number;
  grounded: boolean;
  running: boolean;
  ackSeq: number;
  jumpSeq?:number;
  snapshotAt: number;
  shadowScale?: number;
  reel?: import("./fishing-rules").ReelPlan;
  escape?: { at: number; origin: { x: number; z: number } };
  phase: Phase;
  bobber: { x: number; z: number };
  showcase?: { fishId?: string; species: string; grams: number };
}
export interface Profile {
  id: string;
  name: string;
  appearanceId: AppearanceId;
  xp: number;
  fish: Fish[];
  coins: number;
  revision: number;
  ownedRods: RodId[];
  baitCounts: Record<BaitId, number>;
  equippedRod: RodId;
  equippedBait: BaitId;
  album: AlbumEntry[];
  tutorialStep: number;
  quests?: import("./quests").QuestState[];
  questResetAt?: string;
}
export const BITE_MS = 1200;
export const WALK_SPEED = 4.4;
export const DOCK = { minX: -7, maxX: 7, minZ: 1, maxZ: 13, fishingZ: 4 };
export function clampPosition(x: number, z: number) {
  return {
    x: Math.max(DOCK.minX, Math.min(DOCK.maxX, x)),
    z: Math.max(DOCK.minZ, Math.min(DOCK.maxZ, z)),
  };
}
export function hookAllowed(
  now: number,
  opens: number,
  rtt: number,
  windowMs = BITE_MS,
) {
  return (
    now >= opens &&
    now <= opens + windowMs + Math.min(150, Math.max(0, rtt / 2))
  );
}
