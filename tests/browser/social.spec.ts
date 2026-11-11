import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Client, type Room } from "colyseus.js";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { db } from "../../apps/server/src/db";
import type {
  SocialAck,
  SocialState,
  ChatMessage,
} from "../../packages/shared/src/index";

const sdk = new Client("ws://127.0.0.1:2567");
const run = promisify(execFile);
function next<T = any>(
  room: Room,
  kind: string,
  match: (value: T) => boolean = () => true,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`No ${kind}`));
    }, 10000);
    const off = room.onMessage(kind, (data: T) => {
      if (match(data)) {
        clearTimeout(timer);
        off();
        resolve(data);
      }
    });
  });
}
async function join(request: APIRequestContext, roomId?: string) {
  const identity = await (await request.get("/api/guest")).json();
  const room = roomId
    ? await sdk.joinById(roomId, { ticket: identity.ticket })
    : await sdk.create("beach", { ticket: identity.ticket });
  room.onMessage("*", () => {});
  let state: SocialState | null = null;
  const messages: ChatMessage[] = [],
    emotes: unknown[] = [];
  room.onMessage("SOCIAL_STATE", (value) => {
    state = value;
  });
  room.onMessage("CHAT_MESSAGE", (value) => messages.push(value));
  room.onMessage("EMOTE", (value) => emotes.push(value));
  room.onMessage("PING", (nonce) => room.send("PONG", nonce));
  await expect.poll(() => state).not.toBeNull();
  return { room, identity, messages, emotes, state: () => state! };
}
async function command(
  room: Room,
  kind: string,
  body: object,
  requestId: string = randomUUID(),
) {
  const response = next<SocialAck>(
    room,
    "SOCIAL_ACK",
    (ack) => ack.requestId === requestId,
  );
  room.send(kind, { ...body, requestId });
  return response;
}
async function moderate(...args: string[]) {
  return run(process.execPath, [
    resolve("apps/server/node_modules/tsx/dist/cli.mjs"),
    resolve("apps/server/src/moderate.ts"),
    ...args,
  ]);
}
test.afterAll(async () => {
  await db.$disconnect();
});

test("room chat validates, throttles and deduplicates; mute/report persist and moderation takes effect", async ({
  playwright,
}) => {
  const requests = await Promise.all(
    Array.from({ length: 3 }, () =>
      playwright.request.newContext({ baseURL: "http://127.0.0.1:5173" }),
    ),
  );
  const a = await join(requests[0]),
    b = await join(requests[1], a.room.roomId),
    c = await join(requests[2]);
  try {
    expect(a.state().members.some((member) => "token" in member)).toBe(false);
    const requestId = randomUUID(),
      text = "<img src=x onerror=alert(1)> Chào biển!";
    const ack = next<SocialAck>(
      a.room,
      "SOCIAL_ACK",
      (value) => value.requestId === requestId,
    );
    for (let i = 0; i < 6; i++) a.room.send("CHAT_SEND", { requestId, text });
    expect((await ack).ok).toBe(true);
    await expect.poll(() => b.messages.length).toBe(1);
    expect(a.messages).toHaveLength(1);
    expect(c.messages).toHaveLength(0);
    expect((await command(a.room, "CHAT_SEND", { text }, requestId)).ok).toBe(
      true,
    );
    expect(
      await db.chatMessage.count({
        where: { guestId: a.identity.profile.id, requestId },
      }),
    ).toBe(1);
    expect((await command(a.room, "CHAT_SEND", { text: "spam" })).ok).toBe(
      false,
    );
    expect(
      (await command(a.room, "CHAT_SEND", { text: "x".repeat(161) })).ok,
    ).toBe(false);
    expect(
      (
        await command(a.room, "CHAT_SEND", {
          text: "forged",
          senderId: b.identity.profile.id,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await command(b.room, "MUTE_SET", {
          targetId: a.identity.profile.id,
          muted: true,
        })
      ).ok,
    ).toBe(true);
    expect(b.state().messages).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 1050));
    expect(
      (await command(a.room, "CHAT_SEND", { text: "Tin bị tắt tiếng" })).ok,
    ).toBe(true);
    expect(a.messages).toHaveLength(2);
    expect(b.messages).toHaveLength(1);
    expect((await command(a.room, "EMOTE_SEND", { emoteId: "wave" })).ok).toBe(
      true,
    );
    expect(b.emotes).toHaveLength(0);
    expect(c.emotes).toHaveLength(0);
    const reportId = randomUUID(),
      report = {
        targetId: a.identity.profile.id,
        reason: "abuse",
        detail: "QA report",
      };
    expect((await command(b.room, "REPORT_SEND", report, reportId)).ok).toBe(
      true,
    );
    expect((await command(b.room, "REPORT_SEND", report, reportId)).ok).toBe(
      true,
    );
    expect((await command(b.room, "REPORT_SEND", report)).ok).toBe(false);
    expect((await command(c.room, "REPORT_SEND", report)).ok).toBe(false);
    const saved = await db.playerReport.findMany({
      where: { guestId: b.identity.profile.id },
    });
    expect(saved).toHaveLength(1);
    expect((saved[0].evidence as any[]).map((message) => message.text)).toEqual(
      [text, "Tin bị tắt tiếng"],
    );
    await moderate("resolve", saved[0].id);
    expect(
      (await db.playerReport.findUniqueOrThrow({ where: { id: saved[0].id } }))
        .status,
    ).toBe("RESOLVED");
    await b.room.leave();
    const returned = await join(requests[1], a.room.roomId);
    b.room = returned.room;
    expect(returned.state().muted).toContainEqual({
      id: a.identity.profile.id,
      name: a.identity.profile.name,
    });
    expect(returned.state().messages).toHaveLength(0);
    expect(
      (
        await command(returned.room, "MUTE_SET", {
          targetId: a.identity.profile.id,
          muted: false,
        })
      ).ok,
    ).toBe(true);
    expect(returned.state().messages).toHaveLength(2);
    const starting = next(a.room, "FISH_STARTED");
    a.room.send("FISH_START");
    await starting;
    expect((await command(a.room, "EMOTE_SEND", { emoteId: "heart" })).ok).toBe(
      false,
    );
    const ended = next(a.room, "FISH_ENDED");
    a.room.send("FISH_CANCEL");
    await ended;
    await moderate("mute", a.identity.profile.id, "5", "QA moderation");
    expect(
      (await command(a.room, "CHAT_SEND", { text: "Không được phát" })).ok,
    ).toBe(false);
    expect((await command(a.room, "EMOTE_SEND", { emoteId: "clap" })).ok).toBe(
      false,
    );
    await moderate("unmute", a.identity.profile.id, "QA finished");
    await new Promise((resolve) => setTimeout(resolve, 1050));
    expect(
      (await command(a.room, "CHAT_SEND", { text: "Chat đã mở lại" })).ok,
    ).toBe(true);
    const kicked = new Promise<number>((resolve) => a.room.onLeave(resolve));
    await moderate("ban", a.identity.profile.id, "5", "QA ban");
    expect(await kicked).toBe(4003);
    const identity = await (await requests[0].get("/api/guest")).json();
    await expect(
      sdk.create("beach", { ticket: identity.ticket }),
    ).rejects.toThrow(/tạm khóa/);
    await moderate("unban", a.identity.profile.id, "QA finished");
  } finally {
    await Promise.allSettled(
      [a.room, b.room, c.room]
        .filter((room) => room.connection.isOpen)
        .map((room) => room.leave()),
    );
    await Promise.all(requests.map((request) => request.dispose()));
  }
});

async function appearance(page: Page, name: string, outfit: string) {
  await page.getByRole("button", { name: "Nhân vật", exact: true }).click();
  await expect(page.getByLabel("Tên nhân vật", { exact: true })).toBeEnabled();
  await page
    .getByRole("button", { name: `Chọn ${outfit}`, exact: true })
    .click();
  await page.getByLabel("Tên nhân vật", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Lưu nhân vật", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
test("two players customize, chat as text, mute/report, emote and type Space while fishing", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  // This test exercises social interactions; graphics defaults are tested separately.
  for (const context of [a, b])
    await context.addInitScript(() =>
      localStorage.setItem(
        "fishing-player-settings",
        JSON.stringify({ version: 1, state: { quality: "low" } }),
      ),
    );
  const p = await a.newPage(),
    q = await b.newPage(),
    errors: string[] = [];
  p.on("pageerror", (error) => errors.push(error.message));
  q.on("pageerror", (error) => errors.push(error.message));
  try {
    await p.goto("/");
    await appearance(p, "Sunny QA", "Nắng hè");
    await p.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await p.getByRole("button", { name: "Tạo phòng mới" }).click();
    await expect(p.getByRole("button", { name: "Thả câu" })).toBeEnabled();
    const code = (await p.locator(".room span").first().innerText()).replace(
      "Mã phòng ",
      "",
    );
    await q.goto("/");
    await appearance(q, "Linh QA", "San hô");
    await q.getByRole("button", { name: "Chọn phòng", exact: true }).click();
    await q.getByRole("textbox", { name: "Mã phòng", exact: true }).fill(code);
    await q.getByRole("button", { name: "Vào phòng", exact: true }).click();
    await p.getByRole("button", { name: "Cộng đồng", exact: true }).click();
    await expect(p.locator(".member-row")).toHaveCount(2);
    const html = "<img src=x onerror=alert(1)>";
    await p.getByRole("textbox", { name: "Tin nhắn", exact: true }).fill(html);
    await p.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
    await expect(p.locator(".chat-line p")).toHaveText(html);
    expect(await p.locator(".chat-line p img").count()).toBe(0);
    await q.getByRole("button", { name: "Mở chat", exact: true }).click();
    await expect(q.locator(".chat-line p")).toHaveText(html);
    await p
      .getByRole("button", { name: "Tùy chọn Linh QA", exact: true })
      .click();
    await p.getByRole("button", { name: "Tắt tiếng", exact: true }).click();
    await expect(
      p.locator(".member-row").filter({ hasText: "Linh QA" }),
    ).toContainText("Đã tắt tiếng");
    await q
      .getByRole("textbox", { name: "Tin nhắn", exact: true })
      .fill("Một tin tạm ẩn");
    await q.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
    await expect(
      q.locator(".chat-line p").filter({ hasText: "Một tin tạm ẩn" }),
    ).toBeVisible();
    await expect(
      p.locator(".chat-line p").filter({ hasText: "Một tin tạm ẩn" }),
    ).toHaveCount(0);
    await p
      .getByRole("button", { name: "Tùy chọn Linh QA", exact: true })
      .click();
    await p.getByRole("button", { name: "Báo cáo", exact: true }).click();
    await p.getByRole("combobox").selectOption("abuse");
    await p.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
    await expect(
      p.getByRole("dialog", { name: "Báo cáo người chơi" }),
    ).toBeHidden();
    await p
      .getByRole("button", { name: "Tùy chọn Linh QA", exact: true })
      .click();
    await p.getByRole("button", { name: "Bỏ tắt tiếng", exact: true }).click();
    await p.screenshot({ path: ".local/m4-community.png" });
    await p.getByRole("button", { name: "Đóng cộng đồng" }).click();
    await q.getByRole("button", { name: "Vẫy tay", exact: true }).click();
    await expect(p.locator(".emote-bubble")).toContainText("👋");
    await p.screenshot({ path: ".local/m4-emote.png" });
    await p.getByRole("button", { name: "Thả câu" }).click();
    await expect(
      p.getByRole("button", { name: "Thu cần", exact: true }),
    ).toBeEnabled();
    await p.getByRole("button", { name: "Mở chat", exact: true }).click();
    const input = p.getByRole("textbox", { name: "Tin nhắn", exact: true });
    await input.fill("Đang câu");
    await input.press("Space");
    await expect(input).toHaveValue("Đang câu ");
    await p.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
    await expect(
      q.locator(".chat-line p").filter({ hasText: "Đang câu" }),
    ).toBeVisible();
    await expect(p.getByRole("button", { name: "Giật cần" })).toBeEnabled();
    await p.getByRole("button", { name: "Thu cần", exact: true }).click();
    await expect(p.getByRole("button", { name: "Thả câu" })).toBeEnabled();
    await p.getByRole("button", { name: "Chỉnh sửa nhân vật" }).click();
    await p.getByRole("button", { name: "Chọn Biển ngọc" }).click();
    await p.getByRole("button", { name: "Lưu nhân vật" }).click();
    await p.reload();
    await p.getByRole("button", { name: "Chơi khách", exact: true }).click();
    await expect(p.locator(".profile img")).toHaveAttribute(
      "src",
      /avatar-ocean/,
    );
    await expect(p.locator(".profile b")).toHaveText("Sunny QA");
    await q.getByRole("button", { name: "Cộng đồng", exact: true }).click();
    await expect(
      q.locator(".member-row").filter({ hasText: "Sunny QA" }).locator("img"),
    ).toHaveAttribute("src", /avatar-ocean/);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});

test("appearance and community fit portrait and landscape; original WAV assets decode", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Nhân vật", exact: true }).click();
  await expect(page.getByLabel("Tên nhân vật", { exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Chọn Nắng hè" }).click();
  await page
    .locator(".appearance-stage > img")
    .evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({ path: ".local/m4-appearance-390.png" });
  await page.getByRole("button", { name: "Lưu nhân vật" }).click();
  await page.getByRole("button", { name: "Chọn phòng", exact: true }).click();
  await page.getByRole("button", { name: "Tạo phòng mới" }).click();
  await expect(page.getByRole("button", { name: "Thả câu" })).toBeEnabled();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Cộng đồng", exact: true }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await page.screenshot({
      path: `.local/m4-community-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "Đóng cộng đồng" }).click();
  }
  const decoded = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      return await Promise.all(
        [
          "tropical-shore",
          "island-melody",
          "bite",
          "cast",
          "hook",
          "catch",
          "click",
          "miss",
        ].map(async (name) => {
          const buffer = await context.decodeAudioData(
            await (await fetch(`/assets/audio/${name}.wav`)).arrayBuffer(),
          );
          return {
            name,
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
          };
        }),
      );
    } finally {
      await context.close();
    }
  });
  expect(decoded).toHaveLength(8);
  expect(
    decoded.every((audio) => audio.duration > 0 && audio.channels === 1),
  ).toBe(true);
});
