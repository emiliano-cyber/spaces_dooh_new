-- @tipo: esquema
-- ============================================================================
--  COB-COMP · EL COMPROBANTE DE CADA PAGO DE UN CLIENTE.
-- ----------------------------------------------------------------------------
--  Pedido del dueno el 19/10: al registrar un pago en Cobranza no habia donde
--  subir el recibo o la transferencia del cliente. En los pagos de RENTA si lo
--  hay desde hace meses (`pagos_renta.comprobante_url`), y este es su espejo.
--
--  Va en `cobranza_abonos` y no en `cobranzas` porque una cobranza se paga en
--  varios abonos, cada uno con su dinero y su dia (ADR 0046): un solo campo
--  en la cobranza haria que el segundo comprobante pisara al primero.
--
--  Mismo formato que en renta: un data URL (PDF o imagen, 5 MB maximo, lo
--  valida `LIMITES.adjuntoPago` en `lib/server/uploads.ts`). NULL = sin
--  comprobante, que es lo que tienen TODOS los abonos de antes de hoy.
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--
--  · No cambia ninguna fila: solo agrega una columna que nace vacia.
--  · No toca la RLS ni los permisos: la tabla ya tiene `tenant_isolation`
--    forzada y el rol de la aplicacion ya tiene `update` sobre ella
--    (`20261008_cobranza_abonos.sql`), que es lo que necesita adjuntarlo
--    despues.
--  · No edita ninguna migracion anterior ni `db/schema.sql`.
--
--  Nada posterior a PostgreSQL 14. Transaccional e idempotente.
-- ============================================================================

begin;

alter table cobranza_abonos add column if not exists comprobante_url text;

comment on column cobranza_abonos.comprobante_url is
  'COB-COMP. Comprobante del pago (recibo, transferencia) como data URL: PDF, JPG, PNG o WEBP, 5 MB maximo. NULL = sin comprobante. No viaja en los listados: se sirve por GET /api/cobranzas/[id]/abonos/[abonoId]/comprobante.';

commit;
