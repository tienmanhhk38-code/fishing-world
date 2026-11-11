import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { WORLD_SCALE, landHeightAt } from "@fishing/shared";
const beds = [
  [-27, -20],
  [-24, -22],
  [-20, -20],
  [-8, -20],
  [-6, -24],
  [-20, -29],
  [-23, -32],
  [-16, -40],
  [-5, -42],
  [2, -35],
  [6, -36],
  [11, -24],
  [20, -24],
  [30, -27],
  [32, -36],
  [27, -43],
  [19, -44],
  [12, -44],
  [-26, -45],
  [-34, -47],
  [-31, -54],
  [-20, -54],
  [6, -54],
  [20, -54],
  [-15, -23],
  [-4, -24],
  [-12, -35],
  [-6, -35],
].map(([x, z]) => [x * WORLD_SCALE, z * WORLD_SCALE]);
function flowerMeshes() {
  const flowers = beds.flatMap(([x, z], i) =>
    Array.from({ length: 13 }, (_, n) => {
      const xx = x + Math.cos(n * 2.4) * Math.sqrt(n / 13) * 1.4,
        zz = z + Math.sin(n * 2.4) * Math.sqrt(n / 13) * 1.4;
      return {
        x: xx,
        z: zz,
        y: landHeightAt({ x: xx, z: zz }) + 0.15 + (n % 3) * 0.1,
        color: ["#f594b5", "#f3ca6a", "#f8eee1", "#acb8df"][(i + n) % 4],
      };
    }),
  );
  const petals = new T.InstancedMesh(
    new T.SphereGeometry(1, 6, 4),
    new T.MeshStandardMaterial({ roughness: 1 }),
    flowers.length * 5,
  );
  const centers = new T.InstancedMesh(
    new T.SphereGeometry(1, 6, 4),
    new T.MeshStandardMaterial({ color: "#ffdb6e", roughness: 1 }),
    flowers.length,
  );
  const o = new T.Object3D(),
    c = new T.Color();
  flowers.forEach((f, i) => {
    o.position.set(f.x, f.y, f.z);
    o.scale.set(0.07, 0.055, 0.07);
    o.updateMatrix();
    centers.setMatrixAt(i, o.matrix);
    for (let n = 0; n < 5; n++) {
      const a = (n / 5) * Math.PI * 2;
      o.position.set(
        f.x + Math.cos(a) * 0.12,
        f.y - 0.015,
        f.z + Math.sin(a) * 0.12,
      );
      o.scale.set(0.14, 0.04, 0.085);
      o.rotation.y = -a;
      o.updateMatrix();
      petals.setMatrixAt(i * 5 + n, o.matrix);
      petals.setColorAt(i * 5 + n, c.set(f.color));
    }
  });
  petals.computeBoundingSphere();
  centers.computeBoundingSphere();
  return { petals, centers };
}
export function TropicalDetails() {
  const flowers = useMemo(flowerMeshes, []),
    birds = useRef<T.Group>(null);
  const line = useMemo(
    () =>
      new T.BufferGeometry().setFromPoints([
        new T.Vector3(-0.5, 0, 0),
        new T.Vector3(0, -0.13, 0),
        new T.Vector3(0, -0.13, 0),
        new T.Vector3(0.5, 0, 0),
      ]),
    [],
  );
  useFrame(({ clock }) => {
    if (birds.current) {
      birds.current.position.x = Math.sin(clock.elapsedTime * 0.035) * 25;
      birds.current.position.y = 15 + Math.sin(clock.elapsedTime * 0.3) * 0.3;
    }
  });
  useEffect(
    () => () => {
      for (const m of [flowers.petals, flowers.centers]) {
        m.geometry.dispose();
        (m.material as T.Material).dispose();
        m.dispose();
      }
      line.dispose();
    },
    [flowers, line],
  );
  return (
    <>
      <primitive object={flowers.petals} dispose={null} />
      <primitive object={flowers.centers} dispose={null} />
      <group ref={birds} position={[0, 15, -55]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <lineSegments
            key={i}
            geometry={line}
            position={[i * 2.1, Math.sin(i) * 1.2, i * 0.7]}
          >
            <lineBasicMaterial color="#fff9e4" />
          </lineSegments>
        ))}
      </group>
    </>
  );
}
