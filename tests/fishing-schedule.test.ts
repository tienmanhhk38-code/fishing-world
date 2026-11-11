import { describe, it, expect } from "vitest";
import { nibbleCount, fishingSchedule } from "../apps/server/src/fishing";

describe("server nibble schedule", () => {
  it("uses the configured weight group probabilities at exact boundaries", () => {
    const pick = (roll: number) => (min: number) => (min === 0 ? roll : min);
    expect(nibbleCount(900, pick(69))).toBe(1);
    expect(nibbleCount(900, pick(70))).toBe(3);
    expect(nibbleCount(900, pick(95))).toBe(5);
    expect(nibbleCount(1000, pick(34))).toBe(1);
    expect(nibbleCount(1000, pick(35))).toBe(3);
    expect(nibbleCount(1000, pick(85))).toBe(5);
    expect(nibbleCount(5000, pick(14))).toBe(1);
    expect(nibbleCount(5000, pick(15))).toBe(3);
    expect(nibbleCount(5000, pick(60))).toBe(5);
  });
  it("keeps every cue ordered and permits the full six fake nibbles", () => {
    const schedule = fishingSchedule(6000, (_min, max) => max - 1);
    expect(schedule.filter((cue) => cue.phase === "NIBBLING")).toHaveLength(6);
    expect(schedule[0]).toEqual({ at: 700, phase: "WAITING" });
    expect(schedule.at(-1)).toEqual({ at: 19500, phase: "BITE_WINDOW" });
    expect(
      schedule.every((cue, i) => i === 0 || cue.at > schedule[i - 1].at),
    ).toBe(true);
  });
});
