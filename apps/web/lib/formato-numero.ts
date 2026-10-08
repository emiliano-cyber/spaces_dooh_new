// ============================================================================
//  lib/formato-numero.ts — Las CANTIDADES que se muestran (spots, pases,
//  registros, kWh, impactos…), con coma cada tres dígitos.
//
//  Estándar del dueño (08/10): toda cifra que se vea lleva su coma de miles, al
//  estilo es-MX: 2,500 y 1,234,567.50. Los IMPORTES van por `formatMonto`
//  (`lib/data/derive.ts`), que además pone el $ y los dos decimales; esto es
//  para lo que no es dinero. Las exportaciones a CSV/Excel NO pasan por aquí:
//  con coma, Excel leería texto y no podría sumar.
//
//  'es-MX' fijo y no `toLocaleString()` a secas: sin locale manda el del
//  navegador, y en 'es'/'es-ES' un número de cuatro cifras sale SIN separador
//  (2500) y uno mayor con PUNTO (12.500), que en México se lee como decimal.
// ============================================================================

const SIN_DATO = '—'

export function formatNumero(n: number | null | undefined, decimales = 0): string {
  if (n == null || !Number.isFinite(n)) return SIN_DATO
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}
