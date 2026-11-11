import { useEffect, useMemo } from "react";
import * as T from "three";
import {
  HOUSE_POSITIONS,
  MARKET_POSITIONS,
  landHeightAt,
} from "@fishing/shared";

// Soft, static contact occlusion also remains available with real shadows disabled.
export function Grounding() {
  const mesh = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!,
      gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,.8)");
    gradient.addColorStop(0.35, "rgba(255,255,255,.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new T.CanvasTexture(canvas),
      material = new T.MeshBasicMaterial({
        map: texture,
        color: "#493b29",
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
    const spots = [
      ...[...HOUSE_POSITIONS, ...MARKET_POSITIONS].map((p) => ({
        ...p,
        rx: 2.0,
        rz: 1.5,
      })),
      ...HOUSE_POSITIONS.map((p) => ({ ...p, rx: 0.8, rz: 0.65 })),
      { x: -45, z: -73.5, rx: 1.7, rz: 1.7 },
    ];
    const batch = new T.InstancedMesh(
        new T.PlaneGeometry(2, 2),
        material,
        spots.length,
      ),
      o = new T.Object3D();
    spots.forEach((p, i) => {
      o.position.set(p.x, landHeightAt(p) + 0.06, p.z);
      o.rotation.x = -Math.PI / 2;
      o.scale.set(p.rx, p.rz, 1);
      o.updateMatrix();
      batch.setMatrixAt(i, o.matrix);
    });
    batch.computeBoundingSphere();
    return batch;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as T.MeshBasicMaterial).map?.dispose();
      (mesh.material as T.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  return <primitive object={mesh} dispose={null} />;
}
