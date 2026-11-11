ALTER TABLE "Guest" ADD COLUMN "questJumped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FishingRound" ADD COLUMN "selected" JSONB, ADD COLUMN "plan" JSONB, ADD COLUMN "hookedAt" TIMESTAMP(3), ADD COLUMN "reelEndsAt" TIMESTAMP(3);
CREATE INDEX "Fish_guestId_caughtAt_idx" ON "Fish"("guestId", "caughtAt");
CREATE TABLE "QuestProgress" ("guestId" TEXT NOT NULL, "metric" TEXT NOT NULL, "period" TEXT NOT NULL, "value" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("guestId", "metric", "period"));
CREATE TABLE "QuestClaim" ("guestId" TEXT NOT NULL, "questId" TEXT NOT NULL, "period" TEXT NOT NULL, "requestId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "QuestClaim_pkey" PRIMARY KEY ("guestId", "questId", "period"));
CREATE UNIQUE INDEX "QuestClaim_guestId_requestId_key" ON "QuestClaim"("guestId", "requestId");
