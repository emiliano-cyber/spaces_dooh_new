-- ============================================================================
--  TTL de reservas tentativas (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  Una reserva TENTATIVA bloquea inventario. Sin caducidad, una propuesta
--  muerta deja la pantalla reservada para siempre. `expira_en` fija el momento
--  en que la tentativa caduca sola; un barrido en cada lectura de estado
--  (barrerReservasVencidas) la pasa a CANCELADA y libera el sitio.
--
--  • CONFIRMADA / CANCELADA → expira_en = null (no caducan).
--  • VARIANTE CONSERVADORA: las tentativas EXISTENTES quedan en NULL (no
--    caducan). El TTL solo aplica a reservas NUEVAS. Sin backfill → cero
--    escrituras de datos: la migración es puramente aditiva.
-- ============================================================================

alter table public.reservas
  add column if not exists expira_en timestamptz;

create index if not exists idx_reservas_expira on public.reservas (expira_en)
  where estatus = 'TENTATIVA';
