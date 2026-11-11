import { Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment } from "./scene";
import { useSettings } from "./settings";
useSettings.setState({ quality: "high" });
function Controls() {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    Object.assign(window, {
      setIslandView: (id: string) => {
        const views: Record<string, [number[], number[]]> = {
          overview: [
            [48, 55, 40],
            [0, 0, -31],
          ],
          top: [
            [0, 110, -29],
            [0, 0, -30],
          ],
          sea: [
            [3, 6, 18],
            [-5, 2, -30],
          ],
          village: [
            [-9, 5, -28],
            [-6, 1, 5],
          ],
          pond: [
            [35, 13, -18],
            [19, 0, -34],
          ],
        };
        const [position, target] = views[id] ?? views.overview;
        camera.position.set(...(position as [number, number, number]));
        camera.lookAt(...(target as [number, number, number]));
        camera.updateProjectionMatrix();
        invalidate();
      },
    });
  }, [camera, invalidate]);
  return null;
}
createRoot(document.getElementById("root")!).render(
  <Canvas
    shadows="percentage"
    camera={{ position: [76, 66, 70], fov: 43, near: 0.1, far: 400 }}
    dpr={1}
  >
    <Suspense fallback={null}>
      <Environment />
      <Controls />
    </Suspense>
  </Canvas>,
);
