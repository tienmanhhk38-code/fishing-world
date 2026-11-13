import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SPECIES, fishLength } from "@fishing/shared";
import { poseFishBones, setFishLod } from "./fish-rig";

type Options = {
  id: string;
  baseline?: boolean;
  view?: string;
  low?: boolean;
  mask?: boolean;
  transparent?: boolean;
  time?: number;
  reduced?: boolean;
  turn?: number;
  grams?: number;
};
const renderer = new T.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(960, 640);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);
const scene = new T.Scene(),
  camera = new T.OrthographicCamera(-1.2, 1.2, 0.8, -0.8, 0.01, 100);
scene.add(new T.HemisphereLight("#fff4e4", "#b9a798", 2));
const key = new T.DirectionalLight("#fff4e8", 2.2);
key.position.set(2, 4, -6);
scene.add(key);
const fill = new T.DirectionalLight("#e5ecf5", 0.8);
fill.position.set(-3, 2, 4);
scene.add(fill);
const loader = new GLTFLoader(),
  cache = new Map<string, T.Group>();
let current: T.Group | undefined;
let extra: T.Group[] = [];
async function load(id: string, baseline = false) {
  const s = SPECIES.find((s) => s.id === id)!;
  if (!s) throw Error(`Unknown species ${id}`);
  const path = baseline
    ? `/@fs/${BASELINE_ROOT}/models/${s.model}.glb`
    : `/assets/starter/models/${s.model}.glb`;
  if (!cache.has(path)) cache.set(path, (await loader.loadAsync(path)).scene);
  return clone(cache.get(path)!) as T.Group;
}
// Supplied explicitly by the capture runner; no backend/database is involved.
let BASELINE_ROOT = "";
function bones(root: T.Object3D) {
  const result: T.Bone[] = [];
  root.traverse((o) => {
    if (o instanceof T.Bone) result.push(o);
  });
  return result;
}
function normalize(root: T.Group) {
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root),
    center = box.getCenter(new T.Vector3());
  root.position.sub(center);
  return box.getSize(new T.Vector3());
}
async function show(o: Options) {
  if (current) scene.remove(current);
  for (const g of extra) scene.remove(g);
  extra = [];
  current = await load(o.id, o.baseline);
  setFishLod(current, !!o.low);
  const size = normalize(current);
  scene.add(current);
  if (o.time !== undefined)
    poseFishBones(bones(current), o.time, 0, 17, !!o.reduced);
  current.rotation.y = o.turn ?? 0;
  const longest = Math.max(size.x, size.y, size.z),
    view = o.view ?? "reference";
  const dirs: Record<string, number[]> = {
    reference: [0, 0, -5],
    opposite: [0, 0, 5],
    top: [0, 5, 0],
    front: [5, 0, 0],
    rear: [-5, 0, 0],
    threeQuarter: [2, 0.5, -5],
  };
  const d = dirs[view] ?? dirs.reference;
  camera.position.set(...(d as [number, number, number]));
  camera.up.set(0, view === "top" ? 0 : 1, view === "top" ? 1 : 0);
  camera.lookAt(0, 0, 0);
  renderer.setSize(960, 640);
  const span = longest * 1.12;
  camera.left = -span / 2;
  camera.right = span / 2;
  camera.top = span / 3;
  camera.bottom = -span / 3;
  camera.updateProjectionMatrix();
  scene.overrideMaterial = o.mask
    ? new T.MeshBasicMaterial({ color: "#ffffff" })
    : null;
  renderer.setClearColor("#fff4e5", o.mask || o.transparent ? 0 : 1);
  renderer.render(scene, camera);
  const s = SPECIES.find((s) => s.id === o.id)!;
  const landmarks: Record<string, number[]> = {};
  current.updateMatrixWorld(true);
  current.traverse((node) => {
    if (node.userData.landmarks)
      for (const [name, position] of Object.entries(node.userData.landmarks)) {
        const pt = new T.Vector3(...(position as [number, number, number]))
          .applyMatrix4(node.matrixWorld)
          .project(camera);
        landmarks[name] = [(pt.x + 1) * 480, (1 - pt.y) * 320];
      }
  });
  const joints = bones(current);
  return {
    length: longest,
    height: size.y,
    displayLength: fishLength(s, o.grams ?? s.referenceGrams),
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    landmarks,
    headFixed: joints
      .filter((b) => b.userData.fishJoint === 0)
      .every(
        (b) => b.rotation.x === 0 && b.rotation.y === 0 && b.rotation.z === 0,
      ),
    maxBoneAngle: Math.max(
      ...joints.map((b) =>
        Math.max(
          Math.abs(b.rotation.x),
          Math.abs(b.rotation.y),
          Math.abs(b.rotation.z),
        ),
      ),
    ),
  };
}
async function benchmark(id: string, baseline = false, low = false) {
  await show({ id, baseline, low });
  const instances = [current!];
  for (let i = 0; i < 3; i++) {
    const g = await load(id, baseline);
    normalize(g);
    setFishLod(g, low);
    g.position.x += (i - 1) * 0.6;
    g.position.y += i % 2 ? -0.4 : 0.4;
    scene.add(g);
    extra.push(g);
    instances.push(g);
  }
  const jointLists = instances.map(bones),
    samples: number[] = [],
    cpu: number[] = [];
  let previous = performance.now();
  for (let i = 0; i < 240; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const now = performance.now();
    const begin = performance.now();
    instances.forEach((g, j) =>
      poseFishBones(jointLists[j], i * 16.67, 0, 17 + j, false),
    );
    renderer.render(scene, camera);
    if (i >= 60) {
      samples.push(now - previous);
      cpu.push(performance.now() - begin);
    }
    previous = now;
  }
  const stats = (a: number[]) => {
    a.sort((a, b) => a - b);
    return {
      median: a[Math.floor(a.length * 0.5)],
      p95: a[Math.floor(a.length * 0.95)],
    };
  };
  return {
    frames: stats(samples),
    cpu: stats(cpu),
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    gpu: renderer.getContext().getParameter(renderer.getContext().RENDERER),
  };
}
async function record(ids: string[]) {
  const stream = renderer.domElement.captureStream(30),
    chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 3000000,
  });
  const done = new Promise<Blob>((resolve) => {
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  recorder.start();
  for (const id of ids) {
    await show({ id });
    const joints = bones(current!);
    for (let f = 0; f < 90; f++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      current!.rotation.y = (f / 90) * Math.PI * 2;
      poseFishBones(joints, (f * 1000) / 30, 0, 17, false);
      renderer.render(scene, camera);
    }
  }
  recorder.stop();
  const bytes = new Uint8Array(await (await done).arrayBuffer());
  stream.getTracks().forEach((t) => t.stop());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
Object.assign(window, {
  freshwaterQA: {
    show,
    benchmark,
    record,
    baselineRoot: (path: string) => (BASELINE_ROOT = path),
  },
});
