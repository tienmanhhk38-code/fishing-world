import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
const directory = new URL(
  "../apps/client/public/assets/harbor-v2/",
  import.meta.url,
);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", directory), "utf8"),
);
function load(id: string) {
  const data = readFileSync(new URL(id + ".glb", directory));
  expect(data.readUInt32LE(0)).toBe(0x46546c67);
  expect(data.readUInt32LE(4)).toBe(2);
  expect(data.readUInt32LE(8)).toBe(data.length);
  const length = data.readUInt32LE(12);
  return {
    gltf: JSON.parse(data.subarray(20, 20 + length).toString()),
    binary: data.subarray(28 + length),
  };
}
it("all authored GLBs stay within transfer and geometry budgets", () => {
  expect(manifest.assets).toHaveLength(13);
  expect(
    manifest.assets.reduce((n: number, a: any) => n + a.bytes, 0),
  ).toBeLessThan(4_000_000);
  for (const asset of manifest.assets) {
    const { gltf } = load(asset.id);
    const triangles = gltf.meshes
      .flatMap((m: any) => m.primitives)
      .reduce(
        (n: number, p: any) =>
          n + gltf.accessors[p.indices ?? p.attributes.POSITION].count / 3,
        0,
      );
    expect(triangles).toBe(asset.triangles);
    if (asset.id.startsWith("fisher_"))
      expect(triangles).toBeLessThanOrEqual(8000);
  }
});
it("each character has ten playable animation clips and valid six-joint skin weights", () => {
  for (const id of ["sailor", "sunny", "coral", "ocean"]) {
    const { gltf, binary } = load("fisher_" + id);
    expect(gltf.animations.map((a: any) => a.name)).toEqual([
      "Idle",
      "Walk",
      "Cast",
      "Wait",
      "Hook",
      "Reel",
      "Celebrate",
      "Run",
      "Jump",
      "ShowFish",
    ]);
    expect(gltf.skins[0].joints).toHaveLength(6);
    const primitive = gltf.meshes[0].primitives[0],
      weights = gltf.accessors[primitive.attributes.WEIGHTS_0],
      view = gltf.bufferViews[weights.bufferView],
      offset = (view.byteOffset ?? 0) + (weights.byteOffset ?? 0);
    expect(weights.componentType).toBe(5126);
    for (let i = 0; i < weights.count; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++)
        sum += binary.readFloatLE(offset + i * (view.byteStride ?? 16) + j * 4);
      expect(sum).toBeCloseTo(1, 5);
    }
    for (const animation of gltf.animations)
      for (const channel of animation.channels)
        expect(gltf.nodes[channel.target.node]).toBeDefined();
  }
});
