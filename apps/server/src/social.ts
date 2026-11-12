import { performance } from "node:perf_hooks";
import type { Client } from "@colyseus/core";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { GameError } from "./economy";
import {
  cleanChat,
  within,
  NEARBY_CHAT_RADIUS,
  type ChatMessage,
  type RoomMember,
  type AppearanceId,
  type SocialAck,
} from "@fishing/shared";

const id = z.string().uuid();
const chatSchema = z
  .object({
    requestId: id,
    text: z.string().max(2000),
    channel: z.enum(["world", "nearby"]).optional().default("world"),
  })
  .strict();
const muteSchema = z
  .object({ requestId: id, targetId: id, muted: z.boolean() })
  .strict();
const reportSchema = z
  .object({
    requestId: id,
    targetId: id,
    reason: z.enum(["spam", "abuse", "other"]),
    detail: z.string().max(300),
  })
  .strict();
const emoteSchema = z
  .object({
    requestId: id,
    emoteId: z.enum(["wave", "happy", "heart", "clap"]),
  })
  .strict();
type Host = {
  roomId: string;
  clients: Client[];
  members: () => RoomMember[];
  idle: (sessionId: string) => boolean;
  position: (sessionId: string) => { x: number; z: number } | undefined;
};

async function locked<T>(
  guestId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Guest" WHERE "id" = ${guestId} FOR UPDATE`;
      return work(tx);
    },
    { maxWait: 5000, timeout: 10000 },
  );
}
export function ensureNotBanned(guest: { bannedUntil: Date | null }) {
  if (guest.bannedUntil && guest.bannedUntil.getTime() > Date.now())
    throw new GameError(
      "Tài khoản đang bị tạm khóa. Hãy liên hệ quản trị viên.",
    );
}
export class RoomSocial {
  private history: ChatMessage[] = [];
  private muted = new Map<string, Set<string>>();
  private emoteAt = new Map<string, number>();
  private recentEmotes = new Map<string, string[]>();
  private commandBudget = new Map<string, { at: number; count: number }>();
  private inFlight = new Map<string, Promise<void>>();
  constructor(private host: Host) {}
  members() {
    for (const c of this.host.clients)
      c.send("ROOM_MEMBERS", this.host.members());
  }
  async join(c: Client) {
    const [mutes, guest] = await Promise.all([
      db.playerMute.findMany({ where: { guestId: c.auth } }),
      db.guest.findUniqueOrThrow({ where: { id: c.auth } }),
    ]);
    this.muted.set(c.auth, new Set(mutes.map((mute) => mute.targetId)));
    const targets = await db.guest.findMany({
      where: { id: { in: mutes.map((mute) => mute.targetId) } },
      select: { id: true, name: true },
    });
    c.send("SOCIAL_STATE", {
      members: this.host.members(),
      messages: this.history.filter(
        (message) => !this.muted.get(c.auth)!.has(message.senderId),
      ),
      muted: targets,
      chatMutedUntil: guest.chatMutedUntil?.toISOString() ?? null,
    });
    this.members();
  }
  leave(guestId: string) {
    this.muted.delete(guestId);
    this.emoteAt.delete(guestId);
    this.recentEmotes.delete(guestId);
    this.commandBudget.delete(guestId);
    this.members();
  }
  async handle(c: Client, kind: string, raw: unknown) {
    const now = performance.now(),
      current = this.commandBudget.get(c.auth);
    const budget =
      current && now - current.at < 1000 ? current : { at: now, count: 0 };
    this.commandBudget.set(c.auth, budget);
    if (++budget.count > 20) return;
    const candidate = raw as { requestId?: unknown };
    const requestId =
      typeof candidate?.requestId === "string" &&
      id.safeParse(candidate.requestId).success
        ? candidate.requestId
        : "";
    if (!requestId) return;
    const key = `${c.auth}:${kind}:${requestId}`;
    const existing = this.inFlight.get(key);
    if (existing) {
      await existing;
      return;
    }
    const task = this.execute(c, kind, raw, requestId).finally(() =>
      this.inFlight.delete(key),
    );
    this.inFlight.set(key, task);
    await task;
  }
  private async execute(
    c: Client,
    kind: string,
    raw: unknown,
    requestId: string,
  ) {
    const ack = (ok: boolean, message: string, retryable = false) =>
      c.send("SOCIAL_ACK", {
        requestId,
        ok,
        message,
        retryable,
      } satisfies SocialAck);
    try {
      if (
        !this.host
          .members()
          .some((member) => member.id === c.sessionId && member.connected)
      )
        throw new GameError("Hãy kết nối lại phòng.");
      if (kind === "CHAT_SEND") {
        const parsed = chatSchema.safeParse(raw);
        if (!parsed.success) throw new GameError("Tin nhắn không hợp lệ.");
        const text = cleanChat(parsed.data.text),
          channel = parsed.data.channel;
        if (!text || Array.from(text).length > 160)
          throw new GameError("Tin nhắn cần từ 1 đến 160 ký tự.");
        const saved = await locked(c.auth, async (tx) => {
          const previous = await tx.chatMessage.findUnique({
            where: { guestId_requestId: { guestId: c.auth, requestId } },
          });
          if (previous) {
            if (
              previous.text !== text ||
              previous.roomId !== this.host.roomId ||
              previous.channel !== channel
            )
              throw new GameError("Mã tin nhắn đã được dùng.");
            return null;
          }
          const guest = await tx.guest.findUniqueOrThrow({
            where: { id: c.auth },
          });
          ensureNotBanned(guest);
          if (
            guest.chatMutedUntil &&
            guest.chatMutedUntil.getTime() > Date.now()
          )
            throw new GameError("Bạn đang bị tạm tắt chat.");
          const last = await tx.chatMessage.findFirst({
            where: { guestId: c.auth },
            orderBy: { createdAt: "desc" },
          });
          if (last && Date.now() - last.createdAt.getTime() < 1000)
            throw new GameError("Chờ 1 giây trước khi gửi tin tiếp theo.");
          return tx.chatMessage.create({
            data: {
              guestId: c.auth,
              requestId,
              roomId: this.host.roomId,
              text,
              channel,
              name: guest.name,
              appearanceId: guest.appearanceId,
            },
          });
        });
        if (saved) {
          const message: ChatMessage = {
            id: saved.id,
            senderId: saved.guestId,
            name: saved.name,
            appearanceId: saved.appearanceId as AppearanceId,
            text: saved.text,
            createdAt: saved.createdAt.toISOString(),
            channel,
            playerId: c.sessionId,
            expiresAt: saved.createdAt.getTime() + 6000,
          };
          if (channel === "world")
            this.history = [...this.history, message].slice(-80);
          for (const recipient of this.host.clients)
            if (
              this.muted.has(recipient.auth) &&
              !this.muted.get(recipient.auth)!.has(c.auth) &&
              (channel === "world" ||
                within(
                  this.host.position(c.sessionId),
                  this.host.position(recipient.sessionId),
                  NEARBY_CHAT_RADIUS,
                ))
            )
              recipient.send("CHAT_MESSAGE", message);
        }
        ack(true, "Đã gửi.");
      } else if (kind === "MUTE_SET") {
        const parsed = muteSchema.safeParse(raw);
        if (!parsed.success || parsed.data.targetId === c.auth)
          throw new GameError("Người chơi không hợp lệ.");
        const { targetId, muted } = parsed.data;
        if (
          muted &&
          !this.host.members().some((member) => member.publicId === targetId)
        )
          throw new GameError("Người chơi đã rời phòng.");
        if (muted)
          await db.playerMute.upsert({
            where: { guestId_targetId: { guestId: c.auth, targetId } },
            create: { guestId: c.auth, targetId },
            update: {},
          });
        else
          await db.playerMute.deleteMany({
            where: { guestId: c.auth, targetId },
          });
        await this.join(c);
        ack(
          true,
          muted
            ? "Đã tắt tin nhắn và emote của người chơi này."
            : "Đã bỏ tắt tiếng.",
        );
      } else if (kind === "REPORT_SEND") {
        const parsed = reportSchema.safeParse(raw);
        if (!parsed.success || parsed.data.targetId === c.auth)
          throw new GameError("Báo cáo không hợp lệ.");
        const { targetId, reason, detail: inputDetail } = parsed.data,
          detail = cleanChat(inputDetail);
        await locked(c.auth, async (tx) => {
          const previous = await tx.playerReport.findUnique({
            where: { guestId_requestId: { guestId: c.auth, requestId } },
          });
          if (previous) {
            if (
              previous.targetId !== targetId ||
              previous.reason !== reason ||
              previous.detail !== detail ||
              previous.roomId !== this.host.roomId
            )
              throw new GameError("Mã báo cáo đã được dùng.");
            return;
          }
          if (
            !this.host.members().some((member) => member.publicId === targetId)
          )
            throw new GameError("Người chơi đã rời phòng.");
          const recent = await tx.playerReport.findFirst({
            where: {
              guestId: c.auth,
              targetId,
              createdAt: { gt: new Date(Date.now() - 600000) },
            },
          });
          if (recent)
            throw new GameError(
              "Bạn đã báo cáo người chơi này. Hãy chờ quản trị viên xem xét.",
            );
          const count = await tx.playerReport.count({
            where: {
              guestId: c.auth,
              createdAt: { gt: new Date(Date.now() - 600000) },
            },
          });
          if (count >= 5)
            throw new GameError("Đã đạt giới hạn báo cáo. Hãy thử lại sau.");
          await tx.playerReport.create({
            data: {
              guestId: c.auth,
              targetId,
              requestId,
              roomId: this.host.roomId,
              reason,
              detail,
              evidence: (
                await tx.chatMessage.findMany({
                  where: { guestId: targetId, roomId: this.host.roomId },
                  orderBy: { createdAt: "desc" },
                  take: 20,
                })
              )
                .reverse()
                .map((m) => ({
                  id: m.id,
                  senderId: m.guestId,
                  name: m.name,
                  text: m.text,
                  channel: m.channel,
                  createdAt: m.createdAt.toISOString(),
                })) as Prisma.InputJsonValue,
            },
          });
        });
        ack(true, "Đã lưu báo cáo để quản trị viên xem xét.");
      } else if (kind === "EMOTE_SEND") {
        const parsed = emoteSchema.safeParse(raw);
        if (!parsed.success) throw new GameError("Emote không hợp lệ.");
        const seen = this.recentEmotes.get(c.auth) ?? [];
        if (seen.includes(requestId)) {
          ack(true, "Đã gửi emote.");
          return;
        }
        if (!this.host.idle(c.sessionId))
          throw new GameError("Hãy thu cần trước khi dùng emote.");
        if (performance.now() - (this.emoteAt.get(c.auth) ?? -Infinity) < 2000)
          throw new GameError("Chờ một chút trước khi dùng emote tiếp.");
        const guest = await db.guest.findUniqueOrThrow({
          where: { id: c.auth },
        });
        ensureNotBanned(guest);
        if (guest.chatMutedUntil && guest.chatMutedUntil.getTime() > Date.now())
          throw new GameError("Bạn đang bị tạm tắt chat.");
        // Reserve before another request can cross the asynchronous DB lookup.
        if (!this.host.idle(c.sessionId))
          throw new GameError("Hãy thu cần trước khi dùng emote.");
        if (performance.now() - (this.emoteAt.get(c.auth) ?? -Infinity) < 2000)
          throw new GameError("Chờ một chút trước khi dùng emote tiếp.");
        this.emoteAt.set(c.auth, performance.now());
        this.recentEmotes.set(c.auth, [...seen, requestId].slice(-30));
        for (const recipient of this.host.clients)
          if (
            this.muted.has(recipient.auth) &&
            !this.muted.get(recipient.auth)!.has(c.auth)
          )
            recipient.send("EMOTE", {
              playerId: c.sessionId,
              emoteId: parsed.data.emoteId,
              durationMs: 3000,
            });
        ack(true, "Đã gửi emote.");
      }
    } catch (error) {
      if (!(error instanceof GameError))
        console.error("Social operation failed", error);
      ack(
        false,
        error instanceof GameError
          ? error.message
          : "Chưa lưu được. Hãy thử lại cùng thao tác.",
        !(error instanceof GameError),
      );
    }
  }
}
