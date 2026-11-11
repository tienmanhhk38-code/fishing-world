import { test, expect } from "@playwright/test";
import { Client } from "colyseus.js";
import {
  canWalk,
  waterAt,
  onPlatform,
  type Player,
} from "../../packages/shared/src/index";
test("casts from arbitrary pier, beach and lake banks; land rejects casts and water blocks walking", async ({
  request,
}) => {
  test.setTimeout(120000);
  const guest = await (await request.get("/api/guest")).json();
  const room = await new Client("ws://127.0.0.1:2567").create("beach", {
    ticket: guest.ticket,
  });
  let self: Player | undefined;
  const notices: string[] = [];
  room.onMessage("*", () => {});
  room.onMessage("WORLD", (players: Player[]) => {
    self = players.find((p) => p.id === room.sessionId);
  });
  room.onMessage("PING", (n) => room.send("PONG", n));
  room.onMessage("NOTICE", (n) => notices.push(n));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function drive(x: number, z: number) {
    const start = Date.now();
    while (!self || Math.hypot(x - self.x, z - self.z) > 0.23) {
      if (Date.now() - start > 18000)
        throw new Error("Blocked route " + JSON.stringify({ x, z, self }));
      if (self) {
        const dx = x - self.x,
          dz = z - self.z,
          d = Math.max(1, Math.hypot(dx, dz));
        room.send("PLAYER_INPUT", { x: dx / d, z: dz / d });
      }
      await sleep(50);
    }
    room.send("PLAYER_INPUT", { x: 0, z: 0 });
    await sleep(100);
  }
  async function cast(area: string) {
    await sleep(800);
    room.send("FISH_START", {});
    await expect.poll(() => self?.phase).toBe("CASTING");
    expect(waterAt(self!.bobber)).toBe(area);
    expect(onPlatform(self!.bobber)).toBe(false);
    room.send("FISH_CANCEL");
    await expect.poll(() => self?.phase).toBe("IDLE");
  }
  try {
    await expect.poll(() => !!self).toBe(true);
    await drive(6.3, 1.2);
    await cast("beach");
    await drive(-22, 1.2);
    await drive(-22, -10);
    await cast("beach");
    const teleported = new Promise<void>(resolve=>room.onMessage("TELEPORT_RESULT",()=>resolve()));
    room.send("TELEPORT_REQUEST",{area:"village"});await teleported;
    await drive(13.2,-49.5);
    await cast("village");
    room.send("PLAYER_INPUT", { x: 1, z: 0 });
    await sleep(1400);
    room.send("PLAYER_INPUT", { x: 0, z: 0 });
    await sleep(150);
    expect(self!.x).toBeLessThan(15);
    expect(canWalk(self!)).toBe(true);
    await drive(10,-49.5);
    await sleep(800);
    room.send("FISH_START", {});
    await expect
      .poll(() => notices.some((n) => n.includes("mép nước")))
      .toBe(true);
    expect(self!.phase).toBe("IDLE");
  } finally {
    await room.leave();
  }
});
