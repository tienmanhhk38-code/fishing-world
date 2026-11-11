import net from "node:net";
import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { Client } from "colyseus.js";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
for (const rtt of [50, 150, 300]) {
  const sockets = new Set();
  let jitterIndex = 0;
  const proxy = net.createServer((down) => {
    const up = net.connect(2567, "127.0.0.1");
    sockets.add(down);
    sockets.add(up);
    for (const [from, to] of [
      [down, up],
      [up, down],
    ]) {
      let last = 0;
      from.on("data", (chunk) => {
        // Ordered wire delay in both directions; deterministic +/- 10 ms jitter.
        const due = Math.max(
          last + 0.01,
          performance.now() + rtt / 2 + [-10, 0, 10, 0][jitterIndex++ % 4],
        );
        last = due;
        setTimeout(
          () => {
            if (!to.destroyed) to.write(chunk);
          },
          Math.max(0, due - performance.now()),
        );
      });
      from.on("error", () => to.destroy());
      from.on("close", () => {
        sockets.delete(from);
        to.destroy();
      });
    }
  });
  await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const { ticket } = await (
    await fetch("http://127.0.0.1:2567/api/guest")
  ).json();
  const room = await new Client(
    `ws://127.0.0.1:${proxy.address().port}`,
  ).create("beach", { ticket });
  room.onMessage("*", () => {});
  room.onMessage("PING", (nonce) => room.send("PONG", nonce));
  function next(type, predicate = () => true) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timeout ${type} at RTT ${rtt}`));
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
  try {
    await sleep(2500);
    const start = next("FISH_STARTED"),
      bite = next("FISH_CUE", (cue) => cue.phase === "BITE_WINDOW");
    room.send("FISH_START", {});
    const { roundId } = await start;
    await bite;
    // 180 ms reaction is valid for every rarity, including the 400 ms window.
    await sleep(180);
    const confirmed = next("FISH_HOOK_CONFIRMED");
    room.send("FISH_HOOK", { roundId });
    await confirmed;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Reel did not resolve')),16000);
      room.onMessage('FISH_RESULT',()=>{room.send('FISH_STOW',{});clearTimeout(timer);resolve()});
      room.onMessage('FISH_ESCAPED',()=>{clearTimeout(timer);resolve()});
    });
    await sleep(900);
    const second = next("FISH_STARTED"),
      waiting = next("FISH_CUE", (cue) => cue.phase === "WAITING");
    room.send("FISH_START", {});
    const other = await second;
    await waiting;
    const ended = next("FISH_ENDED"),
      notice = next("NOTICE");
    room.send("FISH_HOOK", { roundId: other.roundId });
    await ended;
    assert.match(JSON.stringify(await notice), /early|sớm/i);
    results.push({
      rttMs: rtt,
      jitterOneWayMs: 10,
      reactionMs: 180,
      hookAndSettlement: "passed",
      earlyHook: "rejected",
    });
  } finally {
    await room.leave();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => proxy.close(resolve));
  }
}
await mkdir(".local/m5", { recursive: true });
await writeFile(
  ".local/experience-v4/latency.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "Real bidirectional TCP delay, loopback development backend; ordered deterministic jitter, not Internet packet-loss certification.",
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results));
