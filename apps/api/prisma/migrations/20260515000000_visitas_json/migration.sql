-- Visitas estructuradas por OT: array de {id, tipo, contenido, fecha, autor, timestamps}
ALTER TABLE "tenant_template"."OrdenTrabajo"
  ADD COLUMN IF NOT EXISTS "visitasJson" JSONB NOT NULL DEFAULT '[]';
