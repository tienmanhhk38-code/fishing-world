import { describe, it, expect } from "vitest";
import { hookAllowed, clampPosition } from "../packages/shared/src/index";
describe("Authoritative hook window", () => {
  it("rejects early input even with high latency", () =>
    expect(hookAllowed(999, 1000, 1000)).toBe(false));
  it("accepts the opening and exact closing boundary", () => {
    expect(hookAllowed(1000, 1000, 0)).toBe(true);
    expect(hookAllowed(2200, 1000, 0)).toBe(true);
    expect(hookAllowed(2201, 1000, 0)).toBe(false);
  });
  it("bounds measured RTT compensation to 150 ms", () => {
    expect(hookAllowed(2250, 1000, 100)).toBe(true);
    expect(hookAllowed(2251, 1000, 100)).toBe(false);
    expect(hookAllowed(2350, 1000, 1000)).toBe(true);
    expect(hookAllowed(2351, 1000, 1000)).toBe(false);
  });
  it("keeps movement inside the dock", () =>
    expect(clampPosition(200, -400)).toEqual({ x: 7, z: 1 }));
});
