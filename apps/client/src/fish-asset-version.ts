import { SPECIES } from "@fishing/shared";

const freshwater = new Set(
  SPECIES.filter((s) => s.area === "village").map((s) => s.model),
);
// Keep public filenames and sea asset URLs intact while replacing cached old art.
export const fishAssetVersion = (model: string) =>
  freshwater.has(model) ? "?v=freshwater-v1" : "";
