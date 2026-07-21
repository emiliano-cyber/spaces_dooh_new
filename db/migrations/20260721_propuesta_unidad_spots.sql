-- ============================================================================
-- Propuestas/campañas por tiempo: unidad de contratación + spots/frecuencia.
--
-- Hasta ahora un ítem de propuesta guardaba solo (sitio, fechas, precio manual).
-- Ahora se captura CÓMO se contrata en el tiempo:
--   · unidad          → mensual | catorcenal | semanal | diaria | spot | hora
--   · cantidad        → nº de periodos de esa unidad en el rango (o manual para
--                       spot/hora); el precio = tarifa_unitaria × cantidad
--   · tarifa_unitaria → snapshot de la tarifa por unidad usada (de sitio_modalidades)
--   · spots_por_dia   → programación: cuántas veces al día se muestra el spot
--
-- Los mismos campos viajan a `reservas` al generar la campaña, para que la
-- campaña conserve la contratación por tiempo y la programación.
--
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS). No cambia datos existentes:
-- los ítems viejos quedan con unidad='mensual', cantidad=1 (equivalente a hoy).
-- ============================================================================
begin;

alter table propuesta_items
  add column if not exists unidad          text          not null default 'mensual',
  add column if not exists cantidad        numeric(14,2) not null default 1,
  add column if not exists tarifa_unitaria numeric(14,2) not null default 0,
  add column if not exists spots_por_dia   integer;

alter table reservas
  add column if not exists unidad          text          not null default 'mensual',
  add column if not exists cantidad        numeric(14,2) not null default 1,
  add column if not exists tarifa_unitaria numeric(14,2) not null default 0,
  add column if not exists spots_por_dia   integer;

-- Backfill suave: para los ítems ya existentes, la tarifa unitaria = su precio
-- (cantidad quedó en 1), así que precio = tarifa_unitaria × 1 sigue cuadrando.
update propuesta_items set tarifa_unitaria = precio
  where tarifa_unitaria = 0 and precio > 0;
update reservas set tarifa_unitaria = precio
  where tarifa_unitaria = 0 and precio > 0;

commit;

-- Verificación
select 'propuesta_items' as tabla,
       count(*) filter (where unidad is not null) as con_unidad,
       count(*) as total
  from propuesta_items
union all
select 'reservas', count(*) filter (where unidad is not null), count(*) from reservas;
