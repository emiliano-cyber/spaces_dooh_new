-- @tipo: esquema
-- ============================================================================
--  IMP-REQ · CADA IMPRENTA CON SUS REQUISITOS DE ARTE, Y LOS DE LA EMPRESA.
--  Forma APROBADA POR EL DUEÑO el 2026-11-18 (opción B, zona ROJA R3 + R2).
-- ----------------------------------------------------------------------------
--  Pedido del dueño: «la imprenta usada es de terceros por ahora y, como se
--  vende el proyecto, la imprenta puede ser de cualquiera». La valoración del
--  arte (IMP-VAL, `lib/valoracion-arte.ts`) tenía los umbrales fijos en código.
--  Ahora se resuelven imprenta > empresa > constantes
--  (`lib/requisitos-impresion.ts`).
--
--  SOLO AGREGA:
--   · `config_negocio.requisitos_impresion jsonb` — los de la empresa. '{}' =
--     sin configurar (mandan las constantes). Se SANEA al leer, como
--     `costos_ot`: un jsonb tocado a mano no rompe nada.
--   · La tabla `imprentas` — una por proveedor de impresión, con los suyos.
--   · `ordenes_impresion.imprenta_id` — opcional. `proveedor` (texto) SE QUEDA:
--     las órdenes de antes lo usan y las pantallas lo siguen pintando.
--  Nada existente cambia de forma ni de valor: la versión anterior funciona con
--  esta migración puesta (lo nuevo no lo lee).
--
--  ═══ AISLAMIENTO (R2) ═════════════════════════════════════════════════════
--  · `imprentas.tenant_id` NOT NULL con la RLS fail-closed + FORCE de siempre.
--  · La orden apunta a la imprenta con FK COMPUESTA `(imprenta_id, tenant_id)`:
--    los chequeos de FK saltan la RLS, y con una FK simple una orden podría
--    apuntar a la imprenta de OTRA organización con solo equivocarse de id.
--    MATCH SIMPLE: sin imprenta (`imprenta_id` null) no se comprueba nada.
--
--  ═══ POR QUÉ `on delete restrict` Y NO `set null` ════════════════════════
--  `set null` sobre una FK compuesta intentaría anular también `tenant_id`
--  (NOT NULL) y el borrado fallaría igual. La forma buena,
--  `set null (imprenta_id)`, es PostgreSQL 15 y g500 corre 14.24. Así que la
--  baja de una imprenta es LÓGICA (`activo = false`), el rol de la app no
--  tiene DELETE sobre la tabla y la FK impide borrar una con órdenes.
--
--  ═══ POSTGRESQL 14 ════════════════════════════════════════════════════════
--  Nada posterior a la 14. Sin `-- @pg-min`.
--
--  Transaccional e idempotente: se puede correr dos veces.
-- ============================================================================

begin;

alter table config_negocio
  add column if not exists requisitos_impresion jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'config_requisitos_impresion_ck'
                  and conrelid = 'config_negocio'::regclass) then
    alter table config_negocio add constraint config_requisitos_impresion_ck
      check (jsonb_typeof(requisitos_impresion) = 'object');
  end if;
end $$;

comment on column config_negocio.requisitos_impresion is
  'IMP-REQ (18/11). Requisitos de arte POR OMISIÓN de la empresa: dpiGranVerde, dpiGranAmbar, dpiCercanaVerde, dpiCercanaAmbar, corteGranM, margenCm, formatos. {} = mandan las constantes de lib/requisitos-impresion.ts. Se sanea al leer.';

create table if not exists imprentas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  nombre          text not null,
  requisitos      jsonb not null default '{}'::jsonb,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint imprentas_nombre_ck      check (length(btrim(nombre)) between 1 and 120),
  constraint imprentas_requisitos_ck  check (jsonb_typeof(requisitos) = 'object')
);

-- Único por organización y sin distinguir mayúsculas ni espacios: «Gráficos
-- MX» y «gráficos mx » son la misma imprenta.
create unique index if not exists imprentas_tenant_nombre_uidx
  on imprentas (tenant_id, lower(btrim(nombre)));

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'imprentas_id_tenant_uq'
                  and conrelid = 'imprentas'::regclass) then
    alter table imprentas add constraint imprentas_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

drop trigger if exists trg_imprentas_upd on imprentas;
create trigger trg_imprentas_upd before update on imprentas
  for each row execute function set_actualizado_en();

comment on table imprentas is
  'IMP-REQ (18/11). Proveedores de impresión de la organización, con sus requisitos de arte (misma forma que config_negocio.requisitos_impresion). Baja lógica con activo = false; no se borran.';

alter table ordenes_impresion add column if not exists imprenta_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ordenes_impresion_imprenta_fkey'
                  and conrelid = 'ordenes_impresion'::regclass) then
    alter table ordenes_impresion add constraint ordenes_impresion_imprenta_fkey
      foreign key (imprenta_id, tenant_id) references imprentas (id, tenant_id) on delete restrict;
  end if;
end $$;

create index if not exists idx_ordenes_impresion_imprenta
  on ordenes_impresion (tenant_id, imprenta_id) where imprenta_id is not null;

comment on column ordenes_impresion.imprenta_id is
  'IMP-REQ (18/11). La imprenta que imprime esta orden; sus requisitos mandan en la valoración del arte. Opcional: proveedor (texto) se conserva para las de antes.';

alter table imprentas enable row level security;
alter table imprentas force row level security;
drop policy if exists tenant_isolation on imprentas;
create policy tenant_isolation on imprentas for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update on imprentas to %I', r);
      execute format('revoke delete, truncate on imprentas from %I', r);
    end if;
  end loop;
end $$;

commit;

select 'imprentas existe con RLS forzada (1)' k, count(*)::text v from pg_class
 where relname = 'imprentas' and relrowsecurity and relforcerowsecurity
union all
select 'config_negocio.requisitos_impresion (1)', count(*)::text from information_schema.columns
 where table_name = 'config_negocio' and column_name = 'requisitos_impresion'
union all
select 'ordenes_impresion.imprenta_id (1)', count(*)::text from information_schema.columns
 where table_name = 'ordenes_impresion' and column_name = 'imprenta_id'
union all
select 'FK compuesta de la orden (1)', count(*)::text from pg_constraint
 where conname = 'ordenes_impresion_imprenta_fkey';
