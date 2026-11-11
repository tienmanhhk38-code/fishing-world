import { randomInt } from "node:crypto";
import type { Phase } from "@fishing/shared";

type IntegerRandom = (min: number, maxExclusive: number) => number;
const secureInteger: IntegerRandom = (min, max) => randomInt(min, max);
export const FISHING_TIMING = {
  cast: 700,
  wait: [3000, 7000],
  approach: [800, 1200],
  nibble: [200, 350],
  pause: [600, 1400],
  finalPause: [700, 1500],
} as const;

export function nibbleCount(
  grams: number,
  integer: IntegerRandom = secureInteger,
) {
  const [first, second] =
    grams < 1000 ? [70, 95] : grams < 5000 ? [35, 85] : [15, 60];
  const roll = integer(0, 100);
  const start = roll < first ? 1 : roll < second ? 3 : 5;
  return integer(start, start + 2);
}

export function fishingSchedule(
  grams: number,
  integer: IntegerRandom = secureInteger,
) {
  const duration = (range: readonly [number, number]) =>
    integer(range[0], range[1] + 1);
  const cues: { at: number; phase: Phase }[] = [
    { at: FISHING_TIMING.cast, phase: "WAITING" },
  ];
  let at = FISHING_TIMING.cast + duration(FISHING_TIMING.wait);
  cues.push({ at, phase: "APPROACHING" });
  at += duration(FISHING_TIMING.approach);
  const count = nibbleCount(grams, integer);
  for (let i = 0; i < count; i++) {
    if (i) at += duration(FISHING_TIMING.pause);
    cues.push({ at, phase: "NIBBLING" });
    at += duration(FISHING_TIMING.nibble);
    cues.push({ at, phase: "APPROACHING" });
  }
  at += duration(FISHING_TIMING.finalPause);
  cues.push({ at, phase: "BITE_WINDOW" });
  return cues;
}
