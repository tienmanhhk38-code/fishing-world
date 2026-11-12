import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { SPECIES, type Species } from "@fishing/shared";
export const FISH_ASSET_IDS = SPECIES.map((s) => s.model);
// X axis faces right; a continuous ring surface, skinned together with every fin.
export function createFish(id: string) {
  const source = SPECIES.find((s) => s.model === id)!;
  const originalShapes: Record<string, Species["shape"]> = {
    anchovy: "long",
    herring: "slim",
    mackerel: "slim",
    mullet: "slim",
    perch: "deep",
    crucian: "deep",
    carp: "deep",
    clownfish: "deep",
    seabass: "slim",
    pangasius: "catfish",
    catfish: "catfish",
    tuna: "slim",
    butterflyfish: "deep",
    koi: "deep",
    sunfish: "deep",
  };
  const species = source && {
    ...source,
    shape: source.shape ?? originalShapes[source.id],
  };
  if (!species) throw new Error(`Unknown fish ${id}`);
  const root = new T.Group();
  const mammal = ["dolphin", "orca", "whale"].includes(species.shape ?? "");
  const shark = species.shape === "shark";
  const deep =
    species.shape === "deep" ||
    ["perch", "crucian", "tilapia"].includes(species.id);
  const long = ["long", "bill", "catfish"].includes(species.shape ?? "");
  const whale = species.shape === "whale";
  const sunfish = species.id === "sunfish";
  const mega = species.id === "megalodon";
  const base = new T.Color(
    species.color ??
      (
        {
          mackerel: "#628c99",
          herring: "#8baeb8",
          anchovy: "#759ba8",
          mullet: "#71958f",
          perch: "#6f9766",
          crucian: "#b7a17b",
          carp: "#a79253",
          clownfish: "#ec731b",
          butterflyfish: "#edce42",
          koi: "#edede0",
          sunfish: "#9ca7a6",
          catfish: "#627664",
          tuna: "#335d84",
        } as Record<string, string>
      )[species.id] ??
      "#648f9c",
  );
  const skin = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: mammal ? 0.52 : 0.38,
    metalness: mammal ? 0 : 0.18,
  });
  const detail = new T.MeshStandardMaterial({
    color: "#263c43",
    roughness: 0.65,
  });
  const eyeMat = new T.MeshStandardMaterial({
    color: "#08161e",
    roughness: 0.12,
  });
  const finMat = new T.MeshStandardMaterial({
    color: base.clone().multiplyScalar(0.72),
    roughness: 0.5,
  });
  for (const low of [false, true]) {
    const group = new T.Group();
    group.name = low ? "fish-lod-low" : "fish-lod-high";
    const bones = Array.from({ length: 5 }, (_, i) => {
      const b = new T.Bone();
      b.name = `fish-spine-${low ? "low" : "high"}-${i}`;
      b.userData.fishJoint = i;
      b.position.x = i === 0 ? 0.55 : -0.33;
      return b;
    });
    bones.slice(1).forEach((b, i) => bones[i].add(b));
    group.add(bones[0]);
    const finWidth = whale
      ? 0.28
      : mega
        ? 0.27
        : deep
          ? 0.19
          : long
            ? 0.125
            : mammal
              ? 0.23
              : 0.2;
    const finHeight = sunfish
      ? 0.54
      : whale
        ? 0.31
        : mega
          ? 0.32
          : deep
            ? 0.38
            : long
              ? 0.17
              : mammal
                ? 0.25
                : 0.24;
    for (const sign of [-1, 1]) {
      const b = new T.Bone();
      b.name = `fish-pectoral-${low ? "low" : "high"}-${sign}`;
      b.userData.fishFin = sign;
      b.position.set(-0.12, -finHeight * 0.3, sign * finWidth * 0.45);
      bones[1].add(b);
      bones.push(b);
    }
    const skeleton = new T.Skeleton(bones);
    const add = (g: T.BufferGeometry, mat: T.Material, name: string) => {
      g.deleteAttribute("uv");
      if (mat === finMat) {
        const old = g;
        g = mergeVertices(g);
        old.dispose();
      }
      const p = g.getAttribute("position"),
        weights: number[] = [],
        indices: number[] = [];
      for (let i = 0; i < p.count; i++) {
        const t = T.MathUtils.clamp((0.55 - p.getX(i)) / 0.33, 0, 4),
          a = Math.min(3, Math.floor(t)),
          f = t - a;
        if (name === "pectoral") {
          indices.push(p.getZ(i) < 0 ? 5 : 6, 0, 0, 0);
          weights.push(1, 0, 0, 0);
        } else {
          indices.push(a, a + 1, 0, 0);
          weights.push(1 - f, f, 0, 0);
        }
      }
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(indices, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
      const mesh = new T.SkinnedMesh(g, mat);
      mesh.name = name;
      mesh.frustumCulled = false;
      group.add(mesh);
      root.add(group);
      root.updateMatrixWorld(true);
      mesh.bind(skeleton);
    };
    const width = whale
      ? 0.28
      : mega
        ? 0.27
        : deep
          ? 0.19
          : long
            ? 0.125
            : mammal
              ? 0.23
              : 0.2;
    const height = sunfish
      ? 0.54
      : whale
        ? 0.31
        : mega
          ? 0.32
          : deep
            ? 0.38
            : long
              ? 0.17
              : mammal
                ? 0.25
                : 0.24;
    const rings = low ? 22 : 48,
      sides = low ? 10 : 24,
      pos: number[] = [],
      colors: number[] = [],
      idx: number[] = [];
    // Nose through shoulder, belly and tapering peduncle, without stacked head/belly meshes.
    for (let r = 0; r <= rings; r++) {
      const u = r / rings,
        x = sunfish ? 0.62 - u * 1.15 : 0.7 - u * 1.42;
      let fullness = Math.pow(Math.sin(Math.PI * u), 0.72) * (1 - 0.36 * u);
      if (mega)
        fullness = Math.pow(Math.sin(Math.PI * u), 0.58) * (1 - 0.28 * u);
      if (whale)
        fullness = Math.min(
          1,
          Math.pow(Math.sin(Math.PI * u), 0.28) * (1 - 0.6 * u),
        );
      if (species.shape === "dolphin" && u < 0.18) fullness *= 0.36 + u * 3;
      fullness = Math.max(0.013, fullness);
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2,
          y = Math.cos(a) * height * fullness,
          z = Math.sin(a) * width * fullness;
        pos.push(x, y, z);
        const c = base.clone();
        const belly = Math.max(0, -Math.cos(a));
        c.lerp(new T.Color("#e4e3d1"), belly * 0.85).multiplyScalar(
          0.84 + 0.16 * Math.sin(a) ** 2,
        );
        if (species.shape === "orca") {
          c.set(
            Math.cos(a) < -0.15 ||
              (u < 0.24 && Math.cos(a) > 0.05 && Math.cos(a) < 0.65)
              ? "#eceee1"
              : "#18232d",
          );
        }
        if (
          species.id === "clownfish" &&
          [0.2, 0.44, 0.7].some((v) => Math.abs(u - v) < 0.035)
        )
          c.set("#f0eee5");
        if (species.id === "butterflyfish") {
          if (Math.cos(u * 58 + a * 1.2) > 0.4) c.multiplyScalar(0.4);
        }
        if (species.id === "koi" && Math.sin(u * 27 + a * 3) > 0.25)
          c.set(Math.sin(u * 13 - a) > 0 ? "#cc4929" : "#283237");
        if (!mammal && !shark) {
          const scale =
            Math.sin(u * 310 + Math.floor(j / 2) * 1.7) * Math.sin(a * 38) >
            0.54
              ? 0.87
              : 1;
          c.multiplyScalar(scale);
          if (
            [
              "wahoo",
              "tilapia",
              "snakehead",
              "grouper",
              "arapaima",
              "mackerel",
            ].includes(species.id)
          )
            c.multiplyScalar(0.83 + 0.17 * Math.cos(u * 66 + a * 2));
        }
        colors.push(c.r, c.g, c.b);
        if (r < rings && j < sides) {
          const k = r * (sides + 1) + j;
          idx.push(
            k,
            k + sides + 1,
            k + 1,
            k + 1,
            k + sides + 1,
            k + sides + 2,
          );
        }
      }
    }
    const body = new T.BufferGeometry();
    body.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    body.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    body.setIndex(idx);
    body.computeVertexNormals();
    add(body, skin, "continuous-body");
    const fin = (name: string, points: number[][], horizontal = false) => {
      const shape = new T.Shape();
      for (let i = 0; i < points.length; i++) {
        const prev = points[(i + points.length - 1) % points.length],
          p = points[i],
          next = points[(i + 1) % points.length];
        const enter = [
          p[0] * 0.86 + prev[0] * 0.14,
          p[1] * 0.86 + prev[1] * 0.14,
        ];
        if (i === 0) shape.moveTo(enter[0], enter[1]);
        else shape.lineTo(enter[0], enter[1]);
        shape.quadraticCurveTo(
          p[0],
          p[1],
          p[0] * 0.86 + next[0] * 0.14,
          p[1] * 0.86 + next[1] * 0.14,
        );
      }
      shape.closePath();
      const g = new T.ExtrudeGeometry(shape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelSize: 0.007,
        bevelThickness: 0.005,
        bevelSegments: 1,
        steps: 1,
        curveSegments: low ? 1 : 2,
      });
      g.translate(0, 0, -0.006);
      if (horizontal) g.rotateX(Math.PI / 2);
      add(g, finMat, name);
    };
    if (sunfish) {
      fin("clavus", [
        [-0.42, 0.32],
        [-0.6, 0.3],
        [-0.64, -0.3],
        [-0.42, -0.32],
      ]);
      fin("anal", [
        [-0.28, -0.33],
        [-0.35, -0.82],
        [0.03, -0.38],
      ]);
    } else
      fin(
        "tail",
        [
          [-0.65, 0],
          [-0.82, 0.12],
          [-1.07, 0.34],
          [-1.02, 0.08],
          [-0.88, 0],
          [-1.02, -0.08],
          [-1.07, -0.34],
          [-0.82, -0.12],
        ],
        mammal,
      );
    fin("dorsal", [
      [-0.39, height * 0.6],
      [-0.2, height + (sunfish ? 0.3 : whale ? 0.035 : shark ? 0.38 : 0.19)],
      [0.02, height * 0.65],
    ]);
    for (const sign of [-1, 1]) {
      const finShape = new T.Shape([
        new T.Vector2(0.24, 0),
        new T.Vector2(-0.22, sign * (mammal || shark ? 0.42 : 0.25)),
        new T.Vector2(-0.08, sign * 0.05),
      ]);
      const g = new T.ExtrudeGeometry(finShape, {
        depth: 0.013,
        bevelEnabled: false,
      });
      g.rotateX(Math.PI / 2);
      g.translate(0, -height * 0.3, sign * width * 0.45);
      add(g, finMat, "pectoral");
      const eye = new T.SphereGeometry(0.025, low ? 8 : 12, 8);
      eye.scale(1, 1, 0.5);
      eye.translate(0.48, height * 0.3, sign * width * 0.72);
      add(eye, eyeMat, "eye");
      const line = (name: string, pts: T.Vector3[], radius = 0.004) =>
        add(
          new T.TubeGeometry(
            new T.CatmullRomCurve3(pts),
            low ? 6 : 12,
            radius,
            4,
            false,
          ),
          detail,
          name,
        );
      line("mouth", [
        new T.Vector3(0.65, -0.035, sign * 0.025),
        new T.Vector3(0.53, -0.06, sign * width * 0.55),
        new T.Vector3(0.38, -0.055, sign * width * 0.77),
      ]);
      if (!mammal)
        for (let k = 0; k < (shark ? 5 : 1); k++) {
          const x = 0.28 - k * 0.045;
          line("gill", [
            new T.Vector3(x, height * 0.48, sign * width * 0.65),
            new T.Vector3(x - 0.035, 0, sign * width * 0.86),
            new T.Vector3(x - 0.015, -height * 0.55, sign * width * 0.64),
          ]);
        }
      if (species.shape === "catfish")
        line(
          "barbel",
          [
            new T.Vector3(0.6, -0.06, sign * 0.06),
            new T.Vector3(0.66, -0.13, sign * 0.24),
            new T.Vector3(0.56, -0.23, sign * 0.38),
          ],
          0.007,
        );
    }
    if (species.shape === "bill") {
      const g = new T.ConeGeometry(0.028, 0.6, low ? 8 : 12);
      g.rotateZ(-Math.PI / 2);
      g.translate(0.95, 0, 0);
      add(g, finMat, "bill");
    }
    if (shark && !low)
      for (let i = 0; i < 12; i++) {
        const g = new T.ConeGeometry(0.012, 0.032, 4);
        g.rotateZ(Math.PI);
        g.translate(0.44 + i * 0.016, -0.055, 0.08);
        add(g, eyeMat, "tooth");
      }
    // Merge details by material: four draws per LOD, rather than a draw per gill/tooth.
    for (const mat of [detail, eyeMat, finMat]) {
      const parts = group.children.filter(
        (o) => o instanceof T.SkinnedMesh && o.material === mat,
      ) as T.SkinnedMesh[];
      if (parts.length > 1) {
        const merged = mergeGeometries(parts.map((p) => p.geometry));
        if (merged) {
          for (const part of parts) {
            group.remove(part);
            part.geometry.dispose();
          }
          const mesh = new T.SkinnedMesh(merged, mat);
          mesh.name = `fish-details-${mat === detail ? "gills" : mat === eyeMat ? "eyes" : "fins"}`;
          mesh.frustumCulled = false;
          group.add(mesh);
          root.updateMatrixWorld(true);
          mesh.bind(skeleton);
        }
      }
    }
    root.add(group);
  }
  return root;
}
export async function exportFish(id: string) {
  const buffer = (await new GLTFExporter().parseAsync(createFish(id), {
    binary: true,
  })) as ArrayBuffer;
  let binary = "";
  for (const byte of new Uint8Array(buffer))
    binary += String.fromCharCode(byte);
  return btoa(binary);
}
