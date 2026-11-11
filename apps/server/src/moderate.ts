import { db } from "./db";
// Local operator CLI. No moderation credentials or routes are shipped to clients.
const [command = "reports", target, duration, ...words] = process.argv.slice(2);
try {
  if (command === "reports") {
    console.log(
      JSON.stringify(
        await db.playerReport.findMany({
          where: { status: "OPEN" },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        null,
        2,
      ),
    );
  } else if (command === "resolve") {
    if (!target) throw new Error("Cần ID báo cáo.");
    await db.playerReport.update({
      where: { id: target },
      data: { status: "RESOLVED" },
    });
    console.log("Đã đánh dấu báo cáo được xem xét.");
  } else if (["mute", "unmute", "ban", "unban"].includes(command)) {
    if (!target || !/^[a-f0-9-]{36}$/i.test(target))
      throw new Error("Cần UUID người chơi.");
    const timed = command === "mute" || command === "ban";
    const minutes = Number(duration);
    if (timed && (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080))
      throw new Error("Thời gian từ 1 đến 10.080 phút.");
    const reason = (
      timed ? words.join(" ") : [duration, ...words].filter(Boolean).join(" ")
    ).trim();
    if (!reason) throw new Error("Cần ghi lý do quản trị.");
    const until = timed ? new Date(Date.now() + minutes * 60000) : null;
    await db.$transaction([
      db.guest.update({
        where: { id: target },
        data: command.includes("ban")
          ? { bannedUntil: until }
          : { chatMutedUntil: until },
      }),
      db.moderationLog.create({
        data: { targetId: target, action: command, reason, until },
      }),
    ]);
    console.log(
      `Đã ${command} người chơi ${target}${until ? ` đến ${until.toISOString()}` : ""}.`,
    );
  } else
    throw new Error(
      "Lệnh: reports | resolve <reportId> | mute/ban <guestId> <phút> <lý do> | unmute/unban <guestId> <lý do>",
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Không thể cập nhật.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
