-- @tipo: esquema
-- ============================================================================
--  FLUJO-CREA · LA «FECHA ESPECIAL» (FECHA REQUERIDA) DE UNA ORDEN DE IMPRESIÓN.
--  Aprobada por el dueño el 2026-11-20 (zona ROJA R3), para ensayo local.
-- ----------------------------------------------------------------------------
--  Pedido del dueño (20/11): la cola de Imprenta sigue ordenada por la fecha de
--  inicio de la campaña (`lib/prioridad-imprenta.ts`, IMP-PRIO del 17/11), pero
--  cada orden puede llevar una FECHA ESPECIAL que, si está puesta, MANDA sobre
--  la de inicio para calcular su grupo de urgencia y su lugar en la cola. Sirve
--  para la lona que el cliente pide antes del arranque, o la que puede esperar,
--  sin tocar las fechas de la campaña (que mueven dinero y disponibilidad).
--
--  SOLO AGREGA una columna que admite null: null = manda el inicio de la
--  campaña, que es exactamente el comportamiento de hoy. Las filas existentes
--  quedan en null y la cola no cambia al aplicar esto. Sin default, sin
--  backfill, sin tocar RLS (la columna hereda la de la tabla).
--
--  Se fija desde `PATCH /api/impresion/[id]/fecha-especial` (permiso
--  `imprenta.crear`) y al confirmar «Mandar a impresión».
--
--  Vuelta atrás: `alter table ordenes_impresion drop column if exists
--  fecha_especial;` — la versión anterior de la app no la lee.
--
--  PostgreSQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

alter table ordenes_impresion add column if not exists fecha_especial date;

comment on column ordenes_impresion.fecha_especial is
  'Fecha requerida de la orden. Si no es null, manda sobre campanas.fecha_inicio para la prioridad de la cola de Imprenta (FLUJO-CREA, 20/11).';

commit;

select 'ordenes_impresion.fecha_especial (1)' k, count(*)::text v from information_schema.columns
 where table_name = 'ordenes_impresion' and column_name = 'fecha_especial' and data_type = 'date';
