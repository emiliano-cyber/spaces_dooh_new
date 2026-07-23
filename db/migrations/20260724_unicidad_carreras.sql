-- ============================================================================
-- Cierre de condiciones de carrera de dinero (hallazgo A-1 de la auditoría).
--
-- Los checks "¿ya existe?" corrían ANTES de la transacción y sin unicidad, así
-- que dos peticiones concurrentes (doble clic / dos pestañas) podían crear dos
-- facturas de la misma campaña o dos campañas de la misma propuesta. Estos
-- índices únicos lo cierran a nivel de BD: la segunda inserción falla con
-- unique_violation (23505), que la app ya mapea a un 409 "El registro ya existe".
--
-- Nota: campanas.propuesta_id es nullable (campañas no nacidas de propuesta) y
-- Postgres trata los NULL como distintos, así que el índice no las estorba.
-- facturas.campana_id es NOT NULL → una factura por campaña.
--
-- Idempotente. Si hubiera duplicados previos, la creación fallaría: deduplicar
-- antes (no debería haber en un uso normal).
-- ============================================================================
begin;

create unique index if not exists facturas_campana_uq on facturas (campana_id);
create unique index if not exists campanas_propuesta_uq on campanas (propuesta_id);

commit;
