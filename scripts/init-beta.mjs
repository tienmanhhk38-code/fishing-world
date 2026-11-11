import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const directory = new URL("../.local/beta/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const name of [
  "db-password.txt",
  "db-admin-password.txt",
  "metrics-token.txt",
])
  try {
    await writeFile(new URL(name, directory), randomBytes(32).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
console.log("Local beta secrets are ready; existing values were preserved.");
