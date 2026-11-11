import * as T from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import {
  mergeVertices,
  mergeGeometries,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ISLAND_OUTLINE,
  landHeightAt,
  shoreDistance,
  type Point,
  POND_CENTER,
  POND_RADII,
  WORLD_SCALE,
  worldPoint,
} from "@fishing/shared";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function terrainGeometry() {
  const shape = new T.Shape(
    ISLAND_OUTLINE.map((p) => new T.Vector2(p.x, -p.z)),
  );
  const hole = new T.Path();
  hole.absellipse(
    POND_CENTER.x,
    -POND_CENTER.z,
    POND_RADII.x,
    POND_RADII.z,
    0,
    Math.PI * 2,
    true,
    0,
  );
  shape.holes.push(hole);
  const source = new T.ShapeGeometry(shape, 64);
  const divided = new TessellateModifier(1.2, 12).modify(source);
  source.dispose();
  const position = divided.getAttribute("position"),
    colors: number[] = [],
    c = new T.Color(),
    sand = new T.Color("#efd39a"),
    grass = new T.Color("#79b85b");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      z = -position.getY(i),
      p = { x, z },
      h = landHeightAt(p),
      d = shoreDistance(p);
    position.setXYZ(i, x, h, z);
    const beach = Math.exp(
      -(((x / WORLD_SCALE + 19) / 14) ** 2 + ((z / WORLD_SCALE + 14) / 7) ** 2),
    );
    const sandy = Math.max(1 - clamp((d - 1) / 4), beach * 0.98);
    c.copy(grass)
      .lerp(sand, sandy)
      .multiplyScalar(
        0.97 + Math.sin(x * 1.7 + Math.cos(z)) * Math.sin(z * 1.4) * 0.035,
      );
    colors.push(c.r, c.g, c.b);
  }
  divided.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  const geometry = mergeVertices(divided);
  divided.dispose();
  geometry.computeVertexNormals();
  return geometry;
}
export function coastGeometry() {
  const positions: number[] = [],
    colors: number[] = [],
    c = new T.Color();
  function add(p: Point, y: number, color: string) {
    positions.push(p.x, y, p.z);
    c.set(color);
    colors.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < ISLAND_OUTLINE.length; i++) {
    const a = ISLAND_OUTLINE[i],
      b = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length];
    const outer = (p: Point) => {
      const v = new T.Vector2(
        p.x + WORLD_SCALE,
        p.z + 36 * WORLD_SCALE,
      ).normalize();
      return { x: p.x + v.x * 1.6, z: p.z + v.y * 1.6 };
    };
    const a2 = outer(a),
      b2 = outer(b),
      ah = landHeightAt(a),
      bh = landHeightAt(b);
    add(a, ah, "#ead3a0");
    add(b2, -1.2, "#c7bc9c");
    add(b, bh, "#ead3a0");
    add(a, ah, "#ead3a0");
    add(a2, -1.2, "#c7bc9c");
    add(b2, -1.2, "#c7bc9c");
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
const PATHS_BASE: number[][][] = [
  [
    [-14, -14],
    [-15, -20],
    [-11, -25],
    [-10, -32],
    [-10, -38],
  ],
  [
    [-10, -32],
    [-22, -34],
    [-29, -40],
    [-28, -46],
    [-30, -48],
  ],
  [
    [-10, -32],
    [0, -31],
    [7, -30],
    [12, -24],
    [23, -23],
    [32, -29],
    [32, -36],
    [27, -43],
    [16, -44],
    [7, -43],
    [0, -47],
    [-10, -47],
    [-15, -42],
  ],
  [
    [-16, -20],
    [-24, -18],
    [-29, -23],
    [-29, -29],
    [-22, -34],
  ],
];
export const PATHS = PATHS_BASE.map((path) =>
  path.map(([x, z]) => [x * WORLD_SCALE, z * WORLD_SCALE]),
);
export function plazaGeometry() {
  const center = worldPoint({ x: -10, z: -32 }),
    g = new T.CircleGeometry(7.2 * WORLD_SCALE, 64),
    position = g.getAttribute("position"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const x = center.x + position.getX(i),
      z = center.z - position.getY(i);
    position.setXYZ(i, x, landHeightAt({ x, z }) + 0.06, z);
    uv.setXY(i, uv.getX(i) * 7, uv.getY(i) * 7);
  }
  g.computeVertexNormals();
  return g;
}
export function ribbonGeometry(
  points: number[][],
  width: number,
  offset = 0.025,
) {
  const curve = new T.CatmullRomCurve3(
      points.map(([x, z]) => new T.Vector3(x, 0, z)),
    ),
    steps = Math.ceil(curve.getLength() * 2),
    positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      p = curve.getPoint(t),
      v = curve.getTangent(t),
      nx = -v.z,
      nz = v.x;
    for (const side of [-1, 1]) {
      const x = p.x + nx * width * 0.5 * side,
        z = p.z + nz * width * 0.5 * side;
      positions.push(x, landHeightAt({ x, z }) + offset, z);
      uv.push(side === -1 ? 0 : 1, (t * steps) / 3);
    }
    if (i < steps) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function pathGeometry(width: number, offset: number) {
  const parts = PATHS.map((p) => ribbonGeometry(p, width, offset)),
    g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}
export function pavingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#9e947f";
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + (row % 2) * 32,
        y = row * 32;
      ctx.fillStyle = ["#e4cead", "#d8c3a5", "#ead8bb", "#cbbda6"][
        (row * 7 + col + 5) % 4
      ];
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, 61, 29, 5);
      ctx.fill();
    }
  const map = new T.CanvasTexture(canvas);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}
