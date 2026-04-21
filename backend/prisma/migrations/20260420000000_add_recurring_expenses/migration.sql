-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "RecurringExpenseStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'FINANCING';

-- AlterTable Expenses - Adicionar novos campos
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "recurringExpenseId" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable RecurringExpenses
CREATE TABLE IF NOT EXISTS "recurring_expenses" (
    "id" TEXT NOT NULL,
    "truckId" TEXT,
    "type" "ExpenseType" NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "RecurringExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalInstallments" INTEGER,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "notes" TEXT,
    "lastGeneratedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recurring_expenses_truckId_idx" ON "recurring_expenses"("truckId");
CREATE INDEX IF NOT EXISTS "recurring_expenses_status_idx" ON "recurring_expenses"("status");
CREATE INDEX IF NOT EXISTS "recurring_expenses_dueDay_idx" ON "recurring_expenses"("dueDay");
CREATE INDEX IF NOT EXISTS "expenses_recurringExpenseId_idx" ON "expenses"("recurringExpenseId");

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
