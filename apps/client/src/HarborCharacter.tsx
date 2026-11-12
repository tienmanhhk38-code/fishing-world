import { useMemo, useLayoutEffect, useEffect, type RefObject } from "react";
import { createPortal } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as T from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  RODS,
  type RodId,
  type Phase,
  type AppearanceId,
} from "@fishing/shared";
import { Model, assetUrl } from "./assets";

export interface CharacterAnimator {
  update: (
    dt: number,
    phase: Phase,
    moving: boolean,
    running?: boolean,
    airborne?: boolean,
  ) => void;
}
type JointRef = RefObject<T.Object3D | null>;
export function CharacterModel({
  leftArm,
  rightArm,
  leftLeg,
  rightLeg,
  rod,
  animator,
  rodId,
  appearanceId = "sailor",
}: {
  leftArm: JointRef;
  rightArm: JointRef;
  leftLeg: JointRef;
  rightLeg: JointRef;
  rod: RefObject<T.Group | null>;
  animator: RefObject<CharacterAnimator | null>;
  rodId: RodId;
  appearanceId?: AppearanceId;
}) {
  const source = useGLTF(`/assets/harbor-v2/fisher_${appearanceId}.glb`);
  const rig = useMemo(() => {
    const group = clone(source.scene),
      mixer = new T.AnimationMixer(group),
      actions = new Map(
        source.animations.flatMap((clip) => {
          const upper =
            clip.name === "ShowFish"
              ? new T.AnimationClip(
                  clip.name,
                  clip.duration,
                  clip.tracks.filter((t) => !t.name.includes("Leg")),
                )
              : clip;
          const entries: [string, T.AnimationAction][] = [
            [clip.name, mixer.clipAction(upper)],
          ];
          if (["Idle", "Walk", "Run", "Jump"].includes(clip.name))
            entries.push([
              "Lower" + clip.name,
              mixer.clipAction(
                new T.AnimationClip(
                  "Lower" + clip.name,
                  clip.duration,
                  clip.tracks.filter((t) => t.name.includes("Leg")),
                ),
              ),
            ]);
          return entries;
        }),
      );
    const bones = new Map<string, T.Bone>(),
      skeletons = new Set<T.Skeleton>();
    group.traverse((o) => {
      if (o instanceof T.Bone) bones.set(o.name, o);
      if (o instanceof T.SkinnedMesh) {
        o.castShadow = false;
        o.receiveShadow = true;
        o.boundingSphere = new T.Sphere(new T.Vector3(0, 1.1, 0), 1.65);
        skeletons.add(o.skeleton);
      }
    });
    let previous = "",
      phaseBefore: Phase | undefined,
      elapsed = 0;
    let showing = false;
    const update = (
      dt: number,
      phase: Phase,
      moving: boolean,
      running = false,
      airborne = false,
    ) => {
      if (phase !== phaseBefore) {
        elapsed = 0;
        phaseBefore = phase;
      } else elapsed += Math.min(dt, 0.1);
      const locomotion = airborne
        ? "Jump"
        : moving
          ? running
            ? "Run"
            : "Walk"
          : "Idle";
      const isShowing = phase === "SHOWCASING";
      if (isShowing !== showing) {
        const action = actions.get("ShowFish");
        if (action) {
          if (isShowing)
            action.reset().setLoop(T.LoopRepeat, Infinity).fadeIn(0.12).play();
          else action.fadeOut(0.12);
        }
        showing = isShowing;
      }
      const name = isShowing
        ? "Lower" + locomotion
        : phase === "IDLE"
          ? moving
            ? running
              ? "Run"
              : "Walk"
            : "Idle"
          : phase === "CASTING"
            ? "Cast"
            : phase === "RESULT"
              ? "Idle"
              : phase === "REELING"
                ? elapsed < 0.28
                  ? "Hook"
                  : "Reel"
                : "Wait";
      const actualName =
        !isShowing && phase === "IDLE" && airborne ? "Jump" : name;
      if (actualName !== previous) {
        const next = actions.get(actualName) ?? actions.get("Idle")!;
        next
          .reset()
          .setLoop(
            ["Cast", "Hook", "Celebrate"].includes(name)
              ? T.LoopOnce
              : T.LoopRepeat,
            Infinity,
          );
        next.clampWhenFinished = true;
        next.fadeIn(0.12).play();
        if (name === "Idle")
          next.time =
            ((group.uuid.split("").reduce((n, c) => n + c.charCodeAt(0), 0) %
              100) /
              100) *
            next.getClip().duration;
        if (previous) actions.get(previous)?.fadeOut(0.12);
        previous = actualName;
      }
      mixer.update(Math.min(dt, 0.1));
    };
    return { group, mixer, bones, skeletons, update };
  }, [source.scene, source.animations]);
  useLayoutEffect(() => {
    leftArm.current = rig.bones.get("leftArm")!;
    rightArm.current = rig.bones.get("rightArm")!;
    leftLeg.current = rig.bones.get("leftLeg")!;
    rightLeg.current = rig.bones.get("rightLeg")!;
    animator.current = { update: rig.update };
    return () => {
      leftArm.current =
        rightArm.current =
        leftLeg.current =
        rightLeg.current =
          null;
      animator.current = null;
    };
  }, [rig, leftArm, rightArm, leftLeg, rightLeg, animator]);
  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
      rig.mixer.uncacheRoot(rig.group);
      rig.skeletons.forEach((s) => s.dispose());
    },
    [rig],
  );
  return (
    <group scale={1.5}>
      <primitive object={rig.group} dispose={null} />
      {createPortal(
        <group
          ref={rod}
          name="held-rod"
          position={[0.14, -0.38, 0.03]}
          rotation={[1.25, 0, 0]}
        >
          <Model id={RODS[rodId].model} />
        </group>,
        rig.bones.get("rightArm")!,
      )}
    </group>
  );
}
