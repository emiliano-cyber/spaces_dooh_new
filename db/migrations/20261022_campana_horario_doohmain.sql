-- @tipo: esquema
-- ============================================================================
--  El horario INDIVIDUAL de una campaña en DOOHmain.
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 2026-10-22: «que en campaña se pueda poner una franja de
--  tiempo individual que se mande a DOOHmain». Forma aprobada ese día: hora de
--  inicio, hora de fin y, opcional, los días de la semana (la API de DOOHmain
--  los acepta en `create_spot`: 0 = domingo … 6 = sábado).
--
--  Gana sobre la franja programada (`campanas.franja_programada_id`) y la
--  contratada (`reservas.franja_id`): es lo que se dicta a mano para ESTA
--  campaña. Vale para todas sus pantallas. Lo aplica `lib/doohmain-programacion.ts`
--  (`franjaQueViaja`) y lo lee `lib/server/doohmain.ts`.
--
--  No mueve un peso: es instrucción de operación, como la programada. El precio
--  sigue congelado en `propuestas.snapshot_economico`.
--
--  SOLO AGREGA tres columnas opcionales. `text` + CHECK y no `time`, por lo
--  mismo que `franjas_horarias`: es exactamente la cadena HH:mm que viaja, sin
--  zona horaria que la mueva. PostgreSQL 14: nada de 15. Idempotente.
-- ============================================================================

begin;

alter table campanas add column if not exists doohmain_hora_inicio text;
alter table campanas add column if not exists doohmain_hora_fin    text;
alter table campanas add column if not exists doohmain_dias        smallint[];

do $$
declare c record;
begin
  for c in select * from (values
    ('campanas_doohmain_hora_inicio_ck',
     'check (doohmain_hora_inicio is null or doohmain_hora_inicio ~ ''^([01][0-9]|2[0-3]):[0-5][0-9]$'')'),
    ('campanas_doohmain_hora_fin_ck',
     'check (doohmain_hora_fin is null or doohmain_hora_fin ~ ''^([01][0-9]|2[0-3]):[0-5][0-9]$'')'),
    -- Las dos horas van juntas, y no iguales: una sola no es un horario.
    ('campanas_doohmain_horario_par_ck',
     'check ((doohmain_hora_inicio is null) = (doohmain_hora_fin is null) and (doohmain_hora_inicio is null or doohmain_hora_inicio <> doohmain_hora_fin))'),
    -- Días solo con horario, al menos uno, del 0 al 6.
    ('campanas_doohmain_dias_ck',
     'check (doohmain_dias is null or (doohmain_hora_inicio is not null and cardinality(doohmain_dias) between 1 and 7 and doohmain_dias <@ array[0,1,2,3,4,5,6]::smallint[]))')
  ) as v(nombre, def) loop
    if not exists (select 1 from pg_constraint where conname = c.nombre and conrelid = 'campanas'::regclass) then
      execute format('alter table campanas add constraint %I %s', c.nombre, c.def);
    end if;
  end loop;
end $$;

comment on column campanas.doohmain_hora_inicio is
  'El horario INDIVIDUAL de la campaña en DOOHmain (22/10), HH:mm. Gana sobre la franja programada y la contratada. Va con doohmain_hora_fin; los dos NULL = no hay horario individual.';
comment on column campanas.doohmain_dias is
  'Días de la semana del horario individual (0 = domingo … 6 = sábado), como los recibe create_spot de DOOHmain. NULL = todos.';

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'columnas nuevas en campanas (3)' k, count(*)::text v
  from information_schema.columns
 where table_name = 'campanas'
   and column_name in ('doohmain_hora_inicio','doohmain_hora_fin','doohmain_dias');
