import { Client } from "pg";
export async function acquireInstanceLock() {
  const direct = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!direct) throw new Error("Thiếu DATABASE_URL.");
  if (new URL(direct).pathname !== new URL(process.env.DATABASE_URL!).pathname)
    throw new Error("DIRECT_DATABASE_URL cần trỏ cùng database.");
  const client = new Client({
    connectionString: direct,
    keepAlive: true,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  let lost = false;
  client.on("error", () => {
    lost = true;
  });
  client.on("end", () => {
    lost = true;
  });
  await client.connect();
  const {
    rows: [result],
  } = await client.query(
    "SELECT pg_try_advisory_lock(20261110,1) AS acquired, pg_backend_pid() AS pid",
  );
  if (!result.acquired) {
    await client.end();
    throw new Error("Database đang được một game-server khác sử dụng.");
  }
  return {
    release: () => client.end(),
    verify: async () => {
      if (lost) throw new Error("Mất kết nối khóa game-server.");
      const {
        rows: [state],
      } = await client.query(
        "SELECT pg_backend_pid() AS pid, EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=20261110 AND objid=1 AND pid=pg_backend_pid() AND granted) AS held",
      );
      if (state.pid !== result.pid || !state.held)
        throw new Error("Mất khóa game-server.");
    },
  };
}
