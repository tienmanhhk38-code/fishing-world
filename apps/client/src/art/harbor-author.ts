import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { APPEARANCES, type AppearanceId } from "@fishing/shared";

// Authored in metres, +Z forward. Source geometry and all animation curves are
// reproducible here; exported GLBs do not require this module at runtime.
type V = [number, number, number];
function kit() {
  const group = new T.Group();
  function add(
    g: T.BufferGeometry,
    color: string,
    p: V = [0, 0, 0],
    s: V = [1, 1, 1],
    r: V = [0, 0, 0],
    joint = 0,
  ) {
    const m = new T.Mesh(
      g,
      new T.MeshStandardMaterial({ color, roughness: 0.82 }),
    );
    m.position.set(...p);
    m.scale.set(...s);
    m.rotation.set(...r);
    m.userData.joint = joint;
    group.add(m);
    return m;
  }
  const box = (
    size: V,
    color: string,
    p: V,
    r: V = [0, 0, 0],
    bevel = 0.035,
    joint = 0,
  ) =>
    add(
      bevel <= 0.015
        ? new T.BoxGeometry(...size)
        : new RoundedBoxGeometry(...size, 1, bevel),
      color,
      p,
      [1, 1, 1],
      r,
      joint,
    );
  const ball = (size: V, color: string, p: V, joint = 0, segments = 16) =>
    add(
      new T.SphereGeometry(1, segments, segments <= 10 ? 4 : 7),
      color,
      p,
      size,
      [0, 0, 0],
      joint,
    );
  const tube = (
    points: V[],
    radius: number,
    color: string,
    joint = 0,
    segments = 12,
  ) =>
    add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        segments,
        radius,
        4,
        false,
      ),
      color,
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
      joint,
    );
  const ring = (
    radius: number,
    thickness: number,
    color: string,
    p: V,
    joint = 0,
  ) =>
    add(
      new T.TorusGeometry(radius, thickness, 3, 24),
      color,
      p,
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
      joint,
    );
  return { group, add, box, ball, tube, ring };
}
function packed(source: T.Group, skinned = false) {
  source.updateMatrixWorld(true);
  const pieces: T.BufferGeometry[] = [];
  source.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    let g = o.geometry.clone();
    if (g.index) {
      const expanded = g.toNonIndexed();
      g.dispose();
      g = expanded;
    }
    g.applyMatrix4(o.matrixWorld);
    for (const attribute of Object.keys(g.attributes))
      if (!["position", "normal"].includes(attribute))
        g.deleteAttribute(attribute);
    const pos = g.attributes.position,
      norm = g.attributes.normal,
      colors = new Float32Array(pos.count * 3),
      color = (o.material as T.MeshStandardMaterial).color;
    const indices = new Uint16Array(pos.count * 4),
      weights = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const shade = T.MathUtils.clamp(
        0.96 +
          norm.getY(i) * 0.055 +
          Math.sin(pos.getX(i) * 15 + pos.getZ(i) * 9) * 0.012,
        0.84,
        1.035,
      );
      colors.set([color.r * shade, color.g * shade, color.b * shade], i * 3);
      indices[i * 4] = o.userData.joint ?? 0;
      weights[i * 4] = 1;
    }
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    if (skinned) {
      g.setAttribute("skinIndex", new T.Uint16BufferAttribute(indices, 4));
      g.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
    }
    pieces.push(g);
  });
  const geometry = mergeGeometries(pieces, false)!;
  pieces.forEach((p) => p.dispose());
  source.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      (o.material as T.Material).dispose();
    }
  });
  const indexed = mergeVertices(geometry, 0.00001);
  geometry.dispose();
  indexed.computeBoundingSphere();
  return indexed;
}
function material(name = "painted") {
  const m = new T.MeshStandardMaterial({
    color: "white",
    vertexColors: true,
    roughness: 0.8,
  });
  m.name = name;
  m.userData.artPass = "harbor-v2";
  return m;
}
function character(id: AppearanceId) {
  const k = kit(),
    c = APPEARANCES[id],
    skin = "#f4bc98",
    hair = c.hair;
  // Torso, jacket hem, shorts, shoes and articulated hands.
  k.ball([0.265, 0.315, 0.18], c.shirt, [0, 0.96, 0], 0);
  k.box([0.46, 0.11, 0.33], c.shirt, [0, 0.73, 0], [0, 0, 0], 0.045);
  for (const sign of [-1, 1]) {
    const arm = sign < 0 ? 2 : 3,
      leg = sign < 0 ? 4 : 5;
    k.box(
      [0.18, 0.33, 0.22],
      c.shirt,
      [sign * 0.345, 0.88, 0.015],
      [0, 0, -sign * 0.13],
      0.065,
      arm,
    );
    k.box(
      [0.19, 0.065, 0.23],
      "#e4e9e4",
      [sign * 0.365, 0.745, 0.018],
      [0, 0, 0],
      0.025,
      arm,
    );
    k.ball([0.095, 0.105, 0.093], skin, [sign * 0.4, 0.65, 0.035], arm, 12);
    k.ball([0.043, 0.065, 0.055], skin, [sign * 0.455, 0.65, 0.06], arm, 10);
    k.box(
      [0.23, 0.24, 0.3],
      c.shorts,
      [sign * 0.13, 0.615, 0],
      [0, 0, 0],
      0.035,
      leg,
    );
    k.box(
      [0.235, 0.055, 0.305],
      "#7599b6",
      [sign * 0.13, 0.51, 0],
      [0, 0, 0],
      0.012,
      leg,
    );
    k.add(
      new T.CylinderGeometry(0.071, 0.065, 0.25, 10),
      skin,
      [sign * 0.13, 0.37, 0],
      [1, 1, 1],
      [0, 0, 0],
      leg,
    );
    k.box(
      [0.19, 0.105, 0.29],
      "#263e5c",
      [sign * 0.13, 0.17, 0.048],
      [0, 0, 0],
      0.045,
      leg,
    );
    k.box(
      [0.2, 0.045, 0.3],
      "#f4eee0",
      [sign * 0.13, 0.105, 0.05],
      [0, 0, 0],
      0.015,
      leg,
    );
    k.box(
      [0.12, 0.022, 0.11],
      "#e1e8e7",
      [sign * 0.13, 0.224, 0.085],
      [0.1, 0, 0],
      0.008,
      leg,
    );
    k.box(
      [0.026, 0.1, 0.05],
      c.accent,
      [sign * 0.065, 0.98, 0.174],
      [0, 0, sign * 0.22],
      0.01,
    );
  }
  k.box([0.035, 0.25, 0.025], "#d8e5e5", [0, 0.97, 0.182], [0, 0, 0], 0.01);
  k.ball([0.055, 0.026, 0.008], c.accent, [0.125, 0.96, 0.18], 0, 10);
  k.tube(
    [
      [-0.17, 1.17, 0.08],
      [-0.1, 1.12, 0.16],
      [0, 1.09, 0.19],
      [0.1, 1.12, 0.16],
      [0.17, 1.17, 0.08],
    ],
    0.035,
    "#e5e8df",
    0,
    12,
  );
  k.add(new T.CylinderGeometry(0.1, 0.1, 0.15, 12), skin, [0, 1.2, 0]);
  // Round head and ear volumes. Forward facial layers are kept clear of the hair.
  k.ball([0.365, 0.335, 0.315], skin, [0, 1.48, 0], 1, 24);
  for (const sign of [-1, 1]) {
    k.ball([0.068, 0.095, 0.06], skin, [sign * 0.35, 1.44, 0], 1, 12);
    k.ball([0.03, 0.055, 0.016], "#db957c", [sign * 0.38, 1.44, 0.035], 1, 10);
    k.ball([0.064, 0.088, 0.026], "#fff8ed", [sign * 0.13, 1.49, 0.298], 1, 16);
    k.ball(
      [0.042, 0.062, 0.017],
      "#5a352a",
      [sign * 0.124, 1.482, 0.322],
      1,
      14,
    );
    k.ball([0.025, 0.046, 0.012], "#251f28", [sign * 0.12, 1.48, 0.338], 1, 12);
    k.ball(
      [0.013, 0.02, 0.009],
      "#ffffff",
      [sign * 0.12 - 0.012, 1.506, 0.347],
      1,
      10,
    );
    k.ball(
      [0.044, 0.022, 0.009],
      "#eb9696",
      [sign * 0.245, 1.365, 0.242],
      1,
      12,
    );
    k.tube(
      [
        [sign * 0.19, 1.595, 0.275],
        [sign * 0.13, 1.61, 0.294],
        [sign * 0.08, 1.596, 0.285],
      ],
      0.012,
      hair,
      1,
      6,
    );
  }
  k.ball([0.027, 0.023, 0.025], "#efac87", [0, 1.405, 0.311], 1, 12);
  k.tube(
    [
      [-0.048, 1.34, 0.288],
      [0, 1.321, 0.306],
      [0.048, 1.34, 0.288],
    ],
    0.009,
    "#9c534b",
    1,
    8,
  );
  k.add(
    new T.SphereGeometry(1, 20, 10, Math.PI, Math.PI, 0, Math.PI * 0.8),
    hair,
    [0, 1.48, 0],
    [0.38, 0.35, 0.328],
    [0, 0, 0],
    1,
  );
  for (const [x, y, z, s, angle] of [
    [-0.28, 1.65, 0.15, 0.1, -0.5],
    [-0.16, 1.725, 0.21, 0.12, -0.7],
    [0, 1.72, 0.25, 0.13, -0.65],
    [0.17, 1.69, 0.21, 0.115, -0.45],
    [0.29, 1.6, 0.13, 0.085, -0.1],
  ]) {
    const strand = k.ball(
      [s, s * 0.82, 0.075],
      hair,
      [x, Math.min(y, 1.635), z],
      1,
      12,
    );
    strand.rotation.z = angle * 0.55;
  }
  if (id === "sunny" || id === "coral")
    for (const sign of [-1, 1])
      k.ball([0.105, 0.29, 0.115], hair, [sign * 0.29, 1.26, -0.115], 1, 14);
  const hat = new T.LatheGeometry(
    [
      [0, 1.755],
      [0.31, 1.755],
      [0.46, 1.71],
      [0.49, 1.73],
      [0.49, 1.75],
      [0.45, 1.77],
      [0.31, 1.79],
      [0.29, 1.92],
      [0.24, 2.02],
      [0, 2.04],
    ].map(([x, y]) => new T.Vector2(x, y)),
    32,
  );
  k.add(hat, c.hat, [0, 0, 0], [1, 1, 1], [0, 0, 0], 1);
  k.add(
    new T.CylinderGeometry(0.291, 0.31, 0.075, 32, 1, true),
    "#a47748",
    [0, 1.827, 0],
    [1, 1, 1],
    [0, 0, 0],
    1,
  );
  k.ring(0.476, 0.009, "#d2ae6e", [0, 1.746, 0], 1);
  k.ring(0.283, 0.006, "#e8c990", [0, 1.93, 0], 1);
  for (const [r, y] of [
    [0.296, 1.9],
    [0.272, 1.96],
    [0.252, 2.0],
  ])
    k.ring(r, 0.003, "#bba06d", [0, y, 0], 1);
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    k.tube(
      [
        [Math.cos(a) * 0.34, 1.783, Math.sin(a) * 0.34],
        [Math.cos(a) * 0.4, 1.778, Math.sin(a) * 0.4],
        [Math.cos(a) * 0.465, 1.77, Math.sin(a) * 0.465],
      ],
      0.0025,
      "#c4ab78",
      1,
      4,
    );
  }
  if (id === "ocean") {
    for (const sign of [-1, 1]) {
      k.add(
        new T.TorusGeometry(0.078, 0.011, 5, 16),
        "#243b50",
        [sign * 0.13, 1.495, 0.339],
        [1, 1.1, 1],
        [0, 0, 0],
        1,
      );
    }
    k.box(
      [0.07, 0.015, 0.022],
      "#243b50",
      [0, 1.5, 0.342],
      [0, 0, 0],
      0.005,
      1,
    );
  }
  k.group.traverse((o) => {
    if (o instanceof T.Mesh && o.userData.joint >= 4) o.position.y -= 0.0825;
  });
  const group = new T.Group(),
    bones = Array.from({ length: 6 }, () => new T.Bone());
  const poses: V[] = [
    [0, 0, 0],
    [0, 1.15, 0],
    [-0.28, 1, 0],
    [0.28, 1, 0],
    [-0.14, 0.6, 0],
    [0.14, 0.6, 0],
  ];
  bones.forEach((b, i) => {
    b.name = ["root", "head", "leftArm", "rightArm", "leftLeg", "rightLeg"][i];
    b.position.set(...poses[i]);
    if (i) bones[0].add(b);
  });
  group.add(bones[0]);
  group.updateMatrixWorld(true);
  const geometry = packed(k.group, true),
    positions = geometry.attributes.position,
    paint = geometry.attributes.color;
  const blink = positions.clone();
  blink.name = "Blink";
  for (let i = 0; i < positions.count; i++) {
    const x = Math.abs(positions.getX(i)),
      y = positions.getY(i),
      z = positions.getZ(i);
    const eye =
      (paint.getX(i) > 0.85 && paint.getY(i) > 0.8) ||
      (paint.getX(i) < 0.24 && paint.getY(i) < 0.12);
    if (x > 0.055 && x < 0.21 && y > 1.39 && y < 1.59 && z > 0.295 && eye)
      blink.setY(i, 1.485 + (y - 1.485) * 0.035);
  }
  geometry.morphAttributes.position = [blink];
  const mesh = new T.SkinnedMesh(geometry, material());
  mesh.name = "fisher";
  mesh.bind(new T.Skeleton(bones));
  group.add(mesh);
  const lengths: Record<string, number> = {
    Idle: 2.8,
    Walk: 0.72,
    Cast: 0.7,
    Wait: 2,
    Hook: 0.28,
    Reel: 1.2,
    Celebrate: 2.8,
    Run: 0.52,
    Jump: 0.65,
    ShowFish: 2.8,
  };
  const clips = Object.entries(lengths).map(([name, duration]) => {
    const tracks: T.KeyframeTrack[] = [];
    for (const joint of [
      "head",
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg",
    ]) {
      const times: number[] = [],
        values: number[] = [];
      for (let i = 0; i <= 28; i++) {
        const t = i / 28,
          cycle = Math.sin(t * Math.PI * 2);
        let x = 0,
          y = 0,
          z = 0;
        if (joint === "rightArm") x = -0.55;
        if (name === "Idle") {
          if (joint === "head") y = cycle * 0.025;
          if (joint === "rightArm") x += cycle * 0.025;
        }
        if (name === "Walk") {
          if (joint === "leftArm") x = cycle * 0.38;
          if (joint === "rightArm") x += cycle * 0.075;
          if (joint === "leftLeg") x = cycle * 0.52;
          if (joint === "rightLeg") x = -cycle * 0.52;
        }
        if (name === "Run") {
          if (joint === "leftLeg") x = cycle * 0.9;
          if (joint === "rightLeg") x = -cycle * 0.9;
          if (joint === "leftArm") x = -cycle * 0.55;
          if (joint === "rightArm") x = -0.65 + cycle * 0.12;
          if (joint === "head") x = -0.08;
        }
        if (name === "Jump") {
          if (joint === "leftLeg") x = -Math.sin(t * Math.PI) * 0.65;
          if (joint === "rightLeg") x = Math.sin(t * Math.PI) * 0.4;
          if (joint === "leftArm") z = Math.sin(t * Math.PI) * -0.4;
        }
        if (name === "ShowFish") {
          if (joint === "leftArm") {
            x = -2.3 + cycle * 0.025;
            z = 0.25;
          }
          if (joint === "rightArm") x = -0.55;
          if (joint === "head") y = cycle * 0.05;
        }
        if (name === "Cast") {
          if (joint === "rightArm") x = -0.8 - Math.sin(t * Math.PI) * 1.25;
          if (joint === "leftArm") x = -0.65;
          if (joint === "head") x = -Math.sin(t * Math.PI) * 0.1;
        }
        if (name === "Wait") {
          if (joint === "rightArm") x = -0.8 + cycle * 0.025;
          if (joint === "leftArm") x = -0.75;
        }
        if (["Wait", "Hook", "Reel"].includes(name)) {
          if (joint === "rightArm") z = -0.65;
          if (joint === "leftArm") z = 1.1;
        }
        if (name === "Hook") {
          if (joint === "rightArm") x = -0.8 - Math.sin(t * Math.PI) * 0.85;
          if (joint === "leftArm") x = -0.85;
        }
        if (name === "Reel") {
          if (joint === "rightArm") x = -1.3 + cycle * 0.35;
          if (joint === "leftArm") x = -1 + cycle * 0.22;
          if (joint === "head") x = -0.04;
        }
        if (name === "Celebrate") {
          if (joint === "rightArm") x = -2.8 + cycle * 0.07;
          if (joint === "leftArm") x = -0.45;
          if (joint === "head") {
            x = -0.08;
            y = cycle * 0.08;
          }
        }
        const q = new T.Quaternion().setFromEuler(new T.Euler(x, y, z));
        times.push(t * duration);
        values.push(...q.toArray());
      }
      tracks.push(
        new T.QuaternionKeyframeTrack(`${joint}.quaternion`, times, values),
      );
    }
    if (name === "Idle")
      tracks.push(
        new T.NumberKeyframeTrack(
          "fisher.morphTargetInfluences",
          [0, 1.3, 1.35, 1.44, 1.5, 2.8],
          [0, 0, 1, 1, 0, 0],
        ),
      );
    return new T.AnimationClip(name, duration, tracks);
  });
  return { group, clips };
}

function dock() {
  const k = kit();
  for (let i = 0; i < 9; i++) {
    const z = -2.7 + i * 0.33,
      wood = ["#bf814d", "#ca9059", "#d29b60", "#bc7f4b"][i % 4];
    k.box(
      [1.99, 0.13, 0.309],
      wood,
      [0, 0, z],
      [0, ((i % 3) - 1) * 0.003, 0],
      0.025,
    );
    for (const x of [-0.82, 0.82])
      k.ball([0.014, 0.007, 0.014], "#746954", [x, 0.07, z], 0, 8);
  }
  const geometry = packed(k.group),
    pos = geometry.attributes.position,
    uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + 1) / 2;
    uv[i * 2 + 1] = (pos.getZ(i) + 2.865) / 2.98;
  }
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff7e2";
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 9; row++)
    for (let line = 0; line < 7; line++) {
      const y = (row * 512) / 9 + 6 + line * 6.2;
      ctx.strokeStyle = `rgba(110,67,26,${0.035 + (line % 3) * 0.015})`;
      ctx.lineWidth = line % 3 === 0 ? 1.3 : 0.7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        120,
        y + Math.sin(row + line) * 5,
        300,
        y - 3,
        512,
        y + 2,
      );
      ctx.stroke();
    }
  const m = material("plank");
  m.map = new T.CanvasTexture(canvas);
  m.map.colorSpace = T.SRGBColorSpace;
  m.map.anisotropy = 8;
  const group = new T.Group();
  group.add(new T.Mesh(geometry, m));
  return { group, clips: [] };
}
function post() {
  const k = kit();
  k.add(new T.CylinderGeometry(0.155, 0.18, 1.3, 16), "#a87543", [0, 0.12, 0]);
  k.add(new T.CylinderGeometry(0.177, 0.177, 0.08, 20), "#c69258", [0, 0.8, 0]);
  for (const r of [0.06, 0.105, 0.14])
    k.ring(r, 0.004, "#a07343", [0, 0.844, 0]);
  for (const y of [0.5, 0.54, 0.58]) k.ring(0.165, 0.017, "#dbc99a", [0, y, 0]);
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}
function palm() {
  const k = kit();
  const trunk: V[] = [
    [0, 0, 0],
    [0.05, 0.65, 0.02],
    [0.22, 1.35, 0.03],
    [0.48, 2.15, 0.05],
    [0.62, 2.55, 0.05],
  ];
  k.tube(trunk, 0.105, "#bc9462", 0, 24);
  for (let i = 0; i < 12; i++) {
    const y = 0.12 + i * 0.2;
    k.ring(0.108, 0.008, "#96744f", [0.62 * Math.pow(y / 2.55, 1.6), y, 0.03]);
  }
  k.ball([0.23, 0.15, 0.22], "#68894a", [0.62, 2.55, 0.05], 0, 12);
  for (let n = 0; n < 9; n++) {
    const a = (n * Math.PI * 2) / 9 + 0.12,
      L = 1.35 + (n % 3) * 0.12,
      positions: number[] = [],
      colors: number[] = [],
      base = new T.Color(n % 2 ? "#5caa59" : "#3d9152");
    function point(t: number, side: number) {
      const w = Math.sin(Math.PI * t) * 0.22;
      return new T.Vector3(
        0.62 + Math.cos(a) * L * t - Math.sin(a) * w * side,
        2.57 +
          0.42 * Math.sin(t * Math.PI) -
          0.7 * t * t -
          (side === 0 ? 0 : 0.045),
        0.05 + Math.sin(a) * L * t + Math.cos(a) * w * side,
      );
    }
    for (let i = 0; i < 9; i++)
      for (const side of [-1, 1]) {
        const A = point(i / 9, 0),
          B = point(i / 9, side),
          C = point((i + 1) / 9, side),
          D = point((i + 1) / 9, 0);
        for (const v of [A, B, C, A, C, D, C, B, A, D, C, A]) {
          positions.push(...v.toArray());
          const shade = 0.85 + 0.17 * (v.y - 1.8);
          colors.push(base.r * shade, base.g * shade, base.b * shade);
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    // The folded silhouette and tapered, slightly serrated edge read from orbit views.
    k.add(g, n % 2 ? "#67ae5a" : "#419951");
    k.tube(
      Array.from({ length: 10 }, (_, i) => point(i / 9, 0).toArray() as V),
      0.012,
      "#a2be63",
      0,
      10,
    );
  }
  for (const [x, y, z] of [
    [0.49, 2.4, 0.15],
    [0.76, 2.38, 0.06],
    [0.58, 2.37, -0.1],
  ])
    k.ball([0.11, 0.14, 0.11], "#aa9360", [x, y, z], 0, 12);
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}
function house() {
  const k = kit();
  k.box([2.4, 1.85, 2.02], "#f5dfb2", [0, 0.96, 0], [0, 0, 0], 0.07);
  k.box([2.48, 0.16, 2.1], "#c5b18a", [0, 0.08, 0], [0, 0, 0], 0.035);
  for (const x of [-1.15, 1.15])
    for (const z of [-0.99, 0.99])
      k.box([0.12, 1.78, 0.12], "#f9f0d9", [x, 1.02, z], [0, 0, 0], 0.025);
  const shape = new T.Shape();
  shape.moveTo(-1.43, 0);
  shape.lineTo(0, 0.86);
  shape.lineTo(1.43, 0);
  shape.lineTo(1.43, -0.13);
  shape.lineTo(-1.43, -0.13);
  shape.closePath();
  const roof = new T.ExtrudeGeometry(shape, {
    depth: 2.52,
    bevelEnabled: true,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    bevelSegments: 2,
    steps: 1,
  });
  k.add(roof, "#d87963", [0, 2.06, -1.26]);
  for (const z of [-1.24, 1.24])
    k.tube(
      [
        [-1.44, 2.055, z],
        [0, 2.93, z],
        [1.44, 2.055, z],
      ],
      0.055,
      "#f3c69b",
    );
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.3;
    k.box(
      [0.035, 0.022, 2.52],
      i % 2 ? "#e49476" : "#bd695b",
      [x, 2.94 - Math.abs(x) * 0.6, 0],
      [0, 0, 0],
      0.009,
    );
  }
  for (const z of [-0.94, -0.48, 0, 0.48, 0.94])
    k.tube(
      [
        [-1.37, 2.1, z],
        [-0.7, 2.51, z],
        [0, 2.94, z],
        [0.7, 2.51, z],
        [1.37, 2.1, z],
      ],
      0.012,
      "#eea287",
      0,
      8,
    );
  // Recessed blue panes, cream trim, wooden shutters, door and porch.
  for (const x of [-0.72, 0.72]) {
    k.box([0.57, 0.72, 0.08], "#fff2cd", [x, 1.23, 1.033], [0, 0, 0], 0.04);
    k.box([0.43, 0.57, 0.09], "#438b9e", [x, 1.24, 1.064], [0, 0, 0], 0.025);
    k.box([0.032, 0.58, 0.035], "#e9e3ca", [x, 1.24, 1.119], [0, 0, 0], 0.008);
    k.box([0.44, 0.032, 0.035], "#e9e3ca", [x, 1.24, 1.119], [0, 0, 0], 0.008);
    k.box([0.68, 0.075, 0.19], "#d3a574", [x, 0.86, 1.1], [0, 0, 0], 0.015);
    for (const sign of [-1, 1]) {
      k.box(
        [0.13, 0.64, 0.055],
        "#78a9a2",
        [x + sign * 0.33, 1.24, 1.07],
        [0, sign * 0.2, 0],
        0.015,
      );
      for (let row = 0; row < 5; row++)
        k.box(
          [0.11, 0.018, 0.018],
          "#52847e",
          [x + sign * 0.33, 1.03 + row * 0.105, 1.107],
          [0, 0, 0],
          0.004,
        );
    }
  }
  k.box([0.5, 1.18, 0.09], "#ae784d", [0, 0.66, 1.053], [0, 0, 0], 0.045);
  for (const x of [-0.16, 0, 0.16])
    k.box([0.015, 1.08, 0.025], "#d39f6a", [x, 0.67, 1.112], [0, 0, 0], 0.004);
  k.ball([0.028, 0.028, 0.028], "#e6c173", [0.15, 0.69, 1.16], 0, 10);
  k.box([0.8, 0.13, 0.33], "#d6b386", [0, 0.1, 1.17], [0, 0, 0], 0.035);
  k.box([0.7, 0.075, 0.38], "#ead6ae", [0, 0.035, 1.36], [0, 0, 0], 0.025);
  k.box([0.52, 0.12, 0.09], "#c58c54", [0, 1.6, 1.09], [0, 0, 0], 0.025);
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}

function bush() {
  const k = kit();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4,
      r = (i % 3) * 0.17;
    k.ball(
      [0.34, 0.3, 0.32],
      ["#82b365", "#6fa35e", "#9ac477"][i % 3],
      [Math.cos(a) * r, 0.2 + (i % 3) * 0.12, Math.sin(a) * r],
      0,
      12,
    );
  }
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}
function rocks() {
  const k = kit();
  for (const [i, p] of [
    [0, [-0.48, 0.2, 0.05]],
    [1, [0.16, 0.35, 0]],
    [2, [0.63, 0.15, 0.16]],
    [3, [-0.12, 0.12, 0.48]],
  ] as [number, V][]) {
    const g = new T.IcosahedronGeometry(1, 2),
      pos = g.attributes.position;
    for (let n = 0; n < pos.count; n++) {
      const x = pos.getX(n),
        y = pos.getY(n),
        z = pos.getZ(n),
        w = 1 + Math.sin(x * 8 + z * 5) * 0.055;
      pos.setXYZ(n, x * w, y * (0.93 + Math.cos(x * 5) * 0.05), z * w);
    }
    g.computeVertexNormals();
    k.add(
      g,
      ["#9caeac", "#b1bfba", "#8d9f9f", "#c0c8bd"][i],
      p,
      [0.42 + (i === 1 ? 0.12 : 0), 0.32 + (i === 1 ? 0.17 : 0), 0.38],
      [0, i, 0],
    );
  }
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}
function crate() {
  const k = kit();
  k.box([0.78, 0.72, 0.72], "#ba8854", [0, 0.36, 0], [0, 0, 0], 0.025);
  for (const z of [-0.37, 0.37]) {
    for (const y of [0.1, 0.36, 0.62])
      k.box([0.8, 0.055, 0.045], "#dfb77d", [0, y, z], [0, 0, 0], 0.012);
    for (const x of [-0.34, 0.34])
      k.box([0.075, 0.74, 0.055], "#d5a66d", [x, 0.36, z], [0, 0, 0], 0.015);
  }
  for (const x of [-0.4, 0.4])
    for (const z of [-0.3, 0.3])
      k.box([0.05, 0.74, 0.075], "#d5a66d", [x, 0.36, z], [0, 0, 0], 0.015);
  for (const z of [-0.23, 0, 0.23])
    k.box([0.8, 0.045, 0.055], "#d9ad73", [0, 0.74, z], [0, 0, 0], 0.012);
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}
function lighthouse() {
  const k = kit();
  for (let i = 0; i < 5; i++) {
    const bottom = 0.73 - i * 0.065,
      top = bottom - 0.065;
    k.add(
      new T.CylinderGeometry(top, bottom, 0.76, 24),
      i % 2 ? "#d78376" : "#fff1cd",
      [0, 0.42 + i * 0.76, 0],
    );
    if (i === 0)
      k.add(
        new T.CylinderGeometry(0.82, 0.85, 0.16, 24),
        "#c6b597",
        [0, 0.08, 0],
      );
  }
  k.add(new T.CylinderGeometry(0.81, 0.81, 0.14, 28), "#36566b", [0, 3.9, 0]);
  k.add(new T.CylinderGeometry(0.56, 0.56, 0.64, 16), "#79c6d1", [0, 4.29, 0]);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    k.add(new T.CylinderGeometry(0.025, 0.025, 0.76, 8), "#f9e6b8", [
      Math.cos(a) * 0.57,
      4.3,
      Math.sin(a) * 0.57,
    ]);
    k.add(new T.CylinderGeometry(0.018, 0.018, 0.4, 6), "#435e6b", [
      Math.cos(a) * 0.77,
      4.1,
      Math.sin(a) * 0.77,
    ]);
  }
  k.ring(0.77, 0.025, "#435e6b", [0, 4.3, 0]);
  k.add(new T.ConeGeometry(0.83, 0.51, 24), "#d57667", [0, 4.88, 0]);
  k.ball([0.06, 0.12, 0.06], "#e3c38a", [0, 5.18, 0], 0, 12);
  k.box([0.37, 0.65, 0.08], "#a97e56", [0, 0.43, 0.72], [0, 0, 0], 0.04);
  for (const y of [1.45, 2.8]) {
    k.box([0.22, 0.35, 0.04], "#e9dcb9", [0, y, 0.61], [0, 0, 0], 0.035);
    k.box([0.13, 0.24, 0.05], "#477b96", [0, y, 0.645], [0, 0, 0], 0.02);
  }
  const group = new T.Group();
  group.add(new T.Mesh(packed(k.group), material()));
  return { group, clips: [] };
}

function island() {
  const count = 96,
    positions: number[] = [0, 0.645, 0],
    colors: number[] = [],
    indices: number[] = [];
  const grass = new T.Color("#99bb73");
  colors.push(grass.r, grass.g, grass.b);
  const rings: [number, number, number, number, string][] = [
    [8.7, 8.8, 0.7, 0.645, "#99bb73"],
    [9.15, 9.25, 1.0, 0.63, "#cbd29a"],
    [10.5, 10.4, 1.8, -0.52, "#e9d29b"],
    [11, 10.9, 2, -0.75, "#c7b98e"],
  ];
  for (const [w, h, r, y, hex] of rings) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const points = shape.getSpacedPoints(count),
      c = new T.Color(hex);
    for (let i = 0; i < count; i++) {
      positions.push(points[i].x, y, points[i].y);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < count; i++) indices.push(0, 1 + ((i + 1) % count), 1 + i);
  for (let ring = 0; ring < 3; ring++)
    for (let i = 0; i < count; i++) {
      const a = 1 + ring * count + i,
        b = 1 + ring * count + ((i + 1) % count),
        c = a + count,
        d = b + count;
      indices.push(a, b, d, a, d, c);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const group = new T.Group();
  group.add(new T.Mesh(geometry, material()));
  return { group, clips: [] };
}

export async function exportHarborAsset(id: string) {
  const variant = /^fisher_(sailor|sunny|coral|ocean)$/.exec(id);
  const asset = variant
    ? character(variant[1] as AppearanceId)
    : (
        {
          dock,
          dock_post: post,
          palm,
          house,
          bush,
          rocks,
          crate,
          lighthouse,
          island,
        } as Record<string, () => { group: T.Group; clips: T.AnimationClip[] }>
      )[id]?.();
  if (!asset) throw new Error("Unknown harbor asset " + id);
  asset.group.userData = {
    author: "Fishing World Online",
    version: 2,
    units: "metres",
    license: "Project-authored procedural geometry",
  };
  let triangles = 0;
  asset.group.traverse((o) => {
    if (o instanceof T.Mesh)
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  const data = (await new GLTFExporter().parseAsync(asset.group, {
    binary: true,
    animations: asset.clips,
    onlyVisible: true,
  })) as ArrayBuffer;
  const bytes = new Uint8Array(data);
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    base64: btoa(text),
    triangles,
    animations: asset.clips.map((c) => c.name),
  };
}
