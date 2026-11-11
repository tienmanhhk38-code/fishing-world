import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.CAPTURE_URL ?? "https://localhost:8443";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const source = await readFile("apps/client/dist/index.html");
assert.equal((await fetch(base + "/readyz")).status, 200);
const indexResponse = await fetch(base + "/?release=island-v3");
const policy = indexResponse.headers.get("content-security-policy") ?? "";
assert.match(
  policy,
  /connect-src[^;]*\bblob:/,
  "Embedded GLB textures must be fetchable under the production CSP",
);
assert.match(policy, /script-src 'self'/);
const html = Buffer.from(await indexResponse.arrayBuffer());
assert.equal(
  hash(html),
  hash(source),
  "Production index must match the final local build",
);
const files = [
  ...source
    .toString()
    .matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.(?:js|css))"/g),
].map((m) => m[1]);
assert.ok(files.some((f) => f.endsWith(".js")));
for (const file of files) {
  const response = await fetch(base + file);
  assert.equal(response.status, 200);
  assert.equal(
    hash(Buffer.from(await response.arrayBuffer())),
    hash(await readFile("apps/client/dist" + file)),
    file,
  );
}
const result = {
  at: new Date().toISOString(),
  url: base,
  health: true,
  indexSHA256: hash(source),
  bundleFiles: files,
  hashesMatch: true,
  embeddedTexturesAllowed: true,
};
await writeFile(
  ".local/island-v3/release.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
