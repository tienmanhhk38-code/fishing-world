-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appearanceId" TEXT NOT NULL DEFAULT 'sailor',
    "chatMutedUntil" TIMESTAMP(3),
    "bannedUntil" TIMESTAMP(3),
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "catalogVersion" INTEGER NOT NULL DEFAULT 0,
    "equippedRod" TEXT NOT NULL DEFAULT 'wood',
    "equippedBait" TEXT NOT NULL DEFAULT 'dough',
    "activeRoundId" TEXT,
    "tutorialMoved" BOOLEAN NOT NULL DEFAULT false,
    "tutorialSold" BOOLEAN NOT NULL DEFAULT false,
    "tutorialShop" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishingRound" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "area" TEXT NOT NULL DEFAULT 'beach',
    "baitId" TEXT NOT NULL DEFAULT 'dough',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FishingRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fish" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "speciesId" TEXT,
    "saleValue" INTEGER,
    "xp" INTEGER NOT NULL DEFAULT 20,
    "soldAt" TIMESTAMP(3),
    "area" TEXT NOT NULL DEFAULT 'beach',
    "grams" INTEGER NOT NULL,
    "caughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnedRod" (
    "guestId" TEXT NOT NULL,
    "rodId" TEXT NOT NULL,

    CONSTRAINT "OwnedRod_pkey" PRIMARY KEY ("guestId","rodId")
);

-- CreateTable
CREATE TABLE "BaitStock" (
    "guestId" TEXT NOT NULL,
    "baitId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BaitStock_pkey" PRIMARY KEY ("guestId","baitId")
);

-- CreateTable
CREATE TABLE "Album" (
    "guestId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "recordGrams" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("guestId","speciesId")
);

-- CreateTable
CREATE TABLE "SaleQuote" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "fishIds" TEXT[],
    "total" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyOperation" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appearanceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMute" (
    "guestId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerMute_pkey" PRIMARY KEY ("guestId","targetId")
);

-- CreateTable
CREATE TABLE "PlayerReport" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "PlayerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guest_token_key" ON "Guest"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Fish_roundId_key" ON "Fish"("roundId");

-- CreateIndex
CREATE INDEX "Fish_guestId_soldAt_idx" ON "Fish"("guestId", "soldAt");

-- CreateIndex
CREATE INDEX "SaleQuote_guestId_idx" ON "SaleQuote"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "EconomyOperation_guestId_requestId_key" ON "EconomyOperation"("guestId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedger_operationId_key" ON "CoinLedger"("operationId");

-- CreateIndex
CREATE INDEX "CoinLedger_guestId_idx" ON "CoinLedger"("guestId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_guestId_createdAt_idx" ON "ChatMessage"("guestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_guestId_requestId_key" ON "ChatMessage"("guestId", "requestId");

-- CreateIndex
CREATE INDEX "PlayerReport_status_createdAt_idx" ON "PlayerReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerReport_guestId_targetId_createdAt_idx" ON "PlayerReport"("guestId", "targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerReport_guestId_requestId_key" ON "PlayerReport"("guestId", "requestId");

-- AddForeignKey
ALTER TABLE "FishingRound" ADD CONSTRAINT "FishingRound_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fish" ADD CONSTRAINT "Fish_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fish" ADD CONSTRAINT "Fish_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "FishingRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
