-- ============================================================================
-- Fase 3 · Integración Arrendadores ↔ Operaciones — ALMACÉN DE ACTIVOS.
--
-- Seguimiento de activos físicos (pantallas, estructuras, lonas) fuera de
-- operación: en bodega, instalados, en traslado o dados de baja; con un registro
-- de movimientos (traslados). Complementa las OT (Fase 2): cuando una pantalla se
-- retira, su equipo entra al almacén; cuando se instala, sale.
--
-- RLS fail-closed + FORCE por tenant (patrón M5), porque estas tablas se crean
-- después del barrido global de Hardening 1.
-- ============================================================================
begin;

do $$ begin
  create type est_activo as enum ('EN_ALMACEN','INSTALADO','EN_TRASLADO','BAJA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_mov_almacen as enum ('ENTRADA','SALIDA','TRASLADO','BAJA');
exception when duplicate_object then null; end $$;

create table if not exists almacen_activos (
  id          uuid primary key default gen_random_uuid(),
  etiqueta    text not null,               -- serie / número de inventario / tag
  descripcion text not null,
  tipo_activo text not null default 'PANTALLA',  -- PANTALLA / ESTRUCTURA / LONA / OTRO
  estado      est_activo not null default 'EN_ALMACEN',
  sitio_id    uuid references sitios(id) on delete set null,  -- dónde está si INSTALADO
  notas       text,
  creado_en   timestamptz not null default now(),
  tenant_id   uuid not null
);
create index if not exists idx_almacen_activos_estado on almacen_activos (estado);

create table if not exists almacen_movimientos (
  id          uuid primary key default gen_random_uuid(),
  activo_id   uuid not null references almacen_activos(id) on delete cascade,
  tipo        tipo_mov_almacen not null,
  motivo      text,
  sitio_id    uuid references sitios(id) on delete set null,
  usuario_id  uuid references usuarios(id) on delete set null,
  fecha       timestamptz not null default now(),
  tenant_id   uuid not null
);
create index if not exists idx_almacen_mov_activo on almacen_movimientos (activo_id);

-- RLS fail-closed + FORCE (patrón arr_m5_rls_failclosed).
do $$
declare t text;
begin
  foreach t in array array['almacen_activos','almacen_movimientos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- GRANTs al rol de la app (el que exista).
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on almacen_activos to %I', r);
      execute format('grant select, insert, update, delete on almacen_movimientos to %I', r);
    end if;
  end loop;
end $$;

commit;
