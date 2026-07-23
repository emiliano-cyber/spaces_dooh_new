-- ============================================================================
-- Fase 1 · Integración Arrendadores ↔ Operaciones — PAUSA LEGAL del inventario.
--
-- Permite pausar una pantalla por una situación legal (con motivo), lo que la
-- saca de la disponibilidad comercial (se pone estatus_comercial='BLOQUEADO',
-- igual que una incidencia), pero de forma distinguible y reversible. Al
-- reanudar, se libera. La pausa es un overlay: no pierde el motivo ni depende de
-- crear una incidencia de "daño".
--
-- Aditiva e idempotente.
-- ============================================================================
begin;

alter table sitios
  add column if not exists pausa_legal        boolean not null default false,
  add column if not exists motivo_pausa_legal text,
  add column if not exists pausa_legal_en      timestamptz;

commit;
