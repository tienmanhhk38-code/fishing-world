import { monitorEventLoopDelay, performance } from "node:perf_hooks";
const counters: Record<string, number> = {};
const histograms = new Map<string, number[]>();
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
const started = performance.now();
let cpu = process.cpuUsage(),
  cpuAt = performance.now(),
  cpuPercent = 0;
export function count(name: string, by = 1) {
  counters[name] = (counters[name] ?? 0) + by;
}
export function observe(name: string, value: number) {
  const data = histograms.get(name) ?? [];
  data.push(value);
  if (data.length > 1000) data.shift();
  histograms.set(name, data);
}
export function snapshot(gauges: Record<string, number> = {}) {
  const now = performance.now(),
    nextCpu = process.cpuUsage();
  cpuPercent =
    ((nextCpu.user - cpu.user + nextCpu.system - cpu.system) /
      ((now - cpuAt) * 1000)) *
    100;
  cpu = nextCpu;
  cpuAt = now;
  return {
    at: new Date().toISOString(),
    uptimeSeconds: (now - started) / 1000,
    counters: { ...counters },
    gauges,
    cpuPercent,
    memory: process.memoryUsage(),
    eventLoop: {
      p50Ms: loop.percentile(50) / 1e6,
      p95Ms: loop.percentile(95) / 1e6,
      p99Ms: loop.percentile(99) / 1e6,
      maxMs: loop.max / 1e6,
    },
    timings: Object.fromEntries(
      [...histograms].map(([name, data]) => {
        const sorted = [...data].sort((a, b) => a - b);
        return [
          name,
          {
            samples: sorted.length,
            p50: sorted[Math.floor((sorted.length - 1) * 0.5)],
            p95: sorted[Math.floor((sorted.length - 1) * 0.95)],
            max: sorted.at(-1),
          },
        ];
      }),
    ),
  };
}
