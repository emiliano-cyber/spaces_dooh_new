-- ============================================================================
-- Contrato incompleto · paso 1 de 2 — valor de enum.
-- Ver docs/adr/0001-contrato-incompleto-al-generar-campana.md
--
-- Va SOLO en su propia migración a propósito: PostgreSQL no permite USAR un
-- valor de enum recién agregado dentro de la misma transacción que lo agrega.
-- El paso 2 (relajar NOT NULL, CHECK y carga inicial) sí lo usa, así que debe
-- correr después de que este commit haya terminado.
--
-- INCOMPLETO = el contrato existe como pendiente visible en Arrendadores, pero
-- todavía no tiene arrendador, importe, periodicidad ni fecha de fin. NO cuenta
-- como costo en el P&L ni dispara alertas de vencimiento (ver derive.ts,
-- `contratoActivo`, que solo considera VIGENTE/POR_VENCER/RENOVADO).
-- Aditivo e idempotente.
-- ============================================================================
begin;

alter type est_contrato add value if not exists 'INCOMPLETO';

commit;

-- Verificación
select 'valores_enum' k, string_agg(e.enumlabel, ', ' order by e.enumsortorder) v
  from pg_type t join pg_enum e on e.enumtypid = t.oid
 where t.typname = 'est_contrato';
