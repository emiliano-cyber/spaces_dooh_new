-- Evidencia: fecha de creación/captura de la imagen en el dispositivo.
-- "timestamp" se mantiene como la fecha de subida/registro en el sistema.
ALTER TABLE "tenant_template"."EvidenciaOT"
  ADD COLUMN IF NOT EXISTS "capturadaEn" TIMESTAMP(3);
