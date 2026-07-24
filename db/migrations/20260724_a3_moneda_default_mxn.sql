-- ============================================================================
-- A-3 (cierre): la moneda estándar por organización es la del tenant (MXN), no
-- el literal 'PEN' peruano.
--
-- La migración 20260724_moneda_por_tenant.sql ya alineó los DATOS existentes
-- (campanas.moneda y facturas.moneda) a tenants.moneda. Pero los DEFAULT de
-- columna seguían en 'PEN' (herencia del esquema original): si un INSERT llegara
-- a omitir `moneda`, la fila nacería en soles. Los repos hoy siempre la fijan
-- por coalesce del tenant, pero el default es una trampa latente. Este cierre:
--   1) Cambia el DEFAULT de campanas/facturas/contratos de 'PEN' a 'MXN'.
--   2) Re-corrige (idempotente) cualquier 'PEN' residual de campanas/facturas al
--      valor del tenant, y REPORTA cuántas filas tocó por tabla.
--
-- FUERA DE SCOPE (se reporta como pendiente, hallazgo M-8): config_negocio.moneda
-- sigue en 'PEN' y NO se migra aquí; la config económica global se aborda aparte.
-- La conversión con tipo de cambio para P&L multi-moneda también queda fuera.
--
-- Append-only e idempotente.
-- ============================================================================
begin;

-- 1) Defaults sensatos (org estándar = MXN, igual que tenants.moneda).
alter table campanas               alter column moneda set default 'MXN';
alter table facturas               alter column moneda set default 'MXN';
alter table contratos_arrendamiento alter column moneda set default 'MXN';

-- 2) Backfill idempotente + conteo. Solo campanas y facturas heredan la moneda
--    del tenant (el contrato la elige el usuario y puede ser legítimamente otra).
do $$
declare n_camp int; n_fac int;
begin
  update campanas c
     set moneda = t.moneda
    from tenants t
   where t.id = c.tenant_id
     and c.moneda is distinct from t.moneda;
  get diagnostics n_camp = row_count;

  update facturas f
     set moneda = t.moneda
    from tenants t
   where t.id = f.tenant_id
     and f.moneda is distinct from t.moneda;
  get diagnostics n_fac = row_count;

  raise notice 'A-3 backfill: campanas corregidas=%, facturas corregidas=%', n_camp, n_fac;
end $$;

commit;
