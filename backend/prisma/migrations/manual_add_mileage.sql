-- Script SQL para adicionar os campos de quilometragem manualmente
-- Execute este script diretamente no PostgreSQL se a migração automática falhar

-- Adicionar currentMileage na tabela trucks (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trucks' AND column_name = 'currentMileage'
    ) THEN
        ALTER TABLE trucks ADD COLUMN "currentMileage" DOUBLE PRECISION DEFAULT 0;
    END IF;
END $$;

-- Adicionar startMileage na tabela trips (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trips' AND column_name = 'startMileage'
    ) THEN
        ALTER TABLE trips ADD COLUMN "startMileage" DOUBLE PRECISION;
    END IF;
END $$;

-- Adicionar endMileage na tabela trips (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trips' AND column_name = 'endMileage'
    ) THEN
        ALTER TABLE trips ADD COLUMN "endMileage" DOUBLE PRECISION;
    END IF;
END $$;

-- Verificar se as colunas foram criadas
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name IN ('trucks', 'trips') 
    AND column_name IN ('currentMileage', 'startMileage', 'endMileage')
ORDER BY table_name, column_name;
