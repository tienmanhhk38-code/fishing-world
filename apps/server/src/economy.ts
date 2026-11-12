import { randomUUID, createHash, randomInt } from "node:crypto";
import type { Prisma, Guest } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { selectCatch } from "./catch-selection";
import { questStates, recordQuestSale } from "./quests";
import {
  validName,
  SPECIES,
  RODS,
  BAITS,
  speciesFor,
  fishPrice,
  levelProgress,
  type Profile,
  type Fish,
  type RodId,
  type BaitId,
  type OpenAreaId,
  catchPresentation,
  questDay,
} from "@fishing/shared";

type Tx = Prisma.TransactionClient;
export class GameError extends Error {}
const rod = z.enum(["wood", "bamboo", "carbon"]),
  bait = z.enum(["dough", "worm", "shrimp"]);
const requestId = z.string().uuid();
export const operationSchema = z.discriminatedUnion("action", [
  z
    .object({
      requestId,
      action: z.literal("sell"),
      quoteId: z.string().uuid(),
    })
    .strict(),
  z.object({ requestId, action: z.literal("buyRod"), itemId: rod }).strict(),
  z.object({ requestId, action: z.literal("equipRod"), itemId: rod }).strict(),
  z
    .object({
      requestId,
      action: z.literal("buyBait"),
      itemId: z.enum(["worm", "shrimp"]),
      quantity: z.number().int().min(1).max(100),
    })
    .strict(),
  z
    .object({ requestId, action: z.literal("equipBait"), itemId: bait })
    .strict(),
  z.object({ requestId, action: z.literal("viewShop") }).strict(),
]);

async function lockAccount(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Guest" WHERE "id" = ${id} FOR UPDATE`;
  let guest = await tx.guest.findUniqueOrThrow({ where: { id } });
  if (guest.catalogVersion === 0) {
    const fish = await tx.fish.findMany({ where: { guestId: id } });
    const album = new Map<string, { count: number; recordGrams: number }>();
    for (const item of fish) {
      const species = speciesFor(item.speciesId ?? item.species);
      if (!species) continue;
      await tx.fish.update({
        where: { id: item.id },
        data: {
          speciesId: species.id,
          saleValue: item.saleValue ?? fishPrice(species, item.grams),
        },
      });
      const entry = album.get(species.id) ?? { count: 0, recordGrams: 0 };
      entry.count++;
      entry.recordGrams = Math.max(entry.recordGrams, item.grams);
      album.set(species.id, entry);
    }
    for (const [speciesId, entry] of album)
      await tx.album.upsert({
        where: { guestId_speciesId: { guestId: id, speciesId } },
        create: { guestId: id, speciesId, ...entry },
        update: entry,
      });
    guest = await tx.guest.update({
      where: { id },
      data: { catalogVersion: 1, revision: { increment: 1 } },
    });
  }
  return guest;
}
async function account<T>(
  id: string,
  work: (tx: Tx, guest: Guest) => Promise<T>,
) {
  return db.$transaction(async (tx) => work(tx, await lockAccount(tx, id)), {
    maxWait: 5000,
    timeout: 15000,
  });
}
function fishDto(item: {
  id: string;
  species: string;
  speciesId: string | null;
  area: string;
  grams: number;
  caughtAt: Date;
  saleValue: number | null;
  xp: number;
}): Fish {
  const species = speciesFor(item.speciesId ?? item.species);
  return {
    ...item,
    area: item.area as OpenAreaId,
    caughtAt: item.caughtAt.toISOString(),
    speciesId: species?.id,
    saleValue:
      item.saleValue ??
      (species
        ? fishPrice(species, item.grams)
        : Math.max(1, Math.round(item.grams / 100))),
    rarity: species?.rarity ?? "common",
  };
}
async function profile(tx: Tx, id: string): Promise<Profile> {
  const guest = await tx.guest.findUniqueOrThrow({ where: { id } });
  const [fish, rods, stock, album] = await Promise.all([
    tx.fish.findMany({
      where: { guestId: id, soldAt: null },
      orderBy: { caughtAt: "desc" },
    }),
    tx.ownedRod.findMany({ where: { guestId: id } }),
    tx.baitStock.findMany({ where: { guestId: id } }),
    tx.album.findMany({
      where: { guestId: id },
      orderBy: { speciesId: "asc" },
    }),
  ]);
  const caught = album.reduce((sum, entry) => sum + entry.count, 0);
  return {
    id,
    name: guest.name,
    appearanceId: guest.appearanceId as Profile["appearanceId"],
    xp: guest.xp,
    coins: guest.coins,
    revision: guest.revision,
    fish: fish.map(fishDto),
    equippedRod: guest.equippedRod as RodId,
    equippedBait: guest.equippedBait as BaitId,
    ownedRods: [
      "wood",
      ...rods.map((item) => item.rodId as RodId).filter((id) => id !== "wood"),
    ],
    baitCounts: {
      dough: -1,
      worm: stock.find((item) => item.baitId === "worm")?.quantity ?? 0,
      shrimp: stock.find((item) => item.baitId === "shrimp")?.quantity ?? 0,
    },
    album: album.map(({ speciesId, count, recordGrams }) => ({
      speciesId,
      count,
      recordGrams,
    })),
    tutorialStep: !guest.tutorialMoved
      ? 0
      : caught === 0
        ? 1
        : !guest.tutorialSold
          ? 2
          : !guest.tutorialShop
            ? 3
            : 4,
    ...(await questStates(tx, id)),
  };
}
export function getProfile(id: string) {
  return account(id, (tx) => profile(tx, id));
}
export function customizeProfile(
  id: string,
  name: string,
  appearanceId: Profile["appearanceId"],
) {
  return account(id, async (tx, guest) => {
    ensureIdle(guest);
    const normalized = validName(name);
    if (!normalized) throw new GameError("Tên cần từ 2 đến 20 ký tự.");
    await tx.guest.update({
      where: { id },
      data: { name: normalized, appearanceId, revision: { increment: 1 } },
    });
    return profile(tx, id);
  });
}
function ensureIdle(guest: Guest) {
  if (guest.activeRoundId)
    throw new GameError("Hãy thu cần trước khi thay đổi hành trang.");
}

export async function prepareSale(id: string, fishId?: string) {
  return account(id, async (tx, guest) => {
    ensureIdle(guest);
    const fish = await tx.fish.findMany({
      where: { guestId: id, soldAt: null, ...(fishId ? { id: fishId } : {}) },
    });
    if (!fish.length) throw new GameError("Chưa có cá hợp lệ để bán.");
    const total = fish.reduce((sum, item) => sum + fishDto(item).saleValue!, 0);
    const quote = await tx.saleQuote.create({
      data: {
        guestId: id,
        fishIds: fish.map((item) => item.id),
        total,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    return {
      id: quote.id,
      count: fish.length,
      total,
      expiresAt: quote.expiresAt.toISOString(),
    };
  });
}
export async function economyOperation(
  id: string,
  input: z.infer<typeof operationSchema>,
  authorizeAction: () => void = () => {},
) {
  const { requestId, ...action } = input;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(action))
    .digest("hex");
  return account(id, async (tx, guest) => {
    const existing = await tx.economyOperation.findUnique({
      where: { guestId_requestId: { guestId: id, requestId } },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new GameError("Mã thao tác đã dùng cho một yêu cầu khác.");
      return {
        ok: existing.success,
        message: existing.message,
        profile: await profile(tx, id),
      };
    }
    authorizeAction();
    const operationId = randomUUID();
    let delta = 0,
      message = "Đã cập nhật hành trang.";
    try {
      ensureIdle(guest);
      switch (action.action) {
        case "sell": {
          const quote = await tx.saleQuote.findFirst({
            where: { id: action.quoteId, guestId: id },
          });
          if (!quote || quote.expiresAt.getTime() < Date.now())
            throw new GameError("Xác nhận bán đã hết hạn. Hãy chọn cá lại.");
          const fish = await tx.fish.findMany({
            where: { guestId: id, id: { in: quote.fishIds }, soldAt: null },
          });
          if (fish.length !== quote.fishIds.length)
            throw new GameError(
              "Túi cá đã thay đổi. Hãy kiểm tra và xác nhận lại.",
            );
          delta = fish.reduce((sum, item) => sum + fishDto(item).saleValue!, 0);
          if (delta !== quote.total)
            throw new GameError("Giá cá đã thay đổi. Hãy xác nhận lại.");
          await tx.fish.updateMany({
            where: { guestId: id, id: { in: quote.fishIds }, soldAt: null },
            data: { soldAt: new Date() },
          });
          await recordQuestSale(tx, id, delta);
          await tx.guest.update({
            where: { id },
            data: { tutorialSold: true },
          });
          message = `Đã bán ${fish.length} cá, nhận ${delta} Xu.`;
          break;
        }
        case "buyRod": {
          const item = RODS[action.itemId];
          if (
            action.itemId === "wood" ||
            (await tx.ownedRod.findUnique({
              where: { guestId_rodId: { guestId: id, rodId: action.itemId } },
            }))
          )
            throw new GameError("Bạn đã sở hữu cần này.");
          if (levelProgress(guest.xp).level < item.level)
            throw new GameError(
              `Cần đạt cấp ${item.level} để mua ${item.name}.`,
            );
          if (guest.coins < item.price) throw new GameError("Bạn chưa đủ Xu.");
          await tx.ownedRod.create({
            data: { guestId: id, rodId: action.itemId },
          });
          delta = -item.price;
          message = `Đã mua ${item.name}.`;
          break;
        }
        case "buyBait": {
          const item = BAITS[action.itemId];
          delta = -item.price * action.quantity;
          if (guest.coins + delta < 0) throw new GameError("Bạn chưa đủ Xu.");
          await tx.baitStock.upsert({
            where: { guestId_baitId: { guestId: id, baitId: action.itemId } },
            create: {
              guestId: id,
              baitId: action.itemId,
              quantity: action.quantity,
            },
            update: { quantity: { increment: action.quantity } },
          });
          message = `Đã mua ${action.quantity} ${item.name.toLowerCase()}.`;
          break;
        }
        case "equipRod": {
          if (
            action.itemId !== "wood" &&
            !(await tx.ownedRod.findUnique({
              where: { guestId_rodId: { guestId: id, rodId: action.itemId } },
            }))
          )
            throw new GameError("Bạn chưa sở hữu cần này.");
          await tx.guest.update({
            where: { id },
            data: { equippedRod: action.itemId },
          });
          message = `Đang dùng ${RODS[action.itemId].name}.`;
          break;
        }
        case "equipBait": {
          if (action.itemId !== "dough") {
            const stock = await tx.baitStock.findUnique({
              where: { guestId_baitId: { guestId: id, baitId: action.itemId } },
            });
            if (!stock || stock.quantity < 1)
              throw new GameError("Bạn đã hết loại mồi này.");
          }
          await tx.guest.update({
            where: { id },
            data: { equippedBait: action.itemId },
          });
          message = `Đang dùng ${BAITS[action.itemId].name}.`;
          break;
        }
        case "viewShop": {
          if (guest.tutorialSold)
            await tx.guest.update({
              where: { id },
              data: { tutorialShop: true },
            });
          message = "Chọn cần hoặc mồi cho chuyến câu tiếp theo.";
          break;
        }
      }
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      await tx.economyOperation.create({
        data: {
          id: operationId,
          guestId: id,
          requestId,
          fingerprint,
          message: error.message,
          success: false,
        },
      });
      return {
        ok: false,
        message: error.message,
        profile: await profile(tx, id),
      };
    }
    if (delta)
      await tx.coinLedger.create({
        data: { guestId: id, delta, reason: action.action, operationId },
      });
    await tx.guest.update({
      where: { id },
      data: { coins: { increment: delta }, revision: { increment: 1 } },
    });
    await tx.economyOperation.create({
      data: { id: operationId, guestId: id, requestId, fingerprint, message },
    });
    return { ok: true, message, profile: await profile(tx, id) };
  });
}

export function beginFishing(id: string, roundId: string, area: OpenAreaId) {
  return account(id, async (tx, guest) => {
    ensureIdle(guest);
    const rod = guest.equippedRod as RodId,
      bait = guest.equippedBait as BaitId;
    if (bait !== "dough") {
      const changed = await tx.baitStock.updateMany({
        where: { guestId: id, baitId: bait, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (!changed.count)
        throw new GameError("Đã hết mồi. Mở Túi đồ để chọn mồi thường vô hạn.");
    }
    const selected = selectCatch(area, rod, bait);
    const plan = {
      ...catchPresentation(selected.species, selected.grams),
      escape:
        randomInt(0, 1000000) / 1000000 <
        catchPresentation(selected.species, selected.grams).escapeChance,
      seed: randomInt(0, 1000000),
    };
    await tx.fishingRound.create({
      data: {
        id: roundId,
        guestId: id,
        area,
        baitId: bait,
        selected: selected as unknown as Prisma.InputJsonValue,
        plan,
      },
    });
    await tx.guest.update({
      where: { id },
      data: { activeRoundId: roundId, revision: { increment: 1 } },
    });
    return { selected, plan, rod, bait, profile: await profile(tx, id) };
  });
}
export function commitCatch(
  id: string,
  roundId: string,
  selected: ReturnType<typeof selectCatch>,
) {
  return account(id, async (tx, guest) => {
    const candidate = await tx.fishingRound.findFirstOrThrow({
      where: { id: roundId, guestId: id },
    });
    if (candidate.status === "COMMITTED") {
      const fish = await tx.fish.findUniqueOrThrow({ where: { roundId } });
      return { fish: fishDto(fish), profile: await profile(tx, id) };
    }
    if (
      candidate.status !== "REELING" ||
      !candidate.reelEndsAt ||
      candidate.reelEndsAt.getTime() > Date.now() ||
      (candidate.plan as any)?.escape
    )
      throw new GameError("Lượt kéo chưa thành công.");
    const changed = await tx.fishingRound.updateMany({
      where: { id: roundId, guestId: id, status: "REELING" },
      data: { status: "COMMITTED" },
    });
    if (!changed.count || guest.activeRoundId !== roundId)
      throw new GameError("Lượt câu đã được xử lý.");
    const round = await tx.fishingRound.findUniqueOrThrow({
      where: { id: roundId },
    });
    const { species, grams } = candidate.selected as unknown as ReturnType<
      typeof selectCatch
    >;
    const previous = await tx.album.findUnique({
      where: { guestId_speciesId: { guestId: id, speciesId: species.id } },
    });
    const fish = await tx.fish.create({
      data: {
        guestId: id,
        roundId,
        species: species.name,
        speciesId: species.id,
        area: round.area,
        grams,
        saleValue: fishPrice(species, grams),
        xp: species.xp,
      },
    });
    await tx.album.upsert({
      where: { guestId_speciesId: { guestId: id, speciesId: species.id } },
      create: {
        guestId: id,
        speciesId: species.id,
        count: 1,
        recordGrams: grams,
      },
      update: {
        count: { increment: 1 },
        recordGrams: Math.max(grams, previous?.recordGrams ?? 0),
      },
    });
    await tx.guest.update({
      where: { id },
      data: {
        activeRoundId: null,
        xp: { increment: species.xp },
        revision: { increment: 1 },
      },
    });
    return {
      fish: {
        ...fishDto(fish),
        newSpecies: !previous,
        newRecord: grams > (previous?.recordGrams ?? 0),
      },
      profile: await profile(tx, id),
    };
  });
}
export function finishFishing(
  id: string,
  roundId: string,
  interrupted = false,
) {
  return account(id, async (tx, guest) => {
    const round = await tx.fishingRound.findFirst({
      where: { id: roundId, guestId: id },
    });
    if (round?.status === "REELING" && interrupted) return profile(tx, id);
    if (round?.status === "ACTIVE" || round?.status === "REELING") {
      await tx.fishingRound.update({
        where: { id: roundId },
        data: { status: interrupted ? "INTERRUPTED" : "CANCELLED" },
      });
      if (interrupted && round.baitId !== "dough")
        await tx.baitStock.upsert({
          where: { guestId_baitId: { guestId: id, baitId: round.baitId } },
          create: { guestId: id, baitId: round.baitId, quantity: 1 },
          update: { quantity: { increment: 1 } },
        });
    }
    if (guest.activeRoundId === roundId)
      await tx.guest.update({
        where: { id },
        data: { activeRoundId: null, revision: { increment: 1 } },
      });
    return profile(tx, id);
  });
}
export function recordMovement(id: string) {
  return account(id, async (tx, guest) => {
    if (!guest.tutorialMoved)
      await tx.guest.update({
        where: { id },
        data: { tutorialMoved: true, revision: { increment: 1 } },
      });
    return profile(tx, id);
  });
}
export async function recoverFishing() {
  const unfinished = await db.fishingRound.findMany({
    where: { status: { in: ["ACTIVE", "REELING"] } },
  });
  await Promise.all(
    unfinished.map(async (round) => {
      if (round.status === "REELING" && round.reelEndsAt) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(
              0,
              Math.min(12000, round.reelEndsAt!.getTime() - Date.now()),
            ),
          ),
        );
        await settleReel(round.guestId, round.id);
      } else await finishFishing(round.guestId, round.id, true);
    }),
  );
  await db.guest.updateMany({
    where: { activeRoundId: { not: null } },
    data: { activeRoundId: null, revision: { increment: 1 } },
  });
}

export function startReel(id: string, roundId: string) {
  return account(id, async (tx, guest) => {
    const round = await tx.fishingRound.findFirstOrThrow({
      where: { id: roundId, guestId: id },
    });
    if (round.status !== "ACTIVE" || guest.activeRoundId !== roundId)
      throw new GameError("Lượt câu đã được xử lý.");
    const plan = round.plan as unknown as ReturnType<
      typeof catchPresentation
    > & { seed: number; escape: boolean };
    const startedAt = Date.now(),
      reelEndsAt = new Date(startedAt + plan.reelMs);
    await tx.fishingRound.update({
      where: { id: roundId },
      data: { status: "REELING", hookedAt: new Date(startedAt), reelEndsAt },
    });
    return { startedAt, durationMs: plan.reelMs, seed: plan.seed };
  });
}
export async function settleReel(id: string, roundId: string) {
  const round = await db.fishingRound.findFirstOrThrow({
    where: { id: roundId, guestId: id },
  });
  if (round.status === "COMMITTED")
    return {
      fish: fishDto(await db.fish.findUniqueOrThrow({ where: { roundId } })),
      profile: await getProfile(id),
    };
  if (round.status !== "REELING")
    return { fish: null, profile: await getProfile(id) };
  if (!round.reelEndsAt || round.reelEndsAt.getTime() > Date.now())
    throw new GameError("Đang kéo cá.");
  if ((round.plan as any)?.escape)
    return account(id, async (tx, guest) => {
      const changed = await tx.fishingRound.updateMany({
        where: { id: roundId, guestId: id, status: "REELING" },
        data: { status: "ESCAPED" },
      });
      if (changed.count && guest.activeRoundId === roundId)
        await tx.guest.update({
          where: { id },
          data: { activeRoundId: null, revision: { increment: 1 } },
        });
      return { fish: null, profile: await profile(tx, id) };
    });
  return commitCatch(
    id,
    roundId,
    round.selected as unknown as ReturnType<typeof selectCatch>,
  );
}
export function recordJump(id: string) {
  return account(id, async (tx, guest) => {
    if (!guest.questJumped)
      await tx.guest.update({
        where: { id },
        data: { questJumped: true, revision: { increment: 1 } },
      });
    return profile(tx, id);
  });
}
export function claimQuest(
  id: string,
  questId: string,
  period: string,
  requestId: string,
) {
  return account(id, async (tx) => {
    const reused = await tx.questClaim.findUnique({
      where: { guestId_requestId: { guestId: id, requestId } },
    });
    if (reused && (reused.questId !== questId || reused.period !== period))
      throw new GameError("Mã nhận thưởng đã dùng.");
    const state = (await questStates(tx, id)).quests.find(
      (q) => q.id === questId && q.period === period,
    );
    if (!state) throw new GameError("Nhiệm vụ đã hết hạn.");
    if (state.claimed)
      return {
        profile: await profile(tx, id),
        message: "Phần thưởng đã nhận.",
      };
    if (!state.available || state.progress < state.goal)
      throw new GameError("Chưa hoàn thành nhiệm vụ.");
    await tx.questClaim.create({
      data: { guestId: id, questId, period, requestId },
    });
    await tx.guest.update({
      where: { id },
      data: {
        coins: { increment: state.coins },
        xp: { increment: state.xp },
        revision: { increment: 1 },
      },
    });
    await tx.coinLedger.create({
      data: {
        guestId: id,
        delta: state.coins,
        reason: "quest",
        operationId: `quest:${id}:${questId}:${period}`,
      },
    });
    if (state.worms)
      await tx.baitStock.upsert({
        where: { guestId_baitId: { guestId: id, baitId: "worm" } },
        create: { guestId: id, baitId: "worm", quantity: state.worms },
        update: { quantity: { increment: state.worms } },
      });
    return {
      profile: await profile(tx, id),
      message: `Đã nhận ${state.coins} Xu, ${state.xp} XP.`,
    };
  });
}
