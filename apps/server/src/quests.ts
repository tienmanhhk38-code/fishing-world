import type { Prisma } from "@prisma/client";
import {
  QUESTS,
  questDay,
  questResetAt,
  type QuestState,
} from "@fishing/shared";
type Tx = Prisma.TransactionClient;
export async function questStates(tx: Tx, id: string, now = new Date()) {
  const day = questDay(now),
    start = new Date(day + "T00:00:00+07:00");
  const [guest, claims, totals, daily, stock, progress] = await Promise.all([
    tx.guest.findUniqueOrThrow({ where: { id } }),
    tx.questClaim.findMany({ where: { guestId: id } }),
    tx.fish.groupBy({ by: ["area"], where: { guestId: id }, _count: true }),
    tx.fish.groupBy({
      by: ["area"],
      where: {
        guestId: id,
        caughtAt: { gte: start, lt: new Date(start.getTime() + 86400000) },
      },
      _count: true,
    }),
    tx.ownedRod.findUnique({
      where: { guestId_rodId: { guestId: id, rodId: "bamboo" } },
    }),
    tx.questProgress.findMany({ where: { guestId: id, metric: "sold" } }),
  ]);
  // Existing sale history is authoritative for the onboarding backfill. Daily
  // counters are incremented in the same transaction as each successful sale.
  const historical = await tx.coinLedger.aggregate({
    where: { guestId: id, reason: "sell", delta: { gt: 0 } },
    _sum: { delta: true },
  });
  const values = (kind: "intro" | "daily") => ({
    moveJump: Number(guest.tutorialMoved && guest.questJumped),
    caught: (kind === "intro" ? totals : daily).reduce(
      (n, r) => n + r._count,
      0,
    ),
    fresh: (kind === "intro" ? totals : daily)
      .filter((r) => r.area === "village")
      .reduce((n, r) => n + r._count, 0),
    sold:
      kind === "intro"
        ? (historical._sum.delta ?? 0)
        : (progress.find((p) => p.period === day)?.value ?? 0),
    bamboo: Number(!!stock && guest.equippedRod === "bamboo"),
  });
  let unlocked = true;
  const quests: QuestState[] = QUESTS.map((q) => {
    const period = q.kind === "intro" ? "intro" : day,
      claimed = claims.some((c) => c.questId === q.id && c.period === period),
      available = q.kind === "daily" || unlocked;
    const result = {
      ...q,
      period,
      progress: Math.min(q.goal, values(q.kind)[q.metric]),
      claimed,
      available,
    };
    if (q.kind === "intro" && !claimed) unlocked = false;
    return result;
  });
  return { quests, questResetAt: questResetAt(now) };
}
export async function recordQuestSale(
  tx: Tx,
  id: string,
  amount: number,
  now = new Date(),
) {
  const key = { guestId: id, metric: "sold", period: questDay(now) };
  await tx.questProgress.upsert({
    where: { guestId_metric_period: key },
    create: { ...key, value: amount },
    update: { value: { increment: amount } },
  });
}
