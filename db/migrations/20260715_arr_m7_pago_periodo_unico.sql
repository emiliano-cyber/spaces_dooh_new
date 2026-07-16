-- ============================================================================
-- Arrendadores Fase 1 · M7 — Idempotencia del calendario de pagos.
-- Índice único (contrato_id, periodo) para que la generación del calendario sea
-- idempotente (INSERT ... ON CONFLICT DO NOTHING). `periodo` guarda la fecha de
-- vencimiento del periodo en formato YYYY-MM-DD (única por contrato).
-- Aditivo e idempotente.
-- ============================================================================
begin;

create unique index if not exists pagos_renta_contrato_periodo_uq
  on pagos_renta (contrato_id, periodo);

commit;

-- Verificación
select indexname from pg_indexes
 where tablename='pagos_renta' and indexname='pagos_renta_contrato_periodo_uq';
