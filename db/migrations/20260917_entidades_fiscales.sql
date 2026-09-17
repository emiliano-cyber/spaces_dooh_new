-- ============================================================================
-- `entidades_fiscales` — las razones sociales PROPIAS del owner.
--
-- ── Por qué existe ─────────────────────────────────────────────────────────
-- Un owner de SPACE OS no es una sola empresa: reparte su operación entre
-- varias razones sociales. Una paga las rentas a los arrendadores, otra compra
-- los activos, otra hace los trámites y licencias con gobierno, otra u otras
-- venden publicidad, y la operación con su nómina va aparte. Es el reparto
-- normal del negocio, no un caso raro.
--
-- Hasta hoy el producto no guardaba NINGUNA razón social propia: `tenants` solo
-- tenía `id, nombre, slug, moneda` (`db/schema.sql:590-596`) y la razón social
-- del owner llegó después como UNA columna suelta de esa misma tabla — o sea,
-- una y nada más. Con eso no se puede decir a nombre de quién se paga una renta
-- ni quién emite un comprobante.
--
-- ── La confusión que hay que evitar, porque ya vive en el repositorio ──────
-- `arrendador_razon_social` (`db/schema.sql:290`) es la razón social del
-- ARRENDADOR: quien ME COBRA la renta. Esta tabla es la del OWNER: quien la
-- PAGA. Son cosas distintas, se capturan en pantallas distintas y ninguna
-- sustituye a la otra. Aquella tabla NO se toca.
--
-- ── `entidad_id` NO ES UNA FRONTERA DE SEGURIDAD ───────────────────────────
-- La frontera sigue siendo UNA: `tenant_id` con RLS. Si alguna consulta filtra
-- por `entidad_id` creyendo que eso aísla y se le cae el `tenant_id`, aparece el
-- fallo R2 de este repositorio, que NO DA ERROR: devuelve cero filas en silencio
-- o filas de otra empresa. Ya pasó dos veces. Por eso las dos tablas nuevas
-- nacen con RLS fail-closed + FORCE y por eso el repo lleva además el
-- `and tenant_id = $n` explícito como segunda capa.
--
-- ── Por qué el rol es TEXTO con catálogo sembrado y NO un enum ─────────────
-- La lista de roles es una decisión de negocio todavía abierta: puede que mañana
-- haga falta NOMINA, o que dos de los cinco se fundan. Con un enum, cada cambio
-- de esa lista es una migración —y un `alter type` no se puede revertir dentro
-- de una transacción—; con un catálogo en una tabla, es un `insert`. La
-- restricción de integridad no se pierde: `entidad_roles.rol` referencia al
-- catálogo, así que un rol inventado sigue siendo imposible.
--
-- El catálogo NO lleva `tenant_id` a propósito: es vocabulario del producto,
-- igual para toda la flota, y una lista por organización es una decisión de
-- diseño que nadie ha tomado. Sin `tenant_id` queda fuera del invariante de
-- RLS (mismo criterio que `folios_consecutivos`, `db/schema.sql:93-99`).
--
-- ── Por qué las dos columnas nuevas son NULLABLE ───────────────────────────
-- `contratos_arrendamiento.entidad_id` y `facturas.entidad_emisora_id` nacen
-- vacías en todas las filas que ya existen, y eso es CORRECTO: se pintan como
-- «sin asignar». Exigirlas habría dejado el módulo inservible el día del
-- despliegue, que es lo que pasa cuando un dato nuevo se declara obligatorio
-- hacia atrás. Las FK van `on delete set null`: retirar una razón social no
-- puede llevarse por delante un contrato ni un comprobante ya emitido.
--
-- Nota sobre `facturas`: en este producto NO se timbra CFDI. Son recibos y
-- comprobantes de pago; el timbrado real llegará después por API. Aquí no hay
-- nada del SAT, ni certificados, ni complemento de pago: solo cuál de mis
-- razones sociales emite el documento.
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

-- ─── 1. El catálogo de roles ───────────────────────────────────────────────
create table if not exists catalogo_roles_entidad (
  rol      text primary key,
  etiqueta text not null,          -- cómo se lee en pantalla
  orden    integer not null default 100
);

comment on table catalogo_roles_entidad is
  'Vocabulario de roles de una entidad fiscal del owner. Es TEXTO con catalogo '
  'y no un enum a proposito: la lista es una decision de negocio abierta y se '
  'cambia con un insert, no con una migracion. Sin tenant_id: es vocabulario '
  'del producto, igual para toda la flota.';

-- Los cinco de partida. `do nothing` y no `do update`: si alguien renombró una
-- etiqueta en su instancia, reaplicar la migración no se la pisa.
insert into catalogo_roles_entidad (rol, etiqueta, orden) values
  ('ARRENDAMIENTOS', 'Paga las rentas a los arrendadores', 10),
  ('ACTIVOS',        'Compra los activos y el equipo',     20),
  ('LICENCIAS',      'Tramites y licencias con gobierno',  30),
  ('OPERACION',      'Operacion y nomina',                 40),
  ('VENTAS',         'Vende publicidad',                   50)
on conflict (rol) do nothing;

-- ─── 2. Las entidades fiscales del owner ───────────────────────────────────
create table if not exists entidades_fiscales (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  razon_social text not null,
  rfc          text,                    -- puede faltar: el expediente nace incompleto (ADR 0001)
  regimen      text,
  cp_fiscal    text,                    -- código postal del domicilio fiscal
  serie_folios text,                    -- serie con la que esta entidad folia sus documentos
  -- Baja LOGICA, no fisica: una entidad aparece en contratos y en comprobantes
  -- ya emitidos. Borrarla dejaria documentos apuntando a la nada, y como las FK
  -- son `on delete set null`, el borrado no fallaria — perderia el dato en
  -- silencio, que es peor que un error.
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create index if not exists idx_entidades_fiscales_tenant
  on entidades_fiscales (tenant_id);
-- Las activas, que es el listado de todos los días.
create index if not exists idx_entidades_fiscales_activas
  on entidades_fiscales (tenant_id) where activo;

comment on table entidades_fiscales is
  'Razones sociales PROPIAS del owner: quien PAGA la renta, compra activos, '
  'tramita licencias o vende. NO confundir con arrendador_razon_social, que es '
  'la razon social de quien me COBRA la renta.';

-- ─── 3. Los roles de cada entidad ──────────────────────────────────────────
-- Una entidad puede tener VARIOS: operación y ventas suelen coincidir, y ese es
-- el caso normal, no la excepción. Lo que no puede es tener el mismo dos veces.
create table if not exists entidad_roles (
  entidad_id uuid not null references entidades_fiscales(id) on delete cascade,
  rol        text not null references catalogo_roles_entidad(rol),
  tenant_id  uuid not null,
  creado_en  timestamptz not null default now(),
  constraint entidad_roles_uq unique (entidad_id, rol)
);

create index if not exists idx_entidad_roles_tenant on entidad_roles (tenant_id);

comment on table entidad_roles is
  'Que papel juega cada entidad fiscal. Varios por entidad es lo normal. '
  'El unique (entidad_id, rol) es el ultimo cerrojo: si un dia una ruta nueva '
  'insertara roles sin pasar por el controller, sigue en pie.';

-- ─── 4. Las dos columnas que enlazan con lo que ya existe ──────────────────
-- Nullable a propósito (ver la cabecera). `add column if not exists` y la FK
-- guardada por catálogo para que reaplicar la migración no falle.
alter table contratos_arrendamiento add column if not exists entidad_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'contratos_arrendamiento_entidad_id_fkey'
       and conrelid = 'contratos_arrendamiento'::regclass
  ) then
    alter table contratos_arrendamiento
      add constraint contratos_arrendamiento_entidad_id_fkey
      foreign key (entidad_id) references entidades_fiscales(id) on delete set null;
  end if;
end $$;

create index if not exists idx_contratos_entidad on contratos_arrendamiento (entidad_id);

comment on column contratos_arrendamiento.entidad_id is
  'Cual de MIS razones sociales paga esta renta. NULL = sin asignar, y es un '
  'estado legitimo: todas las filas anteriores al 2026-09-17 estan asi. '
  'NO es una frontera de seguridad: la unica es tenant_id con RLS.';

alter table facturas add column if not exists entidad_emisora_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'facturas_entidad_emisora_id_fkey'
       and conrelid = 'facturas'::regclass
  ) then
    alter table facturas
      add constraint facturas_entidad_emisora_id_fkey
      foreign key (entidad_emisora_id) references entidades_fiscales(id) on delete set null;
  end if;
end $$;

create index if not exists idx_facturas_entidad_emisora on facturas (entidad_emisora_id);

comment on column facturas.entidad_emisora_id is
  'Cual de MIS razones sociales emite el comprobante. NULL = sin asignar. '
  'Aqui NO se timbra CFDI: son recibos y comprobantes de pago, y el timbrado '
  'real llegara despues por API.';

-- ─── 5. RLS fail-closed + FORCE ────────────────────────────────────────────
-- Patrón literal de `20260723_almacen.sql:47-60` (`arr_m5_rls_failclosed`). Se
-- aplica aquí porque estas tablas se crean DESPUÉS del barrido global de
-- Hardening 1, que no ve las tablas futuras.
do $$
declare t text;
begin
  foreach t in array array['entidades_fiscales','entidad_roles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── 6. GRANTs al rol de la app ────────────────────────────────────────────
-- En producción las tablas las posee otro rol, así que el GRANT es explícito.
-- Por rol existente porque los entornos difieren (`spaces_user` en el droplet
-- viejo, `spaces_app` desde `20260820_grants_rol_app.sql`).
--
-- El catálogo va SOLO de lectura: es vocabulario del producto y lo cambia una
-- migración o una persona con acceso a la base, no la aplicación.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on entidades_fiscales to %I', r);
      execute format('grant select, insert, update, delete on entidad_roles to %I', r);
      execute format('grant select on catalogo_roles_entidad to %I', r);
    end if;
  end loop;
end $$;

-- ─── 7. ASSERT: el invariante de hard1 sigue cumpliéndose ──────────────────
-- CERO tablas con `tenant_id` sin RLS+FORCE. Si el paso 5 se olvidara de una,
-- se entera aquí y no tres semanas después. Es el mismo ASSERT que lleva
-- `20260907_codigos_recuperacion.sql:131-148`.
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and exists (select 1 from information_schema.columns col
                  where col.table_name = c.relname and col.column_name = 'tenant_id')
     and (not c.relrowsecurity or not c.relforcerowsecurity);
  if faltan is not null then
    raise exception 'Tablas con tenant_id sin RLS+FORCE: %', faltan;
  end if;
end $$;

commit;

-- ─── Verificación (debe devolver 0 filas) ──────────────────────────────────
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and exists (select 1 from information_schema.columns col
                where col.table_name = c.relname and col.column_name = 'tenant_id')
   and (not c.relrowsecurity or not c.relforcerowsecurity);
