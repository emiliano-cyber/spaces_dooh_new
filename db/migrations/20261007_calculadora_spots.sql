-- @tipo: esquema
-- ============================================================================
--  ADR 0042 · la CALCULADORA DE SPOTS da la CANTIDAD de una linea de pantalla
--  digital; el PRECIO sigue siendo el de la pantalla.
-- ----------------------------------------------------------------------------
--  Decision del dueno, 2026-10-01: las cuatro columnas de abajo, con la forma
--  que aprobo ese mismo dia, y la prima del Roadblock solo con
--  `comercial.aprobar` (Gerente de ventas y superiores).
--
--      spots_dia = floor(3600 / (total_spots x duracion_spot) x espacios x horas)
--      cantidad  = spots_dia x dias
--
--  La cuenta vive en `apps/web/lib/calculadora-spots.ts`, la MISMA que usa la
--  pantalla. El servidor RECALCULA la cantidad a partir de estas columnas y
--  rechaza (400) una linea cuya cantidad no cuadre: una cantidad inventada con
--  un `curl` no puede bajar el total. Es el hallazgo B40 cerrado por la puerta
--  de la cantidad, como 20261006 lo cerro por la de la tarifa.
--
--  ─── QUIEN ESCRIBE CADA COLUMNA ──────────────────────────────────────────
--  Las cuatro las escribe SOLO `crearPropuesta()`
--  (`lib/server/propuestas-repo.ts`), con lo que el controller ya valido y
--  recalculo. Entran por el cuerpo de la peticion —las elige quien vende, como
--  la franja—, pero ninguna se guarda sin pasar por `resolverCalculadora()`.
--
--   · `espacios_comprados` — cuantos espacios del loop compra la linea. Es lo
--     que retiene la reserva al generar la campana (`spots_reservados`). En un
--     Roadblock, TODOS (`sitios.total_spots`).
--   · `horas_dia` — horas de transmision al dia. Techo: la franja elegida o el
--     horario de la pantalla.
--   · `roadblock` — la linea compra el loop entero. NOT NULL DEFAULT false: lo
--     vendido hasta hoy NO es un Roadblock, y eso es un hecho, no un hueco.
--   · `prima_roadblock_pct` — el % encima de la tarifa calculada. Solo con
--     `roadblock`, y > 0 solo lo pone un gerente: el controller lo exige y
--     marca la linea como ajuste (`precio_ajustado_por`, 20261006).
--
--  NULL en las tres numericas = la linea no uso la calculadora, que es TODO lo
--  vendido hasta hoy y toda pantalla fija u otra unidad: se sigue cotizando a
--  mano exactamente igual. No hay backfill — no se sabe con que espacios ni
--  horas se cotizo lo viejo, y escribirlo seria inventar.
--
--  Las cuatro son INTERNAS: la liga publica (`obtenerPropuestaPublica`) arma su
--  objeto campo por campo y no las lleva. El cliente ve el precio final.
--
--  ─── LOS CHECK ───────────────────────────────────────────────────────────
--  Red de seguridad detras del controller, no sustituto: un CHECK no sabe
--  cuantos espacios tiene la pantalla. Lo que si sabe es que ninguna de estas
--  formas tiene sentido nunca:
--   · espacios <= 0;
--   · horas fuera de (0, 24];
--   · prima fuera de [0, 100];
--   · prima distinta de 0 en una linea que no es Roadblock;
--   · un Roadblock sin espacios: «compro todo el loop» tiene que decir cuanto
--     era «todo», o la reserva no sabria cuantos slots retener.
--  Se anaden con `do $$ … pg_constraint` para que la migracion sea idempotente
--  tambien a medias.
--
--  ─── RLS Y GRANTS ────────────────────────────────────────────────────────
--  No es tabla nueva: `propuesta_items` tiene `tenant_isolation` ENABLE+FORCE
--  desde 20260720_hard1_rls_todas_tablas.sql. Se COMPRUEBA y se aborta si
--  faltara. Los GRANT de `propuesta_items` son de TABLA, asi que cubren las
--  columnas nuevas; se repiten por el motivo medido en 20260923_tickets.sql,
--  igual que 20261006_precio_ajustado_por_gerente.sql.
--
--  ─── POSTGRESQL 14 Y 16 ──────────────────────────────────────────────────
--  Nada de la 15. `add column if not exists`, `add constraint … check` y el
--  `do $$` contra `pg_constraint` son de la 9.6. Transaccional e idempotente:
--  correrla dos veces no cambia nada. No toca ninguna fila existente (el
--  DEFAULT de `roadblock` es constante: en la 11+ no reescribe la tabla) ni
--  `db/schema.sql`, y no mueve ni un importe.
-- ============================================================================
begin;

do $$
declare ok boolean;
begin
  select relrowsecurity and relforcerowsecurity into ok
    from pg_class where oid = 'propuesta_items'::regclass;
  if not coalesce(ok, false) then
    raise exception 'CALC-01: propuesta_items no tiene RLS ENABLE+FORCE; no se anaden columnas sobre una tabla sin aislamiento';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'propuesta_items' and policyname = 'tenant_isolation'
  ) then
    raise exception 'CALC-01: propuesta_items no tiene la politica tenant_isolation';
  end if;
end $$;

alter table propuesta_items add column if not exists espacios_comprados integer;
alter table propuesta_items add column if not exists horas_dia numeric(4,2);
alter table propuesta_items add column if not exists roadblock boolean not null default false;
alter table propuesta_items add column if not exists prima_roadblock_pct numeric(5,2);

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'propuesta_items_espacios_comprados_ck' and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_espacios_comprados_ck
      check (espacios_comprados is null or espacios_comprados > 0);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'propuesta_items_horas_dia_ck' and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_horas_dia_ck
      check (horas_dia is null or (horas_dia > 0 and horas_dia <= 24));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'propuesta_items_prima_roadblock_ck' and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_prima_roadblock_ck
      check (prima_roadblock_pct is null or (prima_roadblock_pct >= 0 and prima_roadblock_pct <= 100));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'propuesta_items_prima_solo_roadblock_ck' and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_prima_solo_roadblock_ck
      check (roadblock or prima_roadblock_pct is null or prima_roadblock_pct = 0);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'propuesta_items_roadblock_espacios_ck' and conrelid = 'propuesta_items'::regclass) then
    alter table propuesta_items add constraint propuesta_items_roadblock_espacios_ck
      check (not roadblock or espacios_comprados is not null);
  end if;
end $$;

comment on column propuesta_items.espacios_comprados is
  'ADR 0042. Cuantos espacios del loop compra la linea (calculadora de spots). Es lo que retiene la reserva al generar la campana (spots_reservados). En un Roadblock, todos (sitios.total_spots). NULL = la linea no uso la calculadora. Interna: no viaja a la liga publica.';
comment on column propuesta_items.horas_dia is
  'ADR 0042. Horas de transmision al dia con las que la calculadora saco la cantidad. Techo: la franja elegida o el horario de la pantalla. NULL = la linea no uso la calculadora. Interna.';
comment on column propuesta_items.roadblock is
  'ADR 0042. La linea compra el loop ENTERO de la pantalla (exige todos sus espacios libres). false en todo lo vendido antes del 2026-10-01. Interna.';
comment on column propuesta_items.prima_roadblock_pct is
  'ADR 0042. % encima de la tarifa calculada de un Roadblock: tarifa_unitaria = tarifa_calculada x (1 + prima/100). Solo con roadblock; > 0 solo con comercial.aprobar, y entonces la linea lleva precio_ajustado_por. NULL = no es Roadblock. Interna.';

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update on propuesta_items to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
select 'columnas nuevas en propuesta_items' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuesta_items'
   and column_name in ('espacios_comprados','horas_dia','roadblock','prima_roadblock_pct')
union all
select 'CHECK de la calculadora',
       count(*)::text
  from pg_constraint
 where conrelid = 'propuesta_items'::regclass
   and conname in ('propuesta_items_espacios_comprados_ck','propuesta_items_horas_dia_ck',
                   'propuesta_items_prima_roadblock_ck','propuesta_items_prima_solo_roadblock_ck',
                   'propuesta_items_roadblock_espacios_ck')
union all
select 'lineas que ya usan la calculadora (0 al aplicarla: no hay backfill)',
       count(*)::text from propuesta_items where roadblock or espacios_comprados is not null;
