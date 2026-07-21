-- Sesiones de labores: múltiples registros de inicio/fin por OT
ALTER TABLE "tenant_template"."OrdenTrabajo"
  ADD COLUMN IF NOT EXISTS "sesionesJson" JSONB NOT NULL DEFAULT '[]';
