-- @tipo: esquema
-- ============================================================================
--  CAP-01 · la bitácora de captación: cómo va cada venta que se está cerrando.
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 2026-09-29, recorriendo el ensayo de g500 con un perfil
--  de vendedor: «falta la bitácora para ver el avance para crear nuevas
--  pantallas o predios nuevos o arrendadores nuevos; debe tener el progreso de
--  cómo va la venta». Y al preguntarle qué se capta: «se acepta todo eso» —
--  clientes también—, «sube toda la información y el gerente o el
--  administrador ya lo aprueban». Diseño aprobado ese mismo día.
--
--  La medición que lo motiva: el VENDEDOR no tenía NINGUNA pantalla donde
--  anotar una captación. Inventario y Arrendadores son solo de MANDO
--  (`components/demo/shell/nav.ts`), «Actividad» es la bitácora de auditoría
--  —quién hizo qué—, y el único rastro de un proceso de venta era
--  `predios.estado` con PROSPECTO y EN_NEGOCIACION: una etiqueta sin historia,
--  sin nota, sin siguiente paso y sin quién.
--
--  DOS TABLAS:
--    · `prospectos` — lo que se intenta captar, en la etapa en que va.
--    · `prospecto_avances` — la bitácora. SOLO SE AÑADE: el rol de la
--      aplicación tiene `select, insert` y NADA MÁS, así que la historia de una
--      venta no se puede reescribir desde la aplicación, ni por un defecto.
--
--  ─── POR QUÉ `text` + CHECK Y NO ENUM ──────────────────────────────────────
--  Un valor de enum de Postgres no se puede quitar nunca (zona A5), y una lista
--  de etapas de venta es exactamente lo que el negocio va a querer retocar.
--
--  ─── POR QUÉ `registro_id` NO LLEVA CLAVE FORÁNEA ──────────────────────────
--  Apunta a un cliente, un arrendador o un predio según `tipo`: una FK no puede
--  apuntar a tres tablas. Es un enlace de consulta, no una garantía. Si el
--  registro se borra después, el prospecto conserva su historia y el enlace
--  queda colgando, que es lo que debe pasar: la venta sí ocurrió.
--
--  ─── PostgreSQL 14 ─────────────────────────────────────────────────────────
--  Sin `@pg-min`: nada de aquí es sintaxis de 15. g500 corre 14.24 y esta
--  migración no puede ser otra razón para que no se actualice. La FK compuesta
--  de los avances es `on delete cascade`, que existe desde siempre; lo de 15 es
--  la LISTA de columnas en `on delete set null (...)`, y aquí no se usa.
--
--  Idempotente: `if not exists`, guards en `pg_constraint`, `drop policy if
--  exists` y `on conflict do nothing` en los permisos.
-- ============================================================================

begin;

create table if not exists prospectos (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  tipo                 text not null,
  nombre               text not null,
  -- nombre, teléfono y correo de la persona con quien se habla.
  contacto             jsonb not null default '{}'::jsonb,
  direccion            text,
  lat                  numeric(10,7),
  lng                  numeric(11,7),
  -- Lo propio de cada tipo (RFC, medidas, renta que piden, arrendador del
  -- predio...). La forma la valida `captacion-controller.ts` con zod por tipo.
  datos                jsonb not null default '{}'::jsonb,
  etapa                text not null default 'PROSPECTO',
  siguiente_paso       text,
  siguiente_paso_fecha date,
  -- El VENDEDOR. Lo estampa el repo desde la sesión, NUNCA desde el cuerpo de
  -- la petición: es lo que decide quién puede verlo.
  usuario_id           uuid references usuarios(id) on delete set null,
  decidido_por         uuid references usuarios(id) on delete set null,
  decidido_en          timestamptz,
  motivo_rechazo       text,
  registro_id          uuid,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  constraint prospectos_tipo_ck
    check (tipo in ('CLIENTE','ARRENDADOR','PREDIO','PANTALLA')),
  constraint prospectos_etapa_ck
    check (etapa in ('PROSPECTO','CONTACTADO','VISITA','NEGOCIACION',
                     'EN_REVISION','APROBADO','RECHAZADO','PERDIDO')),
  constraint prospectos_nombre_ck
    check (length(btrim(nombre)) between 1 and 200),
  constraint prospectos_contacto_ck check (jsonb_typeof(contacto) = 'object'),
  constraint prospectos_datos_ck    check (jsonb_typeof(datos) = 'object'),
  -- Un aprobado siempre dice cuándo se decidió; un rechazo, por qué.
  constraint prospectos_aprobado_ck
    check (etapa <> 'APROBADO' or decidido_en is not null),
  constraint prospectos_rechazo_ck
    check (etapa <> 'RECHAZADO' or (decidido_en is not null
                                    and length(btrim(coalesce(motivo_rechazo,''))) > 0))
);

create index if not exists idx_prospectos_tenant_usuario
  on prospectos (tenant_id, usuario_id);
create index if not exists idx_prospectos_tenant_etapa
  on prospectos (tenant_id, etapa);

-- La pareja (id, tenant_id) es la que referencian los avances: así un avance no
-- puede colgar de un prospecto de otra organización ni aunque alguien se
-- equivoque de id — la FK simple no comprueba tenant (los chequeos de FK saltan
-- la RLS).
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prospectos_id_tenant_uq'
                    and conrelid = 'prospectos'::regclass) then
    alter table prospectos add constraint prospectos_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

drop trigger if exists trg_prospectos_upd on prospectos;
create trigger trg_prospectos_upd before update on prospectos
  for each row execute function set_actualizado_en();

comment on table prospectos is
  'CAP-01. Lo que un vendedor intenta captar: cliente, arrendador, predio o pantalla, y la etapa en que va. Al aprobarlo, el registro real se crea y su id queda en registro_id. No se borra: lo que no prospera se marca PERDIDO y conserva su historia.';
comment on column prospectos.usuario_id is
  'CAP-01. El VENDEDOR. Lo estampa captacion-repo.ts desde usuarioActual(), NUNCA desde el cuerpo. Quien no tiene captacion.aprobar solo ve los prospectos con su usuario_id.';
comment on column prospectos.registro_id is
  'CAP-01. El cliente, arrendador o predio creado al aprobar, segun tipo. Sin FK a proposito: apunta a tres tablas. NULL en una PANTALLA aprobada: en esta version la da de alta quien administra, desde Inventario.';

create table if not exists prospecto_avances (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  prospecto_id    uuid not null,
  usuario_id      uuid references usuarios(id) on delete set null,
  etapa_anterior  text,
  etapa_nueva     text not null,
  nota            text not null,
  creado_en       timestamptz not null default now(),
  constraint prospecto_avances_nota_ck
    check (length(btrim(nota)) between 1 and 2000),
  constraint prospecto_avances_etapa_ck
    check (etapa_nueva in ('PROSPECTO','CONTACTADO','VISITA','NEGOCIACION',
                           'EN_REVISION','APROBADO','RECHAZADO','PERDIDO'))
);

create index if not exists idx_prospecto_avances_prospecto
  on prospecto_avances (prospecto_id, tenant_id, creado_en);

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prospecto_avances_prospecto_fkey'
                    and conrelid = 'prospecto_avances'::regclass) then
    alter table prospecto_avances add constraint prospecto_avances_prospecto_fkey
      foreign key (prospecto_id, tenant_id)
      references prospectos (id, tenant_id) on delete cascade;
  end if;
end $$;

comment on table prospecto_avances is
  'CAP-01. La bitacora de cada prospecto: quien, cuando, de que etapa a cual y que paso. SOLO SE ANADE: el rol de la aplicacion no tiene update ni delete sobre esta tabla.';

-- ─── RLS: cerrada por los dos lados, como el resto ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['prospectos','prospecto_avances'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── GRANT: la bitácora NO se edita ni se borra ──────────────────────────────
-- `revoke` explícito además de no conceder: `20260820_grants_rol_app.sql` pone
-- `alter default privileges` que concede todo en las tablas nuevas, así que no
-- conceder no bastaría — heredaría update y delete sin que nadie lo pidiera.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update on prospectos to %I', r);
      execute format('revoke delete on prospectos from %I', r);
      execute format('grant select, insert on prospecto_avances to %I', r);
      execute format('revoke update, delete, truncate on prospecto_avances from %I', r);
    end if;
  end loop;
end $$;

-- ─── Permisos: módulo `captacion` ────────────────────────────────────────────
-- Todos los de venta la usan. `aprobar` es lo que separa al vendedor de quien
-- revisa, y es también lo que decide si se ven TODOS los prospectos o solo los
-- propios (`captacion-repo.ts`).
insert into rol_permisos (rol, modulo, accion)
values
  ('DUENO',              'captacion', 'ver'),
  ('DUENO',              'captacion', 'crear'),
  ('DUENO',              'captacion', 'aprobar'),
  ('ADMINISTRADOR',      'captacion', 'ver'),
  ('ADMINISTRADOR',      'captacion', 'crear'),
  ('ADMINISTRADOR',      'captacion', 'aprobar'),
  ('DIRECTOR_COMERCIAL', 'captacion', 'ver'),
  ('DIRECTOR_COMERCIAL', 'captacion', 'crear'),
  ('DIRECTOR_COMERCIAL', 'captacion', 'aprobar'),
  ('GERENTE_VENTAS',     'captacion', 'ver'),
  ('GERENTE_VENTAS',     'captacion', 'crear'),
  ('GERENTE_VENTAS',     'captacion', 'aprobar'),
  ('VENDEDOR',           'captacion', 'ver'),
  ('VENDEDOR',           'captacion', 'crear')
on conflict (rol, modulo, accion) do nothing;

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'las dos tablas existen' k, count(*)::text v
  from information_schema.tables
 where table_name in ('prospectos','prospecto_avances')
union all
select 'las dos con RLS forzada', count(*)::text from pg_class
 where relname in ('prospectos','prospecto_avances')
   and relrowsecurity and relforcerowsecurity
union all
select 'filas de captacion en rol_permisos (14)', count(*)::text
  from rol_permisos where modulo = 'captacion'
union all
select 'el VENDEDOR NO aprueba (0)', count(*)::text
  from rol_permisos where modulo = 'captacion' and rol = 'VENDEDOR' and accion = 'aprobar';
