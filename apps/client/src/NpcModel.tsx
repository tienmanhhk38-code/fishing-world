import type { ThreeElements } from "@react-three/fiber";
// Profession-specific residents, independent of the player rig and outfits.
export function NpcModel({ role }: { role: string }) {
  const merchant = role === "merchant",
    guide = role === "guide";
  const cloth = merchant ? "#b85e39" : guide ? "#317c77" : "#7359a3";
  const ball = (
    position: [number, number, number],
    scale: [number, number, number],
    color: string,
  ) => (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
  const box = (
    position: [number, number, number],
    size: [number, number, number],
    color: string,
    rotation?: ThreeElements["mesh"]["rotation"],
  ) => (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
  return (
    <group scale={1.5}>
      {ball([0, 0.88, 0], [merchant ? 0.46 : 0.32, 0.48, 0.25], cloth)}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          {box(
            [sign * 0.17, 0.28, 0],
            [0.21, 0.55, 0.25],
            guide ? "#344b44" : "#4e393c",
          )}
          {ball([sign * 0.17, 0.07, 0.07], [0.15, 0.09, 0.22], "#45372c")}
          {ball(
            [sign * (merchant ? 0.43 : 0.34), 0.86, 0.03],
            [0.12, 0.32, 0.12],
            "#e5b28c",
          )}
        </group>
      ))}
      {ball([0, 1.5, 0], [0.37, 0.39, 0.32], "#e5b28c")}
      {ball(
        [0, 1.67, -0.08],
        [0.39, 0.28, 0.31],
        guide ? "#d3d1bd" : merchant ? "#392c29" : "#4e3043",
      )}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          {ball([sign * 0.13, 1.53, 0.293], [0.032, 0.042, 0.025], "#292d31")}
        </group>
      ))}
      {merchant ? (
        <>
          {box([0, 0.85, 0.245], [0.58, 0.65, 0.06], "#f1ddad")}
          {box([0, 0.7, 0.285], [0.27, 0.17, 0.025], "#b77e52")}
          {box([0.48, 0.6, 0.1], [0.32, 0.2, 0.25], "#a87d47")}
          {ball([0.48, 0.74, 0.12], [0.13, 0.08, 0.1], "#e9b345")}
          <mesh position={[0, 1.98, 0]}>
            <cylinderGeometry args={[0.25, 0.4, 0.17, 16]} />
            <meshStandardMaterial color="#f7e7bd" />
          </mesh>
        </>
      ) : guide ? (
        <>
          {ball([0, 1.28, 0.19], [0.28, 0.23, 0.2], "#d9d6c6")}
          <mesh position={[0, 1.85, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 0.06, 24]} />
            <meshStandardMaterial color="#ba9864" />
          </mesh>
          {ball([0, 1.94, 0], [0.33, 0.19, 0.3], "#ba9864")}
          {box(
            [0.44, 0.75, 0.23],
            [0.32, 0.42, 0.055],
            "#e0d5ab",
            [0.1, 0, -0.15],
          )}
          {box([0.44, 0.75, 0.263], [0.22, 0.025, 0.008], "#3a8b81")}
        </>
      ) : (
        <>
          {box([-0.27, 0.7, 0.16], [0.24, 0.32, 0.12], "#a36c41")}
          {box([0, 1.05, 0.26], [0.49, 0.055, 0.04], "#e6c68b", [0, 0, 0.7])}
          {box(
            [0.39, 0.83, 0.23],
            [0.29, 0.38, 0.05],
            "#dec39d",
            [0.1, 0, -0.15],
          )}
          {box([0.39, 0.85, 0.264], [0.19, 0.24, 0.008], "#fcf2d8")}
          {ball([0.33, 1.65, -0.2], [0.19, 0.2, 0.19], "#4e3043")}
        </>
      )}
    </group>
  );
}
