import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
const a = {
  models: readdirSync("apps/client/public/assets/starter/models")
    .filter((p) => /^fish_(concept_\d+|extra_\w+)\.glb$/.test(p))
    .map((p) => p.slice(0, -4)),
};
let total = 0,
  maxHigh = 0,
  maxLow = 0,
  maxBytes = 0;
const models = a.models.map((id) => {
  const b = readFileSync(`apps/client/public/assets/starter/models/${id}.glb`);
  total += b.length;
  maxBytes = Math.max(maxBytes, b.length);
  const d = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const levels = {};
  for (const lod of ["high", "low"]) {
    let triangles = 0,
      draws = 0;
    const g = d.nodes.find((n) => n.name === `fish-lod-${lod}`);
    for (const i of g.children) {
      const n = d.nodes[i];
      if (n.mesh === undefined) continue;
      for (const p of d.meshes[n.mesh].primitives) {
        triangles += d.accessors[p.indices ?? p.attributes.POSITION].count / 3;
        draws++;
      }
    }
    levels[lod] = { triangles, draws };
    if (lod === "high") maxHigh = Math.max(maxHigh, triangles);
    else maxLow = Math.max(maxLow, triangles);
  }
  return { id, bytes: b.length, ...levels };
});
mkdirSync("docs/validation", { recursive: true });
writeFileSync(
  "docs/validation/fish-v6-assets.json",
  JSON.stringify(
    {
      species: models.length,
      totalBytes: total,
      maxModelBytes: maxBytes,
      maxHighTriangles: maxHigh,
      maxLowTriangles: maxLow,
      models,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    species: models.length,
    totalBytes: total,
    maxModelBytes: maxBytes,
    maxHighTriangles: maxHigh,
    maxLowTriangles: maxLow,
  }),
);
