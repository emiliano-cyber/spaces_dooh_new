-- Tracking de inicio y fin de labores en campo

ALTER TABLE "tenant_template"."OrdenTrabajo"
  ADD COLUMN IF NOT EXISTS "horaLlegada"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "horaTerminoLabores" TIMESTAMP(3);
