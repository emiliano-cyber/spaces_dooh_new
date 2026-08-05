-- ============================================================================
-- ADR 0011 · `config_negocio` deja de ser una fila global.
-- Cierra el hallazgo M5 de la auditoría QA del 04/08/2026 y el M-8 que el repo
-- venía arrastrando desde 20260724_n6_config_negocio_moneda_mxn.sql.
--
-- EL PROBLEMA, en una línea: había UNA fila para las CINCO organizaciones, y
-- `PATCH /api/config` escribía sobre ella. El Dueño de cualquiera que cambiara
-- su IVA, su moneda o su logo se los cambiaba a todas las demás, desde una
-- pantalla normal y sin dejar rastro de que había tocado a terceros.
--
-- ORDEN DE LOS PASOS (importa): se CLONA la fila para cada tenant ANTES de
-- imponer `not null` y `unique`. Al revés, la restricción falla con la tabla a
-- medias. Y clonar garantiza que nadie estrene valores: cada organización se
-- queda exactamente con lo que estaba viendo hasta este momento.
--
-- Transaccional. Idempotente: repetirla no duplica filas (el insert filtra por
-- lo que ya existe) ni vuelve a intentar lo ya hecho.
-- ============================================================================
begin;

-- ─── 1. La columna, todavía permisiva ───────────────────────────────────────
alter table config_negocio add column if not exists tenant_id uuid references tenants(id) on delete cascade;

-- ─── 2. La fila existente es de RGB, y `nombre_tenant` se va ────────────────
-- Va TODO dentro del guard porque las dos cosas dependen de que la columna
-- exista. En una segunda pasada ya no está, y sin el guard el paso fallaría con
-- «column nombre_tenant does not exist» — la migración dejaría de ser
-- idempotente justo en el momento en que uno la relanza porque algo salió mal.
--
-- El DROP va AQUÍ, antes de clonar, y no al final: así el insert de abajo no
-- tiene que rellenar una columna `not null` que está a punto de desaparecer.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'config_negocio' and column_name = 'nombre_tenant'
  ) then
    -- `nombre_tenant` dice 'RGB Catorce', así que se usa para decidir de quién
    -- son esos valores; si no cuadrara, cae al tenant 'rgb'.
    execute $q$
      update config_negocio c
         set tenant_id = coalesce(
           (select t.id from tenants t where lower(t.nombre) = lower(c.nombre_tenant) limit 1),
           (select t.id from tenants t where t.slug = 'rgb' limit 1),
           (select t.id from tenants t order by t.creado_en limit 1)
         )
       where c.tenant_id is null
    $q$;
    -- Duplicaba `tenants.nombre` y el código resolvía la duplicidad de dos
    -- maneras CONTRARIAS: obtenerConfig() lo pisaba con el del tenant (sidebar:
    -- «G500») y obtenerConfigAdmin() no (Configuración: «RGB Catorce»). Esa es
    -- literalmente la contradicción que reportó M5.
    execute 'alter table config_negocio drop column nombre_tenant';
  end if;
end $$;

-- ─── 3. Una fila por tenant, clonando la que había ──────────────────────────
-- Cada organización hereda EXACTAMENTE la configuración que venía leyendo, que
-- es la de la fila global. Nadie nota el cambio el día del despliegue; a partir
-- de ahí, cada quien puede tocar la suya sin pisar a nadie.
insert into config_negocio (
  tenant_id, moneda, plazos_cobranza, tipos_tarea,
  max_clientes_pantalla, logo_url, iva_tasas, loop_seg, spot_seg
)
select t.id, base.moneda, base.plazos_cobranza, base.tipos_tarea,
       base.max_clientes_pantalla, base.logo_url, base.iva_tasas, base.loop_seg, base.spot_seg
  from tenants t
 cross join (select * from config_negocio order by actualizado_en limit 1) base
 where not exists (select 1 from config_negocio c where c.tenant_id = t.id);

-- ─── 4. Ahora sí, las restricciones ─────────────────────────────────────────
alter table config_negocio alter column tenant_id set not null;
create unique index if not exists config_negocio_tenant_uidx on config_negocio (tenant_id);

-- ─── 5. Aislamiento, como el resto de las tablas de negocio ─────────────────
-- Era la ÚNICA tabla de negocio con rls=f, force=f. Quedó fuera porque nació
-- como singleton global; ahora que tiene tenant_id no hay motivo para la
-- excepción. Doble capa: RLS aquí + filtro explícito por tenant_id en las
-- consultas, igual que en usuarios-repo.
alter table config_negocio enable row level security;
alter table config_negocio force row level security;
drop policy if exists tenant_isolation on config_negocio;
create policy tenant_isolation on config_negocio for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- ASSERT: si la app conectara con un rol BYPASSRLS, todo lo anterior sería
-- decorativo. Mejor fallar aquí que dar una falsa sensación de aislamiento.
do $$
declare malo text;
begin
  select string_agg(rolname, ', ') into malo
    from pg_roles
   where rolname in ('spaces_user','spaces_app') and (rolbypassrls or rolsuper);
  if malo is not null then
    raise exception 'El rol de la app puede saltarse la RLS (%). Abortado.', malo;
  end if;
end $$;

commit;

-- Verificación
select 'filas de config (debe = nº de tenants)' k, count(*)::text v from config_negocio
union all
select 'tenants', count(*)::text from tenants
union all
select 'filas sin tenant (debe ser 0)', count(*)::text from config_negocio where tenant_id is null
union all
select 'nombre_tenant (debe ser 0)', count(*)::text from information_schema.columns
  where table_name='config_negocio' and column_name='nombre_tenant'
union all
select 'RLS activa (debe ser t)', relrowsecurity::text from pg_class where relname='config_negocio';
