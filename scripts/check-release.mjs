import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "colyseus.js";
const base = "https://localhost:8443",
  project = process.env.BETA_PROJECT ?? "fishing-beta-m5",
  origin = base;
const cli = (...args) =>
  execFileSync(
    "docker",
    ["compose", "-p", project, "-f", "compose.beta.yaml", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
const sql = (query) =>
  cli(
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "fishing_admin",
    "-d",
    "fishing",
    "-At",
    "-c",
    query,
  );
const sdk = new Client(base.replace("https:", "wss:"), {
    headers: { Origin: origin },
  }),
  checks = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const api = (path, cookie) =>
  fetch(base + path, {
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
  });
async function guest() {
  const response = await api("/api/guest");
  assert.equal(response.status, 200);
  const raw = response.headers.get("set-cookie");
  assert.match(raw, /__Host-fishing_session=/);
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    assert.ok(raw.includes(attr));
  return { ...(await response.json()), cookie: raw.split(";")[0] };
}
function next(room, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`Timeout ${type}`));
    }, 30000);
    const off = room.onMessage(type, (data) => {
      if (predicate(data)) {
        clearTimeout(timer);
        off();
        resolve(data);
      }
    });
  });
}
async function join(identity) {
  const room = await sdk.create("beach", { ticket: identity.ticket });
  room.onMessage("*", () => {});
  room.onMessage("PING", (nonce) => room.send("PONG", nonce));
  room.onError(() => {});
  return room;
}
async function start(room) {
  const pending = next(room, "FISH_STARTED");
  room.send("FISH_START", {});
  return pending;
}
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/readyz")).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("Backend did not become ready");
}
function stock(id) {
  sql(
    `INSERT INTO "BaitStock" ("guestId","baitId",quantity) VALUES ('${id}','worm',2); UPDATE "Guest" SET "equippedBait"='worm' WHERE id='${id}';`,
  );
}
function snapshot(id) {
  return JSON.parse(
    sql(
      `SELECT json_build_object('xp',g.xp,'active',g."activeRoundId",'stock',(SELECT quantity FROM "BaitStock" WHERE "guestId"=g.id AND "baitId"='worm'),'fish',(SELECT count(*) FROM "Fish" WHERE "guestId"=g.id),'statuses',(SELECT json_agg(status ORDER BY "createdAt") FROM "FishingRound" WHERE "guestId"=g.id)) FROM "Guest" g WHERE id='${id}'`,
    ),
  );
}
const health = await fetch(base + "/readyz");
assert.equal(health.status, 200);
assert.match(health.headers.get("content-security-policy"), /wasm-unsafe-eval/);
assert.equal(health.headers.get("x-content-type-options"), "nosniff");
assert.equal((await fetch(base + "/internal/metrics")).status, 404);
const roles = JSON.parse(
  sql(
    "SELECT json_build_object('super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'schemaCreate',has_schema_privilege('fishing_app','public','CREATE')) FROM pg_roles WHERE rolname='fishing_app'",
  ),
);
assert.deepEqual(roles, {
  super: false,
  createdb: false,
  createrole: false,
  schemaCreate: false,
});
assert.equal(cli("exec", "-T", "app", "id", "-u"), "10001");
checks.push(
  "HTTPS, CSP, HttpOnly/Secure cookie, private metrics, nonroot container and restricted application database role",
);
const winner = await guest(),
  interrupted = await guest(), escaped = await guest();
stock(winner.profile.id);
stock(interrupted.profile.id);stock(escaped.profile.id);
const a = await join(winner),
  b = await join(interrupted);
const bite = next(a, "FISH_CUE", (cue) => cue.phase === "BITE_WINDOW");
const ra = await start(a);
sql(`UPDATE "FishingRound" SET plan=jsonb_set(jsonb_set(plan,'{escape}','false'),'{reelMs}','8000') WHERE id='${ra.roundId}'`);
await bite;
const confirmed = next(a, "FISH_HOOK_CONFIRMED");
a.send("FISH_HOOK", { roundId: ra.roundId });
await confirmed;
await start(b);
assert.equal(snapshot(winner.profile.id).fish,0);
assert.equal(snapshot(escaped.profile.id).fish,0);
// SIGKILL during an accepted durable reel: startup must honor both stored outcomes.
cli("kill", "-s", "SIGKILL", "app");
cli("up", "-d", "app");
await ready();
const win = snapshot(winner.profile.id),
  lost = snapshot(interrupted.profile.id);
assert.equal(win.fish, 1);
assert.ok(win.xp > 0);
assert.equal(win.stock, 1);
assert.equal(win.active, null);
assert.equal(lost.fish, 0);
assert.equal(lost.stock, 2);
assert.equal(lost.active, null);
assert.deepEqual(lost.statuses, ["INTERRUPTED"]);
const restored = await (await api("/api/profile", winner.cookie)).json();
assert.equal(restored.fish.length, 1);
assert.equal(restored.xp, win.xp);
const escapedTicket=await (await api('/api/guest',escaped.cookie)).json();
const e=await join(escapedTicket),escapeBite=next(e,'FISH_CUE',cue=>cue.phase==='BITE_WINDOW');
const re=await start(e);
sql(`UPDATE "FishingRound" SET plan=jsonb_set(jsonb_set(plan,'{escape}','true'),'{reelMs}','8000') WHERE id='${re.roundId}'`);
await escapeBite;const confirmedEscape=next(e,'FISH_HOOK_CONFIRMED');e.send('FISH_HOOK',{roundId:re.roundId});await confirmedEscape;
assert.equal(snapshot(escaped.profile.id).fish,0);
cli('kill','-s','SIGKILL','app');cli('up','-d','app');await ready();
const escapeResult=snapshot(escaped.profile.id);
assert.equal(escapeResult.fish,0);assert.equal(escapeResult.xp,0);assert.equal(escapeResult.stock,1);assert.deepEqual(escapeResult.statuses,['ESCAPED']);
checks.push(
  "SIGKILL during reel restores persisted win/escape without reroll; only successful reel saves fish/XP; pre-hook interruption refunds once; cookie restores inventory",
);
const graceful = await guest();
stock(graceful.profile.id);
const c = await join(graceful);
await start(c);
cli("stop", "app");
cli("up", "-d", "app");
await ready();
assert.equal(snapshot(graceful.profile.id).stock, 2);
assert.deepEqual(snapshot(winner.profile.id), win);
assert.deepEqual(snapshot(interrupted.profile.id), lost);
checks.push(
  "Graceful shutdown refunds active bait; second startup does not duplicate fish, XP or refunds",
);
await mkdir(".local/experience-v4", { recursive: true });
await writeFile(
  ".local/experience-v4/release.json",
  JSON.stringify(
    {
      status: "passed",
      at: new Date().toISOString(),
      scope:
        "Local Docker Linux production image with Caddy HTTPS local CA; no public deployment.",
      checks,
      snapshots: {
        committed: win,
        interrupted: lost,
        escaped: escapeResult,
        graceful: snapshot(graceful.profile.id),
      },
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ status: "passed", checks }));
