import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import guideData from "./freshwater-guides.json";

type Guide = {
  width: number;
  height: number;
  rows: number[][];
  eye: number[];
  mouth: number[];
  gill: number[];
  pectoral: number[];
  body: number[][];
  pigmentPatches?: { color: string; outline: number[][] }[];
};
type Paint = {
  back: string;
  side: string;
  belly: string;
  fin: string;
  depth: number;
  scales?: number;
  pattern?: string;
  barbels?: number;
};
export const FRESHWATER_PAINT: Record<string, Paint> = {
  perch: {
    back: "#655f36",
    side: "#a9994f",
    belly: "#d9c492",
    fin: "#a18c3e",
    depth: 0.73,
    scales: 10,
  },
  crucian: {
    back: "#8f8590",
    side: "#c3b39c",
    belly: "#e4cfad",
    fin: "#a99b98",
    depth: 0.68,
    scales: 10,
  },
  carp: {
    back: "#69604b",
    side: "#c49b4b",
    belly: "#dbb76c",
    fin: "#d8954d",
    depth: 0.7,
    scales: 12,
    barbels: 1,
  },
  tilapia: {
    back: "#626d7c",
    side: "#a3a28c",
    belly: "#c4bca1",
    fin: "#a89399",
    depth: 0.68,
    pattern: "stripes",
  },
  pangasius: {
    back: "#71778f",
    side: "#b0b8c8",
    belly: "#e3d8ce",
    fin: "#8f8b9e",
    depth: 0.82,
    barbels: 2,
  },
  catfish: {
    back: "#645849",
    side: "#8e793c",
    belly: "#e1bc67",
    fin: "#9c874d",
    depth: 0.9,
    barbels: 4,
  },
  grasscarp: {
    back: "#74764d",
    side: "#bbb89a",
    belly: "#e4d9c3",
    fin: "#999590",
    depth: 0.84,
    scales: 15,
  },
  bigheadcarp: {
    back: "#737482",
    side: "#b6b2b0",
    belly: "#d8ccc0",
    fin: "#a89a9d",
    depth: 0.83,
    pattern: "marble",
  },
  koi: {
    back: "#d6d1c3",
    side: "#eee7dc",
    belly: "#f4e8dc",
    fin: "#e4dcd2",
    depth: 0.76,
    scales: 13,
    pattern: "showa",
    barbels: 1,
  },
  blackcarp: {
    back: "#51525f",
    side: "#85828a",
    belly: "#bcb2a7",
    fin: "#78727c",
    depth: 0.78,
    scales: 15,
  },
  snakehead: {
    back: "#4e575b",
    side: "#a9ac98",
    belly: "#ded8bc",
    fin: "#666865",
    depth: 0.9,
    pattern: "snake",
  },
  marbled_eel: {
    back: "#8c7948",
    side: "#b6a05e",
    belly: "#e0c479",
    fin: "#9c864d",
    depth: 0.87,
    pattern: "eel",
  },
  giantcatfish: {
    back: "#8d8a9e",
    side: "#bdb9c8",
    belly: "#eee0d4",
    fin: "#a19ba9",
    depth: 0.87,
  },
  arapaima: {
    back: "#6e7360",
    side: "#a49d69",
    belly: "#c3b783",
    fin: "#b66950",
    depth: 0.88,
    scales: 18,
    pattern: "redtail",
  },
  sturgeon: {
    back: "#6b6d7d",
    side: "#a1a1ac",
    belly: "#d9cfbd",
    fin: "#8b8999",
    depth: 0.8,
    barbels: 2,
  },
};
export const isFreshwaterModel = (id: string) =>
  Object.keys(FRESHWATER_PAINT).some(
    (s) =>
      id === `fish_extra_${s}` ||
      (
        {
          perch: "fish_concept_07",
          crucian: "fish_concept_08",
          carp: "fish_concept_10",
          tilapia: "fish_extra_tilapia",
          pangasius: "fish_concept_12",
          catfish: "fish_concept_13",
          koi: "fish_concept_09",
        } as Record<string, string>
      )[s] === id,
  );

const smooth = (v: number) => {
  v = T.MathUtils.clamp(v, 0, 1);
  return v * v * (3 - 2 * v);
};
const rgb = (hex: string) => {
  const c = new T.Color(hex);
  return [c.r, c.g, c.b];
};
const mix = (a: number[], b: number[], t: number) =>
  a.map((v, i) => T.MathUtils.lerp(v, b[i], t));
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(x - ix),
    fy = smooth(y - iy);
  const h = (a: number, b: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + 18.4) * 43758.5453;
    return v - Math.floor(v);
  };
  return T.MathUtils.lerp(
    T.MathUtils.lerp(h(ix, iy), h(ix + 1, iy), fx),
    T.MathUtils.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), fx),
    fy,
  );
}
function frame(g: Guide, u: number) {
  const a = g.body;
  let j = 0;
  while (j < a.length - 2 && u > a[j + 1][0]) j++;
  const t = T.MathUtils.clamp((u - a[j][0]) / (a[j + 1][0] - a[j][0]), 0, 1);
  return [
    T.MathUtils.lerp(a[j][1], a[j + 1][1], t),
    T.MathUtils.lerp(a[j][2], a[j + 1][2], t),
  ];
}

// Texture pigments are authored from palettes and deterministic patterns, never
// projected poster pixels. Both LODs share these UV maps and the same silhouette.
function makeSurface(id: string, g: Guide, p: Paint) {
  const size = 1024,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!,
    image = ctx.createImageData(size, size);
  const back = rgb(p.back),
    side = rgb(p.side),
    belly = rgb(p.belly),
    fin = rgb(p.fin),
    dark = rgb("#4f5259"),
    red = rgb("#d54c28");
  const ratio = g.height / g.width;
  const patchCanvas = document.createElement("canvas");
  patchCanvas.width = patchCanvas.height = size;
  const pc = patchCanvas.getContext("2d")!,
    patchColors: number[][] = [];
  for (const patch of g.pigmentPatches ?? []) {
    let colorIndex = patchColors.findIndex(
      (c) => c.join(",") === rgb(patch.color).join(","),
    );
    if (colorIndex < 0) {
      colorIndex = patchColors.length;
      patchColors.push(rgb(patch.color));
    }
    pc.fillStyle = `rgb(${colorIndex + 1},0,0)`;
    pc.beginPath();
    patch.outline.forEach(([u, v], i) =>
      i
        ? pc.lineTo(u * size, (v / ratio) * size)
        : pc.moveTo(u * size, (v / ratio) * size),
    );
    pc.closePath();
    pc.fill();
  }
  const traced = !!g.pigmentPatches?.length,
    patchPixels = pc.getImageData(0, 0, size, size).data;
  const patchAt = (u: number, v: number, c: number[]) => {
    const x = T.MathUtils.clamp(Math.floor(u * size), 0, size - 1),
      y = T.MathUtils.clamp(Math.floor((v / ratio) * size), 0, size - 1),
      i = (y * size + x) * 4;
    return patchPixels[i + 3] && patchColors[patchPixels[i] - 1]
      ? mix(c, patchColors[patchPixels[i] - 1], patchPixels[i + 3] / 255)
      : c;
  };
  function pigment(u: number, v: number) {
    const [top, bottom] = frame(g, u),
      q = (v - top) / Math.max(0.02, bottom - top);
    let c =
      q < 0.4
        ? mix(back, side, smooth(q / 0.4))
        : mix(side, belly, smooth((q - 0.4) / 0.65));
    if (v < top || v > bottom || u > g.body[g.body.length - 1][0]) {
      if (
        id === "sturgeon" &&
        v < top &&
        u > 0.14 &&
        u < 0.69 &&
        Math.sin((u - 0.18) * 120) > -0.4
      )
        return rgb("#d6c5a8");
      const root = v < top ? [0.48, top] : [0.6, bottom];
      const ray = Math.cos(Math.atan2(v - root[1], u - root[0]) * 44);
      return patchAt(
        u,
        v,
        fin.map((c) => c * (0.88 + 0.12 * ray)),
      );
    }
    if (p.pattern === "stripes") {
      const band =
        smooth((Math.sin(u * 43 + noise(u * 12, v * 15) * 0.7) - 0.15) * 3) *
        (1 - smooth((q - 0.7) * 3));
      c = mix(c, dark, band * 0.48);
    }
    if (
      !traced &&
      (p.pattern === "marble" || p.pattern === "snake" || p.pattern === "eel")
    ) {
      const n = noise(u * 23, v * 36) * 0.65 + noise(u * 45 + 7, v * 62) * 0.35;
      const amount = smooth((n - 0.43) * 12) * (1 - smooth((q - 0.66) * 3));
      c = mix(
        c,
        p.pattern === "eel" ? rgb("#6a5941") : dark,
        amount * (p.pattern === "marble" ? 0.7 : 0.85),
      );
    }
    if (p.pattern === "showa" && !traced) {
      const n = noise(u * 21, v * 27),
        s = u + 0.018 * Math.sin(v * 57) + 0.022 * (n - 0.5);
      if (
        (s < 0.17 && q < 0.7) ||
        (s > 0.2 && s < 0.36) ||
        (s > 0.45 && s < 0.66) ||
        (s > 0.74 && s < 0.88)
      )
        c = rgb("#363338");
      if (
        ((s > 0.04 && s < 0.15) ||
          (s > 0.31 && s < 0.43) ||
          (s > 0.62 && s < 0.73) ||
          (s > 0.83 && s < 0.9)) &&
        q < 0.6 + n * 0.22
      )
        c = red;
    }
    if (p.pattern === "redtail")
      c = mix(
        c,
        red,
        smooth((u - 0.4) / 0.5) * (1 - smooth((q - 0.8) * 4)) * 0.85,
      );
    if (
      id === "perch" &&
      ((u - 0.79) / 0.019) ** 2 + ((v - (top + bottom) / 2) / 0.028) ** 2 < 1
    )
      c = rgb("#534b31");
    return patchAt(u, v, c);
  }
  const field: Float32Array = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1),
        v = (y / (size - 1)) * ratio,
        [top, bottom] = frame(g, u),
        q = (v - top) / Math.max(0.02, bottom - top);
      let c = pigment(u, v),
        relief = 0;
      if (
        p.scales &&
        u > 0.19 &&
        u < g.body[g.body.length - 1][0] &&
        q > 0 &&
        q < 1
      ) {
        const pitch = 1 / p.scales,
          sy = pitch * 0.7,
          row = Math.floor(v / sy),
          sx = (u / pitch + (row % 2) * 0.5) % 1,
          yy = (v / sy) % 1;
        const arc =
            0.18 + 0.65 * Math.sqrt(Math.max(0, 1 - ((sx - 0.5) * 2) ** 2)),
          dist = yy - arc;
        const edge = Math.exp(-dist * dist * 600);
        const shading =
          (yy - 0.45) * 0.16 +
          Math.cos((sx - 0.5) * Math.PI) * 0.06 -
          edge * 0.045;
        c = c.map((z) => T.MathUtils.clamp(z * (1 + shading), 0, 1));
        relief =
          Math.sin(Math.PI * sx) * Math.sin(Math.PI * yy) * 0.3 - edge * 0.12;
      } else if (v < top || v > bottom) {
        relief =
          0.1 *
          Math.sin(Math.atan2(v - (v < top ? top : bottom), u - 0.48) * 44);
      }
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++)
        image.data[i + k] = Math.round(
          T.ColorManagement.workingToColorSpace(
            new T.Color(...(c as [number, number, number])),
            T.SRGBColorSpace,
          ).toArray()[k] * 255,
        );
      image.data[i + 3] = 255;
      field[y * size + x] = relief;
    }
  ctx.putImageData(image, 0, 0);
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = size;
  const nc = normalCanvas.getContext("2d")!,
    ni = nc.createImageData(size, size);
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = roughCanvas.height = size;
  const rc = roughCanvas.getContext("2d")!,
    ri = rc.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        dx =
          (field[y * size + Math.min(size - 1, x + 1)] -
            field[y * size + Math.max(0, x - 1)]) *
          0.65,
        dy =
          (field[Math.min(size - 1, y + 1) * size + x] -
            field[Math.max(0, y - 1) * size + x]) *
          0.65,
        n = new T.Vector3(-dx, dy, 1).normalize();
      ni.data.set(
        [
          (n.x * 0.5 + 0.5) * 255,
          (n.y * 0.5 + 0.5) * 255,
          (n.z * 0.5 + 0.5) * 255,
          255,
        ],
        i,
      );
      ri.data.set([170, 170, 170, 255], i);
    }
  nc.putImageData(ni, 0, 0);
  rc.putImageData(ri, 0, 0);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.name = `${id}-pigment`;
  const reducedNormal = document.createElement("canvas");
  const normalSize = id === "crucian" ? 384 : 512;
  reducedNormal.width = reducedNormal.height = normalSize;
  reducedNormal
    .getContext("2d")!
    .drawImage(normalCanvas, 0, 0, normalSize, normalSize);
  const reducedRough = document.createElement("canvas");
  reducedRough.width = reducedRough.height = 32;
  reducedRough.getContext("2d")!.drawImage(roughCanvas, 0, 0, 32, 32);
  const normalMap = new T.CanvasTexture(reducedNormal);
  normalMap.name = `${id}-scale-relief`;
  const roughnessMap = new T.CanvasTexture(reducedRough);
  roughnessMap.name = `${id}-roughness`;
  return new T.MeshStandardMaterial({
    name: `${id}-skin`,
    map,
    normalMap,
    roughnessMap,
    normalScale: new T.Vector2(0.65, 0.65),
    roughness: 0.8,
    metalness: 0.02,
    vertexColors: true,
  });
}

function coverage(g: Guide, u: number, v: number) {
  const px = u * (g.width - 1),
    py = v * g.width;
  const x = Math.floor(px),
    y = Math.floor(py);
  const sample = (xx: number, yy: number) => {
    if (xx < 0 || yy < 0 || yy >= g.rows.length || xx >= g.width) return 0;
    const row = g.rows[yy];
    for (let j = 0; j < row.length; j += 2)
      if (xx >= row[j] && xx < row[j + 1]) return 1;
    return 0;
  };
  return T.MathUtils.lerp(
    T.MathUtils.lerp(sample(x, y), sample(x + 1, y), px - x),
    T.MathUtils.lerp(sample(x, y + 1), sample(x + 1, y + 1), px - x),
    py - y,
  );
}
function depth(g: Guide, p: Paint, u: number, v: number) {
  const [top, bottom] = frame(g, u),
    q = (v - (top + bottom) / 2) / Math.max(0.01, (bottom - top) / 2);
  const end = g.body[g.body.length - 1][0],
    nose = g.body[0][0],
    t = T.MathUtils.clamp((u - nose) / Math.max(0.1, end - nose), 0, 1);
  return (
    0.0015 +
    Math.sqrt(Math.max(0, 1 - q * q)) *
      (bottom - top) *
      p.depth *
      0.48 *
      Math.pow(Math.sin(Math.PI * t), 0.24)
  );
}

export function createFreshwaterFish(id: string) {
  const g = (guideData as Record<string, Guide>)[id],
    p = FRESHWATER_PAINT[id];
  if (!g || !p) throw Error(`No freshwater guide: ${id}`);
  const root = new T.Group();
  root.userData = {
    author: "freshwater-v1",
    speciesId: id,
    referenceFacing: "left",
    mouth: [
      (0.5 - g.mouth[0]) * 1.8,
      (g.height / g.width / 2 - g.mouth[1]) * 1.8,
      0,
    ],
  };
  const skin = makeSurface(id, g, p);
  const fin = new T.MeshStandardMaterial({
    name: `${id}-fins-and-features`,
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
    side: T.DoubleSide,
  });
  const eyeMat = new T.MeshStandardMaterial({
    name: `${id}-eyes`,
    color: "#291b15",
    roughness: 0.13,
    metalness: 0,
  });
  const glint = new T.MeshStandardMaterial({
    name: `${id}-eye-highlight`,
    color: "#fffdf3",
    roughness: 0.1,
  });
  const ratio = g.height / g.width,
    S = 1.8;
  const world = (u: number, v: number, z: number) =>
    new T.Vector3((0.5 - u) * S, (ratio / 2 - v) * S, z * S);
  root.userData.landmarks = Object.fromEntries(
    ["eye", "mouth", "gill", "pectoral"].map((name) => {
      const a = g[name as "eye" | "mouth" | "gill" | "pectoral"];
      return [name, world(a[0], a[1], -depth(g, p, a[0], a[1])).toArray()];
    }),
  );
  for (const low of [false, true]) {
    const group = new T.Group();
    group.name = low ? "fish-lod-low" : "fish-lod-high";
    root.add(group);
    const bones: T.Bone[] = [];
    const stations = [0.12, 0.3, 0.5, 0.7, 0.9];
    for (let j = 0; j < 5; j++) {
      const b = new T.Bone();
      b.name = `fish-spine-${low ? "low" : "high"}-${j}`;
      b.userData.fishJoint = j;
      const f = frame(g, stations[j]);
      const pos = world(stations[j], (f[0] + f[1]) / 2, 0);
      if (j === 0) {
        b.position.copy(pos);
        group.add(b);
      } else {
        const pf = frame(g, stations[j - 1]);
        b.position.copy(
          pos.sub(world(stations[j - 1], (pf[0] + pf[1]) / 2, 0)),
        );
        bones[j - 1].add(b);
      }
      bones.push(b);
    }
    for (const sign of [-1, 1]) {
      const b = new T.Bone();
      b.name = `fish-pectoral-${low ? "low" : "high"}-${sign}`;
      b.userData.fishFin = sign;
      const parent = g.pectoral[0] < 0.25 ? 0 : 1;
      const f = frame(g, stations[parent]),
        base = world(stations[parent], (f[0] + f[1]) / 2, 0);
      const origin = world(
        g.pectoral[0],
        g.pectoral[1],
        depth(g, p, g.pectoral[0], g.pectoral[1]) * sign,
      );
      b.position.copy(origin.sub(base));
      bones[parent].add(b);
      bones.push(b);
    }
    const skeleton = new T.Skeleton(bones),
      parts = new Map<T.Material, T.BufferGeometry[]>();
    const add = (
      geometry: T.BufferGeometry,
      material: T.Material,
      color = "#ffffff",
      rig: "body" | "head" | "left" | "right" = "body",
    ) => {
      if (!geometry.getAttribute("uv"))
        geometry.setAttribute(
          "uv",
          new T.Float32BufferAttribute(
            new Array(geometry.getAttribute("position").count * 2).fill(0.5),
            2,
          ),
        );
      const vertices = geometry.getAttribute("position"),
        colors: number[] = [],
        indices: number[] = [],
        weights: number[] = [],
        c = new T.Color(color);
      for (let i = 0; i < vertices.count; i++) {
        colors.push(c.r, c.g, c.b);
        const u = 0.5 - vertices.getX(i) / S;
        let t = T.MathUtils.clamp(
          ((u - stations[0]) / (stations[4] - stations[0])) * 4,
          0,
          4,
        );
        if (u < 0.25 || rig === "head") t = 0;
        const a = Math.min(3, Math.floor(t)),
          f = t - a;
        if (rig === "left" || rig === "right") {
          indices.push(rig === "left" ? 5 : 6, 0, 0, 0);
          weights.push(1, 0, 0, 0);
        } else {
          indices.push(a, a + 1, 0, 0);
          weights.push(1 - f, f, 0, 0);
        }
      }
      geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      geometry.setAttribute(
        "skinIndex",
        new T.Uint16BufferAttribute(indices, 4),
      );
      geometry.setAttribute(
        "skinWeight",
        new T.Float32BufferAttribute(weights, 4),
      );
      if (geometry.index) geometry = geometry.toNonIndexed();
      geometry.deleteAttribute("tangent");
      const list = parts.get(material) ?? [];
      list.push(geometry);
      parts.set(material, list);
    };
    const pos: number[] = [],
      uv: number[] = [],
      idx: number[] = [],
      cache = new Map<string, number>();
    const vertex = (u: number, v: number, sign: number) => {
      const key = `${u.toFixed(6)}:${v.toFixed(6)}:${sign}`;
      const old = cache.get(key);
      if (old !== undefined) return old;
      const pt = world(u, v, depth(g, p, u, v) * sign);
      const i = pos.length / 3;
      pos.push(pt.x, pt.y, pt.z);
      uv.push(u, 1 - v / ratio);
      cache.set(key, i);
      return i;
    };
    const nx = low ? 38 : 96,
      ny = Math.max(12, Math.round(nx * ratio));
    type P = [number, number];
    const triangle = (ps: P[]) => {
      const clipped: P[] = [],
        cross: P[] = [];
      for (let k = 0; k < 3; k++) {
        const a = ps[k],
          b = ps[(k + 1) % 3],
          inside = coverage(g, ...a) > 0.5,
          other = coverage(g, ...b) > 0.5;
        if (inside) clipped.push(a);
        if (inside !== other) {
          let l = 0,
            r = 1;
          for (let j = 0; j < 10; j++) {
            const m = (l + r) / 2,
              pt: P = [
                T.MathUtils.lerp(a[0], b[0], m),
                T.MathUtils.lerp(a[1], b[1], m),
              ];
            if (coverage(g, ...pt) > 0.5 === inside) l = m;
            else r = m;
          }
          const t = (l + r) / 2,
            pt: P = [
              T.MathUtils.lerp(a[0], b[0], t),
              T.MathUtils.lerp(a[1], b[1], t),
            ];
          clipped.push(pt);
          cross.push(pt);
        }
      }
      if (clipped.length < 3) return;
      for (const sign of [-1, 1])
        for (let j = 1; j < clipped.length - 1; j++) {
          const ids = [clipped[0], clipped[j], clipped[j + 1]].map((pt) =>
            vertex(...pt, sign),
          );
          idx.push(...(sign < 0 ? ids.reverse() : ids));
        }
      if (cross.length === 2) {
        const first = clipped.indexOf(cross[0]);
        const ordered = clipped[(first + 1) % clipped.length] === cross[1];
        const [a, b] = ordered ? cross : [cross[1], cross[0]],
          aa = vertex(...a, -1),
          ab = vertex(...a, 1),
          ba = vertex(...b, -1),
          bb = vertex(...b, 1);
        idx.push(aa, ba, ab, ba, bb, ab);
      }
    };
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const a: P = [x / nx, (y / ny) * ratio],
          b: P = [(x + 1) / nx, (y / ny) * ratio],
          c: P = [(x + 1) / nx, ((y + 1) / ny) * ratio],
          d: P = [x / nx, ((y + 1) / ny) * ratio];
        triangle([a, b, c]);
        triangle([a, c, d]);
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(geo, skin);
    const tube = (
      points: T.Vector3[],
      radius: number,
      color: string,
      rig: "body" | "head" | "left" | "right" = "head",
    ) =>
      add(
        new T.TubeGeometry(
          new T.CatmullRomCurve3(points),
          low ? 4 : 10,
          radius,
          low ? 4 : 6,
          false,
        ),
        fin,
        color,
        rig,
      );
    for (const sign of [-1, 1]) {
      // A shallow solid operculum follows the head surface and meets the gill
      // crease without a pasted-on sphere or an intersecting hard edge.
      const centerU = g.gill[0] - 0.075,
        centerV = g.gill[1],
        hf = frame(g, centerU),
        radiusY = Math.min(centerV - hf[0], hf[1] - centerV) * 0.85;
      const gp: number[] = [],
        guv: number[] = [],
        gi: number[] = [],
        segments = low ? 12 : 24,
        rings = low ? 2 : 4;
      for (let r = 0; r <= rings; r++)
        for (let a = 0; a <= segments; a++) {
          const t = r / rings,
            angle = (a / segments) * Math.PI * 2,
            u = centerU + Math.cos(angle) * 0.075 * t,
            v = centerV + Math.sin(angle) * radiusY * t,
            z = depth(g, p, u, v) + 0.004 * Math.sin(t * Math.PI);
          const pt = world(u, v, z * sign);
          gp.push(pt.x, pt.y, pt.z);
          guv.push(u, 1 - v / ratio);
          if (r < rings && a < segments) {
            const k = r * (segments + 1) + a;
            const faces = [
              k,
              k + segments + 1,
              k + 1,
              k + 1,
              k + segments + 1,
              k + segments + 2,
            ];
            gi.push(...(sign < 0 ? faces.reverse() : faces));
          }
        }
      const cover = new T.BufferGeometry();
      cover.setAttribute("position", new T.Float32BufferAttribute(gp, 3));
      cover.setAttribute("uv", new T.Float32BufferAttribute(guv, 2));
      cover.setIndex(gi);
      cover.computeVertexNormals();
      add(cover, skin, "#ffffff", "head");
      const [eu, ev, er] = g.eye,
        ez = (depth(g, p, eu, ev) + er * 0.1) * sign,
        ep = world(eu, ev, ez),
        eye = new T.SphereGeometry(er * S, low ? 8 : 16, low ? 6 : 12);
      eye.scale(1, 1, 0.48);
      eye.translate(ep.x, ep.y, ep.z);
      add(eye, eyeMat, "#ffffff", "head");
      const hi = new T.SphereGeometry(er * S * 0.24, low ? 6 : 10, low ? 4 : 8);
      const hp = ep
        .clone()
        .add(new T.Vector3(er * S * 0.24, er * S * 0.38, sign * er * S * 0.43));
      hi.translate(hp.x, hp.y, hp.z);
      add(hi, glint, "#ffffff", "head");
      const mu = g.mouth[0],
        mv = g.mouth[1],
        mz = depth(g, p, mu + 0.018, mv) * sign;
      tube(
        [
          world(mu + 0.015, mv - 0.015, mz),
          world(mu - 0.005, mv - 0.003, mz + sign * 0.006),
          world(mu + 0.025, mv + 0.006, mz + sign * 0.012),
        ],
        0.008,
        id === "catfish" ? "#e1ba65" : "#cfb69c",
      );
      tube(
        [
          world(mu + 0.025, mv + 0.006, mz + sign * 0.012),
          world(mu + 0.003, mv + 0.014, mz + sign * 0.008),
          world(mu + 0.025, mv + 0.022, mz),
        ],
        0.0055,
        "#d9bfa0",
      );
      const gu = g.gill[0] - 0.02,
        f = frame(g, gu),
        ct = g.gill[1];
      const arc = Array.from({ length: 7 }, (_, j) => {
        const t = j / 6,
          v =
            T.MathUtils.lerp(f[0] + 0.015, f[1] - 0.015, t) +
            (ct - (f[0] + f[1]) / 2),
          u = gu + 0.02 * Math.sin(t * Math.PI);
        return world(u, v, (depth(g, p, u, v) + 0.0015) * sign);
      });
      tube(arc, 0.0016, p.back);
      const fu = g.pectoral[0],
        fv = g.pectoral[1];
      // Raised paired pectorals are solid curved fans with radial crease lines.
      const shape = new T.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(-0.055, -0.1, -0.18, -0.1);
      shape.quadraticCurveTo(-0.23, -0.025, -0.16, 0.055);
      shape.quadraticCurveTo(-0.055, 0.1, 0, 0);
      const fg = new T.ExtrudeGeometry(shape, {
        depth: 0.009,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 1,
        curveSegments: low ? 3 : 8,
        steps: 1,
      });
      const finY = id === "sturgeon" ? 1 : 1.3;
      const origin = world(fu, fv, depth(g, p, fu, fv) * sign);
      fg.scale(1.3, finY, sign);
      fg.translate(origin.x, origin.y, origin.z);
      add(fg, fin, p.fin, sign < 0 ? "left" : "right");
      for (let j = 0; j < 4; j++) {
        const end = origin
          .clone()
          .add(
            new T.Vector3(
              (-0.14 - j * 0.009) * 1.3,
              (-0.075 + j * 0.039) * finY,
              sign * 0.014,
            ),
          );
        tube(
          [
            origin.clone().add(new T.Vector3(-0.008, 0, sign * 0.014)),
            origin
              .clone()
              .lerp(end, 0.5)
              .add(new T.Vector3(0, 0.007, 0)),
            end,
          ],
          low ? 0.0008 : 0.0012,
          p.back,
          sign < 0 ? "left" : "right",
        );
      }
      for (let j = 0; j < (p.barbels ?? 0); j++) {
        const offset = j * 0.009;
        const start = world(
          mu + 0.015 + offset,
          mv + 0.005,
          (Math.abs(mz) + 0.006) * sign,
        );
        tube(
          [
            start,
            start
              .clone()
              .add(new T.Vector3(0.018, -0.025, sign * (0.025 + j * 0.012))),
            start
              .clone()
              .add(
                new T.Vector3(
                  j % 2 ? -0.025 : 0.035,
                  -0.07 - j * 0.018,
                  sign * (0.045 + j * 0.015),
                ),
              ),
          ],
          0.0032,
          "#d9bd8a",
        );
      }
    }
    if (id === "sturgeon")
      for (const side of [-1, 0, 1])
        for (let j = 0; j < 11; j++) {
          const u = (side === 0 ? 0.18 : 0.29) + j * 0.055,
            [top, bottom] = frame(g, u);
          const column = Math.floor(u * g.width),
            edge =
              g.rows.findIndex((row) =>
                row.some(
                  (v, i) => i % 2 === 0 && column >= v && column < row[i + 1],
                ),
              ) / g.width;
          const v =
              side === 0
                ? Math.min(top + 0.004, edge + 0.008)
                : top + (bottom - top) * 0.48,
            z = side === 0 ? 0 : depth(g, p, u, v) * side;
          const radius = side === 0 ? 0.018 - j * 0.00065 : 0.026 - j * 0.001;
          const plate = new T.OctahedronGeometry(radius * S, 0);
          plate.scale(1.25, 0.75, 0.6);
          const pt = world(u, v, z);
          plate.translate(pt.x, pt.y, pt.z);
          add(plate, fin, "#e6d6b8");
        }
    root.updateMatrixWorld(true);
    for (const [material, geometries] of parts) {
      const merged = mergeVertices(mergeGeometries(geometries, false)!, 1e-5);
      const mesh = new T.SkinnedMesh(merged, material);
      mesh.name = `${id}-${material.name}`;
      mesh.frustumCulled = false;
      group.add(mesh);
      root.updateMatrixWorld(true);
      mesh.bind(skeleton);
    }
  }
  return root;
}
