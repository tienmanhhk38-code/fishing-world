import { it, expect } from "vitest";
import {
  createFishShadowGeometry,
  deformFishShadow,
  shadowMouthOffset,
  SHADOW_NOSE,
} from "../apps/client/src/fish-shadow";
it("is one connected silhouette with a deforming tail and a stationary head", () => {
  const g = createFishShadowGeometry(),
    p = g.getAttribute("position"),
    base = new Float32Array(p.array);
  const edges = new Map<number, Set<number>>();
  const index = g.index!;
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (const a of tri) {
      if (!edges.has(a)) edges.set(a, new Set());
      for (const b of tri) edges.get(a)!.add(b);
    }
  }
  const seen = new Set<number>(),
    todo = [index.getX(0)];
  while (todo.length) {
    const a = todo.pop()!;
    if (seen.has(a)) continue;
    seen.add(a);
    todo.push(...edges.get(a)!);
  }
  expect(seen.size).toBe(edges.size);
  deformFishShadow(g, base, 1);
  let moving = 0;
  for (let i = 0; i < p.count; i++) {
    if (base[i * 3 + 2] >= -0.2) expect(p.getX(i)).toBe(base[i * 3]);
    else if (p.getX(i) !== base[i * 3]) moving++;
    expect(p.getY(i)).toBe(0);
  }
  expect(moving).toBeGreaterThan(5);
  expect(
    Math.max(...Array.from({ length: p.count }, (_, i) => p.getZ(i))),
  ).toBeCloseTo(SHADOW_NOSE, 6);
  g.dispose();
});
it("places the hook at the nose for every heading and fish size", () => {
  for (const scale of [0.2, 1, 4])
    for (const yaw of [0, Math.PI / 2, Math.PI, 4.3]) {
      const nose = shadowMouthOffset(yaw, scale);
      expect(Math.hypot(nose.x, nose.z)).toBeCloseTo(SHADOW_NOSE * scale, 8);
      expect(Math.hypot(nose.x, nose.z)).toBeGreaterThan(0);
    }
});
