-- ============================================================================
--  S0-1: snapshot económico inmutable de la propuesta
-- ----------------------------------------------------------------------------
--  Al aceptar/aprobar una propuesta se congela un snapshot con la economía
--  exacta (bruto, descuento, base, comisión, neto, IVA, total, precio por sitio
--  y versión). Campaña, factura, rentabilidad y comisiones leen de este snapshot
--  — ningún módulo recalcula desde tarifas de lista. Renegociar después exige
--  nueva aceptación, que genera un nuevo snapshot (versionado). Aditivo.
-- ============================================================================

alter table public.propuestas
  add column if not exists snapshot_economico jsonb,
  add column if not exists snapshot_en        timestamptz;
