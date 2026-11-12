import { create } from "zustand";
import { send, useGame } from "./network";
import { serverNow } from "./motion-client";
import type {
  RoomMember,
  ChatMessage,
  MutedPlayer,
  SocialState,
  SocialAck,
  EmoteId,
} from "@fishing/shared";
export const emotes = new Map<string, { id: EmoteId; until: number }>();
export const speech = new Map<string, ChatMessage>();
export const useSocial = create<{
  members: RoomMember[];
  messages: ChatMessage[];
  muted: MutedPlayer[];
  chatMutedUntil: string | null;
  notice: string;
  error: string;
  draft: string;
  nearbyDraft: string;
  sending: boolean;
}>(() => ({
  members: [],
  messages: [],
  muted: [],
  chatMutedUntil: null,
  notice: "",
  error: "",
  draft: "",
  nearbyDraft: "",
  sending: false,
}));
const pending = new Map<
  string,
  {
    resolve: (ack: SocialAck) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
class SocialError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
  }
}
export function receiveSocial(state: SocialState) {
  const mutedIds = new Set(state.muted.map((player) => player.id));
  for (const member of state.members)
    if (mutedIds.has(member.publicId)) {
      emotes.delete(member.id);
      speech.delete(member.id);
    }
  useSocial.setState(state);
}
export function receiveChat(message: ChatMessage) {
  const state = useSocial.getState();
  if (
    state.muted.some((player) => player.id === message.senderId) ||
    state.messages.some((item) => item.id === message.id)
  )
    return;
  if (message.channel === "nearby") {
    if (
      message.playerId &&
      message.expiresAt &&
      message.expiresAt > serverNow()
    )
      speech.set(message.playerId, message);
    return;
  }
  useSocial.setState({ messages: [...state.messages, message].slice(-80) });
}
export function receiveAck(ack: SocialAck) {
  const task = pending.get(ack.requestId);
  if (!task) return;
  clearTimeout(task.timer);
  pending.delete(ack.requestId);
  task.resolve(ack);
}
export async function socialAction(
  kind: string,
  body: object,
  requestId: string = crypto.randomUUID(),
) {
  if (!useGame.getState().connected) throw new Error("Hãy kết nối lại phòng.");
  if (pending.has(requestId)) throw new Error("Đang chờ phản hồi.");
  useSocial.setState({ error: "", notice: "" });
  const ack = await new Promise<SocialAck>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("Chưa nhận được phản hồi. Hãy thử lại."));
    }, 8000);
    pending.set(requestId, { resolve, reject, timer });
    send(kind, { ...body, requestId });
  }).catch((error) => {
    useSocial.setState({ error: error.message });
    throw error;
  });
  if (!ack.ok) {
    useSocial.setState({ error: ack.message });
    throw new SocialError(ack.message, !ack.retryable);
  }
  if (kind !== "CHAT_SEND" && kind !== "EMOTE_SEND")
    useSocial.setState({ notice: ack.message });
}
let chatAttempt: {
  text: string;
  requestId: string;
  context: string;
  channel: "world" | "nearby";
} | null = null;
export async function sendChat(channel: "world" | "nearby" = "world") {
  const state = useSocial.getState(),
    text = (channel === "nearby" ? state.nearbyDraft : state.draft).trim();
  if (!text || state.sending) return;
  const game = useGame.getState(),
    context = `${game.profile?.id}:${game.roomId}`;
  if (
    chatAttempt?.text !== text ||
    chatAttempt?.context !== context ||
    chatAttempt?.channel !== channel
  )
    chatAttempt = { text, requestId: crypto.randomUUID(), context, channel };
  useSocial.setState({ sending: true });
  try {
    await socialAction("CHAT_SEND", { text, channel }, chatAttempt.requestId);
    const key = channel === "nearby" ? "nearbyDraft" : "draft";
    if (useSocial.getState()[key].trim() === text)
      useSocial.setState({ [key]: "" });
    chatAttempt = null;
  } catch (error) {
    if (error instanceof SocialError && error.permanent) chatAttempt = null;
    throw error;
  } finally {
    useSocial.setState({ sending: false });
  }
}
export function clearSocial() {
  emotes.clear();
  speech.clear();
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.reject(new Error("Kết nối bị ngắt. Hãy kết nối lại phòng."));
  }
  pending.clear();
}
