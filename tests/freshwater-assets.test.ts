import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SPECIES } from "../packages/shared/src/index";
import guides from "../apps/client/src/art/freshwater-guides.json";
import { fishAssetVersion } from "../apps/client/src/fish-asset-version";

describe("reference-authored freshwater assets", () => {
  it("refreshes cached freshwater art without changing sea or environment URLs", () => {
    for (const s of SPECIES)
      expect(fishAssetVersion(s.model)).toBe(
        s.area === "village" ? "?v=freshwater-v1" : "",
      );
    expect(fishAssetVersion("dock_straight_2x3m")).toBe("");
  });
  it("covers exactly the fifteen existing freshwater species without changing catalog identities", () => {
    expect(Object.keys(guides).sort()).toEqual(
      SPECIES.filter((s) => s.area === "village")
        .map((s) => s.id)
        .sort(),
    );
    for (const g of Object.values(guides)) {
      expect(g.rows).toHaveLength(g.height);
      expect(g.eye[2]).toBeGreaterThan(0);
      for (const row of g.rows) {
        expect(row.length % 2).toBe(0);
        for (let i = 0; i < row.length; i += 2) {
          expect(row[i]).toBeLessThan(row[i + 1]);
          expect(row[i + 1]).toBeLessThanOrEqual(g.width);
        }
      }
    }
  });
  it("retains UVs and shares embedded color/normal/roughness maps across both LODs", () => {
    for (const s of SPECIES.filter((s) => s.area === "village")) {
      const b = readFileSync(
        `apps/client/public/assets/starter/models/${s.model}.glb`,
      );
      const length = b.readUInt32LE(12),
        doc = JSON.parse(b.subarray(20, 20 + length).toString());
      const skinIndex = doc.materials.findIndex(
        (m: any) => m.name === `${s.id}-skin`,
      );
      expect(skinIndex, s.id).toBeGreaterThanOrEqual(0);
      const material = doc.materials[skinIndex];
      expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(material.normalTexture).toBeDefined();
      expect(
        material.pbrMetallicRoughness.metallicRoughnessTexture,
      ).toBeDefined();
      expect(
        doc.meshes.filter((m: any) =>
          m.primitives.some((p: any) => p.material === skinIndex),
        ),
      ).toHaveLength(2);
      for (const mesh of doc.meshes)
        for (const primitive of mesh.primitives) {
          expect(primitive.attributes.TEXCOORD_0).toBeDefined();
        }
      for (const im of doc.images) {
        const view = doc.bufferViews[im.bufferView],
          start = 20 + length + 8 + (view.byteOffset ?? 0);
        const png = b.subarray(start, start + view.byteLength);
        expect(png.subarray(1, 4).toString()).toBe("PNG");
        expect(png.readUInt32BE(16)).toBeLessThanOrEqual(1024);
        expect(png.readUInt32BE(20)).toBeLessThanOrEqual(1024);
      }
    }
  });
});
