import {
  simulateMovement,
  movable,
  type Player,
  type Motion,
  type MovementInput,
} from "@fishing/shared";
let selfId = "",
  predicted: Player | null = null,
  offset = { x: 0, y: 0, z: 0 },
  clockOffset = 0,
  clockReady = false;
const snapshots = new Map<string, Player[]>();
let history: { from: number; to: number; input: MovementInput }[] = [];
let pendingJump: { seq: number; at: number } | null = null;
export function resetMotion(id = "") {
  selfId = id;
  predicted = null;
  history = [];
  snapshots.clear();
  offset = { x: 0, y: 0, z: 0 };
  clockReady = false;
  pendingJump = null;
}
export function receiveMotion(players: Player[], id: string, rtt: number) {
  if (id !== selfId) resetMotion(id);
  const received = Date.now(),
    stamp = players[0]?.snapshotAt ?? received,
    sample = stamp - received + Math.min(300, rtt) / 2;
  clockOffset = clockReady ? clockOffset * 0.95 + sample * 0.05 : sample;
  clockReady = true;
  for (const player of players) {
    if (player.id !== id) {
      const list = snapshots.get(player.id) ?? [];
      list.push({ ...player });
      while (list.length > 12) list.shift();
      snapshots.set(player.id, list);
      continue;
    }
    let next = { ...player };
    const baseTime = player.snapshotAt - clockOffset;
    if (movable(player.phase))
      for (const step of history) {
        if (step.to <= baseTime) continue;
        next = {
          ...next,
          ...simulateMovement(
            next,
            step.input,
            Math.max(0, (step.to - Math.max(step.from, baseTime)) / 1000),
          ),
        };
      }
    if (pendingJump) {
      if (
        (player.jumpSeq ?? 0) >= pendingJump.seq ||
        received - pendingJump.at > 500
      )
        pendingJump = null;
      else if (predicted) {
        next.y = predicted.y;
        next.vy = predicted.vy;
        next.grounded = predicted.grounded;
      }
    }
    if (predicted) {
      const dx = predicted.x - next.x,
        dy = predicted.y - next.y,
        dz = predicted.z - next.z;
      if (Math.hypot(dx, dz) < 8) {
        offset.x += dx;
        offset.y += dy;
        offset.z += dz;
      } else offset = { x: 0, y: 0, z: 0 };
    }
    predicted = next;
  }
  const alive = new Set(players.map((p) => p.id));
  for (const id of snapshots.keys()) if (!alive.has(id)) snapshots.delete(id);
}
export function predictMotion(dt: number, input: MovementInput) {
  const now = Date.now();
  history.push({ from: now - dt * 1000, to: now, input });
  history = history.filter((s) => s.to > now - 1500);
  if (predicted && movable(predicted.phase))
    Object.assign(predicted, simulateMovement(predicted, input, dt));
  const decay = Math.exp(-dt * 12);
  offset.x *= decay;
  offset.y *= decay;
  offset.z *= decay;
}
export function predictJump(seq: number) {
  if (predicted?.grounded && movable(predicted.phase)) {
    predicted.grounded = false;
    predicted.vy = 6;
    pendingJump = { seq, at: Date.now() };
  }
}
export function motionPose(player: Player): Player {
  if (player.id === selfId && predicted)
    return {
      ...player,
      ...predicted,
      phase: player.phase,
      showcase: player.showcase,
      reel: player.reel,
      shadowScale: player.shadowScale,
      x: predicted.x + offset.x,
      y: predicted.y + offset.y,
      z: predicted.z + offset.z,
    };
  const list = snapshots.get(player.id);
  if (!list?.length) return player;
  const target = Date.now() + clockOffset - 100;
  let a = list[0],
    b = list[list.length - 1];
  for (let i = 1; i < list.length; i++)
    if (list[i].snapshotAt >= target) {
      a = list[i - 1];
      b = list[i];
      break;
    }
  const t = Math.max(
      0,
      Math.min(
        1,
        (target - a.snapshotAt) / Math.max(1, b.snapshotAt - a.snapshotAt),
      ),
    ),
    lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    ...player,
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    z: lerp(a.z, b.z),
    yaw:
      a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * t,
  };
}
export function serverNow() {
  return Date.now() + clockOffset;
}
