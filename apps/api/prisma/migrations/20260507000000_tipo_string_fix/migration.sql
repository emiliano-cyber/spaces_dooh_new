-- Change OrdenTrabajo.tipo from TipoOT enum to plain TEXT
-- This allows storing comma-separated multi-tipo values (e.g. "MONTAJE_LONA,HERRERIA")
ALTER TABLE "tenant_template"."OrdenTrabajo"
  ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::TEXT;
