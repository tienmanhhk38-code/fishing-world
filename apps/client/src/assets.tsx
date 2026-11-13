import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useSettings } from "./settings";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { speciesFor } from "@fishing/shared";
import { bakeMeshes } from "./merge-models";
import { fishAssetVersion } from "./fish-asset-version";

export const fishModelId = (species?: string) =>
  speciesFor(species ?? "")?.model ?? "fish_concept_01";
const upgraded: Record<string, string> = {
  island_base: "island",
  dock_straight_2x3m: "dock",
  dock_post: "dock_post",
  palm_tree: "palm",
  village_house: "house",
  tropical_bush: "bush",
  rock_cluster: "rocks",
  wooden_crate: "crate",
  lighthouse: "lighthouse",
};
export const assetUrl = (id: string) =>
  upgraded[id]
    ? `/assets/harbor-v2/${upgraded[id]}.glb`
    : `/assets/starter/models/${id}.glb${fishAssetVersion(id)}`;
export { CharacterModel } from "./HarborCharacter";
const artMaterials = new Map<THREE.Material, THREE.Material>();
function artMaterial(source: THREE.Material, id: string) {
  if (source.userData.artPass === "harbor-v2") return source;
  const color =
    id.startsWith("dock_") && source.name === "plank"
      ? "#cd8c53"
      : id === "dock_post" && source.name === "wood"
        ? "#b17a45"
        : id === "palm_tree" && source.name === "leaf"
          ? "#3c9f68"
          : id === "palm_tree" && source.name === "grass"
            ? "#8ac442"
            : "";
  if (!color || !(source instanceof THREE.MeshStandardMaterial)) return source;
  if (!artMaterials.has(source)) {
    const material = source.clone();
    material.color.set(color);
    artMaterials.set(source, material);
  }
  return artMaterials.get(source)!;
}
const styledMaterial = (
  source: THREE.Material | THREE.Material[],
  id: string,
) =>
  Array.isArray(source)
    ? source.map((material) => artMaterial(material, id))
    : artMaterial(source, id);
const bakedAssets = new Map<string, THREE.Group>();
function bakedScene(scene: THREE.Group, id: string, materialName?: string) {
  const key = scene.uuid + ":" + (materialName ?? "*");
  if (!bakedAssets.has(key)) {
    scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.parent?.name !== "fish-lod-low" &&
        (!materialName ||
          (!Array.isArray(object.material) &&
            object.material.name === materialName))
      )
        meshes.push(object);
    });
    const group = new THREE.Group(),
      combined = bakeMeshes(meshes, (material) => artMaterial(material, id));
    if (combined) group.add(combined);
    else
      for (const mesh of meshes) {
        const copy = mesh.clone();
        copy.material = styledMaterial(mesh.material, id);
        mesh.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
        group.add(copy);
      }
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    bakedAssets.set(key, group);
  }
  return bakedAssets.get(key)!;
}

export class AssetBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Html center>
        <div className="asset-loading" role="alert">
          Không thể tải model 3D.
          <button onClick={() => location.reload()}>Tải lại</button>
        </div>
      </Html>
    ) : (
      this.props.children
    );
  }
}

export function Model({
  id,
  ...props
}: { id: string } & Omit<ThreeElements["group"], "id">) {
  const { scene } = useGLTF(assetUrl(id));
  const instance = useMemo(() => {
    const copy = bakedScene(scene, id).clone(true);
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh)
        object.material = styledMaterial(object.material, id);
    });
    return copy;
  }, [scene, id]);
  return (
    <group {...props}>
      <primitive object={instance} dispose={null} />
    </group>
  );
}

export interface Placement {
  position: [number, number, number];
  rotation?: number;
  scale?: number | [number, number, number];
}

function InstanceBatch({
  id,
  mesh,
  placements,
  maxDistance,
}: {
  id: string;
  mesh: THREE.Mesh;
  placements: Placement[];
  maxDistance?: number;
}) {
  const matrices = useRef<THREE.Matrix4[]>([]),
    nextCull = useRef(1),
    quality = useSettings((s) => s.quality);
  const object = useMemo(
    () =>
      new THREE.InstancedMesh(
        mesh.geometry,
        styledMaterial(mesh.material, id),
        placements.length,
      ),
    [mesh, placements.length, id],
  );
  useLayoutEffect(() => {
    object.castShadow = true;
    object.receiveShadow = true;
    const transform = new THREE.Object3D();
    placements.forEach((placement, i) => {
      transform.position.fromArray(placement.position);
      transform.rotation.set(0, placement.rotation ?? 0, 0);
      const scale = placement.scale ?? 1;
      if (typeof scale === "number") transform.scale.setScalar(scale);
      else transform.scale.fromArray(scale);
      transform.updateMatrix();
      const matrix = transform.matrix.clone().multiply(mesh.matrixWorld);
      matrices.current[i] = matrix;
      object.setMatrixAt(i, matrix);
    });
    object.instanceMatrix.needsUpdate = true;
    object.computeBoundingSphere();
  }, [object, mesh, placements]);
  useFrame(({ camera, clock }) => {
    if (!maxDistance || clock.elapsedTime < nextCull.current) return;
    nextCull.current = clock.elapsedTime + 0.3;
    const distance = maxDistance * (quality === "low" ? 0.75 : 1);
    let count = 0;
    placements.forEach((p, i) => {
      if (
        Math.hypot(
          p.position[0] - camera.position.x,
          p.position[2] - camera.position.z,
        ) < distance
      )
        object.setMatrixAt(count++, matrices.current[i]);
    });
    object.count = count;
    object.instanceMatrix.needsUpdate = true;
  });
  useEffect(
    () => () => {
      object.dispose();
    },
    [object],
  );
  return <primitive object={object} dispose={null} />;
}

export function ModelInstances({
  id,
  placements,
  materialName,
  maxDistance,
}: {
  id: string;
  placements: Placement[];
  materialName?: string;
  maxDistance?: number;
}) {
  const { scene } = useGLTF(assetUrl(id));
  const meshes = useMemo(() => {
    const source = bakedScene(scene, id, materialName);
    source.updateMatrixWorld(true);
    const result: THREE.Mesh[] = [];
    source.traverse((object) => {
      if (object instanceof THREE.Mesh) result.push(object);
    });
    return result;
  }, [scene, materialName, id]);
  return (
    <>
      {meshes.map((mesh, index) => (
        <InstanceBatch
          key={index}
          id={id}
          mesh={mesh}
          placements={placements}
          maxDistance={maxDistance}
        />
      ))}
    </>
  );
}

// The supplied character is a merged static mesh. Each disconnected authored
// part receives one rigid bone so the original geometry can use gameplay poses.
