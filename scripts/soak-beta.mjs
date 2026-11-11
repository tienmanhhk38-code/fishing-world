import { readFile } from "node:fs/promises";
const password = (await readFile(".local/beta/db-password.txt", "utf8")).trim();
process.env.DATABASE_URL = `postgresql://fishing_app:${encodeURIComponent(password)}@127.0.0.1:55433/fishing?connection_limit=4`;
process.env.SOAK_URL = "https://localhost:8443";
process.env.SOAK_ORIGIN = "https://localhost:8443";
process.env.SOAK_METRICS_URL = "http://127.0.0.1:2569/internal/metrics";
process.env.METRICS_TOKEN = (
  await readFile(".local/beta/metrics-token.txt", "utf8")
).trim();
await import("./soak.mjs");
