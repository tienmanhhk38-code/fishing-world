import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SPECIES } from "@fishing/shared";

// Development entry point used by scripts/render-asset-thumbnails.mjs.
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(256, 192);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe4f4ff, 0xb4956d, 1.5));
const sun = new THREE.DirectionalLight(0xfff5df, 3);
sun.position.set(-3, 5, 6);
scene.add(sun);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
let current: THREE.Group | undefined;
Object.assign(window, {
  renderAsset: async (id: string, outputSize = 256) => {
    if (current) scene.remove(current);
    const variant = /^(avatar|character)-(sailor|sunny|coral|ocean)$/.exec(id);
    current = (
      await new GLTFLoader().loadAsync(
        id.startsWith("harbor-")
          ? `/assets/harbor-v2/${id.slice(7)}.glb`
          : variant
            ? `/assets/harbor-v2/fisher_${variant[2]}.glb`
            : `/assets/starter/models/${id}.glb`,
      )
    ).scene;
    current.traverse((o) => {
      if (o.name === "fish-lod-low") o.visible = false;
    });
    const box = new THREE.Box3().setFromObject(current),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    current.position.sub(center);
    scene.add(current);
    const portrait =
      id === "chibi_fisher_blockout" || variant?.[1] === "avatar";
    const aspect = portrait ? 1 : 4 / 3;
    const span = portrait
      ? 1.45
      : Math.max(size.x / aspect, size.y, size.z) * (variant ? 1.13 : 1.3);
    renderer.setSize(outputSize, portrait ? outputSize : outputSize * 0.75);
    camera.left = (-span * aspect) / 2;
    camera.right = (span * aspect) / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.position.set(portrait ? 0.5 : 1.5, portrait ? 0.7 : 0.8, 5);
    const freshwater = SPECIES.find((s) => s.model === id)?.area === "village";
    if (freshwater) camera.position.set(0, 0, -5);
    sun.position.z = freshwater ? -6 : 6;
    camera.lookAt(0, portrait ? 0.42 : 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  },
});
