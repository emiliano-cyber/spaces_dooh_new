-- ============================================================================
--  TTL de reservas tentativas (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  Una reserva TENTATIVA bloquea inventario. Sin caducidad, una propuesta
--  muerta deja la pantalla reservada para siempre. `expira_en` fija el momento
--  en que la tentativa caduca sola; un barrido en cada lectura de estado
--  (barrerReservasVencidas) la pasa a CANCELADA y libera el sitio.
--
--  • CONFIRMADA / CANCELADA → expira_en = null (no caducan).
--  • Backfill NO destructivo: a las tentativas ya existentes se les da una
--    ventana fresca (7 días desde ahora) para que ninguna caduque de golpe.
-- ============================================================================

alter table public.reservas
  add column if not exists expira_en timestamptz;

update public.reservas
   set expira_en = now() + interval '7 days'
 where estatus = 'TENTATIVA' and expira_en is null;

create index if not exists idx_reservas_expira on public.reservas (expira_en)
  where estatus = 'TENTATIVA';
