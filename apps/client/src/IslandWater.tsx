import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import {
  waterAt,
  shoreDistance,
  waterHeightAt,
  POND_CENTER,
  POND_RADII,
  WORLD_SCALE,
  ISLAND_OUTLINE,
  landHeightAt,
  onIsland,
} from "@fishing/shared";
import { useSettings } from "./settings";
const SIZE = 320,
  RES = 512;
function depthAt(x: number, z: number) {
  const kind = waterAt({ x, z });
  if (kind === "village")
    return (
      0.55 +
      1.4 *
        Math.max(
          0,
          1 -
            Math.hypot(
              (x - POND_CENTER.x) / POND_RADII.x,
              (z - POND_CENTER.z) / POND_RADII.z,
            ),
        )
    );
  const d = shoreDistance({ x, z }) / WORLD_SCALE;
  const bay = Math.exp(
    -(
      (x / (38 * WORLD_SCALE)) ** 4 +
      ((z - 2 * WORLD_SCALE) / (22 * WORLD_SCALE)) ** 4
    ),
  );
  return (
    Math.min(13, 0.35 + d * 0.42) * (1 - bay * 0.7) +
    Math.sin(x * 0.38 + z * 0.16) * 0.12
  );
}
function createWaterData() {
  const pixels = new Uint8Array(RES * RES * 4);
  for (let j = 0; j < RES; j++)
    for (let i = 0; i < RES; i++) {
      const x = (i / (RES - 1) - 0.5) * SIZE,
        z = (j / (RES - 1) - 0.5) * SIZE,
        p = { x, z },
        kind = waterAt(p),
        index = (j * RES + i) * 4;
      const distance =
        kind === "village"
          ? Math.abs(
              1 -
                Math.hypot(
                  (x - POND_CENTER.x) / POND_RADII.x,
                  (z - POND_CENTER.z) / POND_RADII.z,
                ),
            ) * 7
          : shoreDistance(p);
      pixels[index] = Math.round((Math.max(0.2, depthAt(x, z)) / 14) * 255);
      pixels[index + 1] = kind === "village" ? 255 : 0;
      pixels[index + 2] = kind ? 255 : 0;
      pixels[index + 3] = Math.round(Math.min(1, distance / 20) * 255);
    }
  const map = new T.DataTexture(pixels, RES, RES, T.RGBAFormat);
  map.magFilter = map.minFilter = T.LinearFilter;
  map.needsUpdate = true;
  const floor = new T.PlaneGeometry(SIZE, SIZE, 160, 160);
  floor.rotateX(-Math.PI / 2);
  const positions = floor.getAttribute("position"),
    colors: number[] = [],
    c = new T.Color(),
    sand = new T.Color("#92cbc3"),
    deep = new T.Color("#237b9e");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      d = depthAt(x, z);
    positions.setY(i, waterHeightAt({ x, z }) - d - 0.05);
    c.copy(sand)
      .lerp(deep, Math.min(1, d / 12))
      .multiplyScalar(0.94 + Math.sin(x * 0.8 + Math.sin(z)) * 0.045);
    colors.push(c.r, c.g, c.b);
  }
  floor.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  floor.computeVertexNormals();
  const outer = new T.Shape();
  outer.moveTo(-500, -500);
  outer.lineTo(500, -500);
  outer.lineTo(500, 500);
  outer.lineTo(-500, 500);
  outer.closePath();
  const hole = new T.Path();
  hole.moveTo(-150, -150);
  hole.lineTo(-150, 150);
  hole.lineTo(150, 150);
  hole.lineTo(150, -150);
  hole.closePath();
  outer.holes.push(hole);
  const horizon = new T.ShapeGeometry(outer);
  const coords: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  ISLAND_OUTLINE.forEach((p, i) => {
    const before =
        ISLAND_OUTLINE[(i + ISLAND_OUTLINE.length - 1) % ISLAND_OUTLINE.length],
      after = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length];
    const tangent = new T.Vector2(
      after.x - before.x,
      after.z - before.z,
    ).normalize();
    const inward = new T.Vector2(-tangent.y, tangent.x);
    if (!onIsland({ x: p.x + inward.x * 0.3, z: p.z + inward.y * 0.3 }))
      inward.multiplyScalar(-1);
    const amounts = [-1.4, -0.5, 0, 0.6, 1.2, 2];
    for (const [j, amount] of amounts.entries()) {
      const x = p.x + inward.x * amount,
        z = p.z + inward.y * amount;
      coords.push(
        x,
        amount < 0
          ? 0.04 + (0.21 * (amount + 1.4)) / 1.4
          : landHeightAt({ x, z }) + 0.045,
        z,
      );
      uv.push(i / ISLAND_OUTLINE.length, j / (amounts.length - 1));
    }
    const n = i * amounts.length,
      next = ((i + 1) % ISLAND_OUTLINE.length) * amounts.length;
    for (let j = 0; j < amounts.length - 1; j++)
      indices.push(
        n + j,
        next + j,
        n + j + 1,
        n + j + 1,
        next + j,
        next + j + 1,
      );
  });
  const wash = new T.BufferGeometry();
  wash.setAttribute("position", new T.Float32BufferAttribute(coords, 3));
  wash.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  wash.setIndex(indices);
  wash.computeVertexNormals();
  return { map, floor, horizon, wash };
}
// Suspense can retry the initial scene while GLBs load. Keep one pending set of
// procedural buffers instead of rebuilding the depth field on every retry.
let cachedWater: ReturnType<typeof createWaterData> | undefined;
function waterData() {
  return (cachedWater ??= createWaterData());
}
const vertex = `
uniform sampler2D geography;uniform float time;varying vec3 world;varying vec3 normalWave;varying vec4 water;
void main(){
 vec3 p=vec3(position.x,0.,-position.y);vec2 uv=p.xz/320.+.5;water=texture2D(geography,uv);
 float lake=water.g;float amp=mix(1.,.35,lake);
 float a=p.x*.6+p.z*.34+time*1.15,b=p.x*-.38+p.z*.8+time*.83,c=p.x*1.7-p.z*.9-time*1.65;
 p.y=lake*.48+amp*(sin(a)*.055+sin(b)*.035+sin(c)*.012);
 normalWave=normalize(vec3(-amp*(cos(a)*.033-cos(b)*.0133+cos(c)*.0204),1.,-amp*(cos(a)*.0187+cos(b)*.028-cos(c)*.0108)));
 world=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const fragment = `
uniform float time;uniform float detail;uniform sampler2D geography;varying vec3 world;varying vec3 normalWave;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec4 water=texture2D(geography,world.xz/320.+.5);
 if(water.b<.5)discard;
 float depth=water.r*14.,shore=water.a*20.;vec2 p=world.xz;
 vec3 view=normalize(cameraPosition-world),n=normalize(normalWave);
 float fresnel=pow(1.-max(0.,dot(view,n)),4.);
 vec3 shallow=mix(vec3(.025,.62,.76),vec3(.055,.56,.59),water.g),deep=vec3(.015,.32,.54);
 vec3 color=mix(shallow,deep,smoothstep(1.5,13.,depth));
 float caustics=pow(1.-abs(sin(p.x*1.7+sin(p.y*1.2+time*.8)) * sin(p.y*1.8+cos(p.x*1.3-time*.6))),18.);
 color+=vec3(.21,.30,.18)*caustics*.16*detail*(1.-smoothstep(2.,6.,depth));
 float drift=noise(p*.6+vec2(time*.08,-time*.06));
 float phase=time*.22+noise(p*.045)*.10;
 float foamBand=0.;
 for(int i=0;i<3;i++){float age=fract(phase+float(i)/3.);float front=(1.-age)*5.;foamBand=max(foamBand,(1.-smoothstep(.04,.35,abs(shore-front)))*smoothstep(.0,.15,age)*(1.-smoothstep(.86,1.,age)));}
 float foam=foamBand*mix(.5,1.,smoothstep(.18,.72,drift))*.94*mix(1.,.16,water.g);
 float sun=pow(max(0.,dot(reflect(-normalize(vec3(-.35,.8,.45)),n),view)),160.);
 color=mix(color,vec3(.60,.83,.96),fresnel*.28)+sun*vec3(1.,.9,.64)*.7;
 float sparkle=pow(max(0.,sin(p.x*5.3+sin(p.y*4.7-time*1.3))*sin(p.y*6.8+time*.7)),28.);
 color+=vec3(.65,.85,.86)*sparkle*.14*detail;
 color=mix(color,vec3(.90,.98,.91),foam);
 float alpha=clamp(.35+depth*.042+fresnel*.28+foam*.5,.35,.94);
 alpha=mix(alpha,1.,smoothstep(9.,13.,depth));
 gl_FragColor=vec4(color,alpha);
}`;
export function IslandWater() {
  const data = useMemo(waterData, []),
    mat = useRef<T.ShaderMaterial>(null),
    quality = useSettings((s) => s.quality);
  const uniforms = useMemo(
    () => ({
      geography: { value: data.map },
      time: { value: 0 },
      detail: { value: 1 },
    }),
    [data],
  );
  uniforms.detail.value = quality === "high" ? 1 : 0;
  useFrame(({ clock }) => {
    uniforms.time.value = clock.elapsedTime;
  });
  useEffect(
    () => () => {
      data.map.dispose();
      data.floor.dispose();
      data.horizon.dispose();
      data.wash.dispose();
      if (cachedWater === data) cachedWater = undefined;
    },
    [data],
  );
  return (
    <>
      <mesh geometry={data.horizon} renderOrder={2}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthWrite={false}
          side={T.DoubleSide}
        />
      </mesh>
      <mesh geometry={data.floor} receiveShadow>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <mesh renderOrder={2}>
        <planeGeometry
          args={[
            SIZE,
            SIZE,
            quality === "high" ? 192 : 96,
            quality === "high" ? 192 : 96,
          ]}
        />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthWrite={false}
          side={T.DoubleSide}
        />
      </mesh>
      <mesh geometry={data.wash} renderOrder={3}>
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={T.DoubleSide}
          vertexShader={
            "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          }
          fragmentShader={
            "uniform float time;varying vec2 vUv;void main(){float phase=time*.95-vUv.x*5.;float tide=.5+.5*sin(phase);float edge=.18+tide*.68;float band=1.-smoothstep(.012,.07,abs(vUv.y-edge));float wet=(1.-smoothstep(.65,.98,vUv.y))*.18;float sheet=(1.-smoothstep(edge,edge+.06,vUv.y))*.26;float breakup=.78+.22*sin(vUv.x*360.+time*2.);float fade=smoothstep(0.,.07,vUv.y)*(1.-smoothstep(.91,1.,vUv.y));gl_FragColor=vec4(mix(vec3(.17,.53,.57),vec3(.94,.99,.95),band),max(wet,max(sheet,band*.72*breakup))*fade);}"
          }
        />
      </mesh>
    </>
  );
}
