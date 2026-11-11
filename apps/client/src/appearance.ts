import * as THREE from "three";
import { APPEARANCES, type AppearanceId } from "@fishing/shared";

export function appearanceMaterial(source: THREE.Material, id: AppearanceId) {
  const palette = APPEARANCES[id],
    material = source.clone();
  if (material instanceof THREE.MeshStandardMaterial) {
    const color = (
      {
        white: palette.shirt,
        navy: palette.shorts,
        sand: palette.hat,
        hair: palette.hair,
        skin: "#f5bb96",
      } as Record<string, string>
    )[source.name];
    if (color) material.color.set(color);
    material.roughness = 0.8;
  }
  return material;
}
// Small authored details extend the supplied GLB; positions use its model space.
export function characterDetails(id: AppearanceId, headOnly = false) {
  const group = new THREE.Group(),
    palette = APPEARANCES[id];
  const add = (
    geometry: THREE.BufferGeometry,
    color: string,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
  ) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    group.add(mesh);
    return mesh;
  };
  for (const sign of [-1, 1]) {
    add(new THREE.SphereGeometry(0.017, 8, 6), "#fffaf0", [
      sign * 0.12 - 0.013,
      1.477,
      0.322,
    ]);
    add(
      new THREE.SphereGeometry(0.046, 10, 6),
      "#ed8d91",
      [sign * 0.23, 1.36, 0.259],
      [1, 0.43, 0.18],
    );
    if (id === "sunny" || id === "coral")
      add(new THREE.CapsuleGeometry(0.085, 0.3, 3, 7), palette.hair, [
        sign * 0.29,
        1.16,
        -0.1,
      ]);
    if (id === "ocean") {
      add(new THREE.TorusGeometry(0.098, 0.012, 6, 16), "#15374b", [
        sign * 0.13,
        1.451,
        0.338,
      ]);
      add(new THREE.CircleGeometry(0.088, 16), "#244a60", [
        sign * 0.13,
        1.451,
        0.336,
      ]);
    }
  }
  if (id === "ocean")
    add(new THREE.BoxGeometry(0.065, 0.018, 0.018), "#15374b", [0, 1.45, 0.34]);
  const smile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.048, 1.32, 0.291),
    new THREE.Vector3(0, 1.3, 0.303),
    new THREE.Vector3(0.048, 1.32, 0.291),
  ]);
  add(new THREE.TubeGeometry(smile, 10, 0.009, 5, false), "#94514c", [0, 0, 0]);
  if (!headOnly) {
    add(
      new THREE.SphereGeometry(0.065, 10, 6),
      palette.accent,
      [0, 0.99, 0.228],
      [1.4, 0.65, 0.14],
    );
    const tail = add(
      new THREE.ConeGeometry(0.05, 0.08, 3),
      palette.accent,
      [-0.105, 0.99, 0.23],
      [1, 1, 0.25],
    );
    tail.rotation.z = -Math.PI / 2;
  }
  return group;
}
export function disposeDetails(group: THREE.Object3D) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((material) => material.dispose());
    }
  });
}
