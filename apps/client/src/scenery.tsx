import { useMemo, useEffect } from "react";
import * as T from "three";
import {
  ISLAND_OUTLINE,
  WORLD_SCALE,
  worldPoint,
  PALM_POSITIONS,
  ROCK_OUTCROPS,
  HOUSE_POSITIONS,
  MARKET_POSITIONS,
  LIGHTHOUSE,
  inPond,
  onIsland,
  landHeightAt,
  shoreDistance,
} from "@fishing/shared";
import { Model, ModelInstances, type Placement } from "./assets";
import {
  terrainGeometry,
  coastGeometry,
  pathGeometry,
  pavingTexture,
  plazaGeometry,
} from "./island-geometry";
import { IslandDecor } from "./IslandDecor";
import { TropicalDetails } from "./TropicalDetails";
import { Grounding } from "./Grounding";
export function SkyDome() {
  return (
    <mesh>
      <sphereGeometry args={[180, 32, 20]} />
      <shaderMaterial
        side={T.BackSide}
        depthWrite={false}
        vertexShader={`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec3 p;void main(){float h=clamp(normalize(p).y*2.,0.,1.);gl_FragColor=vec4(mix(vec3(.69,.88,1.),vec3(.16,.49,.90),pow(h,.65)),1.);}`}
      />
    </mesh>
  );
}
const palms: Placement[] = PALM_POSITIONS.map(({ x, z }, i) => ({
  position: [x, landHeightAt({ x, z }), z],
  rotation: i * 2.4,
  scale: 2.4 + (i % 4) * 0.23,
}));
const bushes: Placement[] = Array.from({ length: 320 }, (_, i) => {
  const a = i * 2.399,
    r = Math.sqrt((i + 0.5) / 320),
    x = -2 + Math.cos(a) * 39 * r,
    z = -38 + Math.sin(a) * 29 * r;
  return { ...worldPoint({ x, z }), i };
})
  .filter(
    (p) =>
      onIsland(p) &&
      shoreDistance(p) > 1.4 &&
      !inPond(p, 2) &&
      ![...HOUSE_POSITIONS, ...MARKET_POSITIONS].some(
        (h) => Math.hypot(p.x - h.x, p.z - h.z) < 3.5,
      ) &&
      !(p.x > -27 && p.x < 9 && p.z > -63 && p.z < -33),
  )
  .map(({ x, z, i }) => ({
    position: [x, landHeightAt({ x, z }), z],
    rotation: i,
    scale: (z < -66 ? 2.2 : 1.1) + (i % 4) * 0.3,
  }));
const rocks: Placement[] = ISLAND_OUTLINE.filter(
  (p, i) => i % 3 === 0 && !(p.z > -34.5 && p.x < 0),
).map((p, i) => ({
  position: [p.x, landHeightAt(p) - 1, p.z],
  rotation: i * 1.7,
  scale: [1.2 + (i % 3) * 0.5, 1.2 + (i % 4) * 0.35, 1.2 + (i % 3) * 0.5],
}));
rocks.push(
  ...ROCK_OUTCROPS.map(({ x, z }, i) => ({
    position: [x, landHeightAt({ x, z }) - 0.7, z] as [number, number, number],
    scale: [3.5, 5.5 + (i % 3), 3.2] as [number, number, number],
    rotation: i,
  })),
);
const dock: Placement[] = [];
for (let x = -23; x < 12; x += 2)
  for (const z of [1.91, 3.91])
    dock.push({ position: [x, 0.66, z], scale: [1, 1, 2 / 2.98] });
for (let z = -24.135; z < 0; z += 3)
  for (const x of [-23, -21]) dock.push({ position: [x, 0.66, z] });
const benches: Placement[] = [
  [-19, -30],
  [-1, -31],
  [15, -23],
  [31, -31],
  [-27, -43],
].map(([bx, bz], i) => {
  const { x, z } = worldPoint({ x: bx, z: bz });
  return {
    position: [x, landHeightAt({ x, z }), z],
    rotation: i % 2 ? Math.PI / 2 : 0,
    scale: 1.2,
  };
});
const broadTrees: Placement[] = [
  [-32, -33],
  [-28, -38],
  [-19, -48],
  [-8, -54],
  [0, -60],
  [18, -51],
  [29, -45],
  [32, -24],
  [8, -47],
  [-30, -27],
].map(([bx, bz], i) => {
  const { x, z } = worldPoint({ x: bx, z: bz });
  return {
    position: [x, landHeightAt({ x, z }) + 2.7, z],
    scale: [2.1, 2.7, 2.1],
    rotation: i,
  };
});
let cachedWorld:
  | {
      terrain: T.BufferGeometry;
      coast: T.BufferGeometry;
      paths: T.BufferGeometry;
      edges: T.BufferGeometry;
      paving: T.CanvasTexture;
      plaza: T.BufferGeometry;
    }
  | undefined;
export function PackWorld() {
  const data = useMemo(
    () =>
      (cachedWorld ??= {
        terrain: terrainGeometry(),
        coast: coastGeometry(),
        paths: pathGeometry(2.4, 0.045),
        edges: pathGeometry(2.8, 0.025),
        paving: pavingTexture(),
        plaza: plazaGeometry(),
      }),
    [],
  );
  useEffect(
    () => () => {
      data.terrain.dispose();
      data.coast.dispose();
      data.paths.dispose();
      data.edges.dispose();
      data.paving.dispose();
      data.plaza.dispose();
      if (cachedWorld === data) cachedWorld = undefined;
    },
    [data],
  );
  return (
    <>
      <mesh geometry={data.terrain} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.96}
          side={T.DoubleSide}
        />
      </mesh>
      <mesh geometry={data.coast} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} side={T.DoubleSide} />
      </mesh>
      <mesh geometry={data.edges} receiveShadow>
        <meshStandardMaterial color="#c1ad8e" roughness={1} />
      </mesh>
      <mesh geometry={data.paths} receiveShadow>
        <meshStandardMaterial map={data.paving} color="#f7e5c5" roughness={1} />
      </mesh>
      <mesh geometry={data.plaza} receiveShadow>
        <meshStandardMaterial map={data.paving} color="#f0dfc1" roughness={1} />
      </mesh>
      <Grounding />
      <IslandDecor />
      <ModelInstances id="dock_straight_2x3m" placements={dock} />
      <ModelInstances id="palm_tree" placements={palms} />
      <ModelInstances id="tropical_bush" placements={bushes} maxDistance={75} />
      <ModelInstances
        id="tropical_bush"
        placements={broadTrees}
        maxDistance={95}
      />
      {broadTrees.map(({ position }, i) => (
        <mesh
          key={i}
          position={[position[0], position[1] - 1.5, position[2]]}
          castShadow
        >
          <cylinderGeometry args={[0.18, 0.32, 3, 7]} />
          <meshStandardMaterial color="#a58357" />
        </mesh>
      ))}
      <ModelInstances id="rock_cluster" placements={rocks} />
      <ModelInstances id="beach_bench" placements={benches} />
      <Model
        id="lighthouse"
        position={[LIGHTHOUSE.x, landHeightAt(LIGHTHOUSE), LIGHTHOUSE.z]}
        scale={1.75}
      />
      <ModelInstances
        id="wooden_crate"
        placements={[
          { position: [-23, 0.73, 2], scale: 0.8 },
          { position: [-22, 0.73, 2.6], scale: 0.6 },
          {
            position: [-7.5, landHeightAt({ x: -7.5, z: -36 }), -36],
            scale: 0.7,
          },
        ]}
      />
      <TropicalDetails />
      {[0, 1, 2].map((n) => (
        <ModelInstances
          key={n}
          id={`fish_concept_0${n + 1}`}
          placements={Array.from({ length: 5 }, (_, i) => ({
            position: [
              (-8 + i * 3 + n) * WORLD_SCALE,
              -1.2 - n * 0.35,
              (7 + n * 3) * WORLD_SCALE,
            ],
            rotation: 1.1,
            scale: 0.55,
          }))}
        />
      ))}
      {[-65, -28, 15, 55].map((x, i) => (
        <group
          key={x}
          position={[x * WORLD_SCALE, 18 + (i % 2) * 5, -85 * WORLD_SCALE]}
        >
          {[0, 1, 2, 3].map((n) => (
            <mesh
              key={n}
              position={[n * 2, Math.sin(n) * 1.1, 0]}
              scale={[3.5, 1.6 + (n % 2), 2]}
            >
              <sphereGeometry args={[1, 16, 10]} />
              <meshStandardMaterial color="#fff9ed" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[43 * WORLD_SCALE, 0, -8 * WORLD_SCALE]}>
        <mesh scale={[1, 0.35, 0.4]}>
          <sphereGeometry args={[2.5, 20, 10]} />
          <meshStandardMaterial color="#b9774d" />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 6, 8]} />
          <meshStandardMaterial color="#f4deb3" />
        </mesh>
        <mesh position={[1, 3.4, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([0, 2, 0, 0, -2, 0, 2, -2, 0]), 3]}
            />
          </bufferGeometry>
          <meshBasicMaterial color="#fff9e6" side={T.DoubleSide} />
        </mesh>
      </group>
    </>
  );
}
