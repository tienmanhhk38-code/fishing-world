import * as T from "three";
export const SHADOW_LENGTH = 1.4;
export const SHADOW_NOSE = 0.62 / SHADOW_LENGTH;
export function createFishShadowGeometry() {
  const s = new T.Shape();
  s.moveTo(0, 0.62);
  s.bezierCurveTo(0.22, 0.6, 0.29, 0.25, 0.22, 0.02);
  s.quadraticCurveTo(0.4, -0.08, 0.22, -0.13);
  s.quadraticCurveTo(0.15, -0.31, 0.075, -0.41);
  s.bezierCurveTo(0.12, -0.52, 0.25, -0.65, 0.27, -0.78);
  s.quadraticCurveTo(0.1, -0.72, 0, -0.59);
  s.quadraticCurveTo(-0.1, -0.72, -0.27, -0.78);
  s.bezierCurveTo(-0.25, -0.65, -0.12, -0.52, -0.075, -0.41);
  s.quadraticCurveTo(-0.15, -0.31, -0.22, -0.13);
  s.quadraticCurveTo(-0.4, -0.08, -0.22, 0.02);
  s.bezierCurveTo(-0.29, 0.25, -0.22, 0.6, 0, 0.62);
  s.closePath();
  const geometry = new T.ShapeGeometry(s, 20),
    positions = geometry.getAttribute("position"),
    normals = geometry.getAttribute("normal");
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(
      i,
      positions.getX(i) / SHADOW_LENGTH,
      0,
      positions.getY(i) / SHADOW_LENGTH,
    );
    normals.setXYZ(i, 0, 1, 0);
  }
  geometry.boundingSphere = new T.Sphere(new T.Vector3(), 1.2);
  return geometry;
}
export function deformFishShadow(
  geometry: T.BufferGeometry,
  base: Float32Array,
  swing: number,
) {
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const weight = Math.max(0, Math.min(1, (-base[i * 3 + 2] - 0.2) / 0.36));
    pos.setX(i, base[i * 3] + swing * weight * weight * 0.17);
  }
  pos.needsUpdate = true;
}
export function shadowMouthOffset(yaw: number, scale: number) {
  return {
    x: Math.sin(yaw) * SHADOW_NOSE * scale,
    z: Math.cos(yaw) * SHADOW_NOSE * scale,
  };
}
