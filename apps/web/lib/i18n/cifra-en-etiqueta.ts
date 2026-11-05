import type { Idioma } from './idiomas'
import { numeroEnIdioma } from './formato-idioma'

// ============================================================================
//  lib/i18n/cifra-en-etiqueta.ts — UNA CIFRA SUELTA DENTRO DE UNA ETIQUETA.
// ----------------------------------------------------------------------------
//  Lote L2 del italiano (2026-11-03). Las etiquetas de Propuestas llevan cifras
//  con decimales que se escribian con `toFixed` o con `String(n)`: el divisor
//  («× 0.85»), el descuento comercial («5.00%»), el de volumen («2.5%»). En
//  espanol y en ingles eso ya es su formato; en italiano sale con PUNTO, y la
//  guardia del espejo (`guardias-italiano.ts`) lo marca: «0.85» en una pantalla
//  italiana se lee como «ochenta y cinco centesimas» solo por casualidad.
//
//  En `es` y `en` devuelve EXACTAMENTE la expresion de antes, por construccion
//  —no por medicion—: la regla del italiano es que esos dos idiomas no cambien
//  ni un byte. Cualquier otro idioma pasa por la tabla de `formato-idioma.ts`.
// ============================================================================

/**
 * `decimales` fijo → `n.toFixed(decimales)` en es/en; sin el → `String(n)`.
 * Fuera de es/en, el mismo numero con el formato del idioma.
 */
export function cifraEnEtiqueta(n: number, idioma: Idioma, decimales?: number): string {
  if (idioma === 'es' || idioma === 'en') return decimales == null ? String(n) : n.toFixed(decimales)
  return numeroEnIdioma(
    n,
    idioma,
    decimales == null
      ? { maximumFractionDigits: 20 }
      : { minimumFractionDigits: decimales, maximumFractionDigits: decimales },
  )
}
