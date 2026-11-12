import { Component, useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { create } from "zustand";
import { controls, send, useGame, world } from "./network";
import { motionPose } from "./motion-client";
import { Box3, Vector3 } from "three";
const useGraphics = create<{ error: string }>(() => ({ error: "" }));
export class GraphicsBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="graphics-error" role="alert">
        <b>Không thể mở cảnh 3D trên trình duyệt này.</b>
        <span>Kiểm tra WebGL hoặc thử lại sau khi đóng bớt ứng dụng.</span>
        <button onClick={() => location.reload()}>Tải lại game</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function GraphicsNotice() {
  const error = useGraphics((state) => state.error);
  return error ? (
    <div className="graphics-error" role="alert">
      <b>{error}</b>
      <span>Tiến trình đã lưu vẫn được giữ trên server.</span>
      <button onClick={() => location.reload()}>Tải lại game</button>
    </div>
  ) : null;
}
declare global {
  interface Window {
    __fishingDiagnostics?: {
      samples: { at: number; dt: number; calls: number; triangles: number }[];
      info: Record<string, unknown>;
      setCamera: (yaw: number, pitch?: number) => void;
      reset: () => void;
      localPlayer: () => {
        server: import("@fishing/shared").Player;
        rendered: import("@fishing/shared").Player;
      } | null;
      players: () => import("@fishing/shared").Player[];
      presentations: () => {
        id: string;
        rodVisible: boolean;
        fishLength: number;
        fishY: number;
        arms: number[];
        fishJoints: { joint: number; y: number; z: number }[];
        fishLod: string;
      }[];
    };
  }
}
export function GraphicsLifecycle() {
  const { gl, invalidate, camera, scene } = useThree(),
    last = useRef(0);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      controls.keys.clear();
      controls.x = controls.z = 0;
      useGraphics.setState({ error: "Cảnh 3D tạm ngắt. Đang chờ khôi phục…" });
      if (useGame.getState().phase !== "IDLE") send("FISH_CANCEL");
    };
    const restored = () => {
      useGraphics.setState({ error: "" });
      gl.shadowMap.needsUpdate = true;
      last.current = 0;
      invalidate();
    };
    const clear = () => {
      if (document.hidden) {
        controls.keys.clear();
        controls.x = controls.z = 0;
      }
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    document.addEventListener("visibilitychange", clear);
    if (new URLSearchParams(location.search).get("diagnostics") === "1") {
      const context = gl.getContext(),
        extension = context.getExtension("WEBGL_debug_renderer_info");
      window.__fishingDiagnostics = {
        presentations: () =>
          Array.from(world.values(), (p) => {
            const actor = scene.getObjectByName(`actor:${p.id}`),
              fish = actor?.getObjectByName("held-fish");
            const bounds = fish ? new Box3().setFromObject(fish) : undefined;
            const size = bounds?.getSize(new Vector3());
            const fishJoints: { joint: number; y: number; z: number }[] = [];
            let fishLod = "";
            fish?.traverse((o) => {
              if (o.name.startsWith("fish-lod-") && o.visible) fishLod = o.name;
              if (
                o.userData.fishJoint !== undefined &&
                o.parent?.parent?.visible !== false
              )
                fishJoints.push({
                  joint: o.userData.fishJoint,
                  y: o.rotation.y,
                  z: o.rotation.z,
                });
            });
            return {
              id: p.id,
              fishJoints,
              fishLod,
              rodVisible: actor?.getObjectByName("held-rod")?.visible ?? false,
              fishLength: size ? Math.max(size.x, size.y, size.z) : 0,
              fishY: fish?.getWorldPosition(new Vector3()).y ?? 0,
              arms: ["leftArm", "rightArm"].map(
                (n) => actor?.getObjectByName(n)?.rotation.x ?? 0,
              ),
            };
          }),
        players: () =>
          Array.from(world.values(), (p) => ({ ...motionPose(p) })),
        localPlayer: () => {
          const player = world.get(useGame.getState().id);
          return player
            ? { server: { ...player }, rendered: motionPose(player) }
            : null;
        },
        samples: [],
        info: {
          vendor: extension
            ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL)
            : context.getParameter(context.VENDOR),
          renderer: extension
            ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
            : context.getParameter(context.RENDERER),
          userAgent: navigator.userAgent,
        },
        setCamera: (yaw, pitch = 0.3) => {
          controls.yaw = yaw;
          controls.pitch = pitch;
        },
        reset: () => {
          if (window.__fishingDiagnostics)
            window.__fishingDiagnostics.samples = [];
          last.current = 0;
        },
      };
    }
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", lost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", clear);
      delete window.__fishingDiagnostics;
    };
  }, [gl, invalidate]);
  useFrame(() => {
    const diagnostics = window.__fishingDiagnostics;
    if (!diagnostics) return;
    const now = performance.now();
    if (last.current) {
      diagnostics.samples.push({
        at: now,
        dt: now - last.current,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      if (diagnostics.samples.length > 1000) diagnostics.samples.shift();
    }
    last.current = now;
    diagnostics.info = {
      ...diagnostics.info,
      camera: camera.position.toArray(),
      pixelRatio: gl.getPixelRatio(),
      width: gl.domElement.width,
      height: gl.domElement.height,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    };
  });
  return null;
}
