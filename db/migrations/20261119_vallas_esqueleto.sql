-- @tipo: esquema
-- ============================================================================
--  VALLAS · ESQUELETO DEL MÓDULO (19/11). Zona ROJA R3 (+ R2).
--  ESPERA LA APROBACIÓN DEL DUEÑO para cualquier base que no sea la de pruebas.
-- ----------------------------------------------------------------------------
--  Pedido del dueño: un módulo de vallas publicitarias donde ir metiendo reglas
--  de negocio. Dos conceptos de entrada:
--   · NUMERACIÓN: un número por cuadro/cara (`vallas.numero`) y otro por grupo
--     (`vallas_grupos.numero`) cuando varias vallas juntas forman una imagen.
--     Cada valla con su ancho × alto; cada grupo con su medida total y su modo
--     (`una_imagen` | `separadas`).
--   · COMPETENCIA DE MARCAS: categorías editables («Refrescos de cola»:
--     Coca-Cola, Pepsi). La regla vive en código (`lib/vallas/reglas/`); aquí
--     solo el catálogo. La marca se compara con `campanas.marca` (texto, ya
--     existe), así que no hace falta una tabla de marcas aparte.
--
--  REUTILIZA `sitios` (tipo_medio VALLA, ancho, alto, caras): una valla vive en
--  un sitio y NO duplica sus datos.
--
--  SOLO AGREGA tres tablas. Nada existente cambia de forma ni de valor.
--
--  ═══ AISLAMIENTO (R2) ═════════════════════════════════════════════════════
--  · `tenant_id` NOT NULL en las tres, con la RLS fail-closed + FORCE de
--    siempre (la misma política que `imprentas`).
--  · FK COMPUESTAS `(x_id, tenant_id)`: los chequeos de FK saltan la RLS, y con
--    una FK simple una valla podría colgar del sitio (o del grupo) de OTRA
--    organización con solo equivocarse de id. `sitios_id_tenant_uq` ya existe
--    (20260928_paquete_cerrado.sql).
--
--  ═══ BORRADOS (R5) ════════════════════════════════════════════════════════
--  Nada en cascada salvo el tenant. `vallas → sitios` es `on delete restrict`:
--  un sitio con vallas no se borra sin quitarlas antes (se borran a mano, la
--  valla no tiene historia que perder todavía). `vallas → vallas_grupos` es
--  `no action`: al borrar un grupo el repo suelta antes a sus vallas en la
--  misma transacción (`set null (grupo_id)` es PostgreSQL 15; g500 corre 14).
--
--  Nada posterior a PostgreSQL 14. Transaccional e idempotente.
-- ============================================================================

begin;

-- ─── Grupos de vallas ───────────────────────────────────────────────────────
create table if not exists vallas_grupos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  numero          text not null,
  nombre          text,
  modo            text not null default 'una_imagen',
  ancho_m         numeric(8,2),
  alto_m          numeric(8,2),
  notas           text,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint vallas_grupos_numero_ck check (length(btrim(numero)) between 1 and 40),
  constraint vallas_grupos_modo_ck   check (modo in ('una_imagen','separadas')),
  constraint vallas_grupos_medida_ck check ((ancho_m is null or ancho_m > 0) and (alto_m is null or alto_m > 0))
);

create unique index if not exists vallas_grupos_tenant_numero_uidx
  on vallas_grupos (tenant_id, upper(btrim(numero)));

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vallas_grupos_id_tenant_uq'
                  and conrelid = 'vallas_grupos'::regclass) then
    alter table vallas_grupos add constraint vallas_grupos_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

drop trigger if exists trg_vallas_grupos_upd on vallas_grupos;
create trigger trg_vallas_grupos_upd before update on vallas_grupos
  for each row execute function set_actualizado_en();

comment on table vallas_grupos is
  'VALLAS (19/11). Varias vallas que se venden juntas, con número propio. modo una_imagen: el arte se hace a ancho_m × alto_m del grupo; separadas: cada valla lleva su arte.';

-- ─── Vallas (un cuadro/cara cada una) ───────────────────────────────────────
create table if not exists vallas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  sitio_id        uuid not null,
  numero          text not null,
  cara            smallint,
  ancho_m         numeric(8,2) not null,
  alto_m          numeric(8,2) not null,
  grupo_id        uuid,
  posicion        smallint,
  notas           text,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint vallas_numero_ck   check (length(btrim(numero)) between 1 and 40),
  constraint vallas_medida_ck   check (ancho_m > 0 and alto_m > 0),
  constraint vallas_cara_ck     check (cara is null or cara between 1 and 50),
  constraint vallas_posicion_ck check (posicion is null or posicion between 1 and 999)
);

create unique index if not exists vallas_tenant_numero_uidx
  on vallas (tenant_id, upper(btrim(numero)));
create index if not exists idx_vallas_sitio on vallas (tenant_id, sitio_id);
create index if not exists idx_vallas_grupo on vallas (tenant_id, grupo_id) where grupo_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vallas_sitio_fkey'
                  and conrelid = 'vallas'::regclass) then
    alter table vallas add constraint vallas_sitio_fkey
      foreign key (sitio_id, tenant_id) references sitios (id, tenant_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vallas_grupo_fkey'
                  and conrelid = 'vallas'::regclass) then
    alter table vallas add constraint vallas_grupo_fkey
      foreign key (grupo_id, tenant_id) references vallas_grupos (id, tenant_id);
  end if;
end $$;

drop trigger if exists trg_vallas_upd on vallas;
create trigger trg_vallas_upd before update on vallas
  for each row execute function set_actualizado_en();

comment on table vallas is
  'VALLAS (19/11). Un cuadro/cara con su número individual y su medida (metros), dentro de un sitio del inventario. grupo_id: el grupo que forma con otras (opcional).';

-- ─── Categorías de competencia de marcas ───────────────────────────────────
create table if not exists competencia_categorias (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  nombre          text not null,
  marcas          text[] not null default '{}',
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint competencia_categorias_nombre_ck check (length(btrim(nombre)) between 1 and 120),
  constraint competencia_categorias_marcas_ck check (cardinality(marcas) <= 100)
);

create unique index if not exists competencia_categorias_tenant_nombre_uidx
  on competencia_categorias (tenant_id, lower(btrim(nombre)));

drop trigger if exists trg_competencia_categorias_upd on competencia_categorias;
create trigger trg_competencia_categorias_upd before update on competencia_categorias
  for each row execute function set_actualizado_en();

comment on table competencia_categorias is
  'VALLAS (19/11). Marcas que compiten entre sí (p. ej. Refrescos de cola: Coca-Cola, Pepsi). Se comparan normalizadas contra campanas.marca. Baja lógica con activo = false.';

-- ─── RLS fail-closed + FORCE ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['vallas_grupos','vallas','competencia_categorias'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- Las vallas y los grupos se borran (no tienen historia que perder todavía);
-- las categorías no: su baja es lógica.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on vallas, vallas_grupos to %I', r);
      execute format('revoke truncate on vallas, vallas_grupos from %I', r);
      execute format('grant select, insert, update on competencia_categorias to %I', r);
      execute format('revoke delete, truncate on competencia_categorias from %I', r);
    end if;
  end loop;
end $$;

commit;

select 'tablas de vallas con RLS forzada (3)' k, count(*)::text v from pg_class
 where relname in ('vallas','vallas_grupos','competencia_categorias') and relrowsecurity and relforcerowsecurity
union all
select 'FK compuestas de vallas (2)', count(*)::text from pg_constraint
 where conname in ('vallas_sitio_fkey','vallas_grupo_fkey');
