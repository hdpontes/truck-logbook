-- CreateTable: receivable_payments
CREATE TABLE IF NOT EXISTS "receivable_payments" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptPath" TEXT,
    "receiptFileName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receivable_payments_receivableId_idx" ON "receivable_payments"("receivableId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receivable_payments_paymentDate_idx" ON "receivable_payments"("paymentDate");

-- AddForeignKey
ALTER TABLE "receivable_payments" 
    DROP CONSTRAINT IF EXISTS "receivable_payments_receivableId_fkey";

ALTER TABLE "receivable_payments" 
    ADD CONSTRAINT "receivable_payments_receivableId_fkey" 
    FOREIGN KEY ("receivableId") REFERENCES "receivables"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
