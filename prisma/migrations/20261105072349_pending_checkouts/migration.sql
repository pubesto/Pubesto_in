-- CreateTable
CREATE TABLE "pending_checkouts" (
    "razorpayOrderId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_checkouts_pkey" PRIMARY KEY ("razorpayOrderId")
);

-- CreateIndex
CREATE INDEX "pending_checkouts_createdAt_idx" ON "pending_checkouts"("createdAt");
