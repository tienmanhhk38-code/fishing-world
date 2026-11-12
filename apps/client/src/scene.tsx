import { fishWriggle } from "./fish-animation";
import { formatFishWeight } from "@fishing/shared";
import {
  createFishShadowGeometry,
  deformFishShadow,
  shadowMouthOffset,
} from "./fish-shadow";
import { overheadVisible } from "@fishing/shared";
import { NpcModel } from "./NpcModel";
import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  Float,
  Billboard,
  useGLTF,
  BakeShadows,
} from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
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
import { emotes, speech } from "./social-client";
import {
  NPCS,
  within,
  INTERACTION_RADIUS,
  floatPresentation,
  fishLength,
  speciesFor,
  isLargeFish,
  waterAt,
  onPlatform,
} from "@fishing/shared";

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
    startedAt: 0,
    animationSeed: 0,
    rodId: "wood" as RodId,
    level: 1,
    appearanceId: "sailor" as AppearanceId,
    emote: "",
    grams: 1000,
    chat: "",
    bite: false,
    kind: "player",
    interact: false,
  });
  const nextPosition = useMemo(() => new THREE.Vector3(), []);
  const animator = useRef<CharacterAnimator | null>(null);
  const labelTime = useRef(0);
  const soundPhase = useRef<string | undefined>(undefined);
  const remoteReelAt = useRef(0),
    escapeAt = useRef(0),
    contactShadow = useRef<THREE.Mesh>(null);
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
      const sounds = {
        CASTING: "cast",
        BITE_WINDOW: "bite",
        REELING: "hook",
        RESULT: "catch",
      } as const;
      const sound = sounds[phase as keyof typeof sounds];
      if (soundPhase.current && sound)
        playSound(
          sound,
          { x: p.bobber?.x ?? p.x, y: 1, z: p.bobber?.z ?? p.z },
          true,
        );
    }
    soundPhase.current = phase;
    if (p && id !== useGame.getState().id) {
      if (p.escape && p.escape.at !== escapeAt.current) {
        escapeAt.current = p.escape.at;
        playSound("line-break", { ...p.escape.origin, y: 0 }, true);
      }
      if (phase === "REELING" && t - remoteReelAt.current > 1.05) {
        remoteReelAt.current = t;
        playSound("reel", { x: p.x, y: 1, z: p.z }, true);
      }
    }
    nextPosition.set(
      p?.x ?? (size.width < size.height ? 1.1 : 4.3),
      p ? p.y : groundHeightAt({ x: 4.3, z: 4 }),
      p?.z ?? 4,
    );
    root.current.position.copy(nextPosition);
    if (contactShadow.current && p) {
      contactShadow.current.position.y =
        (groundHeightAt(p) - p.y) / 0.672 + 0.04;
      contactShadow.current.scale.setScalar(
        1 - Math.min(0.3, Math.max(0, p.y - groundHeightAt(p)) * 0.2),
      );
    }
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
    const emote =
        emotes.get(id) ??
        (p?.emote ? { id: p.emote, until: Date.now() + 1000 } : undefined),
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
    const large =
      phase === "SHOWCASING" && isLargeFish(p?.showcase?.grams ?? 0);
    if (leftArm.current) leftArm.current.position.y = large ? 1.3 : 1;
    if (rightArm.current) rightArm.current.position.y = large ? 1.3 : 1;
    if (large) {
      if (leftArm.current) leftArm.current.rotation.set(-2.92, 0, -0.26);
      if (rightArm.current) rightArm.current.rotation.set(-2.92, 0, 0.26);
    }
    const escaped = p?.escape && serverNow() - p.escape.at < 450;
    if (escaped && rightArm.current)
      rightArm.current.rotation.x =
        -1.8 + Math.min(1, (serverNow() - p!.escape!.at) / 450) * 0.9;
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
      rod.current.visible = !large && p?.kind !== "npc";
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
      if (large && rightArm.current) {
        leftArm.current.updateWorldMatrix(true, false);
        rightArm.current.updateWorldMatrix(true, false);
        leftArm.current.localToWorld(handPosition.set(-0.12, -0.38, 0.04));
        rightArm.current.localToWorld(tip.set(0.12, -0.38, 0.04));
        handPosition.add(tip).multiplyScalar(0.5);
        root.current.worldToLocal(handPosition);
        handPosition.y +=
          heldFish.current.getObjectByName("carried-fish")?.userData
            .halfHeight ?? 0.5;
        heldFish.current.position.copy(handPosition);
      } else {
        leftArm.current.updateWorldMatrix(true, false);
        leftArm.current.localToWorld(handPosition.set(-0.12, -0.38, 0.04));
        root.current.worldToLocal(handPosition);
        heldFish.current.position.copy(handPosition);
      }
    }
    if (t - labelTime.current > 0.15) {
      labelTime.current = t;
      const self = world.get(useGame.getState().id);
      const visible = !!p && overheadVisible(p, self);
      const emoteText =
        visible && phase === "IDLE" && emote && emote.until > Date.now()
          ? EMOTES[emote.id].emoji
          : "";
      const name = visible ? (p?.name ?? "") : "",
        fish =
          p?.showcase &&
          (p.id === useGame.getState().id ||
            useSettings.getState().showOtherCatches)
            ? `Tôi câu được ${p.showcase.species}, nặng ${formatFishWeight(p.showcase.grams)} nè!`
            : "";
      const message = speech.get(id);
      const chat =
        visible &&
        message &&
        (message.expiresAt ?? 0) > serverNow() &&
        phase !== "BITE_WINDOW"
          ? message.text
          : visible &&
              p?.kind === "bot" &&
              p.speech &&
              p.speech.until > serverNow() &&
              within(p, world.get(useGame.getState().id), 20) &&
              phase !== "BITE_WINDOW"
            ? p.speech.text
            : "";
      const npc = NPCS.find((n) => id === `npc:${n.id}`);
      const interact =
        !!npc &&
        !!self &&
        self.phase === "IDLE" &&
        within(self, npc, INTERACTION_RADIUS) &&
        useGame.getState().connected;
      setLabel((prev) =>
        prev.name === name &&
        prev.kind === (p?.kind ?? "player") &&
        prev.fish === fish &&
        prev.startedAt === (p?.showcase?.startedAt ?? 0) &&
        prev.species === (p?.showcase?.species ?? "") &&
        prev.grams === (p?.showcase?.grams ?? 1000) &&
        prev.chat === chat &&
        prev.bite === (phase === "BITE_WINDOW") &&
        prev.interact === interact &&
        prev.rodId === (p?.rodId ?? "wood") &&
        prev.level === (p?.level ?? 1) &&
        prev.appearanceId ===
          (p?.appearanceId ??
            useGame.getState().profile?.appearanceId ??
            "sailor") &&
        prev.emote === emoteText
          ? prev
          : {
              name,
              grams: p?.showcase?.grams ?? 1000,
              chat,
              bite: phase === "BITE_WINDOW",
              kind: p?.kind ?? "player",
              interact,
              fish,
              species: p?.showcase?.species ?? "",
              startedAt: p?.showcase?.startedAt ?? 0,
              animationSeed: p?.showcase?.animationSeed ?? 0,
              rodId: p?.rodId ?? "wood",
              level: p?.level ?? 1,
              appearanceId:
                p?.appearanceId ??
                useGame.getState().profile?.appearanceId ??
                "sailor",
              emote: emoteText,
            },
      );
    }
  }, -1);
  return (
    <group
      ref={root}
      name={`actor:${id}`}
      position={[4.3, 0.72, 4]}
      scale={preview ? 1.45 : 0.672}
    >
      <mesh
        ref={contactShadow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
      >
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial
          color="#65412d"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <group ref={rig}>
        {label.kind === "npc" ? (
          <NpcModel role={id.slice(4)} />
        ) : (
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
        )}
      </group>
      {(preview || label.fish) && (
        <group ref={heldFish} name="held-fish">
          <group
            position={[0, isLargeFish(label.grams) ? 0 : -0.35, 0]}
            rotation={[0, 0, isLargeFish(label.grams) ? 0 : Math.PI / 2]}
          >
            <Suspense fallback={null}>
              <FishModel
                species={label.species}
                grams={label.grams}
                startedAt={label.startedAt}
                animationSeed={label.animationSeed}
              />
            </Suspense>
          </group>
        </group>
      )}
      {label.name && (
        <Html
          position={[0, label.fish && isLargeFish(label.grams) ? 5.6 : 3.45, 0]}
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`nameplate ${label.kind === "npc" ? "resident-nameplate" : ""}`}
          >
            {label.kind !== "npc" && <i>{label.level}</i>}
            {label.name}
            {label.kind === "npc" && (
              <small className="npc-role">
                {NPCS.find((n) => id === `npc:${n.id}`)?.role}
              </small>
            )}
          </div>
        </Html>
      )}
      {label.interact && (
        <Html position={[0, 4.4, 0]} center zIndexRange={[12, 7]}>
          <button
            className="npc-interaction"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("fishing:npc", { detail: id.slice(4) }),
              )
            }
          >
            {NPCS.find((n) => id === `npc:${n.id}`)?.action}
          </button>
        </Html>
      )}
      {label.bite && (
        <Html
          position={[0, 4.4, 0]}
          center
          zIndexRange={[14, 9]}
          style={{ pointerEvents: "none" }}
        >
          <div className="head-bite" aria-label="Cá cắn câu">
            !
          </div>
        </Html>
      )}
      {label.chat && (
        <Html
          position={[
            0,
            label.fish ? (isLargeFish(label.grams) ? 8.5 : 6.2) : 4.65,
            0,
          ]}
          center
          zIndexRange={[10, 9]}
          style={{ pointerEvents: "none" }}
        >
          <div className="speech-bubble">{label.chat}</div>
        </Html>
      )}
      {label.fish && (
        <>
          <Html
            position={[0, isLargeFish(label.grams) ? 7.1 : 4.4, 0]}
            center
            zIndexRange={[8, 6]}
          >
            <div className="showcase">{label.fish}</div>
          </Html>
        </>
      )}
      {label.emote && !label.chat && !label.bite && (
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
function FishModel({
  species,
  grams = 1000,
  startedAt = 0,
  animationSeed = 0,
}: {
  species?: string;
  grams?: number;
  startedAt?: number;
  animationSeed?: number;
}) {
  const { scene } = useGLTF(assetUrl(fishModelId(species)));
  const instance = useMemo(() => {
    const copy = cloneSkeleton(scene),
      box = new THREE.Box3().setFromObject(copy);
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    for (const name of ["fish-lod-high", "fish-lod-low"]) {
      const meshes: THREE.SkinnedMesh[] = [];
      copy.getObjectByName(name)?.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) meshes.push(o);
      });
      for (const mesh of meshes.slice(1)) mesh.skeleton = meshes[0].skeleton;
    }
    copy.position.sub(center);
    return { copy, length: Math.max(size.x, size.y, size.z), height: size.y };
  }, [scene]);
  useEffect(
    () => () => {
      const skeletons = new Set<THREE.Skeleton>();
      instance.copy.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
      });
      skeletons.forEach((s) => s.dispose());
    },
    [instance],
  );
  const definition = speciesFor(species ?? "") ?? SPECIES[0];
  const bones = useMemo(() => {
    const result: THREE.Bone[] = [];
    instance.copy.traverse((o) => {
      if (o instanceof THREE.Bone) result.push(o);
    });
    return result;
  }, [instance]);
  useFrame(({ camera }) => {
    const angles = fishWriggle(
      serverNow(),
      startedAt,
      animationSeed,
      useSettings.getState().reducedMotion,
    );
    const mammal = ["dolphin", "orca", "whale"].includes(
      definition.shape ?? "",
    );
    for (const b of bones) {
      const i = Number(b.userData.fishJoint ?? 0);
      b.rotation.set(0, 0, 0);
      if (b.userData.fishFin)
        b.rotation.x =
          Math.sin((serverNow() - startedAt) * 0.007 + animationSeed) *
          (useSettings.getState().reducedMotion ? 0.025 : 0.12) *
          b.userData.fishFin;
      else if (i > 0) b.rotation[mammal ? "z" : "y"] = angles[i] ?? 0;
    }
    const low =
      useSettings.getState().quality !== "high" ||
      camera.position.distanceTo(
        instance.copy.getWorldPosition(new THREE.Vector3()),
      ) > 18;
    instance.copy.traverse((o) => {
      if (o.name === "fish-lod-low") o.visible = low;
      if (o.name === "fish-lod-high") o.visible = !low;
    });
  });

  return (
    <group
      name="carried-fish"
      userData={{
        halfHeight:
          (instance.height * fishLength(definition, grams)) /
          0.672 /
          instance.length /
          2,
      }}
      scale={fishLength(definition, grams) / 0.672 / instance.length}
    >
      <primitive object={instance.copy} dispose={null} />
    </group>
  );
}
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: "#173f48",
  transparent: true,
  opacity: 0.48,
  depthWrite: false,
  side: THREE.DoubleSide,
});
function FishShadow() {
  const geometry = useMemo(createFishShadowGeometry, []);
  const base = useMemo(
    () => new Float32Array(geometry.getAttribute("position").array),
    [geometry],
  );
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useFrame(() =>
    deformFishShadow(
      geometry,
      base,
      useSettings.getState().reducedMotion ? 0 : Math.sin(serverNow() * 0.012),
    ),
  );
  return (
    <mesh
      name="fish-silhouette"
      geometry={geometry}
      material={shadowMaterial}
    />
  );
}
function Bobber({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null),
    float = useRef<THREE.Group>(null),
    shadow = useRef<THREE.Group>(null),
    ring = useRef<THREE.Group>(null);
  const nibbleAt = useRef(0);
  const lineObj = useMemo(
    () =>
      new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(32 * 3), 3),
        ),
        new THREE.LineBasicMaterial({
          color: "#edf7e7",
          transparent: true,
          opacity: 0.72,
        }),
      ),
    [],
  );
  useEffect(
    () => () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    },
    [lineObj],
  );
  useFrame(() => {
    const p = world.get(id);
    if (!group.current) return;
    const now = serverNow(),
      phase = p?.phase ?? "IDLE";
    const elapsedEscape = p?.escape ? now - p.escape.at : 1000;
    const escaping = elapsedEscape >= 0 && elapsedEscape < 900;
    group.current.visible =
      !!p &&
      (!["IDLE", "RESULT", "CASTING", "SHOWCASING"].includes(phase) ||
        escaping);
    if (!p || !group.current.visible) return;
    const elapsed = Math.max(0, now - (p.phaseStartedAt ?? now));
    const pose = floatPresentation(
      phase,
      elapsed,
      p.phaseDurationMs ?? 300,
      (p.motionSeed ?? 0) +
        ((((p.phaseStartedAt ?? now) / 1000) * 1.8) % (Math.PI * 2)),
    );
    const position =
      escaping && p.escape
        ? p.escape.origin
        : p.reel
          ? reelPosition(p.reel, now)
          : p.bobber;
    group.current.position.set(position.x, waterHeightAt(position), position.z);
    if (float.current) {
      float.current.visible = phase !== "REELING" && !escaping;
      float.current.position.set(
        phase === "BITE_WINDOW" ? Math.sin(elapsed * 0.1) * 0.025 : 0,
        pose.dip,
        0,
      );
      float.current.rotation.z =
        phase === "BITE_WINDOW" && elapsed < 180
          ? Math.sin(elapsed * 0.12) * 0.14
          : 0;
    }
    if (
      phase === "NIBBLING" &&
      elapsed >= pose.contactMs &&
      nibbleAt.current !== p.phaseStartedAt
    ) {
      nibbleAt.current = p.phaseStartedAt ?? now;
      playSound(
        "nibble",
        { ...position, y: waterHeightAt(position) },
        id !== useGame.getState().id,
      );
    }
    if (shadow.current) {
      shadow.current.visible =
        ["APPROACHING", "NIBBLING", "BITE_WINDOW", "REELING"].includes(phase) ||
        escaping;
      shadow.current.scale.setScalar(
        (p.shadowScale ?? 1) *
          (escaping ? Math.max(0.02, 1 - elapsedEscape / 900) : 1),
      );
      let dx = phase === "REELING" ? 0 : pose.x,
        dz = phase === "REELING" ? 0 : pose.z;
      if (escaping) {
        const d = Math.max(0.1, Math.hypot(position.x - p.x, position.z - p.z));
        dx = ((position.x - p.x) / d) * elapsedEscape * 0.005;
        dz = ((position.z - p.z) / d) * elapsedEscape * 0.005;
      }
      for (let blend = 1; blend >= 0; blend -= 0.1) {
        const candidate = {
          x: position.x + dx * blend,
          z: position.z + dz * blend,
        };
        if (
          waterAt(candidate) === waterAt(position) &&
          !onPlatform(candidate)
        ) {
          dx *= blend;
          dz *= blend;
          break;
        }
      }
      shadow.current.position.set(dx, 0.025, dz);
      shadow.current.rotation.y = escaping ? Math.atan2(dx, dz) : pose.yaw;
      if (p.reel && !escaping) {
        const before = reelPosition(p.reel, now - 50),
          after = reelPosition(p.reel, now + 50);
        shadow.current.rotation.y = Math.atan2(
          after.x - before.x,
          after.z - before.z,
        );
      }
    }
    let mouthX = 0,
      mouthZ = 0;
    if (shadow.current) {
      const offset = shadowMouthOffset(
        shadow.current.rotation.y,
        shadow.current.scale.x,
      );
      // The path is the mouth path; the body follows behind that contact point.
      shadow.current.position.x -= offset.x;
      shadow.current.position.z -= offset.z;
      if (phase === "BITE_WINDOW" || phase === "REELING") {
        mouthX = shadow.current.position.x + offset.x;
        mouthZ = shadow.current.position.z + offset.z;
      }
    }
    if (ring.current) {
      const s = 1 + ((now / 1000) % 1.5) * 0.7;
      ring.current.scale.setScalar(s);
      ring.current.visible = !escaping;
    }
    lineObj.visible = !escaping || elapsedEscape < 400;
    const pos = lineObj.geometry.attributes.position,
      tip = rodTips.get(id);
    const start = tip ?? new THREE.Vector3(p.x, p.y + 2, p.z);
    for (let i = 0; i < 32; i++) {
      let u = (Math.floor(i / 2) + (i % 2)) / 16;
      if (escaping && Math.floor(i / 2) === 8) u = 0.5;
      const recoil = escaping ? Math.min(1, elapsedEscape / 400) : 0;
      const sag =
        Math.sin(u * Math.PI) *
        (escaping ? 0.9 : phase === "REELING" ? 0.06 : 0.26);
      const endX = escaping ? (start.x - position.x) * recoil : mouthX;
      const endZ = escaping ? (start.z - position.z) * recoil : mouthZ;
      pos.setXYZ(
        i,
        (start.x - position.x) * (1 - u) + endX * u,
        (start.y - group.current.position.y) * (1 - u) +
          (phase === "BITE_WINDOW" || phase === "REELING" ? 0.025 : 0.15) * u -
          sag +
          recoil * u,
        (start.z - position.z) * (1 - u) + endZ * u,
      );
    }
    pos.needsUpdate = true;
    lineObj.geometry.computeBoundingSphere();
  });
  return (
    <group ref={group}>
      <group ref={float}>
        <Model id="fishing_bobber" scale={1.3} />
      </group>
      <group ref={ring} position={[0, 0.025, 0]}>
        <Model id="bobber_ripples" />
      </group>
      <group ref={shadow}>
        <FishShadow />
      </group>
      <primitive object={lineObj} />
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
  const size = useThree((state) => state.size);
  const touch =
    navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
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
      distance =
        (fishing && !useSettings.getState().reducedMotion ? 12 : 14.8) *
        (touch && size.width > size.height && size.height <= 550 ? 0.88 : 1);
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
  const signature = useGame((s) => s.actorSignature),
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
