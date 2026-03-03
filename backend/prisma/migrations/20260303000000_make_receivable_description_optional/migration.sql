-- AlterTable: Tornar campo description opcional na tabela receivables
-- Esta migration permite que o campo description seja NULL

-- Alterar coluna para permitir NULL
ALTER TABLE "receivables" ALTER COLUMN "description" DROP NOT NULL;
