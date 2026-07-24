-- ============================================================================
-- Contrato de la campaña (opcional) para el expediente de facturación.
--
-- El candado de facturación ya se apoya en los datos fiscales del cliente
-- (clientes.rfc/razon_social/uso_cfdi, que generarFactura valida y copia a la
-- factura). Faltaba un lugar para el CONTRATO firmado del cliente, si se sube.
-- Se guarda como URL/base64 igual que la OC (oc_url) y el reporte.
--
-- Aditiva e idempotente. No cambia datos existentes.
-- ============================================================================
begin;

alter table campanas
  add column if not exists contrato_url text;

commit;
