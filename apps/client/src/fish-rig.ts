import * as T from "three";
import { fishWriggle } from "./fish-animation";

/** Shared by the live scene and the offline art QA stage. */
export function poseFishBones(
  bones: T.Bone[],
  timeMs: number,
  startedAt: number,
  seed: number,
  reduced: boolean,
  mammal = false,
) {
  const angles = fishWriggle(timeMs, startedAt, seed, reduced);
  for (const b of bones) {
    const i = Number(b.userData.fishJoint ?? 0);
    b.rotation.set(0, 0, 0);
    if (b.userData.fishFin)
      b.rotation.x =
        Math.sin((timeMs - startedAt) * 0.007 + seed) *
        (reduced ? 0.025 : 0.12) *
        b.userData.fishFin;
    else if (i > 0) b.rotation[mammal ? "z" : "y"] = angles[i] ?? 0;
  }
}
export function setFishLod(root: T.Object3D, low: boolean) {
  root.traverse((o) => {
    if (o.name === "fish-lod-low") o.visible = low;
    if (o.name === "fish-lod-high") o.visible = !low;
  });
}
