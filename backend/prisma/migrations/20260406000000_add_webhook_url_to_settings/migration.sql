-- AlterTable
ALTER TABLE "settings" ADD COLUMN "webhookUrl" TEXT;

-- Migrar URL do webhook da variável de ambiente se existir
-- Este campo será configurável via interface de administração
