-- ============================================================================
-- N-6 (cierre): config_negocio.moneda estaba en el literal 'PEN' (soles), igual
-- que el bug de A-3 en campanas/facturas. `config_negocio` es una config GLOBAL
-- (una sola fila, sin tenant_id), así que la moneda estándar de la organización
-- es MXN (igual que tenants.moneda default). Este cierre:
--   1) Cambia el DEFAULT de config_negocio.moneda de 'PEN' a 'MXN'.
--   2) Corrige la fila existente 'PEN' → 'MXN'.
--
-- ALCANCE: SOLO el campo `moneda`. La config económica global por-tenant (que
-- config_negocio NO modela: no tiene tenant_id) sigue siendo el hallazgo M-8,
-- que NO se resuelve aquí.
--
-- Append-only e idempotente.
-- ============================================================================
begin;

alter table config_negocio alter column moneda set default 'MXN';

do $$
declare n int;
begin
  update config_negocio set moneda = 'MXN' where moneda is distinct from 'MXN';
  get diagnostics n = row_count;
  raise notice 'N-6 config_negocio.moneda corregidas=%', n;
end $$;

commit;
