import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("apps/server/package.json", root), "utf8"),
);
await build({
  entryPoints: [fileURLToPath(new URL("apps/server/src/index.ts", root))],
  outfile: fileURLToPath(new URL("apps/server/dist/index.mjs", root)),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external: Object.keys(manifest.dependencies).filter(
    (name) => name !== "@fishing/shared",
  ),
  logLevel: "info",
});
