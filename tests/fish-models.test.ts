import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  SPECIES,
  catchPresentation,
  fishLength,
  formatFishWeight,
} from "../packages/shared/src/index";
import { selectCatch } from "../apps/server/src/catch-selection";
import { fishWriggle } from "../apps/client/src/fish-animation";

describe("40 rigged fish and mythic encounters", () => {
  it("ships two skinned LODs with bounded triangles and normalized weights for every species", () => {
    for (const s of SPECIES) {
      const b = readFileSync(
        new URL(
          `../apps/client/public/assets/starter/models/${s.model}.glb`,
          import.meta.url,
        ),
      );
      const doc = JSON.parse(
        b.subarray(20, 20 + b.readUInt32LE(12)).toString(),
      );
      for (const [name, limit] of [
        ["fish-lod-high", 12000],
        ["fish-lod-low", 4000],
      ] as const) {
        const group = doc.nodes.find((n: any) => n.name === name);
        expect(group, s.id).toBeDefined();
        const meshes = group.children
          .map((i: number) => doc.nodes[i])
          .filter((n: any) => n.mesh !== undefined);
        let triangles = 0;
        for (const n of meshes) {
          expect(n.skin).toBeDefined();
          for (const p of doc.meshes[n.mesh].primitives) {
            triangles +=
              doc.accessors[p.indices ?? p.attributes.POSITION].count / 3;
            expect(p.attributes.WEIGHTS_0).toBeDefined();
            expect(p.attributes.JOINTS_0).toBeDefined();
            const accessor = doc.accessors[p.attributes.WEIGHTS_0],
              view = doc.bufferViews[accessor.bufferView];
            const binStart = 20 + b.readUInt32LE(12) + 8;
            const offset =
              binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
            for (let v = 0; v < accessor.count; v++) {
              const at = offset + v * (view.byteStride ?? 16);
              const sum = [0, 1, 2, 3].reduce(
                (sum, k) => sum + b.readFloatLE(at + k * 4),
                0,
              );
              expect(sum, s.id).toBeCloseTo(1, 5);
            }
          }
        }
        expect(triangles, s.id + name).toBeLessThanOrEqual(limit);
        expect(meshes.length).toBeLessThanOrEqual(4);
      }
      expect(doc.skins.every((skin: any) => skin.joints.length === 7)).toBe(
        true,
      );
      expect(b.length).toBeLessThan(400000);
    }
  });
  it("adds five equal sea-only mythics with exact unbuffed boundaries", () => {
    const giants = SPECIES.filter((s) => s.rarity === "mythic");
    expect(giants).toHaveLength(5);
    for (const s of giants) {
      expect(s.area).toBe("beach");
      expect(s.weight).toBe(1);
      expect(catchPresentation(s, s.minGrams)).toMatchObject({
        hookMs: 400,
        reelMs: 12000,
        escapeChance: 0.35,
        shadowScale: 4,
      });
      expect(catchPresentation(s, s.maxGrams)).toMatchObject({
        reelMs: 16000,
        shadowScale: 8,
      });
      expect(fishLength(s, s.maxGrams)).toBe(4);
    }
    const at = (r: number) =>
      selectCatch("beach", "wood", "dough", () => r).species.rarity;
    expect(at(0.69899)).toBe("common");
    expect(at(0.69901)).toBe("uncommon");
    expect(at(0.91901)).toBe("rare");
    expect(at(0.98901)).toBe("legendary");
    expect(at(0.99901)).toBe("mythic");
    let seed = 981;
    const rng = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    let mythics = 0;
    for (let i = 0; i < 100000; i++)
      if (
        selectCatch("beach", "wood", "dough", rng).species.rarity === "mythic"
      )
        mythics++;
    expect(mythics).toBeGreaterThan(65);
    expect(mythics).toBeLessThan(135);
    for (let i = 0; i < 1000; i++)
      expect(
        selectCatch("village", "carbon", "worm", rng).species.rarity,
      ).not.toBe("mythic");
    expect(formatFishWeight(60000000)).toContain("60");
    expect(formatFishWeight(60000000)).toContain("tấn");
  });
  it("wriggles deterministically with anchored head, bounded bursts and reduced motion", () => {
    let normal = 0,
      reduced = 0;
    for (let t = 1000; t < 20000; t += 20) {
      const pose = fishWriggle(t, 1000, 75);
      expect(pose).toEqual(fishWriggle(t, 1000, 75));
      expect(pose[0]).toBe(0);
      normal = Math.max(normal, ...pose.map(Math.abs));
      reduced = Math.max(
        reduced,
        ...fishWriggle(t, 1000, 75, true).map(Math.abs),
      );
    }
    expect(normal).toBeGreaterThan(0.15);
    expect(normal).toBeLessThanOrEqual(0.195);
    expect(reduced).toBeLessThanOrEqual(0.025);
  });
});
