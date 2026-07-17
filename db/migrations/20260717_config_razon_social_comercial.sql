-- Razón social y nombre comercial del negocio, editables desde config_negocio
-- (Administración → Configuración). Antes estaban hardcodeados en el encabezado
-- del Dashboard ("Tu negocio de un vistazo · …"). Aditivo, idempotente.
alter table public.config_negocio
  add column if not exists razon_social     text,
  add column if not exists nombre_comercial text;
