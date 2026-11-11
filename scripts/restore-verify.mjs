import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Client,
  databaseUrl,
  pgEnvironment,
  command,
  fileHash,
  tableDigests,
} from "./db-tools.mjs";
const dump = resolve(process.env.RESTORE_DUMP ?? ""),
  name = process.env.RESTORE_DATABASE_NAME ?? "";
const applicationRole = process.env.RESTORE_APP_ROLE;
if (applicationRole && !/^[a-z][a-z0-9_]{0,62}$/.test(applicationRole))
  throw new Error("RESTORE_APP_ROLE must be a PostgreSQL role identifier.");
if (!/^fishing_restore_[a-z0-9_]+$/.test(name))
  throw new Error(
    "RESTORE_DATABASE_NAME must use a fresh fishing_restore_* name.",
  );
const manifest = JSON.parse(await readFile(dump + ".manifest.json", "utf8"));
if ((await fileHash(dump)) !== manifest.sha256)
  throw new Error(
    "Backup SHA-256 verification failed; no database was changed.",
  );
const source = databaseUrl(),
  target = new URL(source),
  adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
target.pathname = "/" + name;
if (source.pathname === target.pathname)
  throw new Error("Refusing to restore into the source database.");
const admin = new Client({ connectionString: adminUrl.toString() });
try {
  await admin.connect();
  if (
    (await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount
  )
    throw new Error("Target database already exists; restore refused.");
  if (applicationRole) {
    const role = (
      await admin.query(
        "SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1",
        [applicationRole],
      )
    ).rows[0];
    if (!role || role.rolsuper || role.rolcreatedb || role.rolcreaterole)
      throw new Error(
        "RESTORE_APP_ROLE must already exist without administrator privileges.",
      );
  }
  await admin.query(`CREATE DATABASE "${name}"`);
} finally {
  await admin.end();
}
await command(
  "pg_restore",
  ["--exit-on-error", "--no-owner", "--no-acl", `--dbname=${name}`, dump],
  pgEnvironment(target),
);
const client = new Client({ connectionString: target.toString() });
try {
  await client.connect();
  const actual = await tableDigests(client),
    matches = JSON.stringify(actual) === JSON.stringify(manifest.tables);
  if (matches && applicationRole) {
    const role = `"${applicationRole}"`;
    await client.query(
      `GRANT CONNECT ON DATABASE "${name}" TO ${role}; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO ${role}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${role}; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO ${role};`,
    );
    if (actual._prisma_migrations)
      await client.query(
        `REVOKE ALL ON TABLE public._prisma_migrations FROM ${role}`,
      );
  }
  const report = {
    status: matches ? "passed" : "failed",
    sourceSha256: manifest.sha256,
    targetDatabase: name,
    ...(applicationRole ? { applicationRole } : {}),
    tables: actual,
    verifiedAt: new Date().toISOString(),
  };
  await writeFile(
    dump + ".restore-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      status: report.status,
      targetDatabase: name,
      verifiedTables: Object.keys(actual).length,
    }),
  );
  if (!matches) process.exitCode = 1;
} finally {
  await client.end();
}
