-- ============================================================================
--  Aceptación de la propuesta por el cliente desde la liga pública (aditivo)
-- ----------------------------------------------------------------------------
--  Cierra el loop de venta: el cliente acepta con un clic desde la liga pública
--  y queda el timestamp + su nombre (el "medio-contrato"). La aceptación mueve
--  la propuesta a APROBADA. Nullable → no rompe filas existentes.
-- ============================================================================

alter table public.propuestas
  add column if not exists aceptado_en  timestamptz,
  add column if not exists aceptado_por text,
  add column if not exists aceptado_ip  text;
