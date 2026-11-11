import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
// Docker Compose uses secret files; managed hosts can inject URLs directly.
if (process.env.DATABASE_PASSWORD_FILE) {
  const password = (
    await readFile(process.env.DATABASE_PASSWORD_FILE, "utf8")
  ).trim();
  if (password.length < 32)
    throw new Error("Database secret must contain at least 32 characters.");
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(process.env.DATABASE_USER ?? "fishing")}:${encodeURIComponent(password)}@${process.env.DATABASE_HOST ?? "postgres"}:${process.env.DATABASE_PORT ?? 5432}/${process.env.DATABASE_NAME ?? "fishing"}?connection_limit=12&pool_timeout=10`;
}
if (!process.env.DATABASE_URL)
  throw new Error("Missing DATABASE_URL or DATABASE_PASSWORD_FILE.");
if (process.env.APP_MODE === "migrate" || process.argv.includes("--migrate")) {
  process.env.DATABASE_URL =
    process.env.MIGRATION_DATABASE_URL ??
    process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL;
  const migration = spawnSync(
    process.execPath,
    [
      "apps/server/node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "apps/server/prisma/schema.prisma",
    ],
    { stdio: "inherit", env: process.env },
  );
  process.exit(migration.status ?? 1);
}
if (process.env.METRICS_TOKEN_FILE) {
  process.env.METRICS_TOKEN = (
    await readFile(process.env.METRICS_TOKEN_FILE, "utf8")
  ).trim();
}
delete process.env.MIGRATION_DATABASE_URL;
const child = spawn(process.execPath, ["apps/server/dist/index.mjs"], {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
