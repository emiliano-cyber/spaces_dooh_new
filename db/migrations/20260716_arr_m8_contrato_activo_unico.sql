-- ============================================================================
-- Arrendadores Fase 1 · M8 — Un solo contrato ACTIVO por predio.
-- Un predio tiene N contratos EN EL TIEMPO, pero solo uno vigente a la vez: la
-- renta del predio es una sola. Dos contratos activos sobre el mismo predio son
-- datos inválidos y rompen el P&L en silencio (rentaAtribuidaPorSitio toma el de
-- mayor renta, así que el resto de la renta pagada NO se contaría como costo).
-- El índice lo hace imposible desde la BD, no solo desde la app.
-- CANCELADO y VENCIDO no cuentan: por eso el índice es PARCIAL (permite el
-- histórico completo del predio y la renovación, que deja el anterior VENCIDO).
-- Aditivo e idempotente.
-- ============================================================================
begin;

-- Guarda: si ya hubiera datos en conflicto, el índice fallaría con un error poco
-- claro. Esto los reporta antes (falla ruidosa = dato malo que hay que revisar).
do $$
declare n int;
begin
  select count(*) into n from (
    select predio_id from contratos_arrendamiento
     where predio_id is not null and estatus in ('VIGENTE','POR_VENCER','RENOVADO')
     group by predio_id having count(*) > 1) x;
  if n > 0 then
    raise exception 'M8: % predio(s) tienen más de un contrato activo. Cancela o vence los sobrantes antes de aplicar.', n;
  end if;
end $$;

create unique index if not exists contratos_predio_activo_uq
  on contratos_arrendamiento (predio_id)
  where predio_id is not null and estatus in ('VIGENTE','POR_VENCER','RENOVADO');

comment on index contratos_predio_activo_uq is
  'Un solo contrato activo (VIGENTE/POR_VENCER/RENOVADO) por predio. La renta del predio es una sola: dos activos romperían el P&L.';

commit;

-- Verificación
select 'indice' k, indexname v from pg_indexes
 where tablename='contratos_arrendamiento' and indexname='contratos_predio_activo_uq'
union all
select 'predios_con_2plus_activos', count(*)::text from (
  select predio_id from contratos_arrendamiento
   where predio_id is not null and estatus in ('VIGENTE','POR_VENCER','RENOVADO')
   group by predio_id having count(*) > 1) x;
