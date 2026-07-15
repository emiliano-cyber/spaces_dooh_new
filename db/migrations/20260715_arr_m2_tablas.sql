-- ============================================================================
-- Arrendadores Fase 1 · M2 — Tablas nuevas (predios, razón social) + FKs + RLS.
-- RLS se crea FAIL-OPEN (igual que las tablas hermanas); M5 la endurece a
-- fail-closed + FORCE para el módulo. Idempotente.
-- ============================================================================
begin;

-- Enum de estado del predio.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_predio') then
    create type estado_predio as enum
      ('PROSPECTO','EN_NEGOCIACION','DISPONIBLE','OCUPADO','SUSPENDIDO','PROBLEMA_LEGAL','FUERA_DE_SERVICIO');
  end if;
end $$;

-- Predio: núcleo del módulo (Arrendador → Predio → Contrato → Pantallas).
create table if not exists predios (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  arrendador_id  uuid not null references arrendadores(id) on delete restrict,
  nombre         text not null,
  direccion      text,
  lat            numeric(10,7),
  lng            numeric(11,7),
  tipo_ubicacion text,
  estado         estado_predio not null default 'DISPONIBLE',
  documentos     jsonb not null default '[]'::jsonb,
  creado_en      timestamptz not null default now()
);
create index if not exists predios_arrendador_idx on predios(arrendador_id);
create index if not exists predios_tenant_idx     on predios(tenant_id);

-- Razón social del arrendador (un arrendador factura bajo N razones sociales).
create table if not exists arrendador_razon_social (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  arrendador_id uuid not null references arrendadores(id) on delete cascade,
  razon_social  text not null,
  rfc           text,
  regimen       text,
  creado_en     timestamptz not null default now()
);
create index if not exists ars_arrendador_idx on arrendador_razon_social(arrendador_id);

-- FKs de las columnas agregadas en M1 (guardadas; Postgres no soporta IF NOT EXISTS aquí).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_predio_fk') then
    alter table contratos_arrendamiento
      add constraint contratos_predio_fk foreign key (predio_id) references predios(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contratos_razon_social_fk') then
    alter table contratos_arrendamiento
      add constraint contratos_razon_social_fk foreign key (razon_social_id) references arrendador_razon_social(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sitios_predio_fk') then
    alter table sitios
      add constraint sitios_predio_fk foreign key (predio_id) references predios(id) on delete restrict;
  end if;
end $$;

-- RLS (fail-open por ahora; se endurece en M5) — mismo patrón que las hermanas.
alter table predios                  enable row level security;
alter table arrendador_razon_social  enable row level security;
drop policy if exists tenant_isolation on predios;
drop policy if exists tenant_isolation on arrendador_razon_social;
create policy tenant_isolation on predios for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
         or nullif(current_setting('app.tenant_id', true),'') is null)
  with check (true);
create policy tenant_isolation on arrendador_razon_social for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
         or nullif(current_setting('app.tenant_id', true),'') is null)
  with check (true);

commit;

-- Verificación
select 'tablas' t, string_agg(relname, ',' order by relname) v
  from pg_class where relname in ('predios','arrendador_razon_social') and relkind='r'
union all
select 'fks', string_agg(conname, ',' order by conname)
  from pg_constraint where conname in ('contratos_predio_fk','contratos_razon_social_fk','sitios_predio_fk')
union all
select 'rls_predios', (relrowsecurity)::text from pg_class where relname='predios'
union all
select 'estado_predio_enum', string_agg(enumlabel, ',' order by enumsortorder)
  from pg_enum e join pg_type ty on ty.oid=e.enumtypid where ty.typname='estado_predio';
