import { moveOnMap, groundHeightAt, type Point } from "./world";
export interface Motion extends Point {
  y: number;
  vy: number;
  grounded: boolean;
  running: boolean;
  yaw: number;
  moving: boolean;
}
export interface MovementInput {
  x: number;
  z: number;
  sprint?: boolean;
  seq?: number;
}
export const RUN_SPEED = 7,
  JUMP_SPEED = 6,
  GRAVITY = 18;
export function movable(phase: string) {
  return phase === "IDLE" || phase === "SHOWCASING";
}
export function simulateMovement(
  state: Motion,
  input: MovementInput,
  dt: number,
): Motion {
  let { x, z, y, vy, grounded, yaw } = state;
  // A running takeoff keeps its horizontal pace until landing, even when
  // Shift is released while the jump is in progress.
  const sprinting = !!input.sprint || (!state.grounded && state.running);
  const length = Math.hypot(input.x, input.z),
    speed = sprinting ? RUN_SPEED : 4.4;
  const steps = Math.max(1, Math.ceil(dt / (1 / 60))),
    step = Math.min(0.1, Math.max(0, dt)) / steps;
  for (let i = 0; i < steps; i++) {
    const p = moveOnMap(
      { x, z },
      (input.x / Math.max(1, length)) * speed * step,
      (input.z / Math.max(1, length)) * speed * step,
    );
    x = p.x;
    z = p.z;
    const floor = groundHeightAt(p);
    if (!grounded) {
      vy -= GRAVITY * step;
      y += vy * step;
      if (y <= floor) {
        y = floor;
        vy = 0;
        grounded = true;
      }
    } else y = floor;
  }
  const moving = Math.hypot(x - state.x, z - state.z) > 0.0001;
  if (length > 0.05) yaw = Math.atan2(input.x, input.z);
  return {
    x,
    z,
    y,
    vy,
    grounded,
    yaw,
    moving,
    running: moving && sprinting,
  };
}
