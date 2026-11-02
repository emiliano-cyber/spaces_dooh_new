import type { Idioma } from './idiomas'
import type { Moneda } from './dinero'

// ============================================================================
//  lib/i18n/simbolo-en-pantalla.ts — ¿ALGUN IMPORTE DE ESTA PANTALLA SE PUEDE
//  LEER COMO LA OTRA MONEDA? (decision del dueno del 2026-11-02)
// ----------------------------------------------------------------------------
//  Lo usan las pruebas de pantallas (`pantallas-*.test.ts`), no la app. Mira
//  el HTML ya rendido, que es lo unico que ve el lector, y no el codigo: un
//  `formatMonto(n)` sin idioma en una pantalla inglesa de una instancia MXN
//  escribe «$ 1,000.00», que un lector anglosajon lee como dolares. Ningun
//  error lo delata; solo mirar lo pintado.
//
//  La tabla es la de `dinero.ts`: el `$` a secas es la moneda LOCAL del
//  lector.
//
//                  espanol     ingles
//      MXN         $           MX$
//      USD         US$         $
//
//  Se cuenta como importe todo simbolo seguido de una cifra (con o sin
//  espacio): «$ 1,000.00», «MX$1,000», «(US$ 5.00)», «$ 4.9M».
// ============================================================================

const ESPERADO: Record<Idioma, Record<Moneda, '$' | 'MX$' | 'US$'>> = {
  es: { MXN: '$', USD: 'US$' },
  en: { MXN: 'MX$', USD: '$' },
}

// Un prefijo de letras pegado al `$` (MX, US, o cualquier otro) y una cifra
// detras. `\s` cubre el espacio duro que algun componente pone.
const IMPORTE = /([A-Za-z]{0,3})\$(?=\s*\d)/g

export interface LecturaDinero {
  /** Cuantos importes se encontraron. Una pantalla sin dinero da 0. */
  importes: number
  /** Los que llevan otro simbolo que el de la tabla, con su contexto. */
  ajenos: string[]
}

/** Lee el dinero de un HTML ya rendido y dice cuales importes no llevan el simbolo de la tabla. */
export function leerDinero(html: string, idioma: Idioma, moneda: Moneda): LecturaDinero {
  const esperado = ESPERADO[idioma][moneda]
  const ajenos: string[] = []
  let importes = 0
  for (const m of html.matchAll(IMPORTE)) {
    importes++
    const simbolo = `${m[1]}$`
    if (simbolo !== esperado) {
      const i = m.index ?? 0
      ajenos.push(`«${simbolo}» en …${html.slice(Math.max(0, i - 30), i + 20).replace(/\s+/g, ' ')}…`)
    }
  }
  return { importes, ajenos }
}
