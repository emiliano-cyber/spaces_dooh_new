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
//
//  ─── EL PORTUGUES (pt-BR) ──────────────────────────────────────────────────
//
//  Decision del dueno del 2026-11-05: Brasil (`pt-BR`), y el peso como en
//  italiano, «MX$ 1.160,00» (no se anade el real). Se reusa la posicion
//  `delante-con-espacio`: `Intl` en pt-BR ya pone «MX$ 1.160,00», pero con un
//  espacio U+00A0 que ningun otro idioma de la app escribe. PROPUESTA de la ola
//  0, decidida el 05/11 (D4 de `vault/03-Frontend/portugues-olas.md`): fecha
//  «1 de dez. de 2026» (la corta de pt-BR), cifras «1.160,5», porcentaje
//  «55,0%», trimestre «T1 2026». El dolar, «US$ 1.160,00» (P1, 05/11). Y la
//  captura de cifras A LA BRASILENA, «1.500,50» (P2, decision del dueno del
//  05/11, tarea roja `feat/portugues-cifras`): `separadorDecimal`, abajo.
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
  /** La letra del trimestre en las etiquetas de periodo: «T1 2026» (es), «Q1 2026» (en). */
  letraTrimestre: string
  /**
   * El signo DECIMAL de lo que se TECLEA en un campo de cifra
   * (`lib/captura-cifra.ts`); el de millar es el otro. Espanol e ingles: punto
   * decimal y coma de millar («212,500.50»), la regla de siempre. Italiano:
   * coma decimal y punto de millar («212.500,50»), decision del dueno del
   * 2026-11-04 (P-L2-1). Portugues: lo mismo que el italiano, decision del
   * dueno del 2026-11-05 (P2).
   */
  separadorDecimal: '.' | ','
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
    letraTrimestre: 'T',
    separadorDecimal: '.',
  },
  en: {
    locale: 'en-US',
    agruparSiempre: false,
    fechaPorOmision: { year: 'numeric', month: 'short', day: '2-digit' },
    simbolo: { MXN: 'MX$', USD: '$' },
    posicionSimbolo: 'intl',
    nombreMoneda: { MXN: 'Mexican peso (MXN)', USD: 'US dollar (USD)' },
    espacioAntesDePorcentaje: false,
    letraTrimestre: 'Q',
    separadorDecimal: '.',
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
    // «T1 2026» (trimestre). PROVISIONAL: lo confirma el lote de reportes.
    letraTrimestre: 'T',
    separadorDecimal: ',',
  },
  pt: {
    locale: 'pt-BR',
    // pt-BR ya agrupa las cuatro cifras («1.160»), pero no pt-PT ni todas las
    // versiones de ICU: se fuerza, como en italiano, y no depende del motor.
    agruparSiempre: true,
    // «1 de dez. de 2026». PROPUESTA (D4), sin decidir.
    fechaPorOmision: { year: 'numeric', month: 'short', day: 'numeric' },
    // MXN: decision del dueno (05/11). USD: PROVISIONAL, pendiente del dueno.
    simbolo: { MXN: 'MX$', USD: 'US$' },
    posicionSimbolo: 'delante-con-espacio',
    nombreMoneda: { MXN: 'Peso mexicano (MXN)', USD: 'Dólar americano (USD)' },
    espacioAntesDePorcentaje: false,
    // «T1 2026» (trimestre). PROVISIONAL: lo confirma el lote de reportes.
    letraTrimestre: 'T',
    // A LA BRASILENA: punto de millar y coma decimal, «1.500,50» (P2, decision
    // del dueno del 05/11). Hasta ese dia, a la mexicana. Es el MISMO sistema
    // que el italiano y el portugues lo hereda entero (`lib/captura-cifra.ts`):
    // lo que se acepta, se rechaza, se pinta y se manda; solo cambia el idioma
    // del motivo. Sus avisos (`compartidos.cifra.*` y los demas «no se
    // entiende») estan escritos en portugues, no caen al espanol.
    separadorDecimal: ',',
  },
}

/** El locale de `Intl` de un idioma: «es-MX», «en-US», «it-IT», «pt-BR». */
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
