-- ============================================================================
--  Bitácora append-only (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  La tabla `acciones` es la bitácora (quién hizo qué y cuándo). La app solo
--  hace INSERT/SELECT; aquí se IMPIDEN UPDATE y DELETE por trigger.
--
--  Por qué un trigger (y no RLS): el trigger se dispara incluso para el
--  superusuario, así que protege con la conexión actual del BFF (que conecta
--  como `spaces`, superuser). No toca los registros existentes.
--
--  Nota: TRUNCATE NO dispara este trigger (es un evento distinto), por lo que
--  el reinicio total del demo sigue siendo posible vía TRUNCATE.
--
--  Alcance: esto da inmutabilidad a nivel de base (no-edición/no-borrado). El
--  tamper-proofing absoluto (anclar hashes on-chain / WORM) es alcance de una
--  fase posterior (Space Proof V2), no de esta migración.
-- ============================================================================

create or replace function acciones_append_only()
  returns trigger
  language plpgsql
as $$
begin
  raise exception 'bitacora es append-only: % no permitido sobre acciones', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists trg_acciones_append_only on public.acciones;
create trigger trg_acciones_append_only
  before update or delete on public.acciones
  for each row execute function acciones_append_only();
