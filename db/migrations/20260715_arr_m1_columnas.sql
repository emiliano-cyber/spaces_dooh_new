-- ============================================================================
-- Arrendadores Fase 1 · M1 — Extensiones de columnas (ADITIVO, sin FK todavía).
-- Idempotente. Las FKs de predio_id / razon_social_id se agregan en M2 (cuando
-- existan las tablas predios y arrendador_razon_social).
-- ============================================================================
begin;

-- Arrendador: datos fiscales/pago + soft-delete.
alter table arrendadores add column if not exists curp             text;
alter table arrendadores add column if not exists direccion        text;
alter table arrendadores add column if not exists cuenta_bancaria  text;
alter table arrendadores add column if not exists forma_pago       text;
alter table arrendadores add column if not exists observaciones    text;
alter table arrendadores add column if not exists activo           boolean not null default true;

-- Contrato: depósito, vínculo a predio y razón social, motivo de cancelación.
alter table contratos_arrendamiento add column if not exists deposito           numeric(14,2);
alter table contratos_arrendamiento add column if not exists predio_id          uuid;
alter table contratos_arrendamiento add column if not exists razon_social_id    uuid;
alter table contratos_arrendamiento add column if not exists motivo_cancelacion text;

-- Pagos de renta: comprobante, método, observaciones.
alter table pagos_renta add column if not exists comprobante_url text;
alter table pagos_renta add column if not exists metodo_pago     text;
alter table pagos_renta add column if not exists observaciones   text;

-- Pantalla: vínculo a predio (N pantallas : 1 predio).
alter table sitios add column if not exists predio_id uuid;

-- Moneda por organización (deja de ser global).
alter table tenants add column if not exists moneda text not null default 'MXN';

-- Deprecación (sin DROP en esta fase): la renta directa del sitio se migra a un
-- contrato del predio y deja de ser fuente en el P&L y la UI.
comment on column sitios.renta_arrendador   is 'DEPRECADO (Fase 1): usar el contrato del predio. No leer en P&L/UI.';
comment on column sitios.periodicidad_renta is 'DEPRECADO (Fase 1): usar el contrato del predio. No leer en P&L/UI.';

commit;

-- Verificación
select 'arrendadores' t, string_agg(column_name, ',' order by column_name) cols
  from information_schema.columns where table_name='arrendadores'
   and column_name in ('curp','direccion','cuenta_bancaria','forma_pago','observaciones','activo')
union all
select 'contratos', string_agg(column_name, ',' order by column_name)
  from information_schema.columns where table_name='contratos_arrendamiento'
   and column_name in ('deposito','predio_id','razon_social_id','motivo_cancelacion')
union all
select 'pagos_renta', string_agg(column_name, ',' order by column_name)
  from information_schema.columns where table_name='pagos_renta'
   and column_name in ('comprobante_url','metodo_pago','observaciones')
union all
select 'sitios.predio_id', string_agg(column_name, ',') from information_schema.columns
  where table_name='sitios' and column_name='predio_id'
union all
select 'tenants.moneda', string_agg(column_name, ',') from information_schema.columns
  where table_name='tenants' and column_name='moneda';
