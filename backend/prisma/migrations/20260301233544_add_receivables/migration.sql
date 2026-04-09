-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "receivables" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "phoneNumber" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "installmentNumber" INTEGER,
    "totalInstallments" INTEGER,
    "recurringGroupId" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "lastNotificationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receivables_clientId_idx" ON "receivables"("clientId");
CREATE INDEX IF NOT EXISTS "receivables_status_idx" ON "receivables"("status");
CREATE INDEX IF NOT EXISTS "receivables_dueDate_idx" ON "receivables"("dueDate");
CREATE INDEX IF NOT EXISTS "receivables_recurringGroupId_idx" ON "receivables"("recurringGroupId");

-- AddForeignKey (só se a tabela clients existir)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        ALTER TABLE "receivables" ADD CONSTRAINT "receivables_clientId_fkey" 
            FOREIGN KEY ("clientId") REFERENCES "clients"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
