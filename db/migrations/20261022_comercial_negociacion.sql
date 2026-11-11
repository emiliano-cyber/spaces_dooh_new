-- @tipo: esquema
-- ============================================================================
--  NEG-01 · Comercial negociación deja de ser maqueta, ENCIMA de `prospectos`.
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 2026-10-21: «en comercial negociación ya debemos
--  empezarlo a hacer funcional creando sus tablas», con coordenadas correctas
--  de cada lugar, notas adicionales, un campo de visibilidad cercana, media o
--  lejana, y las medidas del área. Forma aprobada ese mismo día: construir
--  ENCIMA de `prospectos` (CAP-01) —un espacio que se negocia es un prospecto
--  PREDIO o PANTALLA— y no aparte, para no tener dos bitácoras.
--
--  SOLO AGREGA: columnas opcionales en `prospectos`, dos en
--  `prospecto_avances` y cuatro tablas nuevas. Nada existente cambia de forma
--  ni de valor, así que una vuelta atrás a la versión anterior funciona con
--  esta migración puesta: las columnas y tablas nuevas, simplemente, no las lee.
--
--  ─── LA UBICACIÓN: lo que se guarda es lo que CONFIRMA la persona ─────────
--  Los términos de Google no dejan guardar más de 30 días la latitud y longitud
--  que da su buscador; el `place_id`, sí. Así que `lat`/`lng` (ya existían)
--  guardan el punto que la persona confirma o arrastra en el mapa, y
--  `ubicacion_origen` dice cómo se llegó a él. `GPS` está en el CHECK para no
--  necesitar otra migración el día que se haga, pero la API NO lo acepta
--  todavía: el dueño lo dejó pendiente (22/10).
--
--  ─── FK COMPUESTA CON TENANT EN TODAS LAS HIJAS ────────────────────────────
--  Como `prospecto_avances`: `(prospecto_id, tenant_id)` → `prospectos (id,
--  tenant_id)`. Los chequeos de FK saltan la RLS, y una FK simple dejaría colgar
--  un contacto de un prospecto de OTRA organización con solo equivocarse de id.
--
--  ─── LO QUE NO SE BORRA ────────────────────────────────────────────────────
--  · `prospecto_notas`: solo se añade (select, insert). Es lo que pidió el dueño
--    —«lista con autor y fecha»— y una nota que se puede reescribir deja de
--    servir para saber quién dijo qué.
--  · `prospecto_ofertas`: se añade y se le cambia el estado, pero no se borra.
--    La historia de lo que se le ofreció al dueño es la negociación.
--  El `revoke` es explícito porque `20260820_grants_rol_app.sql` concede todo en
--  las tablas nuevas por `alter default privileges`.
--
--  PostgreSQL 14: nada de aquí es de 15 (g500 corrió 14 hasta el 01/10, y la
--  copia del cluster viejo sigue ahí). Idempotente: `if not exists`, guards en
--  `pg_constraint`, `drop policy if exists`.
-- ============================================================================

begin;

-- ─── prospectos: la ficha del espacio ───────────────────────────────────────
alter table prospectos add column if not exists tipo_espacio           text;
alter table prospectos add column if not exists etapa_responsable      smallint;
alter table prospectos add column if not exists visibilidad            text;
alter table prospectos add column if not exists ancho_m                numeric(8,2);
alter table prospectos add column if not exists alto_m                 numeric(8,2);
alter table prospectos add column if not exists superficie_m2          numeric(12,2);
alter table prospectos add column if not exists presupuesto_min        numeric(14,2);
alter table prospectos add column if not exists presupuesto_max        numeric(14,2);
alter table prospectos add column if not exists presupuesto_autoriza   text;
alter table prospectos add column if not exists ubicacion_origen       text;
alter table prospectos add column if not exists ubicacion_precision_m  numeric(10,2);
alter table prospectos add column if not exists ubicacion_place_id     text;
alter table prospectos add column if not exists ubicacion_fijada_por   uuid references usuarios(id) on delete set null;
alter table prospectos add column if not exists ubicacion_fijada_en    timestamptz;

do $$
declare c record;
begin
  for c in select * from (values
    ('prospectos_tipo_espacio_ck',      'check (tipo_espacio is null or length(btrim(tipo_espacio)) between 1 and 80)'),
    ('prospectos_etapa_responsable_ck', 'check (etapa_responsable is null or etapa_responsable between 1 and 5)'),
    ('prospectos_visibilidad_ck',       'check (visibilidad is null or visibilidad in (''CERCANA'',''MEDIA'',''LEJANA''))'),
    ('prospectos_ancho_ck',             'check (ancho_m is null or ancho_m > 0)'),
    ('prospectos_alto_ck',              'check (alto_m is null or alto_m > 0)'),
    ('prospectos_superficie_ck',        'check (superficie_m2 is null or superficie_m2 > 0)'),
    ('prospectos_presupuesto_ck',       'check ((presupuesto_min is null or presupuesto_min >= 0) and (presupuesto_max is null or presupuesto_max >= 0) and (presupuesto_min is null or presupuesto_max is null or presupuesto_min <= presupuesto_max))'),
    ('prospectos_autoriza_ck',          'check (presupuesto_autoriza is null or length(presupuesto_autoriza) <= 120)'),
    ('prospectos_ubicacion_origen_ck',  'check (ubicacion_origen is null or ubicacion_origen in (''GPS'',''PIN'',''BUSCADOR''))'),
    ('prospectos_precision_ck',         'check (ubicacion_precision_m is null or ubicacion_precision_m >= 0)'),
    ('prospectos_place_id_ck',          'check (ubicacion_place_id is null or length(ubicacion_place_id) <= 300)')
  ) as v(nombre, def) loop
    if not exists (select 1 from pg_constraint where conname = c.nombre and conrelid = 'prospectos'::regclass) then
      execute format('alter table prospectos add constraint %I %s', c.nombre, c.def);
    end if;
  end loop;
end $$;

comment on column prospectos.visibilidad is
  'NEG-01. Desde dónde se ve el espacio: CERCANA, MEDIA o LEJANA. Pedido del dueño el 21/10.';
comment on column prospectos.etapa_responsable is
  'NEG-01. La búsqueda de quién firma, 1..5 (lib/negociacion.ts, ETAPAS_RESPONSABLE). Es otro eje que `etapa`: aquélla es la venta, ésta averiguar a quién hay que convencer. La 5 exige un contacto es_legal; lo comprueba el repo con la fila bloqueada.';
comment on column prospectos.ubicacion_origen is
  'NEG-01. Cómo se fijó lat/lng: PIN (en el mapa), BUSCADOR (un resultado confirmado por la persona) o GPS (en el CHECK, pero la API no lo acepta todavía: pendiente del dueño, 22/10).';
comment on column prospectos.ubicacion_place_id is
  'NEG-01. El place_id de Google, si se llegó por su buscador: es lo único de Google que sus términos dejan guardar sin caducidad.';

-- ─── prospecto_avances: el canal y con quién se habló ───────────────────────
alter table prospecto_avances add column if not exists canal           text;
-- El NOMBRE y no una FK al contacto: la bitácora es historia, y si mañana se
-- borra el contacto, la línea tiene que seguir diciendo con quién se habló.
alter table prospecto_avances add column if not exists contacto_nombre text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'prospecto_avances_canal_ck'
                  and conrelid = 'prospecto_avances'::regclass) then
    alter table prospecto_avances add constraint prospecto_avances_canal_ck
      check (canal is null or canal in ('LLAMADA','VISITA','REUNION','CORREO','WHATSAPP','OTRO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospecto_avances_contacto_ck'
                  and conrelid = 'prospecto_avances'::regclass) then
    alter table prospecto_avances add constraint prospecto_avances_contacto_ck
      check (contacto_nombre is null or length(contacto_nombre) <= 200);
  end if;
end $$;

-- ─── prospecto_contactos: varios por espacio ────────────────────────────────
create table if not exists prospecto_contactos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  prospecto_id    uuid not null,
  nombre          text not null,
  papel           text,
  telefono        text,
  email           text,
  -- Quien firma. Es el dato que cierra la última etapa de la búsqueda.
  es_legal        boolean not null default false,
  creado_por      uuid references usuarios(id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint prospecto_contactos_nombre_ck check (length(btrim(nombre)) between 1 and 200),
  constraint prospecto_contactos_papel_ck  check (papel is null or length(papel) <= 80),
  constraint prospecto_contactos_tel_ck    check (telefono is null or length(telefono) <= 40),
  constraint prospecto_contactos_email_ck  check (email is null or length(email) <= 200)
);

-- ─── prospecto_ofertas: lo que se le ofrece al DUEÑO del espacio ────────────
--  OJO: no son las `propuestas` del producto. Aquéllas son a un cliente que
--  compra publicidad; éstas, al dueño que renta el espacio. Sentido contrario y
--  dinero contrario: por eso tabla propia.
create table if not exists prospecto_ofertas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  prospecto_id     uuid not null,
  version          integer not null,
  fecha            date not null default current_date,
  importe_mensual  numeric(14,2) not null,
  plazo_meses      integer not null,
  estado           text not null default 'ENVIADA',
  notas            text,
  creado_por       uuid references usuarios(id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint prospecto_ofertas_version_ck check (version >= 1),
  constraint prospecto_ofertas_importe_ck check (importe_mensual > 0),
  constraint prospecto_ofertas_plazo_ck   check (plazo_meses between 1 and 240),
  constraint prospecto_ofertas_estado_ck  check (estado in ('ENVIADA','CONTRAOFERTA','RECHAZADA','ACEPTADA')),
  constraint prospecto_ofertas_notas_ck   check (notas is null or length(notas) <= 2000)
);

-- ─── prospecto_competencia: quién más ofrece por el espacio ─────────────────
create table if not exists prospecto_competencia (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  prospecto_id    uuid not null,
  nombre          text not null,
  nota            text,
  desde           date,
  creado_por      uuid references usuarios(id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint prospecto_competencia_nombre_ck check (length(btrim(nombre)) between 1 and 200),
  constraint prospecto_competencia_nota_ck   check (nota is null or length(nota) <= 2000)
);

-- ─── prospecto_notas: las notas adicionales, con autor y fecha ──────────────
create table if not exists prospecto_notas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  prospecto_id    uuid not null,
  -- El AUTOR. Lo estampa el repo desde la sesión, nunca desde el cuerpo.
  usuario_id      uuid references usuarios(id) on delete set null,
  texto           text not null,
  creado_en       timestamptz not null default now(),
  constraint prospecto_notas_texto_ck check (length(btrim(texto)) between 1 and 4000)
);

-- Índices (tenant primero) y la FK compuesta de cada hija.
do $$
declare t text;
begin
  foreach t in array array['prospecto_contactos','prospecto_ofertas','prospecto_competencia','prospecto_notas'] loop
    execute format('create index if not exists %I on %I (tenant_id, prospecto_id)', 'idx_' || t || '_prospecto', t);
    if not exists (select 1 from pg_constraint where conname = t || '_prospecto_fkey'
                    and conrelid = t::regclass) then
      execute format('alter table %I add constraint %I foreign key (prospecto_id, tenant_id)
                        references prospectos (id, tenant_id) on delete cascade', t, t || '_prospecto_fkey');
    end if;
  end loop;
end $$;

-- Dos ofertas con la misma versión en un espacio serían la misma oferta dos
-- veces: la versión la pone el repo con la fila del prospecto bloqueada, y esto
-- es la red por si alguna vez no.
create unique index if not exists prospecto_ofertas_version_uq
  on prospecto_ofertas (tenant_id, prospecto_id, version);

do $$
declare t text;
begin
  foreach t in array array['prospecto_contactos','prospecto_ofertas','prospecto_competencia'] loop
    execute format('drop trigger if exists %I on %I', 'trg_' || t || '_upd', t);
    execute format('create trigger %I before update on %I for each row execute function set_actualizado_en()',
                   'trg_' || t || '_upd', t);
  end loop;
end $$;

comment on table prospecto_contactos is
  'NEG-01. Los contactos de un espacio en negociación: el dueño, la apoderada, la vecina, el portero. es_legal = quien firma.';
comment on table prospecto_ofertas is
  'NEG-01. Ofertas de renta al DUEÑO del espacio (no son propuestas a clientes). La versión la pone el repo. Se cambia el estado; no se borran.';
comment on table prospecto_competencia is
  'NEG-01. Quién más ofrece por el espacio, qué y desde cuándo.';
comment on table prospecto_notas is
  'NEG-01. Notas adicionales de un espacio, con autor y fecha. SOLO SE AÑADEN: el rol de la aplicación no tiene update ni delete.';

-- ─── El contacto único que ya tenían los prospectos pasa a ser el primero ───
-- Solo si trae nombre y el prospecto todavía no tiene contactos: corrida dos
-- veces, no duplica. Teléfono y correo se RECORTAN al largo de los CHECK de
-- arriba: el `jsonb` no tenía tope en la base, y un valor largo de antes haría
-- caer la migración entera (y `update.sh` volvería atrás la versión).
insert into prospecto_contactos (tenant_id, prospecto_id, nombre, telefono, email, creado_por, creado_en)
select p.tenant_id, p.id, btrim(p.contacto->>'nombre'),
       left(nullif(btrim(coalesce(p.contacto->>'telefono','')), ''), 40),
       left(nullif(btrim(coalesce(p.contacto->>'email','')), ''), 200),
       p.usuario_id, p.creado_en
  from prospectos p
 where length(btrim(coalesce(p.contacto->>'nombre',''))) between 1 and 200
   and not exists (select 1 from prospecto_contactos c where c.prospecto_id = p.id and c.tenant_id = p.tenant_id);

-- ─── RLS: cerrada por los dos lados, como el resto ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['prospecto_contactos','prospecto_ofertas','prospecto_competencia','prospecto_notas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── GRANT ───────────────────────────────────────────────────────────────────
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on prospecto_contactos to %I', r);
      execute format('grant select, insert, update, delete on prospecto_competencia to %I', r);
      execute format('grant select, insert, update on prospecto_ofertas to %I', r);
      execute format('revoke delete, truncate on prospecto_ofertas from %I', r);
      execute format('grant select, insert on prospecto_notas to %I', r);
      execute format('revoke update, delete, truncate on prospecto_notas from %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'las cuatro tablas nuevas existen (4)' k, count(*)::text v
  from information_schema.tables
 where table_name in ('prospecto_contactos','prospecto_ofertas','prospecto_competencia','prospecto_notas')
union all
select 'las cuatro con RLS forzada (4)', count(*)::text from pg_class
 where relname in ('prospecto_contactos','prospecto_ofertas','prospecto_competencia','prospecto_notas')
   and relrowsecurity and relforcerowsecurity
union all
select 'columnas nuevas en prospectos (14)', count(*)::text from information_schema.columns
 where table_name = 'prospectos' and column_name in ('tipo_espacio','etapa_responsable','visibilidad',
   'ancho_m','alto_m','superficie_m2','presupuesto_min','presupuesto_max','presupuesto_autoriza',
   'ubicacion_origen','ubicacion_precision_m','ubicacion_place_id','ubicacion_fijada_por','ubicacion_fijada_en');
