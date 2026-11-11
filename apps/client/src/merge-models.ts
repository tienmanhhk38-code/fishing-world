import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
export function coloredGeometry(
  source: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  matrix: THREE.Matrix4,
) {
  let geometry = source.clone();
  if (geometry.index) {
    const expanded = geometry.toNonIndexed();
    geometry.dispose();
    geometry = expanded;
  }
  geometry.applyMatrix4(matrix);
  const originalColors = geometry.getAttribute("color");
  for (const name of Object.keys(geometry.attributes))
    if (!["position", "normal", "skinIndex", "skinWeight"].includes(name))
      geometry.deleteAttribute(name);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const colors = new Float32Array(geometry.attributes.position.count * 3),
    fallback = new THREE.Color("white");
  const materials = Array.isArray(material) ? material : [material],
    groups = Array.isArray(material)
      ? geometry.groups
      : [
          {
            start: 0,
            count: geometry.attributes.position.count,
            materialIndex: 0,
          },
        ];
  for (const group of groups) {
    const color =
      (materials[group.materialIndex ?? 0] as THREE.MeshStandardMaterial)
        ?.color ?? fallback;
    for (let i = group.start; i < group.start + group.count; i++) {
      colors[i * 3] = color.r * (originalColors?.getX(i) ?? 1);
      colors[i * 3 + 1] = color.g * (originalColors?.getY(i) ?? 1);
      colors[i * 3 + 2] = color.b * (originalColors?.getZ(i) ?? 1);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}
export function mergeParts(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error("Không thể ghép mesh 3D.");
  geometry.computeBoundingSphere();
  return geometry;
}
export function bakeMeshes(
  meshes: THREE.Mesh[],
  style: (material: THREE.Material) => THREE.Material = (material) => material,
) {
  const materials = meshes
    .flatMap((mesh) =>
      Array.isArray(mesh.material) ? mesh.material : [mesh.material],
    )
    .map(style);
  if (
    !materials.every(
      (material) =>
        material instanceof THREE.MeshStandardMaterial &&
        !material.transparent &&
        !material.map &&
        material.opacity === 1,
    )
  )
    return null;
  const parts = meshes.map((mesh) =>
    coloredGeometry(
      mesh.geometry,
      Array.isArray(mesh.material)
        ? mesh.material.map(style)
        : style(mesh.material),
      mesh.matrixWorld,
    ),
  );
  const geometry = mergeParts(parts);
  parts.forEach((part) => part.dispose());
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
  );
}
