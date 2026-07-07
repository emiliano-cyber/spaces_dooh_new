-- ============================================================================
--  Descuento comercial + versionado de propuesta (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  descuento_pct: rebaja sobre la tarifa de lista (bruto) que paga el cliente,
--  distinta de la comisión de agencia. version: cada renegociación (cambio de
--  descuento tras enviarla) sube la versión (v1, v2, v3…). Ambas con default →
--  no rompen filas existentes.
-- ============================================================================

alter table public.propuestas
  add column if not exists descuento_pct numeric(5,2) not null default 0,
  add column if not exists version       integer      not null default 1;
