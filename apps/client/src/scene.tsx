import { useEffect, useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  Float,
  Billboard,
  useGLTF,
  BakeShadows,
} from "@react-three/drei";
import * as THREE from "three";
import { world, useGame, controls, send } from "./network";
import { useSettings } from "./settings";
import { SkyDome, PackWorld } from "./scenery";
import { Model, CharacterModel, assetUrl, fishModelId } from "./assets";
import type { CharacterAnimator } from "./HarborCharacter";
import {
  groundHeightAt,
  waterHeightAt,
  SPAWNS,
  SPECIES,
  RODS,
  type RodId,
} from "@fishing/shared";
import { EMOTES, type AppearanceId } from "@fishing/shared";
import { emotes } from "./social-client";

import { motionPose, predictMotion, serverNow } from "./motion-client";
import { updateAudioPose, playSound } from "./audio";
import { movable, reelPosition } from "@fishing/shared";
import { IslandWater } from "./IslandWater";
const rodTips = new Map<string, THREE.Vector3>();
const renderedPositions = new Map<string, THREE.Vector3>();
const fishingAssets = [
  "fishing_bobber",
  "bobber_ripples",
  "fish_shadow_uniform",
  "bite_exclamation",
  ...SPECIES.map((species) => species.model),
  ...Object.values(RODS).map((rod) => rod.model),
].map(assetUrl);
export function Environment() {
  // Resolve scenery assets together before constructing procedural geometry.
  useGLTF(
    [
      "dock_straight_2x3m",
      "palm_tree",
      "tropical_bush",
      "rock_cluster",
      "beach_bench",
      "lighthouse",
      "wooden_crate",
      "fish_concept_01",
      "fish_concept_02",
      "fish_concept_03",
    ].map(assetUrl),
  );
  const high = useSettings((s) => s.quality === "high");
  return (
    <>
      <color attach="background" args={["#84cafa"]} />
      <fog attach="fog" args={["#afe0ed", 120, 250]} />
      <SkyDome />
      <hemisphereLight args={["#cce9ff", "#a89574", 1.05]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[-45, 90, 38]}
        intensity={3}
        color="#fff0d2"
        castShadow={high}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={0.5}
        shadow-camera-far={300}
        shadow-bias={-0.00035}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />
      <IslandWater />
      <PackWorld />
      {high && <BakeShadows />}
    </>
  );
}

function Character({ id, preview = false }: { id: string; preview?: boolean }) {
  const root = useRef<THREE.Group>(null),
    rig = useRef<THREE.Group>(null),
    leftArm = useRef<THREE.Object3D>(null),
    rightArm = useRef<THREE.Object3D>(null),
    leftLeg = useRef<THREE.Object3D>(null),
    rightLeg = useRef<THREE.Object3D>(null),
    rod = useRef<THREE.Group>(null);
  const [label, setLabel] = useState({
    name: "",
    fish: "",
    species: "",
    rodId: "wood" as RodId,
    level: 1,
    appearanceId: "sailor" as AppearanceId,
    emote: "",
  });
  const nextPosition = useMemo(() => new THREE.Vector3(), []);
  const animator = useRef<CharacterAnimator | null>(null);
  const labelTime = useRef(0);
  const soundPhase = useRef<string | undefined>(undefined);
  const remoteReelAt = useRef(0), escapeAt = useRef(0), contactShadow = useRef<THREE.Mesh>(null);
  const heldFish = useRef<THREE.Group>(null);
  const handPosition = useMemo(() => new THREE.Vector3(), []);
  const tip = useMemo(() => new THREE.Vector3(), []);
  useEffect(
    () => () => {
      rodTips.delete(id);
      renderedPositions.delete(id);
    },
    [id],
  );
  useFrame(({ clock, size }, dt) => {
    const raw = world.get(id);
    const p = raw ? motionPose(raw) : undefined;
    if (!root.current) return;
    if (!p && !preview) {
      root.current.visible = false;
      return;
    }
    root.current.visible = true;
    const t = clock.elapsedTime,
      phase = p?.phase ?? (preview ? "SHOWCASING" : "IDLE"),
      moving = p?.moving ?? false;
    if (p && id !== useGame.getState().id && soundPhase.current !== phase) {
      const sounds = { CASTING: 'cast', NIBBLING: 'nibble', BITE_WINDOW: 'bite', REELING: 'hook', RESULT: 'catch' } as const;
      const sound = sounds[phase as keyof typeof sounds];
      if (soundPhase.current && sound) playSound(sound, {x:p.bobber?.x??p.x,y:1,z:p.bobber?.z??p.z}, true);
    }
    soundPhase.current = phase;
    if(p && id !== useGame.getState().id){
      if(p.escape && p.escape.at!==escapeAt.current){escapeAt.current=p.escape.at;playSound('miss',{...p.escape.origin,y:0},true);}
      if(phase==='REELING' && t-remoteReelAt.current>.85){remoteReelAt.current=t;playSound('reel',{x:p.x,y:1,z:p.z},true);}
    }
    nextPosition.set(
      p?.x ?? (size.width < size.height ? 1.1 : 4.3),
      p ? p.y : groundHeightAt({ x: 4.3, z: 4 }),
      p?.z ?? 4,
    );
    root.current.position.copy(nextPosition);
    if(contactShadow.current && p){contactShadow.current.position.y=(groundHeightAt(p)-p.y)/.672+.04;contactShadow.current.scale.setScalar(1-Math.min(.3,Math.max(0,p.y-groundHeightAt(p))*.2));}
    renderedPositions.set(id, root.current.position);
    const target = p?.yaw ?? 0.3;
    root.current.rotation.y +=
      Math.atan2(
        Math.sin(target - root.current.rotation.y),
        Math.cos(target - root.current.rotation.y),
      ) *
      (1 - Math.exp(-dt * 14));
    if (rig.current)
      rig.current.position.y = moving ? 0 : Math.sin(t * 2) * 0.008;
    const casting = !["IDLE", "RESULT", "SHOWCASING"].includes(phase);
    const emote = emotes.get(id),
      activeEmote =
        phase === "IDLE" &&
        emote &&
        emote.until > Date.now() &&
        !useSettings.getState().reducedMotion
          ? emote.id
          : "";
    animator.current?.update(
      dt,
      phase,
      moving,
      p?.running ?? false,
      p ? !p.grounded : false,
    );
    if (!moving && activeEmote) {
      if (rightArm.current)
        rightArm.current.rotation.x =
          activeEmote === "wave"
            ? -2.4 + Math.sin(t * 12) * 0.25
            : activeEmote === "clap"
              ? -1.1 + Math.sin(t * 15) * 0.15
              : -0.6;
      if (leftArm.current && activeEmote === "clap")
        leftArm.current.rotation.x = -1.1 - Math.sin(t * 15) * 0.15;
      if (rig.current && activeEmote === "happy")
        rig.current.position.y = Math.abs(Math.sin(t * 6)) * 0.16;
    }
    if (rod.current) {
      rod.current.visible = true;
      rod.current.rotation.x = casting ? 1.7 : 1.25;
      rod.current.updateWorldMatrix(true, false);
      rod.current.localToWorld(tip.set(0.08, 2.02, 0));
      rodTips.set(id, tip);
    }
    if (
      (preview || p?.phase === "SHOWCASING") &&
      heldFish.current &&
      leftArm.current
    ) {
      leftArm.current.updateWorldMatrix(true, false);
      leftArm.current.localToWorld(handPosition.set(-0.12, -0.38, 0.04));
      root.current.worldToLocal(handPosition);
      heldFish.current.position.copy(handPosition);
    }
    if (t - labelTime.current > 0.15) {
      labelTime.current = t;
      const name = p?.name ?? "",
        fish =
          p?.showcase &&
          (p.id === useGame.getState().id ||
            useSettings.getState().showOtherCatches)
            ? `Tôi câu được ${p.showcase.species}, nặng ${(p.showcase.grams / 1000).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg nè!`
            : "";
      setLabel((prev) =>
        prev.name === name &&
        prev.fish === fish &&
        prev.rodId === (p?.rodId ?? "wood") &&
        prev.level === (p?.level ?? 1) &&
        prev.appearanceId ===
          (p?.appearanceId ??
            useGame.getState().profile?.appearanceId ??
            "sailor") &&
        prev.emote ===
          (phase === "IDLE" && emote && emote.until > Date.now()
            ? EMOTES[emote.id].emoji
            : "")
          ? prev
          : {
              name,
              fish,
              species: p?.showcase?.species ?? "",
              rodId: p?.rodId ?? "wood",
              level: p?.level ?? 1,
              appearanceId:
                p?.appearanceId ??
                useGame.getState().profile?.appearanceId ??
                "sailor",
              emote:
                phase === "IDLE" && emote && emote.until > Date.now()
                  ? EMOTES[emote.id].emoji
                  : "",
            },
      );
    }
  }, -1);
  return (
    <group ref={root} position={[4.3, 0.72, 4]} scale={preview ? 1.45 : 0.672}>
      <mesh ref={contactShadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial
          color="#65412d"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <group ref={rig}>
        <CharacterModel
          animator={animator}
          leftArm={leftArm}
          rightArm={rightArm}
          leftLeg={leftLeg}
          rightLeg={rightLeg}
          rod={rod}
          rodId={label.rodId}
          appearanceId={label.appearanceId}
        />
      </group>
      {(preview || label.fish) && (
        <group ref={heldFish}>
          <group
            position={[0, -0.45, 0]}
            rotation={[0, 0, Math.PI / 2]}
            scale={0.85}
          >
            <FishModel species={label.species} />
          </group>
        </group>
      )}
      {label.name && (
        <Html
          position={[0, 3.45, 0]}
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="nameplate">
            <i>{label.level}</i>
            {label.name}
          </div>
        </Html>
      )}
      {label.fish && (
        <>
          <Html position={[0, 4.4, 0]} center zIndexRange={[5, 0]}>
            <div className="showcase">{label.fish}</div>
          </Html>
        </>
      )}
      {label.emote && (
        <Html
          position={[0, 4.25, 0]}
          center
          zIndexRange={[6, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="emote-bubble"
            role="img"
            aria-label={`Biểu cảm ${label.name}`}
          >
            {label.emote}
          </div>
        </Html>
      )}
    </group>
  );
}
function FishModel({ species }: { species?: string }) {
  return (
    <Model id={fishModelId(species)} scale={1.1} rotation={[0, 0, -0.2]} />
  );
}
function Bobber({ id }: { id: string }) {
  useGLTF(assetUrl("bite_exclamation"));
  const group = useRef<THREE.Group>(null),
    float = useRef<THREE.Group>(null),
    shadow = useRef<THREE.Group>(null),
    ring = useRef<THREE.Group>(null),
    line = useRef<THREE.Line>(null);
  const [bite, setBite] = useState(false);
  const bang = useRef<THREE.Group>(null);
  const lineObj = useMemo(
    () =>
      new THREE.Line(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(17 * 3), 3),
        ),
        new THREE.LineBasicMaterial({
          color: "#edf7e7",
          transparent: true,
          opacity: 0.7,
        }),
      ),
    [],
  );
  useFrame(({ clock, camera }) => {
    const p = world.get(id);
    if (!group.current) return;
    const phase = p?.phase ?? "IDLE";
    const escaping = p?.escape && serverNow() - p.escape.at < 900;
    group.current.visible =
      !!p &&
      (!["IDLE", "RESULT", "CASTING", "SHOWCASING"].includes(phase) ||
        !!escaping);
    if (!p) return;
    const t = clock.elapsedTime;
    let position = p.reel ? reelPosition(p.reel, serverNow()) : p.bobber;
    if (escaping && p.escape) {
      const elapsed = (serverNow() - p.escape.at) / 900,
        dx = position.x - p.x,
        dz = position.z - p.z,
        d = Math.max(1, Math.hypot(dx, dz));
      position = {
        x: position.x + (dx / d) * elapsed * 2,
        z: position.z + (dz / d) * elapsed * 2,
      };
    }
    group.current.position.set(position.x, waterHeightAt(position), position.z);
    if (float.current) float.current.visible = phase !== "REELING" && !escaping;

    if (float.current)
      float.current.position.y =
        phase === "BITE_WINDOW"
          ? -0.6
          : phase === "REELING"
            ? 0.2
            : Math.sin(t * (phase === "NIBBLING" ? 24 : 2)) *
              (phase === "NIBBLING" ? 0.12 : 0.025);
    if (shadow.current) {
      shadow.current.visible =
        ["APPROACHING", "NIBBLING", "REELING"].includes(phase) || !!escaping;
      shadow.current.scale.setScalar(
        (p.shadowScale ?? 1) *
          (escaping
            ? Math.max(0.05, 1 - (serverNow() - p.escape!.at) / 900)
            : 1),
      );
      shadow.current.position.x = Math.sin(t * 1.5) * 0.7;
      shadow.current.position.z = Math.cos(t * 1.5) * 0.7;
    }
    if (ring.current) {
      const s = 1 + (t % 1.5) * 0.7;
      ring.current.scale.setScalar(s);
    }
    const pos = lineObj.geometry.attributes.position;
    const tip = rodTips.get(id);
    const start = tip ?? new THREE.Vector3(p.x, p.y + 2, p.z);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16,
        sag = Math.sin(u * Math.PI) * (phase === "REELING" ? 0.06 : 0.26);
      pos.setXYZ(
        i,
        (start.x - group.current.position.x) * (1 - u),
        (start.y - group.current.position.y) * (1 - u) + 0.15 * u - sag,
        (start.z - group.current.position.z) * (1 - u),
      );
    }
    if (bang.current)
      bang.current.scale.setScalar(
        camera.position.distanceTo(group.current.position) * 0.1,
      );

    pos.needsUpdate = true;
    lineObj.geometry.computeBoundingSphere();
    setBite((prev) =>
      prev === (phase === "BITE_WINDOW") ? prev : phase === "BITE_WINDOW",
    );
  });
  return (
    <group ref={group}>
      <group ref={float}>
        <Model id="fishing_bobber" scale={1.3} />
      </group>
      <group ref={ring} position={[0, 0.025, 0]}>
        <Model id="bobber_ripples" />
      </group>
      <group ref={shadow} position={[0, 0.015, 0]}>
        <Model id="fish_shadow_uniform" scale={1} />
      </group>
      <primitive object={lineObj} ref={line} />
      {bite && (
        <group ref={bang} position={[0, 0.75, 0]}>
          <Billboard>
            <Model id="bite_exclamation" position={[0, -0.3, 0]} />
          </Billboard>
        </group>
      )}
    </group>
  );
}
function MotionDriver() {
  const sequence = useRef(0),
    sent = useRef(0),
    id = useGame((s) => s.id);
  useEffect(() => {
    sequence.current = 0;
    sent.current = 0;
  }, [id]);
  useFrame(({ clock }, dt) => {
    const state = useGame.getState(),
      p = world.get(state.id);
    if (!p) return;
    let x =
      controls.x +
      Number(controls.keys.has("KeyD") || controls.keys.has("ArrowRight")) -
      Number(controls.keys.has("KeyA") || controls.keys.has("ArrowLeft"));
    let z =
      controls.z +
      Number(controls.keys.has("KeyS") || controls.keys.has("ArrowDown")) -
      Number(controls.keys.has("KeyW") || controls.keys.has("ArrowUp"));
    const len = Math.max(1, Math.hypot(x, z));
    x /= len;
    z /= len;
    const input = {
      x: movable(state.phase)
        ? x * Math.cos(controls.yaw) + z * Math.sin(controls.yaw)
        : 0,
      z: movable(state.phase)
        ? -x * Math.sin(controls.yaw) + z * Math.cos(controls.yaw)
        : 0,
      sprint:
        controls.sprint ||
        controls.keys.has("ShiftLeft") ||
        controls.keys.has("ShiftRight"),
    };
    predictMotion(Math.min(0.1, dt), input);
    if (clock.elapsedTime - sent.current >= 0.05 && state.connected) {
      sent.current = clock.elapsedTime;
      send("PLAYER_INPUT", { ...input, seq: ++sequence.current });
    }
  }, -3);
  return null;
}
function Camera() {
  const anchor = useMemo(() => new THREE.Vector3(0, 0.72, 2), []),
    orbit = useMemo(() => new THREE.Vector3(10, 7, 12), []),
    look = useMemo(() => new THREE.Vector3(-1.2, 1.5, -1.8), []),
    desired = useMemo(() => new THREE.Vector3(), []),
    direction = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    const state = useGame.getState(),
      p = world.get(state.id),
      position = renderedPositions.get(state.id) ?? p;
    const x = position?.x ?? 0,
      z = position?.z ?? SPAWNS.beach.z;
    desired.set(x, groundHeightAt({ x, z }), z);
    if (Math.hypot(anchor.x - x, anchor.z - z) > 8) anchor.copy(desired);
    else anchor.lerp(desired, 1 - Math.exp(-Math.min(0.1, dt) * 20));
    const fishing = [
        "CASTING",
        "WAITING",
        "APPROACHING",
        "NIBBLING",
        "BITE_WINDOW",
        "REELING",
      ].includes(state.phase),
      distance = fishing && !useSettings.getState().reducedMotion ? 12 : 14.8;
    desired.set(
      Math.sin(controls.yaw) * Math.cos(controls.pitch) * distance,
      1.5 + Math.sin(controls.pitch) * distance,
      Math.cos(controls.yaw) * Math.cos(controls.pitch) * distance,
    );
    orbit.lerp(desired, 1 - Math.exp(-Math.min(0.1, dt) * 10));
    camera.position.copy(anchor).add(orbit);
    const bobber = p?.reel ? reelPosition(p.reel, serverNow()) : p?.bobber;
    desired.set(
      fishing && bobber ? (bobber.x - x) / 2 : -1.2,
      1.35,
      fishing && bobber ? (bobber.z - z) / 2 : -1.8,
    );
    look.lerp(desired, 1 - Math.exp(-Math.min(0.1, dt) * 10));
    camera.lookAt(anchor.x + look.x, anchor.y + look.y, anchor.z + look.z);
    camera.getWorldDirection(direction);
    updateAudioPose(
      camera.position,
      direction,
      p ? { x, y: p.y + 1, z } : undefined,
      bobber ? { ...bobber, y: waterHeightAt(bobber) } : undefined,
    );
  });
  return null;
}
function RenderLoop() {
  const advance = useThree((s) => s.advance),
    clock = useThree((s) => s.clock),
    fps = useSettings((s) => s.fps);
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      rendered = last,
      accumulator = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      accumulator += Math.min(100, now - last);
      last = now;
      if (accumulator + 0.2 < 1000 / fps) return;
      accumulator %= 1000 / fps;
      const delta = Math.min(0.1, (now - rendered) / 1000);
      rendered = now;
      advance(clock.elapsedTime + delta, true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [advance, clock, fps]);
  return null;
}
export function Scene() {
  useGLTF(fishingAssets);
  const count = useGame((s) => s.count),
    id = useGame((s) => s.id);
  const ids = Array.from(world.keys());
  return (
    <>
      <RenderLoop />
      <MotionDriver />
      <Environment />
      <Camera />
      {!id && <Character id="preview" preview />}
      {ids.map((key) => (
        <group key={key}>
          <Character id={key} />
          <Bobber id={key} />
        </group>
      ))}
    </>
  );
}
