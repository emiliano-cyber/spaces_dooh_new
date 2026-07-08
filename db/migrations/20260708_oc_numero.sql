-- ============================================================================
--  S1-4: número de OC del cliente en el registro de ODC (aditivo)
-- ----------------------------------------------------------------------------
--  El registro de OC ahora captura el número de OC del cliente (además del
--  folio interno ODC-, el monto, la fecha y el documento). Así "OC recibida"
--  del pipeline se enciende solo con un registro real, no con un toggle.
-- ============================================================================

alter table public.ordenes_compra
  add column if not exists numero_oc text;
