import { readFile } from "node:fs/promises";
const directory = process.env.SOAK_OUTPUT ?? ".local/m5/soak-linux-60";
const state = JSON.parse(await readFile(directory + "/state.json", "utf8"));
let metrics;
for (const line of (await readFile(directory + "/metrics.ndjson", "utf8"))
  .trim()
  .split("\n")
  .reverse()) {
  try {
    metrics = JSON.parse(line);
    break;
  } catch {}
}
console.log(
  JSON.stringify({
    status: state.status,
    minutes: state.startedAt
      ? (Date.now() - Date.parse(state.startedAt)) / 60000
      : undefined,
    at: metrics.at,
    connected: metrics.gauges.connected,
    catches: metrics.counters.catches ?? 0,
    reconnects: metrics.counters.reconnects ?? 0,
    dbErrors: metrics.counters.db_errors ?? 0,
    fishingErrors: metrics.counters.fishing_errors ?? 0,
    rssMiB: metrics.memory.rss / 1048576,
    eventLoopP99Ms: metrics.eventLoop.p99Ms,
  }),
);
