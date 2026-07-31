-- ============================================================================
-- Licencias y permisos con vigencia (cierra F-2 de la auditoría).
--
-- La auditoría del 2026-07-28 dejó R5.1 en PARCIAL por una razón concreta: la
-- especificación pide alertas de vencimiento para contrato, pago de renta Y
-- licencia/permiso, pero la búsqueda de columnas `%licencia%`, `%permiso%` y
-- `%vigencia%` en TODA la base devolvió 0 resultados. No había dónde guardar la
-- fecha, así que la alerta no podía existir. El enum `estatus_legal` de `sitios`
-- ya contemplaba `PERMISO_VENCIDO` y `SIN_PERMISO`, pero nada los disparaba: solo
-- se llegaba a mano.
--
-- Por qué una TABLA y no columnas en `predios`:
--   · Un permiso se RENUEVA cada cierto tiempo. Con columnas solo cabe el
--     vigente y se pierde el histórico, que es justo lo que se pide para
--     demostrar continuidad ante la autoridad.
--   · Un mismo emplazamiento puede necesitar VARIOS permisos a la vez
--     (municipal, ambiental, de estructura). Con columnas no caben.
--   · `predios.documentos` es un jsonb que nunca se escribió (siempre `[]`) y no
--     permite indexar ni consultar por fecha, que es exactamente lo que hace
--     falta para alertar.
--
-- ANCLAJE DUAL, igual que los contratos y por la misma razón física: el permiso
-- ampara una instalación. Si el predio agrupa varias pantallas, el permiso es del
-- predio y las cubre a todas; una pantalla suelta lleva el suyo. Los dos anclajes
-- son EXCLUYENTES y lo impone un CHECK, no una convención.
--
-- SIN estatus almacenado a propósito: la vigencia se deduce de `fecha_vencimiento`
-- contra hoy, en la capa de lectura. Guardarlo obligaría a un barrido que
-- reescribiera filas en cada carga, que es justo el hallazgo M-5 que sigue abierto
-- para los contratos. Una fecha no necesita mantenimiento.
--
-- Decisión de negocio (confirmada por el dueño del producto): un permiso vencido
-- ALERTA pero NO bloquea la venta. No se toca `estatus_comercial` ni
-- `estatus_legal`. Si más adelante se quiere bloquear, se activa sin rehacer nada.
-- ============================================================================
begin;

create table if not exists licencias (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  -- Anclaje excluyente: o ampara un predio (y con él todas sus pantallas), o una
  -- pantalla suelta.
  predio_id          uuid references predios(id) on delete cascade,
  sitio_id           uuid references sitios(id)  on delete cascade,
  tipo               text not null,          -- MUNICIPAL, AMBIENTAL, ESTRUCTURAL, OTRO
  folio              text,                   -- número de licencia/permiso
  autoridad          text,                   -- quién la expide
  fecha_expedicion   date,
  fecha_vencimiento  date not null,          -- la razón de ser de esta tabla
  documento_url      text,
  notas              text,
  creado_en          timestamptz not null default now()
);

-- Exactamente uno de los dos anclajes. Sin esto, una fila con los dos (o con
-- ninguno) haría ambiguo a quién ampara el permiso.
alter table licencias drop constraint if exists licencia_anclaje_ck;
alter table licencias add constraint licencia_anclaje_ck
  check ((predio_id is not null) <> (sitio_id is not null));

-- Una vigencia no puede terminar antes de empezar. `>=` y no `>`: un permiso de
-- un solo día es raro pero no es un dato inválido (mismo criterio que se aplicó
-- a los contratos, donde el `>` estricto habría roto las campañas de un día).
alter table licencias drop constraint if exists licencia_fechas_ck;
alter table licencias add constraint licencia_fechas_ck
  check (fecha_expedicion is null or fecha_vencimiento >= fecha_expedicion);

alter table licencias drop constraint if exists licencia_tipo_ck;
alter table licencias add constraint licencia_tipo_ck
  check (tipo in ('MUNICIPAL','AMBIENTAL','ESTRUCTURAL','OTRO'));

-- Aislamiento por inquilino: fail-closed y FORCE, igual que el resto del módulo
-- (R6.1). FORCE es lo que impide que el dueño de la tabla se salte la política.
alter table licencias enable row level security;
alter table licencias force  row level security;
drop policy if exists tenant_isolation on licencias;
create policy tenant_isolation on licencias
  using      (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid)
  with check (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);

-- El rol de la aplicación NO se escribe a mano: en local es `spaces_app` y en
-- producción `spaces_user`. Se copian los permisos de una tabla ya existente del
-- módulo, de forma que la nueva quede exactamente con la misma superficie de
-- acceso que las que ya pasaron auditoría, sea cual sea el entorno.
do $$
declare r record; n int := 0;
begin
  for r in
    select distinct grantee from information_schema.role_table_grants
     where table_name = 'contratos_arrendamiento'
       and grantee in (select rolname from pg_roles where rolcanlogin and not rolsuper)
  loop
    execute format('grant select, insert, update, delete on licencias to %I', r.grantee);
    n := n + 1;
  end loop;
  if n = 0 then
    raise exception 'No se encontró el rol de la aplicación. Sin GRANT, la tabla queda inaccesible para la app.';
  end if;
  raise notice 'Permisos concedidos a % rol(es) de aplicación.', n;
end $$;

-- Búsqueda por vencimiento: es la consulta que alimenta las alertas.
create index if not exists licencias_vencimiento_ix on licencias (tenant_id, fecha_vencimiento);
create index if not exists licencias_predio_ix      on licencias (predio_id) where predio_id is not null;
create index if not exists licencias_sitio_ix       on licencias (sitio_id)  where sitio_id  is not null;

-- Evita capturar DOS VECES el mismo permiso: mismo emplazamiento, mismo tipo y
-- misma fecha de vencimiento. Las renovaciones (otra fecha) y el histórico caben
-- sin problema, que es lo que da la trazabilidad.
--
-- La regla más fuerte que se quiso poner —«un solo permiso VIGENTE por tipo»— NO
-- cabe en un índice: exigiría `fecha_vencimiento >= current_date` en el
-- predicado, y Postgres lo rechaza porque `current_date` no es IMMUTABLE (el
-- índice cambiaría de contenido solo, al pasar la medianoche). Expresarla en la
-- base pediría almacenar un estatus y un barrido que lo mantenga, que es
-- precisamente el hallazgo M-5 que se quiso evitar. Queda en la capa de lectura:
-- cuando hay varios del mismo tipo, manda el de vencimiento más lejano.
create unique index if not exists licencias_predio_tipo_uq
  on licencias (predio_id, tipo, fecha_vencimiento) where predio_id is not null;
create unique index if not exists licencias_sitio_tipo_uq
  on licencias (sitio_id, tipo, fecha_vencimiento)  where sitio_id  is not null;

comment on table licencias is
  'Licencias y permisos con vigencia. Anclaje excluyente predio/pantalla, igual que los contratos. La vigencia se deduce de fecha_vencimiento contra hoy; no se almacena estatus.';

commit;

-- Verificación
select 'tabla' k, coalesce((select table_name from information_schema.tables where table_name='licencias'), '(FALTA)') v
union all
select 'rls_activo', (select case when relrowsecurity then 'si' else 'NO' end from pg_class where relname='licencias')
union all
select 'rls_forzado', (select case when relforcerowsecurity then 'si' else 'NO' end from pg_class where relname='licencias')
union all
select 'politicas', (select count(*)::text from pg_policy where polrelid='licencias'::regclass)
union all
select 'constraints', (select string_agg(conname, ', ' order by conname) from pg_constraint
                        where conrelid='licencias'::regclass and contype='c')
union all
select 'indices', (select count(*)::text from pg_indexes where tablename='licencias')
union all
select 'filas', (select count(*)::text from licencias);
