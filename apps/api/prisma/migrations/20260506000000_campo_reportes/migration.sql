-- Add new EstOT enum values for field reports workflow
ALTER TYPE "tenant_template"."EstOT" ADD VALUE IF NOT EXISTS 'BLOQUEADA';
ALTER TYPE "tenant_template"."EstOT" ADD VALUE IF NOT EXISTS 'EN_REVISION';
ALTER TYPE "tenant_template"."EstOT" ADD VALUE IF NOT EXISTS 'RECHAZADA';

-- Add new fields to OrdenTrabajo
ALTER TABLE "tenant_template"."OrdenTrabajo"
  ADD COLUMN IF NOT EXISTS "supervisorUserId"  TEXT,
  ADD COLUMN IF NOT EXISTS "creadoPorUserId"   TEXT,
  ADD COLUMN IF NOT EXISTS "materialesJson"    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "requiereRevision"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "motivoBloqueo"     TEXT,
  ADD COLUMN IF NOT EXISTS "motivoCancelacion" TEXT,
  ADD COLUMN IF NOT EXISTS "revisadoPorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "revisadoEn"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revisionNotas"     TEXT;

-- Add new fields to EvidenciaOT
ALTER TABLE "tenant_template"."EvidenciaOT"
  ADD COLUMN IF NOT EXISTS "formato"    TEXT NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN IF NOT EXISTS "tamanoMb"   DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "precision"  DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS "deviceInfo" TEXT;

-- Change default value of tipo in EvidenciaOT
ALTER TABLE "tenant_template"."EvidenciaOT"
  ALTER COLUMN "tipo" SET DEFAULT 'INSTALACION';
