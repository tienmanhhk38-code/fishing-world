import { useMemo, useEffect } from "react";
import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  HOUSE_POSITIONS,
  WORLD_SCALE,
  worldPoint,
  BEACH_DECK,
  DOCK_STEM,
  POND_BRIDGE,
  MARKET_POSITIONS,
  groundHeightAt,
  landHeightAt,
} from "@fishing/shared";
type V = [number, number, number];
function buildDecor() {
  const parts: T.BufferGeometry[] = [];
  function add(
    g: T.BufferGeometry,
    color: string,
    p: V,
    s: V = [1, 1, 1],
    r: V = [0, 0, 0],
  ) {
    if (g.index) {
      const indexed = g;
      g = g.toNonIndexed();
      indexed.dispose();
    }
    const o = new T.Object3D();
    o.position.set(...p);
    o.rotation.set(...r);
    o.scale.set(...s);
    o.updateMatrix();
    g.applyMatrix4(o.matrix);
    g.deleteAttribute("uv");
    const c = new T.Color(color),
      colors: number[] = [],
      normal = g.getAttribute("normal");
    for (let i = 0; i < g.getAttribute("position").count; i++) {
      const shade = 0.93 + 0.07 * Math.max(0, normal?.getY(i) ?? 1);
      colors.push(c.r * shade, c.g * shade, c.b * shade);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    parts.push(g);
  }
  const box = (s: V, c: string, p: V, r: V = [0, 0, 0], round = false) =>
    add(
      round ? new RoundedBoxGeometry(...s, 1, 0.045) : new T.BoxGeometry(...s),
      c,
      p,
      [1, 1, 1],
      r,
    );
  const ball = (s: V, c: string, p: V) =>
    add(new T.SphereGeometry(1, 12, 8), c, p, s);
  const cylinder = (radius: number, h: number, c: string, p: V, top = radius) =>
    add(new T.CylinderGeometry(top, radius, h, 12), c, p);
  const tube = (points: V[], radius: number, c: string) =>
    add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        24,
        radius,
        5,
        false,
      ),
      c,
      [0, 0, 0],
    );
  const ring = (
    radius: number,
    width: number,
    c: string,
    p: V,
    r: V = [Math.PI / 2, 0, 0],
  ) => add(new T.TorusGeometry(radius, width, 6, 32), c, p, [1, 1, 1], r);
  HOUSE_POSITIONS.forEach(({ x, z }, i) => {
    const y = landHeightAt({ x, z }),
      wall = ["#fff1d3", "#e9e9cf", "#fae2c1"][i % 3],
      roof = i % 2 ? "#527bb3" : "#ce735c";
    box([4.2, 3.8, 3.4], wall, [x, y + 1.9, z], [0, 0, 0], true);
    box([4.35, 0.22, 3.55], "#dbc6a2", [x, y + 0.14, z]);
    for (const xx of [-2.05, 2.05])
      box([0.2, 3.8, 0.2], "#bb9670", [x + xx, y + 1.9, z + 1.72]);
    // Gabled roof and painted front pediment.
    const tri = new T.Shape();
    tri.moveTo(-2.55, 0);
    tri.lineTo(2.55, 0);
    tri.lineTo(0, 1.7);
    tri.closePath();
    add(new T.ExtrudeGeometry(tri, { depth: 4.1, bevelEnabled: false }), roof, [
      x,
      y + 3.85,
      z - 2.05,
    ]);
    const front = new T.Shape();
    front.moveTo(-1.95, 0);
    front.lineTo(1.95, 0);
    front.lineTo(0, 1.36);
    front.closePath();
    add(new T.ShapeGeometry(front), wall, [x, y + 3.88, z + 2.065]);
    tube(
      [
        [x - 2.55, y + 3.85, z + 2.1],
        [x, y + 5.56, z + 2.1],
        [x + 2.55, y + 3.85, z + 2.1],
      ],
      0.085,
      "#fff2d9",
    );
    for (let t = 0; t < 7; t++) {
      const zz = z - 1.95 + t * 0.64;
      tube(
        [
          [x - 2.5, y + 3.9, zz],
          [x, y + 5.58, zz],
          [x + 2.5, y + 3.9, zz],
        ],
        0.035,
        i % 2 ? "#7697c8" : "#e69578",
      );
    }
    box(
      [0.85, 1.75, 0.12],
      "#96704b",
      [x, y + 0.98, z + 1.78],
      [0, 0, 0],
      true,
    );
    for (let d = 0; d < 4; d++)
      box([0.025, 1.6, 0.035], "#cfa56b", [
        x - 0.32 + d * 0.22,
        y + 0.98,
        z + 1.85,
      ]);
    ball([0.07, 0.07, 0.055], "#f8d56a", [x + 0.26, y + 1, z + 1.91]);
    box([1.3, 0.15, 0.55], "#d9c6a0", [x, y + 0.06, z + 1.96]);
    for (const xx of [-1.25, 1.25])
      for (const yy of [1.3, 3.05]) {
        box([0.83, 0.9, 0.12], "#fff5df", [x + xx, y + yy, z + 1.77]);
        box([0.64, 0.72, 0.13], "#568d9d", [x + xx, y + yy, z + 1.85]);
        for (const dx of [-0.22, 0.22])
          box([0.24, 0.62, 0.015], "#97c8d0", [
            x + xx + dx,
            y + yy + 0.03,
            z + 1.925,
          ]);
        box([0.055, 0.77, 0.035], "#fff2d0", [x + xx, y + yy, z + 1.94]);
        box([0.69, 0.055, 0.035], "#fff2d0", [x + xx, y + yy, z + 1.94]);
        for (const dx of [-0.6, 0.6])
          box([0.23, 0.95, 0.12], i % 2 ? "#7492ab" : "#bf8f63", [
            x + xx + dx,
            y + yy,
            z + 1.8,
          ]);
        if (yy < 2) {
          box([1.1, 0.2, 0.35], "#b17e52", [x + xx, y + yy - 0.6, z + 1.95]);
          for (const f of [-0.35, 0, 0.35])
            ball([0.23, 0.16, 0.21], "#739747", [
              x + xx + f,
              y + yy - 0.4,
              z + 1.95,
            ]);
        }
      }
    box([0.45, 1.1, 0.55], "#e7c6a3", [x + 1.3, y + 5.1, z - 0.8]);
    box([0.6, 0.12, 0.7], "#b96d53", [x + 1.3, y + 5.7, z - 0.8]);
  });
  MARKET_POSITIONS.forEach(({ x, z }, i) => {
    const y = landHeightAt({ x, z });
    for (const dx of [-1.7, 1.7])
      cylinder(0.085, 3.2, "#94653f", [x + dx, y + 1.6, z]);
    box([3.6, 1.0, 1.75], "#bb8a54", [x, y + 0.5, z]);
    for (let n = 0; n < 12; n++)
      box([0.018, 0.93, 0.03], "#835e3e", [
        x - 1.6 + n * 0.29,
        y + 0.52,
        z + 0.89,
      ]);
    for (let stripe = 0; stripe < 10; stripe++) {
      box(
        [0.37, 0.11, 2.55],
        stripe % 2 ? "#fff4cf" : i ? "#e78070" : "#e9b84c",
        [x - 1.665 + stripe * 0.37, y + 2.75, z + 0.1],
        [-0.15, 0, 0],
      );
      ball(
        [0.19, 0.15, 0.07],
        stripe % 2 ? "#fff4cf" : i ? "#e78070" : "#e9b84c",
        [x - 1.665 + stripe * 0.37, y + 2.42, z + 1.35],
      );
    }
    box([2.1, 0.7, 0.16], "#9d6947", [x, y + 3.25, z], [0, 0, 0], true);
    ball([0.45, 0.22, 0.07], i ? "#f1c09c" : "#9bc9d2", [
      x,
      y + 3.25,
      z + 0.12,
    ]);
    add(
      new T.ConeGeometry(0.2, 0.3, 3),
      "#f1ddae",
      [x - 0.47, y + 3.25, z + 0.12],
      [1, 1, 0.4],
      [0, 0, Math.PI / 2],
    );
    for (let tray = 0; tray < 3; tray++) {
      box([0.94, 0.15, 1.2], "#e1bd7d", [x - 1.1 + tray * 1.1, y + 1.1, z]);
      for (let f = 0; f < 3; f++)
        ball([0.26, 0.08, 0.11], ["#9eb5ad", "#e5a39b", "#8cadbd"][tray], [
          x - 1.1 + tray * 1.1,
          y + 1.23,
          z - 0.35 + f * 0.34,
        ]);
    }
  });
  // Central stone fountain and flower planter.
  const fx = -15,
    fz = -48,
    fy = landHeightAt({ x: fx, z: fz });
  cylinder(1.65, 0.3, "#d6c6a5", [fx, fy + 0.15, fz]);
  ring(1.45, 0.17, "#eadabe", [fx, fy + 0.35, fz]);
  cylinder(1.24, 0.08, "#70bdc0", [fx, fy + 0.29, fz]);
  cylinder(0.2, 1.4, "#e4d0a9", [fx, fy + 0.85, fz]);
  cylinder(0.8, 0.18, "#dfc5a3", [fx, fy + 1.35, fz], 0.95);
  ball([0.22, 0.3, 0.22], "#71a8a0", [fx, fy + 1.6, fz]);
  // Lake bridge, same arch equation as authoritative walking height.
  for (let x = POND_BRIDGE.minX + 0.1; x < POND_BRIDGE.maxX; x += 0.42) {
    const y = groundHeightAt({
      x,
      z: (POND_BRIDGE.minZ + POND_BRIDGE.maxZ) / 2,
    });
    box([0.4, 0.13, 2.1], "#c99359", [
      x,
      y - 0.07,
      (POND_BRIDGE.minZ + POND_BRIDGE.maxZ) / 2,
    ]);
  }
  for (const z of [POND_BRIDGE.minZ + 0.02, POND_BRIDGE.maxZ - 0.02]) {
    const rail: V[] = [];
    for (
      let x = POND_BRIDGE.minX + 0.1;
      x < POND_BRIDGE.maxX + 0.1;
      x += 1.85
    ) {
      const y = groundHeightAt({
        x,
        z: (POND_BRIDGE.minZ + POND_BRIDGE.maxZ) / 2,
      });
      cylinder(0.075, 1.05, "#af7849", [x, y + 0.48, z]);
      rail.push([x, y + 1, z]);
    }
    tube(rail, 0.075, "#b77b47");
  }
  // Rope rails around the L pier. Openings connect the stem to the cross arm.
  const rails: V[][] = [
    [
      [DOCK_STEM.minX, 0.72, DOCK_STEM.minZ],
      [DOCK_STEM.minX, 0.72, BEACH_DECK.maxZ],
    ],
    [
      [DOCK_STEM.maxX, 0.72, -17],
      [DOCK_STEM.maxX, 0.72, BEACH_DECK.minZ],
    ],
    [
      [BEACH_DECK.minX, 0.72, BEACH_DECK.maxZ],
      [BEACH_DECK.maxX, 0.72, BEACH_DECK.maxZ],
    ],
    [
      [DOCK_STEM.maxX, 0.72, BEACH_DECK.minZ],
      [BEACH_DECK.maxX, 0.72, BEACH_DECK.minZ],
    ],
    [
      [BEACH_DECK.maxX, 0.72, BEACH_DECK.minZ],
      [BEACH_DECK.maxX, 0.72, BEACH_DECK.maxZ],
    ],
  ];
  for (const [a, b] of rails) {
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]),
      segments = Math.ceil(length / 3.2);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[2] + (b[2] - a[2]) * t;
      cylinder(0.11, 4.3, "#ab7946", [x, -0.85, z]);
      cylinder(0.15, 0.11, "#d4a564", [x, 1.26, z]);
      if (i < segments) {
        const nt = (i + 1) / segments,
          xx = a[0] + (b[0] - a[0]) * nt,
          zz = a[2] + (b[2] - a[2]) * nt;
        tube(
          [
            [x, 1.17, z],
            [(x + xx) / 2, 0.97, (z + zz) / 2],
            [xx, 1.17, zz],
          ],
          0.026,
          "#f1d7a4",
        );
      }
    }
  }
  // Beach umbrellas and slatted loungers.
  for (const [x, z] of [
    [-26, -17],
    [-21, -14],
    [-9, -17],
  ].map(([x, z]) => [x * WORLD_SCALE, z * WORLD_SCALE])) {
    const y = landHeightAt({ x, z });
    cylinder(0.045, 2.5, "#a1784a", [x, y + 1.25, z]);
    for (let s = 0; s < 10; s++) {
      const g = new T.SphereGeometry(
        1,
        4,
        3,
        (s / 10) * Math.PI * 2,
        Math.PI * 0.2,
        0,
        Math.PI * 0.44,
      );
      add(
        g,
        s % 2 ? "#fff5d6" : "#ef8d8e",
        [x, y + 2.25, z],
        [1.65, 0.6, 1.65],
      );
    }
    for (const dx of [-0.65, 0.65]) {
      box([0.62, 0.1, 1.65], "#f1d9ac", [x + dx, y + 0.25, z + 0.9]);
      box(
        [0.62, 0.1, 0.6],
        "#87bdc5",
        [x + dx, y + 0.55, z + 0.2],
        [-0.5, 0, 0],
      );
    }
  }
  // Lamps and flower boxes border the village lanes, not the walking centre.
  for (const [x, z] of [
    [-18, -20],
    [-7, -25],
    [5, -28],
    [-26, -34],
    [8, -43],
    [-26, -46],
  ].map(([x, z]) => [x * WORLD_SCALE, z * WORLD_SCALE])) {
    const y = landHeightAt({ x, z });
    cylinder(0.13, 0.25, "#b79b75", [x, y + 0.12, z]);
    cylinder(0.055, 2.8, "#735e48", [x, y + 1.4, z]);
    box([0.36, 0.52, 0.36], "#f7d78b", [x, y + 2.8, z]);
    add(
      new T.ConeGeometry(0.35, 0.32, 4),
      "#84664c",
      [x, y + 3.2, z],
      [1, 1, 1],
      [0, Math.PI / 4, 0],
    );
  }
  // Shell arch at the beach entrance.
  const ax = -21,
    az = -28.5,
    ay = landHeightAt({ x: ax, z: az });
  for (const dx of [-2, 2])
    cylinder(0.13, 2.7, "#e2c79e", [ax + dx, ay + 1.35, az]);
  tube(
    [
      [ax - 2, ay + 2.6, az],
      [ax - 1, ay + 3.4, az],
      [ax + 1, ay + 3.4, az],
      [ax + 2, ay + 2.6, az],
    ],
    0.2,
    "#f8e4bb",
  );
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI;
    ball([0.23, 0.65, 0.15], i % 2 ? "#f1a9a4" : "#ffe0b3", [
      ax + Math.cos(a) * 0.85,
      ay + 3.1 + Math.sin(a) * 0.75,
      az,
    ]);
  }
  // Underwater branching coral, visible through the shallow transparent surface.
  for (let i = 0; i < 38; i++) {
    const x = (-7 + Math.cos(i * 2.399) * (7 + (i % 5) * 2.5)) * WORLD_SCALE,
      z = (9 + Math.sin(i * 2.399) * (3 + (i % 4) * 1.8)) * WORLD_SCALE,
      y = -1.5 - (i % 3) * 0.3;
    const col = ["#d68f99", "#b6adcb", "#6db9a8", "#dfbb7a"][i % 4];
    for (let b = 0; b < 3; b++) {
      const a = b * 2.1 + i,
        tip: V = [
          x + Math.cos(a) * 0.45,
          y + 0.65 + ((i + b) % 3) * 0.18,
          z + Math.sin(a) * 0.45,
        ];
      tube([[x, y, z], [x, y + 0.35, z], tip], 0.065, col);
      ball([0.1, 0.11, 0.1], col, tip);
    }
  }
  // Side windows, gutters and framed shop goods give the larger village detail
  // at walking distance without introducing one draw call per decoration.
  HOUSE_POSITIONS.forEach(({ x, z }, i) => {
    const y = landHeightAt({ x, z });
    for (const side of [-1, 1]) {
      for (const h of [1.35, 3]) {
        box([0.13, 1.05, 1.15], "#f8e9cd", [x + side * 2.14, y + h, z - 0.45]);
        box([0.15, 0.82, 0.9], "#76b4c4", [x + side * 2.17, y + h, z - 0.45]);
        box([0.17, 0.84, 0.045], "#e9d9b9", [x + side * 2.18, y + h, z - 0.45]);
        box([0.17, 0.05, 0.93], "#e9d9b9", [x + side * 2.18, y + h, z - 0.45]);
      }
      box([0.12, 0.15, 3.95], "#8f775e", [x + side * 2.28, y + 3.77, z]);
      cylinder(0.055, 3.6, "#8c9e9b", [x + side * 2.1, y + 1.9, z - 1.62]);
    }
    for (const dx of [-1.9, 1.9]) {
      cylinder(0.22, 0.45, "#b57855", [x + dx, y + 0.23, z + 2.1], 0.28);
      ball([0.35, 0.22, 0.3], "#7ca264", [x + dx, y + 0.58, z + 2.1]);
      for (let n = 0; n < 4; n++)
        ball([0.1, 0.09, 0.1], i % 2 ? "#e6aa9b" : "#e9cc74", [
          x + dx + Math.cos(n * 1.6) * 0.18,
          y + 0.77,
          z + 2.1 + Math.sin(n * 1.6) * 0.18,
        ]);
    }
  });
  for (const z of [BEACH_DECK.minZ + 0.25, BEACH_DECK.maxZ - 0.25])
    box([BEACH_DECK.maxX - BEACH_DECK.minX, 0.22, 0.2], "#96673f", [
      (BEACH_DECK.minX + BEACH_DECK.maxX) / 2,
      0.4,
      z,
    ]);
  for (const x of [DOCK_STEM.minX + 0.25, DOCK_STEM.maxX - 0.25])
    box([0.2, 0.22, BEACH_DECK.maxZ - DOCK_STEM.minZ], "#96673f", [
      x,
      0.4,
      (BEACH_DECK.maxZ + DOCK_STEM.minZ) / 2,
    ]);
  for (const x of [BEACH_DECK.maxX, DOCK_STEM.minX]) {
    ring(0.42, 0.105, "#f1a462", [x, 1.05, 2], [0, Math.PI / 2, 0]);
    for (let n = 0; n < 4; n++)
      box(
        [0.22, 0.14, 0.19],
        "#fff2db",
        [
          x,
          1.05 + Math.cos((n * Math.PI) / 2) * 0.42,
          2 + Math.sin((n * Math.PI) / 2) * 0.42,
        ],
        [(n * Math.PI) / 2, 0, 0],
      );
  }
  const combined = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  const result = mergeVertices(combined);
  combined.dispose();
  result.computeBoundingSphere();
  return result;
}
export function IslandDecor() {
  const geometry = useMemo(buildDecor, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} side={T.DoubleSide} />
    </mesh>
  );
}
