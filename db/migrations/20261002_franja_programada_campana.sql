-- @tipo: esquema
-- ============================================================================
--  PROG-01 · en qué franja SE TRANSMITE cada campaña, guardado APARTE de lo
--  que se vendió.
-- ----------------------------------------------------------------------------
--  Decisión del dueño (2026-09-30), textual: «es para horario transmisión ya
--  que el precio ya debe de estar en la campaña después de la propuesta».
--
--  Hasta hoy una campaña tenía UNA franja por reserva, la CONTRATADA
--  (`reservas.franja_id`, 20260928_rejilla_franja_temporada.sql): heredada del
--  ítem de la propuesta, congelada con su precio en el snapshot, y prohibido
--  elegirla en la campaña (campanas-repo.ts, en la inserción desde propuesta).
--  Eso es lo que el cliente aceptó y ESTA MIGRACIÓN NO LO TOCA.
--
--  Lo que falta es la otra: en qué horario tiene que SALIR. Es una instrucción
--  de operación —no mueve un peso— y por eso vive en su propia columna. Si se
--  escribiera sobre `reservas.franja_id`, la campaña contaría una historia y el
--  snapshot otra, sin dar ningún error.
--
--  ═══ POR QUÉ UNA COLUMNA EN `campanas` Y NO UNA TABLA NI UNA POR RESERVA ═══
--
--   · El dueño lo pidió por CAMPAÑA: «elegir una o varias campañas y
--     asignarles en qué franja se transmiten». No pidió pantalla por pantalla.
--   · Una tabla `campana_programacion` (campana, franja) solo compraría varias
--     franjas por campaña o historia; ninguna de las dos se pidió, y la
--     historia ya queda en `acciones` (quién, cuándo, qué folios).
--   · Una columna por reserva (`reservas.franja_programada_id`) daría
--     granularidad por pantalla, pero obliga a la pantalla a repartir la
--     misma franja en N filas y a que un lote de diez campañas escriba cientos
--     de filas. Si mañana hace falta programar una pantalla distinta de su
--     campaña, se añade ESA columna como excepción sobre esta —la de la
--     campaña sigue siendo la regla— y no hay que deshacer nada.
--
--  ═══ LA FK ES COMPUESTA (franja, tenant) — el agujero SÍ es alcanzable ════
--
--  `franja_programada_id` entra POR EL CUERPO de la petición (el selector). Una
--  FK plana se comprueba con los privilegios del dueño de la tabla y ELUDE la
--  RLS: solo exigiría que la franja existiera en algún sitio. Es exactamente
--  el razonamiento de `reservas_franja_fkey` y de
--  20260918_entidad_tenant_compuesto.sql. `franjas_horarias_id_tenant_uq` ya
--  existe desde el 28/09.
--
--  `on delete RESTRICT`, y no `set null`: `set null` sobre una FK compuesta
--  pondría a NULL también `tenant_id` (la lista de columnas de
--  `on delete set null (col)` es sintaxis de PostgreSQL 15, y g500 corre
--  14.24). Y no hace falta: las franjas no se borran, se dan de baja
--  (`activo = false`), y una franja apagada sigue nombrando lo que ya estaba
--  programado.
--
--  `MATCH SIMPLE` (el de omisión): con la columna en NULL —«sin programar», el
--  estado de toda campaña de hoy— la FK no se comprueba.
--
--  ═══ RLS Y GRANTS ═══════════════════════════════════════════════════════
--
--  No es una tabla nueva: `campanas` ya tiene `tenant_isolation` con ENABLE y
--  FORCE desde 20260720_hard1_rls_todas_tablas.sql, y una columna nueva queda
--  bajo esa misma política. NO se recrea la política —hacerlo reescribiría la
--  de una tabla viva por una columna—; se COMPRUEBA, y si faltara la migración
--  aborta en vez de dejar una columna nueva sobre una tabla sin aislamiento.
--
--  Los GRANT a nivel de tabla ya cubren una columna nueva. Se repiten igual,
--  explícitos y por rol EXISTENTE, por el motivo que 20260923_tickets.sql dejó
--  medido en rojo: en producción las tablas las posee otro rol y el arnés no ve
--  la diferencia. Repetir un GRANT existente no cambia nada.
--
--  ═══ POSTGRESQL 14 ═══════════════════════════════════════════════════════
--
--  Nada de sintaxis de la 15: ni `nulls not distinct`, ni `on delete set null
--  (col)`, ni `merge`. `add column if not exists` y los `do $$` con
--  `pg_constraint` son de la 9.6. Probada en postgres:14-alpine y 16-alpine.
--
--  Aditiva, transaccional e idempotente. No toca una sola fila existente: nace
--  con TODAS las campañas sin programar, que es la verdad.
-- ============================================================================
begin;

-- Aborta ANTES de tocar nada si `campanas` no estuviera aislada.
do $$
declare ok boolean;
begin
  select relrowsecurity and relforcerowsecurity into ok
    from pg_class where oid = 'campanas'::regclass;
  if not coalesce(ok, false) then
    raise exception 'PROG-01: campanas no tiene RLS ENABLE+FORCE; no se añade una columna sobre una tabla sin aislamiento';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'campanas' and policyname = 'tenant_isolation'
  ) then
    raise exception 'PROG-01: campanas no tiene la politica tenant_isolation';
  end if;
end $$;

-- NULLABLE y SIN default: toda campaña de hoy queda «sin programar». Rellenarla
-- con su franja contratada convertiría un «no se ha decidido» en una
-- instrucción que nadie dio.
alter table campanas add column if not exists franja_programada_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'campanas_franja_programada_fkey'
       and conrelid = 'campanas'::regclass
  ) then
    alter table campanas
      add constraint campanas_franja_programada_fkey
      foreign key (franja_programada_id, tenant_id)
      references franjas_horarias (id, tenant_id) on delete restrict;
  end if;
end $$;

-- Parcial: casi todas las campañas estarán en NULL, y el índice sirve para
-- «qué campañas salen en Prime» y para que el `restrict` no recorra la tabla.
create index if not exists idx_campanas_franja_programada
  on campanas (franja_programada_id, tenant_id)
  where franja_programada_id is not null;

comment on column campanas.franja_programada_id is
  'PROG-01. La franja en la que SE TRANSMITE la campaña (instruccion de operacion). NO es la contratada: esa es reservas.franja_id y su precio esta congelado en propuestas.snapshot_economico; esta columna no mueve un peso. Si difieren, la aplicacion AVISA (decision pendiente del dueno: avisar o bloquear). Tampoco viaja al CMS: el SDK de DOOHmain no acepta --hora ni --dias (doohmain_sdk/__main__.py:66-75).';

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      -- Solo lo que esta columna necesita (leerla y escribirla). No se amplía
      -- nada: si el rol ya tenía más, lo conserva; si no lo tenía, no lo gana.
      execute format('grant select, update on campanas to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select 'columna campanas.franja_programada_id' k, count(*)::text v
  from information_schema.columns
 where table_name = 'campanas' and column_name = 'franja_programada_id'
union all
select 'FK compuesta hacia franjas_horarias (columnas)',
       coalesce(max(array_length(conkey, 1)), 0)::text
  from pg_constraint where conname = 'campanas_franja_programada_fkey'
union all
select 'campanas con RLS forzada',
       count(*)::text
  from pg_class where relname = 'campanas' and relrowsecurity and relforcerowsecurity
union all
select 'campanas programadas (nace en cero)',
       count(*)::text from campanas where franja_programada_id is not null;
