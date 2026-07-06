-- ============================================================================
--  Recordatorios automáticos de cobranza (aditivo, no destructivo)
-- ----------------------------------------------------------------------------
--  Una cobranza por vencer / vencida sin liquidar genera recordatorios
--  proactivos (notificación in-app). `recordatorio_en` = último recordatorio
--  enviado; sirve de cadencia (no re-notificar dentro de la ventana) e
--  idempotencia del barrido. `recordatorios_enviados` = cuántos van.
-- ============================================================================

alter table public.cobranzas
  add column if not exists recordatorio_en       timestamptz,
  add column if not exists recordatorios_enviados integer not null default 0;
