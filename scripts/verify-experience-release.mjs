import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.CAPTURE_URL ?? "https://localhost:8443";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const source = await readFile("apps/client/dist/index.html");
assert.equal((await fetch(base + "/readyz")).status, 200);
const indexResponse = await fetch(base + "/?release=experience-v4");
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
for(const file of ['ui/island-map-reference.png','audio/nibble.wav','audio/reel.wav','harbor-v2/fisher_sailor.glb','audio/music/lobby-song.mp3','audio/music/game-song.mp3']){
 const response=await fetch(base+'/assets/'+file);assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(await readFile('apps/client/public/assets/'+file)),file);
}
const range=await fetch(base+'/assets/audio/music/game-song.mp3',{headers:{Range:'bytes=0-127'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,128);
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
  ".local/experience-v4/deployed-bundles.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
