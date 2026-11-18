import type { Idioma } from '@/lib/i18n/idiomas'
import { numeroEnIdioma } from '@/lib/i18n/formato-idioma'
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

// Ola 0 del italiano (2026-11-03): `idioma` opcional, con 'es' por omision.
// `es-MX` y `en-US` escriben las cifras igual, asi que los llamadores de hoy
// —que no lo pasan— pintan lo mismo; el italiano lo pasa y sale «1.160».
export function formatNumero(n: number | null | undefined, decimales = 0, idioma: Idioma = 'es'): string {
  if (n == null || !Number.isFinite(n)) return SIN_DATO
  return numeroEnIdioma(n, idioma, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}
