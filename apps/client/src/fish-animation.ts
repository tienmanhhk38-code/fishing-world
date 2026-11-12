/** Server-time based motion; no local random sampling or accumulating transforms. */
export function fishWriggle(
  timeMs: number,
  startedAt: number,
  seed: number,
  reduced = false,
) {
  const t = Math.max(0, timeMs - startedAt) / 1000;
  const period = 4 + (seed % 300) / 100;
  const burst = reduced
    ? 0
    : Math.pow(Math.max(0, Math.sin((t / period) * Math.PI * 2 + seed)), 12);
  const amplitude = (reduced ? 0.025 : 0.055) + burst * 0.14;
  return Array.from({ length: 5 }, (_, i) =>
    i === 0
      ? 0
      : (Math.sin(t * (5 + burst * 5) - i * 0.8 + seed) * amplitude * i) / 4,
  );
}
