-- @tipo: esquema
-- ============================================================================
--  ADR 0051 · El CRM comercial: oportunidades encima de `prospectos` y
--  `propuestas`, con el cotejo de lo que pide el cliente contra lo cotizado.
-- ----------------------------------------------------------------------------
--  Forma APROBADA POR EL DUEÑO el 2026-11-17 (§1 a §4 del ADR). ROJO: R3.
--
--  SOLO AGREGA: un `unique` en `clientes`, una columna opcional en `propuestas`
--  y tres tablas nuevas. Nada existente cambia de forma ni de valor, así que la
--  versión anterior funciona con esta migración puesta: lo nuevo no lo lee.
--
--  ─── FK COMPUESTAS CON TENANT, Y POR QUÉ HACE FALTA `clientes_id_tenant_uq` ─
--  Los chequeos de FK saltan la RLS. Con una FK simple, una oportunidad podría
--  apuntar al cliente o al prospecto de OTRA organización con solo equivocarse
--  de id, y la base lo daría por bueno. Para que `(cliente_id, tenant_id)` sea
--  una FK válida, `clientes` necesita un `unique (id, tenant_id)`, que no tenía.
--
--  ─── LO QUE SOLO CRECE: POR TRIGGER, NO SOLO POR GRANT ─────────────────────
--  `oportunidad_actividades` y `propuesta_cambios` son historia. Se les quita
--  update y delete al rol de la aplicación, Y un trigger rechaza los dos aunque
--  quien conecte sea superusuario (como `acciones`, 20260629). TRUNCATE no lo
--  dispara, a propósito: el reinicio total de la demo lo sigue usando.
--
--  ─── `usuario_id` SIN FK EN LO QUE SOLO CRECE ─────────────────────────────
--  Lección de `20261109_acciones_sin_fk_usuario.sql`: una FK `on delete set null`
--  sobre una tabla append-only hace que borrar un usuario sea un UPDATE que el
--  trigger rechaza, y el borrado entero cae en 500. Aquí no se pone: cada fila
--  guarda el id y el NOMBRE congelado de quien lo hizo. La oportunidad sí lleva
--  FK (no es append-only): al borrar al vendedor queda sin vendedor.
--
--  ─── `propuesta_cambios.propuesta_id` SIN FK, A PROPÓSITO ─────────────────
--  Un borrador se puede borrar (R5, PROP-COMPLETA). Una FK en cascada se
--  llevaría su historia —y chocaría con el trigger—; una `restrict` impediría
--  borrarlo. Por eso guarda el `folio` congelado, para seguir leyéndose.
--
--  PostgreSQL 14. Idempotente: `if not exists`, guards en `pg_constraint`,
--  `drop ... if exists`.
-- ============================================================================

begin;

-- ─── clientes: la pieza que faltaba para la FK compuesta ────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_id_tenant_uq'
                  and conrelid = 'clientes'::regclass) then
    alter table clientes add constraint clientes_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- ─── oportunidades: lo que el cliente QUIERE ────────────────────────────────
create table if not exists oportunidades (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  -- El lead (un prospecto CLIENTE) o el cliente que ya existe; al menos uno.
  -- Que el prospecto sea de tipo CLIENTE lo comprueba el repo con la fila
  -- bloqueada: un CHECK no puede mirar otra tabla.
  prospecto_id          uuid,
  cliente_id            uuid,
  nombre                text not null,
  -- El VENDEDOR. Lo estampa el repo desde la sesión, NUNCA desde el cuerpo: es
  -- lo que decide quién la ve (VEND-01).
  usuario_id            uuid references usuarios(id) on delete set null,
  etapa                 text not null default 'CONTACTO',
  -- NULL = «la de la etapa» (lib/crm.ts, PROBABILIDAD_POR_ETAPA), que se aplica
  -- al leer: la tabla de omisión sigue abierta (pregunta 3 del ADR).
  probabilidad_pct      smallint,
  -- Sin moneda: es la de la instancia (ADR 0048).
  presupuesto_min       numeric(14,2),
  presupuesto_max       numeric(14,2),
  fecha_inicio_deseada  date,
  fecha_fin_deseada     date,
  fecha_decision        date,
  plazas                text,
  tipos_medio           text[] not null default '{}',
  objetivo              text,
  motivo_perdida        text,
  ganada_en             timestamptz,
  perdida_en            timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  constraint oportunidades_origen_ck      check (prospecto_id is not null or cliente_id is not null),
  constraint oportunidades_nombre_ck      check (length(btrim(nombre)) between 1 and 200),
  constraint oportunidades_etapa_ck
    check (etapa in ('CONTACTO','NECESIDAD','COTIZANDO','NEGOCIANDO','GANADA','PERDIDA')),
  constraint oportunidades_probabilidad_ck check (probabilidad_pct is null or probabilidad_pct between 0 and 100),
  constraint oportunidades_presupuesto_ck
    check ((presupuesto_min is null or presupuesto_min >= 0)
       and (presupuesto_max is null or presupuesto_max >= 0)
       and (presupuesto_min is null or presupuesto_max is null or presupuesto_min <= presupuesto_max)),
  constraint oportunidades_fechas_ck
    check (fecha_inicio_deseada is null or fecha_fin_deseada is null or fecha_inicio_deseada <= fecha_fin_deseada),
  constraint oportunidades_plazas_ck      check (plazas is null or length(plazas) <= 1000),
  constraint oportunidades_objetivo_ck    check (objetivo is null or length(objetivo) <= 2000),
  constraint oportunidades_tipos_medio_ck
    check (cardinality(tipos_medio) <= 7
       and tipos_medio <@ array['ESPECTACULAR','PANTALLA_DIGITAL','PUENTE_PEATONAL',
                                'MOBILIARIO_URBANO','MURAL','VALLA','OTRO']::text[]),
  -- Una perdida dice por qué y cuándo; una ganada, cuándo.
  constraint oportunidades_perdida_ck
    check (etapa <> 'PERDIDA' or (perdida_en is not null
                                  and length(btrim(coalesce(motivo_perdida,''))) between 1 and 2000)),
  constraint oportunidades_ganada_ck      check (etapa <> 'GANADA' or ganada_en is not null)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'oportunidades_id_tenant_uq'
                  and conrelid = 'oportunidades'::regclass) then
    alter table oportunidades add constraint oportunidades_id_tenant_uq unique (id, tenant_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oportunidades_prospecto_fkey'
                  and conrelid = 'oportunidades'::regclass) then
    alter table oportunidades add constraint oportunidades_prospecto_fkey
      foreign key (prospecto_id, tenant_id) references prospectos (id, tenant_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oportunidades_cliente_fkey'
                  and conrelid = 'oportunidades'::regclass) then
    alter table oportunidades add constraint oportunidades_cliente_fkey
      foreign key (cliente_id, tenant_id) references clientes (id, tenant_id) on delete restrict;
  end if;
end $$;

create index if not exists idx_oportunidades_tenant_usuario   on oportunidades (tenant_id, usuario_id);
create index if not exists idx_oportunidades_tenant_etapa     on oportunidades (tenant_id, etapa);
create index if not exists idx_oportunidades_tenant_cliente   on oportunidades (tenant_id, cliente_id);
create index if not exists idx_oportunidades_tenant_prospecto on oportunidades (tenant_id, prospecto_id);

drop trigger if exists trg_oportunidades_upd on oportunidades;
create trigger trg_oportunidades_upd before update on oportunidades
  for each row execute function set_actualizado_en();

comment on table oportunidades is
  'ADR 0051. Lo que un cliente (o un prospecto CLIENTE) quiere comprar: presupuesto, fechas, plazas, medios, objetivo y la etapa de la venta. No se borra: la que no prospera se marca PERDIDA con su motivo.';
comment on column oportunidades.usuario_id is
  'ADR 0051. El VENDEDOR. Lo estampa oportunidades-repo.ts desde la sesión. Quien no tiene comercial.aprobar solo ve las suyas.';
comment on column oportunidades.probabilidad_pct is
  'ADR 0051. La que puso el vendedor. NULL = la de la etapa (lib/crm.ts), aplicada al leer.';

-- ─── oportunidad_actividades: la línea de tiempo comercial ──────────────────
create table if not exists oportunidad_actividades (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  oportunidad_id        uuid not null,
  -- Sin FK a `usuarios`: ver la cabecera. El nombre queda congelado.
  usuario_id            uuid,
  usuario_nombre        text,
  tipo                  text not null,
  nota                  text,
  etapa_anterior        text,
  etapa_nueva           text,
  siguiente_paso        text,
  siguiente_paso_fecha  date,
  creado_en             timestamptz not null default now(),
  constraint oportunidad_actividades_tipo_ck
    check (tipo in ('LLAMADA','VISITA','REUNION','CORREO','WHATSAPP','NOTA','ETAPA')),
  constraint oportunidad_actividades_nota_ck  check (nota is null or length(nota) <= 2000),
  constraint oportunidad_actividades_paso_ck  check (siguiente_paso is null or length(siguiente_paso) <= 300),
  constraint oportunidad_actividades_nombre_ck check (usuario_nombre is null or length(usuario_nombre) <= 200),
  -- Una fila ETAPA siempre dice a cuál; las demás no hablan de etapas.
  constraint oportunidad_actividades_etapa_ck
    check ((tipo = 'ETAPA' and etapa_nueva is not null) or (tipo <> 'ETAPA' and etapa_anterior is null and etapa_nueva is null)),
  constraint oportunidad_actividades_etapas_validas_ck
    check ((etapa_anterior is null or etapa_anterior in ('CONTACTO','NECESIDAD','COTIZANDO','NEGOCIANDO','GANADA','PERDIDA'))
       and (etapa_nueva    is null or etapa_nueva    in ('CONTACTO','NECESIDAD','COTIZANDO','NEGOCIANDO','GANADA','PERDIDA'))),
  -- Una actividad que no es de etapa tiene que decir algo.
  constraint oportunidad_actividades_contenido_ck
    check (tipo = 'ETAPA' or length(btrim(coalesce(nota,''))) >= 1)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'oportunidad_actividades_oportunidad_fkey'
                  and conrelid = 'oportunidad_actividades'::regclass) then
    alter table oportunidad_actividades add constraint oportunidad_actividades_oportunidad_fkey
      foreign key (oportunidad_id, tenant_id) references oportunidades (id, tenant_id) on delete restrict;
  end if;
end $$;

create index if not exists idx_oportunidad_actividades_oportunidad
  on oportunidad_actividades (tenant_id, oportunidad_id, creado_en);

comment on table oportunidad_actividades is
  'ADR 0051. Llamadas, visitas, juntas, notas y cada cambio de etapa (tipo ETAPA) de una oportunidad. SOLO CRECE: trigger contra update y delete, y el rol de la aplicación solo tiene select e insert.';

-- ─── propuesta_cambios: lo que cambió en cada propuesta, campo por campo ────
--  La escribe la Fase 3 (`propuestas-repo.ts`, en la misma transacción que el
--  cambio). Nace aquí para que la migración sea una sola, como se aprobó.
create table if not exists propuesta_cambios (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  -- Sin FK a propósito: ver la cabecera.
  propuesta_id    uuid not null,
  folio           text not null,
  version         integer,
  usuario_id      uuid,
  usuario_nombre  text,
  origen          text not null default 'APP',
  accion          text not null,
  campo           text,
  item_id         uuid,
  valor_anterior  jsonb,
  valor_nuevo     jsonb,
  creado_en       timestamptz not null default now(),
  constraint propuesta_cambios_origen_ck check (origen in ('APP','CLIENTE','SISTEMA')),
  constraint propuesta_cambios_accion_ck
    check (accion in ('CREAR','EDITAR','AGREGAR_SITIO','QUITAR_SITIO','APROBAR_SITIO','CODIGO',
                      'PAQUETE','ESTATUS','ENVIAR','ACEPTAR','LIGAR','BORRAR')),
  constraint propuesta_cambios_campo_ck  check (campo is null or length(campo) <= 80),
  constraint propuesta_cambios_folio_ck  check (length(btrim(folio)) between 1 and 60),
  constraint propuesta_cambios_nombre_ck check (usuario_nombre is null or length(usuario_nombre) <= 200)
);

create index if not exists idx_propuesta_cambios_propuesta
  on propuesta_cambios (tenant_id, propuesta_id, creado_en);

comment on table propuesta_cambios is
  'ADR 0051 §4. Cada cambio a una propuesta: quién, cuándo, qué campo y de qué valor a cuál. SOLO CRECE (trigger). propuesta_id SIN FK: la historia de un borrador borrado se conserva, con su folio.';

-- ─── propuestas.oportunidad_id: opcional ────────────────────────────────────
alter table propuestas add column if not exists oportunidad_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'propuestas_oportunidad_fkey'
                  and conrelid = 'propuestas'::regclass) then
    alter table propuestas add constraint propuestas_oportunidad_fkey
      foreign key (oportunidad_id, tenant_id) references oportunidades (id, tenant_id) on delete restrict;
  end if;
end $$;

create index if not exists idx_propuestas_tenant_oportunidad
  on propuestas (tenant_id, oportunidad_id) where oportunidad_id is not null;

comment on column propuestas.oportunidad_id is
  'ADR 0051 §3. La oportunidad a la que responde esta cotización. Opcional: las de antes quedan sin ligar y funcionan igual.';

-- ─── Solo crece: el trigger, para las dos ───────────────────────────────────
create or replace function crm_solo_crece()
  returns trigger
  language plpgsql
as $$
begin
  raise exception 'historial append-only: % no permitido sobre %', tg_op, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists trg_oportunidad_actividades_solo_crece on oportunidad_actividades;
create trigger trg_oportunidad_actividades_solo_crece
  before update or delete on oportunidad_actividades
  for each row execute function crm_solo_crece();

drop trigger if exists trg_propuesta_cambios_solo_crece on propuesta_cambios;
create trigger trg_propuesta_cambios_solo_crece
  before update or delete on propuesta_cambios
  for each row execute function crm_solo_crece();

-- ─── RLS: cerrada por los dos lados, como el resto ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['oportunidades','oportunidad_actividades','propuesta_cambios'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── GRANT ───────────────────────────────────────────────────────────────────
--  El `revoke` es explícito porque `20260820_grants_rol_app.sql` concede todo en
--  las tablas nuevas por `alter default privileges`.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update on oportunidades to %I', r);
      execute format('revoke delete, truncate on oportunidades from %I', r);
      execute format('grant select, insert on oportunidad_actividades to %I', r);
      execute format('revoke update, delete, truncate on oportunidad_actividades from %I', r);
      execute format('grant select, insert on propuesta_cambios to %I', r);
      execute format('revoke update, delete, truncate on propuesta_cambios from %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'las tres tablas nuevas existen (3)' k, count(*)::text v
  from information_schema.tables
 where table_name in ('oportunidades','oportunidad_actividades','propuesta_cambios')
union all
select 'las tres con RLS forzada (3)', count(*)::text from pg_class
 where relname in ('oportunidades','oportunidad_actividades','propuesta_cambios')
   and relrowsecurity and relforcerowsecurity
union all
select 'propuestas.oportunidad_id (1)', count(*)::text from information_schema.columns
 where table_name = 'propuestas' and column_name = 'oportunidad_id'
union all
select 'clientes_id_tenant_uq (1)', count(*)::text from pg_constraint where conname = 'clientes_id_tenant_uq';
