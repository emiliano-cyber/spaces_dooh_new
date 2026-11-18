import { textoLegible } from './guardias-ingles'
import { FORMATO_IDIOMA } from './formato-idioma'

// ============================================================================
//  lib/i18n/guardias-italiano.ts — LOS FORMATOS AJENOS EN EL HTML ITALIANO.
// ----------------------------------------------------------------------------
//  Ola 0 del italiano (2026-11-03). La hermana de `guardias-ingles.ts`, con una
//  diferencia de fondo: el HTML ingles solo podia contaminarse de ESPANOL; el
//  italiano se puede contaminar de LOS DOS. Una fecha que se quedo en la rama
//  espanola de un `idioma === 'en' ? … : …` sale «01/12/2026»; una que se
//  quedo en la inglesa, «Dec 1, 2026». Ninguna da error: solo mirar lo pintado.
//
//  Lo que el italiano de la app escribe, y por tanto NO es huella (tabla de
//  `formato-idioma.ts`, decision del dueno del 03/11):
//
//      dinero   MX$ 1.160,00   (US$ en una instancia USD, provisional)
//      fecha    1 dic 2026     · 1 dicembre 2026 · 15:45
//      cifra    1.160 · 1.160,5 · 55,0%
//
//  Usa `textoLegible` de la guardia inglesa: los nodos de texto y los
//  atributos que se leen (title, aria-label, placeholder, alt), sin los
//  `value` de los campos.
//
//  Las huellas son de FORMATO, no de idioma: mientras los lotes no terminen,
//  el texto italiano cae al ingles (`diccionario.ts`) y eso no es una huella
//  —lo cuenta `cobertura-italiano.ts`—. Una huella aqui es siempre un sitio
//  del codigo que escribe un formato sin mirar el idioma.
// ============================================================================

export interface OpcionesGuardiaItaliano {
  /** Moneda de la instancia en la que se rindio el HTML. Por omision, MXN. */
  moneda?: 'MXN' | 'USD'
  /** Trozos que el lote declara como dato y no como formato (se prueban contra el trozo). */
  permitidos?: RegExp[]
}

const MESES_CORTOS_IT = '(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)'
// Solo las abreviaturas que el italiano NO usa: «feb», «mar», «ago», «nov» y
// «dic» son de los dos idiomas.
const MESES_CORTOS_SOLO_ES = '(?:ene|abr|may|jun|jul|sep|sept|oct)'
const MESES_LARGOS_ES =
  '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)'
const MESES_EN_CORTOS = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)'
const MESES_EN_LARGOS =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December)'

/** Cada huella con su nombre. Exportada para que la prueba la recorra. */
export const HUELLAS_ITALIANO: readonly [string, RegExp][] = [
  // ── Espanol ──
  ['fecha dd/mm/aaaa', /\b\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})\b/g],
  ['fecha larga en español', new RegExp(`\\b\\d{1,2} de ${MESES_LARGOS_ES}\\b(?: de \\d{4})?`, 'gi')],
  ['mes corto en español', new RegExp(`\\b\\d{1,2} ${MESES_CORTOS_SOLO_ES}\\b\\.?`, 'g')],
  // `es-MX` rellena el dia («01 dic 2026»); el italiano no («1 dic 2026»).
  ['dia con cero delante', new RegExp(`\\b0\\d (?:${MESES_CORTOS_IT.slice(3, -1)}|${MESES_CORTOS_SOLO_ES.slice(3, -1)})\\b`, 'g')],
  ['a. m. / p. m.', /\b[ap]\.\s?m\./g],
  // ── Ingles ──
  ['fecha en ingles', new RegExp(`\\b${MESES_EN_CORTOS}\\.? \\d{1,2}\\b(?:, \\d{4})?`, 'g')],
  ['mes largo en ingles', new RegExp(`\\b${MESES_EN_LARGOS} \\d{4}\\b`, 'g')],
  ['AM / PM', /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/g],
  // ── Cifras: el ingles y el espanol de Mexico escriben igual (1,160.50) ──
  ['cifra con coma de millar', /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g],
  // Uno o dos decimales detras de un punto: «55.0», «1,160.50». No caza el
  // millar italiano («1.160», tres cifras) ni unas coordenadas (cinco), ni
  // la cola de una cifra ya cazada por la coma de millar, ni el trozo de en
  // medio de una version («0.12.5»).
  ['cifra con punto decimal', /(?<![\d.,])\d+\.\d{1,2}\b(?!\.\d)/g],
  // ── Dinero ──
  // En italiano NINGUNA moneda va con `$` a secas: ni el peso ni el dolar son
  // la moneda local del lector.
  ['dinero sin prefijo', /(?<![A-Z]{2})\$\s*\d[\d.,]*/g],
  // «MX$1.160,00»: el italiano lleva espacio entre simbolo y cifra.
  ['simbolo pegado a la cifra', /[A-Z]{2}\$\d/g],
]

/**
 * Las huellas de formato espanol o ingles que quedan en un HTML italiano.
 * Devuelve cada una con su contexto; vacio = limpio.
 */
export function huellasEnItaliano(html: string, opciones: OpcionesGuardiaItaliano = {}): string[] {
  const moneda = opciones.moneda ?? 'MXN'
  const permitidos = opciones.permitidos ?? []
  const texto = textoLegible(html)
  const huellas: string[] = []
  const anotar = (tipo: string, trozo: string, i: number) => {
    if (permitidos.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(trozo))) return
    const contexto = texto.slice(Math.max(0, i - 30), i + trozo.length + 30).replace(/\s+/g, ' ')
    huellas.push(`${tipo} «${trozo}» en «${contexto.trim()}»`)
  }
  for (const [tipo, re] of HUELLAS_ITALIANO) {
    for (const m of texto.matchAll(re)) anotar(tipo, m[0], m.index ?? 0)
  }
  // El simbolo de la OTRA moneda: MX$ en una instancia USD, US$ en una MXN.
  const esperado = FORMATO_IDIOMA.it.simbolo[moneda]
  for (const m of texto.matchAll(/\b(MX|US)\$/g)) {
    if (m[0] !== esperado) anotar('moneda equivocada', m[0], m.index ?? 0)
  }
  return huellas
}
