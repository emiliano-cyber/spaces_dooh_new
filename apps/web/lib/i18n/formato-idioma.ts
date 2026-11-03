import type { Idioma } from './idiomas'
import type { Moneda } from './dinero'

// ============================================================================
//  lib/i18n/formato-idioma.ts — COMO SE ESCRIBE CADA IDIOMA, EN UN SOLO SITIO.
// ----------------------------------------------------------------------------
//  Ola 0 del italiano (2026-11-03). Hasta hoy el formato se decidia con
//  bifurcaciones de dos ramas repartidas por el arbol —`idioma === 'en' ?
//  'en-US' : 'es-MX'`, `const es = idioma === 'es'`— y un tercer idioma caia
//  en la rama equivocada sin dar ningun error: el italiano habria salido con
//  fechas inglesas en una pantalla y espanolas en la de al lado.
//
//  Aqui esta TODO lo que distingue la escritura de un idioma de la de otro. Si
//  el dueno cambia como se escribe el italiano, se cambia esta tabla y nada
//  mas. Un idioma nuevo es una fila nueva, y `tsc` senala la que falte
//  (`Record<Idioma, …>`).
//
//  Los valores de `es` y `en` son LOS DE ANTES, copiados de donde vivian
//  (`dinero.ts`, `simbolo-en-pantalla.ts`, `components/demo/reportes/tabla.ts`):
//  el espanol y el ingles tienen que salir identicos byte a byte, y lo mide el
//  volcado completo de las pruebas (`lib/test/volcado-html.ts`).
//
//  ─── EL ITALIANO ───────────────────────────────────────────────────────────
//
//  Decision del dueno del 2026-11-03: el peso se escribe «MX$ 1.160,00» —el
//  simbolo delante, como en ingles, con espacio, y los separadores italianos
//  (punto de millar, coma decimal)—. Fechas «1 dic 2026». Ver
//  `vault/03-Frontend/italiano-olas.md` §3.
//
//  Lo que NO decidio el dueno y queda marcado como pendiente (§3 del tablero):
//  el dolar de una instancia USD en italiano. Provisional «US$ 1.160,00»: para
//  un lector italiano ni el peso ni el dolar son su moneda local, asi que los
//  dos llevan prefijo y ninguno es un `$` a secas que se pueda leer como el
//  otro.
// ============================================================================

export interface FormatoIdioma {
  /** El locale de `Intl` para numeros y fechas. */
  locale: string
  /**
   * `it-IT` no agrupa los numeros de cuatro cifras (`1160`, no `1.160`): es la
   * regla de CLDR para el italiano. El dueno pidio «1.160,00», asi que se
   * fuerza la agrupacion. En `es-MX` y `en-US` ya agrupan siempre.
   */
  agruparSiempre: boolean
  /** Las opciones de `formatearFecha` cuando quien llama no pasa ninguna. */
  fechaPorOmision: Intl.DateTimeFormatOptions
  /** El simbolo de cada moneda para un lector de este idioma (`dinero.ts`). */
  simbolo: Record<Moneda, '$' | 'MX$' | 'US$'>
  /**
   * Donde va el simbolo. `intl`: donde lo pone `Intl` en ese locale, sin
   * espacio (es y en: «$1,234.50»). `delante-con-espacio`: delante y separado
   * («MX$ 1.160,00»), porque `it-IT` lo pondria DETRAS («1.160,00 MXN»).
   */
  posicionSimbolo: 'intl' | 'delante-con-espacio'
  /** El nombre de cada moneda, para la ficha de Administracion. */
  nombreMoneda: Record<Moneda, string>
  /** «12.5 %» (es) o «12.5%» (en, it). */
  espacioAntesDePorcentaje: boolean
}

export const FORMATO_IDIOMA: Record<Idioma, FormatoIdioma> = {
  es: {
    locale: 'es-MX',
    agruparSiempre: false,
    fechaPorOmision: { year: 'numeric', month: 'short', day: '2-digit' },
    simbolo: { MXN: '$', USD: 'US$' },
    posicionSimbolo: 'intl',
    nombreMoneda: { MXN: 'Peso mexicano (MXN)', USD: 'Dólar estadounidense (USD)' },
    espacioAntesDePorcentaje: true,
  },
  en: {
    locale: 'en-US',
    agruparSiempre: false,
    fechaPorOmision: { year: 'numeric', month: 'short', day: '2-digit' },
    simbolo: { MXN: 'MX$', USD: '$' },
    posicionSimbolo: 'intl',
    nombreMoneda: { MXN: 'Mexican peso (MXN)', USD: 'US dollar (USD)' },
    espacioAntesDePorcentaje: false,
  },
  it: {
    locale: 'it-IT',
    agruparSiempre: true,
    fechaPorOmision: { year: 'numeric', month: 'short', day: 'numeric' },
    // MXN: decision del dueno (03/11). USD: PROVISIONAL, pendiente del dueno.
    simbolo: { MXN: 'MX$', USD: 'US$' },
    posicionSimbolo: 'delante-con-espacio',
    nombreMoneda: { MXN: 'Peso messicano (MXN)', USD: 'Dollaro statunitense (USD)' },
    espacioAntesDePorcentaje: false,
  },
}

/** El locale de `Intl` de un idioma: «es-MX», «en-US», «it-IT». */
export function localeDe(idioma: Idioma): string {
  return FORMATO_IDIOMA[idioma].locale
}

/**
 * Las opciones de un `Intl.NumberFormat` / `toLocaleString` con lo que el
 * idioma impone. Hoy, solo la agrupacion del italiano; en `es` y `en` devuelve
 * el MISMO objeto que entra, para que nada cambie.
 */
export function opcionesNumero(
  idioma: Idioma,
  opciones: Intl.NumberFormatOptions = {},
): Intl.NumberFormatOptions {
  if (!FORMATO_IDIOMA[idioma].agruparSiempre || opciones.useGrouping !== undefined) return opciones
  return { ...opciones, useGrouping: 'always' }
}

/**
 * Un numero SIN moneda en el idioma de quien lee. Es el sustituto de
 * `n.toLocaleString(idioma === 'es' ? 'es-MX' : 'en-US', …)`: misma salida en
 * es y en, y la agrupacion correcta en italiano.
 */
export function numeroEnIdioma(n: number, idioma: Idioma, opciones: Intl.NumberFormatOptions = {}): string {
  return n.toLocaleString(localeDe(idioma), opcionesNumero(idioma, opciones))
}

/** Un porcentaje ya redondeado: «12.5 %» en espanol, «12.5%» en ingles, «12,5%» en italiano. */
export function porcentajeEnIdioma(cifra: string, idioma: Idioma): string {
  return FORMATO_IDIOMA[idioma].espacioAntesDePorcentaje ? `${cifra} %` : `${cifra}%`
}
