-- ============================================================================
-- A-3: alinear la moneda de campañas y facturas a la del tenant.
--
-- El INSERT de factura fijaba el literal 'PEN' (soles) y las campañas caían al
-- default 'PEN' del esquema, aunque la organización opera en su propia moneda
-- (tenants.moneda, p. ej. MXN). Esto hacía que toda factura saliera denominada
-- en soles y que el P&L sumara importes de distintas divisas. A partir de ahora
-- cada campaña hereda la moneda del tenant y la factura toma la de su campaña.
--
-- Este backfill corrige las filas existentes que quedaron en la moneda incorrecta.
-- NO se tocan los contratos de arrendamiento: su moneda se captura explícitamente
-- (el alta permite elegirla), así que podría ser legítimamente distinta.
--
-- Aditivo / idempotente.
-- ============================================================================
begin;

update campanas c
   set moneda = t.moneda
  from tenants t
 where t.id = c.tenant_id
   and c.moneda is distinct from t.moneda;

update facturas f
   set moneda = t.moneda
  from tenants t
 where t.id = f.tenant_id
   and f.moneda is distinct from t.moneda;

commit;
