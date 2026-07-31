-- ============================================================================
-- Periodicidad de renta DIARIA — valor de enum.
-- Ver docs/adr/0004-periodicidad-de-renta-y-recordatorios-de-pago.md
--
-- Va SOLA en su propia migración a propósito: PostgreSQL no permite USAR un
-- valor de enum recién agregado dentro de la misma transacción que lo agrega.
-- Cualquier migración posterior que quiera escribir 'DIARIA' debe correr
-- después de que este commit haya terminado.
--
-- `before 'SEMANAL'` fija el orden del enum de mayor a menor frecuencia. No es
-- cosmético: `order by periodicidad` en reportes y el `enumsortorder` de la
-- verificación de abajo quedan en orden natural (diaria → anual) en vez de
-- dejar DIARIA al final, después de ANUAL.
--
-- Equivalente mensual: DIARIA ×30 (mes comercial de 30 días, el mismo supuesto
-- que ya usa SEMANAL ×30/7). La tabla canónica vive en
-- apps/web/lib/renta-periodicidad.ts.
-- Aditivo e idempotente.
-- ============================================================================
begin;

alter type periodicidad_pago add value if not exists 'DIARIA' before 'SEMANAL';

comment on type periodicidad_pago is
  'Periodicidad de pago de renta. Equiv. mensual: DIARIA x30, SEMANAL x30/7, CATORCENAL x30/14, QUINCENAL x2, MENSUAL x1, BIMESTRAL /2, TRIMESTRAL /3, SEMESTRAL /6, ANUAL /12.';

commit;

-- Verificación
select 'valores_enum' k, string_agg(e.enumlabel, ', ' order by e.enumsortorder) v
  from pg_type t join pg_enum e on e.enumtypid = t.oid
 where t.typname = 'periodicidad_pago'
union all
select 'valores_en_uso', string_agg(distinct periodicidad::text, ', ')
  from contratos_arrendamiento;
