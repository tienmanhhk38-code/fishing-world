import { Client, type Room } from "colyseus.js";
import { create } from "zustand";
import { useSettings } from "./settings";
import { enableAudio, playSound, setAudioScene, stopReelSound } from "./audio";
import { receiveMotion, resetMotion, predictJump } from "./motion-client";
export { enableAudio } from "./audio";
import {
  useSocial,
  receiveSocial,
  receiveChat,
  receiveAck,
  emotes,
  clearSocial,
} from "./social-client";
import type {
  Player,
  Profile,
  Phase,
  Fish,
  OpenAreaId,
  AreaId,
  DestinationId,
} from "@fishing/shared";
import { DESTINATIONS } from "@fishing/shared";
export const world = new Map<string, Player>();
export const useGame = create<{
  profile: Profile | null;
  id: string;
  roomId: string;
  phase: Phase;
  roundId: string;
  notice: string;
  connected: boolean;
  rtt: number;
  result: Fish | null;
  count: number;
  actorSignature: string;
  area: OpenAreaId;
  reconnecting: boolean;
  teleportPending: boolean;
  teleportError: string;
  announcement: string;
  hookWindowMs: number;
  leftLobby: boolean;
  showcaseError: string;
  showcaseAck: number;
}>(() => ({
  profile: null,
  id: "",
  roomId: "",
  phase: "IDLE",
  roundId: "",
  notice: "",
  connected: false,
  rtt: 0,
  result: null,
  count: 0,
  actorSignature: "",
  area: "beach",
  reconnecting: false,
  teleportPending: false,
  teleportError: "",
  announcement: "",
  hookWindowMs: 900,
  leftLobby: false,
  showcaseError: "",
  showcaseAck: 0,
}));
let room: Room | null = null;
let leaving = false;
let jumpSeq = 0;
let connecting: Promise<void> | null = null;

export interface JoinOptions {
  roomId?: string;
  create?: boolean;
}
const endpoint = () => {
  const remote = import.meta.env.VITE_GAME_SERVER_URL;
  if (remote) {
    const url = new URL(remote);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Địa chỉ máy chủ game không hợp lệ.");
    return url.origin.replace(/^https:/, "wss:");
  }
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${import.meta.env.DEV ? "/socket" : ""}`;
};
const showcases = new Map<
  string,
  { species: string; grams: number; until: number }
>();
function remember(joined: Room) {
  try {
    sessionStorage.setItem(
      "fishing-room",
      JSON.stringify({
        token: joined.reconnectionToken,
        roomId: joined.roomId,
      }),
    );
  } catch {}
}
function forget() {
  try {
    sessionStorage.removeItem("fishing-room");
  } catch {}
}
function savedRoom(): { token: string; roomId: string } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem("fishing-room") ?? "null");
    return typeof value?.token === "string" && typeof value?.roomId === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function applyProfile(profile: Profile) {
  const current = useGame.getState().profile;
  if (current?.id === profile.id && current.revision > profile.revision) return;
  useGame.setState({ profile });
}
function bind(joined: Room) {
  room = joined;
  leaving = false;
  resetMotion(joined.sessionId);
  setAudioScene("game");
  remember(joined);
  useGame.setState({
    id: joined.sessionId,
    roomId: joined.roomId,
    connected: true,
    leftLobby: false,
    reconnecting: false,
    notice: "Chờ phao chìm và dấu ! rồi giật cần.",
  });
  joined.onMessage("WELCOME", () => {});
  joined.onMessage("SOCIAL_STATE", receiveSocial);
  joined.onMessage("ROOM_MEMBERS", (members) =>
    useSocial.setState({ members }),
  );
  joined.onMessage("CHAT_MESSAGE", receiveChat);
  joined.onMessage("SOCIAL_ACK", receiveAck);
  joined.onMessage("CHAT_MODERATION", ({ until }) =>
    useSocial.setState({ chatMutedUntil: until }),
  );
  joined.onMessage("EMOTE", ({ playerId, emoteId, durationMs }) =>
    emotes.set(playerId, { id: emoteId, until: Date.now() + durationMs }),
  );
  joined.onMessage("PROFILE", applyProfile);
  joined.onMessage("ANNOUNCEMENT", ({ playerName, species, rarity }) =>
    useGame.setState({
      announcement: `${playerName} vừa bắt được ${species} ${rarity === "mythic" ? "Huyền thoại" : "Cực hiếm"}!`,
    }),
  );
  joined.onMessage(
    "SESSION",
    ({
      player,
      profile,
      roundId,
      result,
    }: {
      player: Player;
      profile: Profile;
      roundId: string;
      result?: Fish;
    }) => {
      jumpSeq = Math.max(jumpSeq, player.jumpSeq ?? 0);
      world.set(player.id, player);
      applyProfile(profile);
      useGame.setState({
        area: player.area,
        phase: player.phase,
        roundId,
        result: result ?? null,
      });
    },
  );
  joined.onMessage("WORLD", (players: Player[]) => {
    receiveMotion(players, joined.sessionId, useGame.getState().rtt);
    world.clear();
    for (const player of players) world.set(player.id, player);
    const self = world.get(joined.sessionId);
    const realCount = players.filter(
      (p) => p.connected && (!p.kind || p.kind === "player"),
    ).length;
    useGame.setState((state) => ({
      ...(state.count !== realCount ? { count: realCount } : {}),
      actorSignature: players.map((p) => p.id).join(","),
      ...(self && self.area !== state.area ? { area: self.area } : {}),
    }));
  });
  joined.onMessage("PING", (nonce) => joined.send("PONG", nonce));
  joined.onMessage("RTT", (rtt) => useGame.setState({ rtt }));
  joined.onMessage("NOTICE", (notice) => {
    useGame.setState({ notice });
  });
  joined.onMessage("FISH_STARTED", ({ roundId }) => {
    playSound("cast");
    useGame.setState({ roundId, phase: "CASTING", result: null, notice: "" });
  });
  joined.onMessage(
    "FISH_CUE",
    ({ phase, windowMs, phaseStartedAt, durationMs }) => {
      const p = world.get(joined.sessionId);
      if (p)
        Object.assign(p, {
          phase,
          phaseStartedAt,
          phaseDurationMs: durationMs,
        });
      useGame.setState({ phase, hookWindowMs: windowMs ?? 900 });
      if (phase === "BITE_WINDOW") playSound("bite");
    },
  );
  joined.onMessage("FISH_HOOK_CONFIRMED", ({ reel }) => {
    const p = world.get(joined.sessionId);
    if (p) p.reel = reel;
    playSound("reel");
    playSound("hook");
    useGame.setState({ phase: "REELING" });
  });
  joined.onMessage("FISH_RESULT", (fish: Fish) => {
    stopReelSound();
    playSound("catch");
    useGame.setState({ result: fish, phase: "RESULT" });
  });
  joined.onMessage("SHOWCASE_STARTED", (showcase) => {
    const p = world.get(joined.sessionId);
    if (p) {
      p.showcase = showcase;
      p.phase = "SHOWCASING";
    }
    useGame.setState({
      phase: "SHOWCASING",
      result: null,
      showcaseAck: Date.now(),
      showcaseError: "",
    });
  });
  joined.onMessage("SHOWCASE_ERROR", ({ message }) =>
    useGame.setState({ showcaseError: message }),
  );
  joined.onMessage("FISH_ESCAPED", () => {
    stopReelSound();
    playSound("line-break");
  });
  joined.onMessage("FISH_ENDED", ({ reason }) => {
    if (reason === "early" || reason === "late") playSound("miss");
    stopReelSound();
    useGame.setState({ phase: "IDLE", roundId: "", result: null });
  });
  joined.onMessage("LOBBY_READY", () => {
    clearRoom();
  });
  joined.onMessage("TELEPORT_RESULT", (result) => {
    useGame.setState({
      teleportPending: false,
      teleportError: result.ok ? "" : result.message,
    });
    if (result.ok) {
      resetMotion(joined.sessionId);
      controls.keys.clear();
      controls.x = controls.z = 0;
      const self = world.get(joined.sessionId);
      if (self)
        Object.assign(self, {
          x: result.x,
          z: result.z,
          area: result.area,
          moving: false,
        });
      useGame.setState({
        area: result.area,
        notice: `Đã đến ${result.destination ? DESTINATIONS[result.destination as DestinationId].name : result.area === "village" ? "Làng Chài" : "Bãi Biển"}.`,
      });
    }
  });
  joined.onLeave((code) => {
    if (room !== joined) return;
    if (leaving) {
      clearRoom();
      return;
    }
    room = null;
    connecting = null;
    controls.keys.clear();
    controls.x = controls.z = 0;
    showcases.clear();
    clearSocial();
    stopReelSound();
    for (const player of world.values()) delete player.showcase;
    useGame.setState({ connected: false, teleportPending: false });
    if (code === 4000 || code === 4003 || code === 4008) {
      forget();
      world.clear();
      useGame.setState({
        phase: "IDLE",
        reconnecting: false,
        ...(code === 4008
          ? { notice: "Thao tác được gửi quá nhanh. Hãy vào bến lại." }
          : code === 4003
            ? {
                notice:
                  "Tài khoản đang bị tạm khóa. Hãy liên hệ quản trị viên.",
              }
            : {}),
      });
      return;
    }
    useGame.setState({
      reconnecting: true,
      notice: "Đang kết nối lại, giữ chỗ tối đa 30 giây…",
    });
    connecting = recover(joined.reconnectionToken).catch(() => {
      forget();
      connecting = null;
      world.clear();
      useGame.setState({
        phase: "IDLE",
        count: 0,
        reconnecting: false,
        notice: "Phiên giữ chỗ đã hết. Bấm Kết nối lại để vào bến.",
      });
    });
  });
  joined.onError(() =>
    useGame.setState({ notice: "Kết nối gặp lỗi. Đang kiểm tra phiên chơi…" }),
  );
}
async function recover(token: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const joined = await new Client(endpoint()).reconnect(token);
      bind(joined);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Reconnection expired");
}
export function connect(options: JoinOptions = {}) {
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const client = new Client(endpoint()),
        saved = savedRoom();
      if (saved) {
        let restored: Room | null = null;
        for (let attempt = 0; attempt < 4 && !restored; attempt++) {
          try {
            restored = await client.reconnect(saved.token);
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
        if (restored) {
          if (
            !options.create &&
            (!options.roomId || options.roomId.toUpperCase() === saved.roomId)
          ) {
            bind(restored);
            return;
          }
          restored.onMessage("*", () => {});
          await restored.leave();
        }
        forget();
      }
      const response = await fetch("/api/guest", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải hồ sơ.");
      const { ticket, profile } = await response.json();
      applyProfile(profile);
      const joined = options.create
        ? await client.create("beach", { ticket })
        : options.roomId
          ? await client.joinById(options.roomId.trim().toUpperCase(), {
              ticket,
            })
          : await client.joinOrCreate("beach", { ticket });
      bind(joined);
    } catch (error) {
      connecting = null;
      const text =
        error instanceof Error ? error.message : "Không thể vào phòng.";
      const message = /locked|full/i.test(text)
        ? "Phòng đã đầy. Hãy chọn phòng khác."
        : /not found|not defined|doesn't exist/i.test(text)
          ? "Không tìm thấy phòng với mã này."
          : text;
      useGame.setState({ notice: message, reconnecting: false });
      throw new Error(message);
    }
  })();
  return connecting;
}
export function requestTeleport(destination: DestinationId) {
  if (!room || useGame.getState().teleportPending) return;
  useGame.setState({ teleportPending: true, teleportError: "" });
  room.send("TELEPORT_REQUEST", { destination });
}

export function send(type: string, data: unknown = {}) {
  room?.send(type, data);
}
export function action() {
  const s = useGame.getState();
  if (!s.connected) return;
  if (s.phase === "IDLE") send("FISH_START");
  else if (s.phase === "RESULT") send("FISH_CONTINUE");
  else if (
    ["WAITING", "APPROACHING", "NIBBLING", "BITE_WINDOW"].includes(s.phase)
  )
    send("FISH_HOOK", { roundId: s.roundId });
}
export async function leaveToLobby() {
  leaving = true;
  controls.keys.clear();
  controls.x = controls.z = 0;
  controls.sprint = false;
  if (room) {
    room.send("LEAVE_GAME");
    setTimeout(() => {
      if (leaving && room) {
        void room.leave();
        clearRoom();
      }
    }, 5000);
  } else clearRoom();
}
function clearRoom() {
  leaving = true;
  room = null;
  connecting = null;
  forget();
  world.clear();
  resetMotion();
  clearSocial();
  stopReelSound();
  setAudioScene("lobby");
  useGame.setState({
    id: "",
    roomId: "",
    connected: false,
    reconnecting: false,
    phase: "IDLE",
    roundId: "",
    result: null,
    count: 0,
    teleportPending: false,
    leftLobby: true,
  });
}
export function jump() {
  const s = useGame.getState();
  if (!s.connected || !["IDLE", "SHOWCASING"].includes(s.phase)) return;
  predictJump(++jumpSeq);
  send("PLAYER_JUMP", { seq: jumpSeq });
}
export const controls = {
  yaw: 0.35,
  pitch: 0.3,
  x: 0,
  z: 0,
  sprint: false,
  keys: new Set<string>(),
};
