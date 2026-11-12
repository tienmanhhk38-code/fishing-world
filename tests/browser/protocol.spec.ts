import { db } from "../../apps/server/src/db";
import { test, expect } from "@playwright/test";
import { Client, type Room } from "colyseus.js";
import {
  canWalk,
  speciesFor,
  type Player,
} from "../../packages/shared/src/index";

const sdk = new Client("ws://127.0.0.1:2567");
async function guest() {
  const response = await fetch("http://127.0.0.1:2567/api/guest");
  return response.json();
}
function nextMessage<T = any>(
  room: Room,
  type: string,
  predicate: (data: T) => boolean = () => true,
  timeout = 25000,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeout);
    const off = room.onMessage(type, (data: T) => {
      if (predicate(data)) {
        clearTimeout(timer);
        off();
        resolve(data);
      }
    });
  });
}
function watch(room: Room) {
  let players: Player[] = [];
  room.onMessage("*", () => {});
  room.onMessage("WORLD", (value) => {
    players = value.filter((p: Player) => !p.kind || p.kind === "player");
  });
  room.onMessage("PING", (nonce) => room.send("PONG", nonce));
  return () => players;
}
async function command(
  room: Room,
  type: string,
  data: unknown,
  response: string,
) {
  const next = nextMessage(room, response);
  room.send(type, data);
  return next;
}
async function walkTo(
  room: Room,
  players: () => Player[],
  x: number,
  z: number,
) {
  const timer = setInterval(() => {
    const player = players().find((value) => value.id === room.sessionId);
    if (!player) return;
    const dx = x - player.x,
      dz = z - player.z,
      distance = Math.hypot(dx, dz);
    room.send(
      "PLAYER_INPUT",
      distance < 0.12
        ? { x: 0, z: 0 }
        : { x: dx / Math.max(distance, 1), z: dz / Math.max(distance, 1) },
    );
  }, 50);
  try {
    await expect
      .poll(
        () => {
          const player = players().find((value) => value.id === room.sessionId);
          return player ? Math.hypot(player.x - x, player.z - z) : Infinity;
        },
        { timeout: 15000 },
      )
      .toBeLessThan(0.35);
  } finally {
    clearInterval(timer);
    room.send("PLAYER_INPUT", { x: 0, z: 0 });
  }
}

test("teleport gates, freshwater reward and reconnect after commit", async () => {
  const identity = await guest();
  let room: Room | null = await sdk.create("beach", {
    ticket: identity.ticket,
  });
  try {
    let players = watch(room);
    await expect.poll(() => players().length).toBe(1);
    expect(
      (
        await command(
          room,
          "TELEPORT_REQUEST",
          { area: "coral" },
          "TELEPORT_RESULT",
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await command(
          room,
          "TELEPORT_REQUEST",
          { area: "village", x: 99, z: 99 },
          "TELEPORT_RESULT",
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await command(
          room,
          "TELEPORT_REQUEST",
          { area: "village" },
          "TELEPORT_RESULT",
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await command(
          room,
          "TELEPORT_REQUEST",
          { area: "beach" },
          "TELEPORT_RESULT",
        )
      ).ok,
    ).toBe(false);
    await walkTo(room, players, 13.2, -49.5);
    const movement = setInterval(
      () => room?.send("PLAYER_INPUT", { x: 1, z: 0 }),
      50,
    );
    await new Promise((resolve) => setTimeout(resolve, 900));
    clearInterval(movement);
    room.send("PLAYER_INPUT", { x: 0, z: 0 });
    const self = players().find((player) => player.id === room!.sessionId)!;
    expect(canWalk(self)).toBe(true);
    expect(self.x).toBeLessThan(15);
    const bite = nextMessage(
      room,
      "FISH_CUE",
      (data) => data.phase === "BITE_WINDOW",
    );
    const started = await command(room, "FISH_START", {}, "FISH_STARTED");
    expect(
      (
        await command(
          room,
          "TELEPORT_REQUEST",
          { area: "beach" },
          "TELEPORT_RESULT",
        )
      ).ok,
    ).toBe(false);
    const saved = await db.fishingRound.findUniqueOrThrow({
      where: { id: started.roundId },
    });
    await db.fishingRound.update({
      where: { id: started.roundId },
      data: { plan: { ...(saved.plan as any), escape: false, reelMs: 450 } },
    });
    await bite;
    const result = nextMessage(room, "FISH_RESULT");
    await command(
      room,
      "FISH_HOOK",
      { roundId: started.roundId },
      "FISH_HOOK_CONFIRMED",
    );
    await result;
    const token = room.reconnectionToken,
      id = room.sessionId,
      roomId = room.roomId;
    await room.leave(false);
    room = null;
    for (let attempt = 0; attempt < 5 && !room; attempt++) {
      try {
        room = await sdk.reconnect(token);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    expect(room).not.toBeNull();
    const session = nextMessage(room!, "SESSION");
    players = watch(room!);
    const restored = await session;
    expect(room!.sessionId).toBe(id);
    expect(room!.roomId).toBe(roomId);
    expect(restored.player.area).toBe("village");
    expect(restored.profile.fish).toHaveLength(1);
    const species = speciesFor(restored.profile.fish[0].species)!;
    expect(species.area).toBe("village");
    expect(restored.profile.xp).toBe(species.xp);
    expect(restored.profile.fish[0]).toMatchObject({
      area: "village",
    });
    await expect
      .poll(() => players().filter((player) => player.id === id).length)
      .toBe(1);
    expect(players().every((player) => !player.showcase)).toBe(true);
  } finally {
    if (room) await room.leave();
  }
});

test("twenty seats spawn inside collision bounds and a full room rejects the next guest", async () => {
  const rooms: Room[] = [];
  try {
    for (let i = 0; i < 20; i++) {
      const identity = await guest();
      const room =
        i === 0
          ? await sdk.create("beach", { ticket: identity.ticket })
          : await sdk.joinById(rooms[0].roomId, { ticket: identity.ticket });
      room.onMessage("*", () => {});
      rooms.push(room);
    }
    const players = watch(rooms[0]);
    await expect.poll(() => players().length).toBe(20);
    expect(players().every(canWalk)).toBe(true);
    const identity = await guest();
    await expect(
      sdk.joinById(rooms[0].roomId, { ticket: identity.ticket }),
    ).rejects.toThrow();
    const listing = await fetch("http://127.0.0.1:2567/api/rooms").then(
      (response) => response.json(),
    );
    expect(
      listing.find((room: { id: string }) => room.id === rooms[0].roomId),
    ).toMatchObject({ clients: 20, maxClients: 20, locked: true });
  } finally {
    await Promise.all(rooms.map((room) => room.leave()));
  }
});

test("reconnecting preserves position while an expired bite stays missed", async () => {
  const identity = await guest();
  let room: Room | null = await sdk.create("beach", {
    ticket: identity.ticket,
  });
  try {
    const players = watch(room);
    await expect.poll(() => players().length).toBe(1);
    const initial = players()[0];
    const started = await command(room, "FISH_START", {}, "FISH_STARTED");
    const token = room.reconnectionToken,
      id = room.sessionId;
    await room.leave(false);
    room = null;
    await new Promise((resolve) => setTimeout(resolve, 22000));
    room = await sdk.reconnect(token);
    const session = nextMessage(room, "SESSION");
    watch(room);
    const restored = await session;
    expect(restored.player).toMatchObject({
      id,
      x: initial.x,
      z: initial.z,
      phase: "IDLE",
    });
    expect(restored.profile.fish).toHaveLength(0);
    expect(restored.profile.xp).toBe(0);
    room.send("FISH_HOOK", { roundId: started.roundId });
  } finally {
    if (room) await room.leave();
  }
});
