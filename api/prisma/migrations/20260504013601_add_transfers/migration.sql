-- CreateTable
CREATE TABLE "TransferQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "sendAmount" DOUBLE PRECISION NOT NULL,
    "midMarketRate" DOUBLE PRECISION NOT NULL,
    "ourRate" DOUBLE PRECISION NOT NULL,
    "markupPct" DOUBLE PRECISION NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "receiveAmount" DOUBLE PRECISION NOT NULL,
    "speedTier" TEXT NOT NULL,
    "deliveryEtaMin" INTEGER NOT NULL,
    "deliveryEtaMax" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recipientName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferQuote_userId_idx" ON "TransferQuote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_quoteId_key" ON "Transfer"("quoteId");

-- CreateIndex
CREATE INDEX "Transfer_userId_idx" ON "Transfer"("userId");

-- AddForeignKey
ALTER TABLE "TransferQuote" ADD CONSTRAINT "TransferQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "TransferQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
