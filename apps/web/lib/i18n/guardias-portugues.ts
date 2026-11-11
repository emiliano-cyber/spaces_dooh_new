import { textoLegible } from './guardias-ingles'
import { FORMATO_IDIOMA } from './formato-idioma'

// ============================================================================
//  lib/i18n/guardias-portugues.ts — LOS FORMATOS AJENOS EN EL HTML pt-BR.
// ----------------------------------------------------------------------------
//  Ola 0 del portugues (2026-11-05). La hermana de `guardias-italiano.ts`: el
//  HTML portugues se puede contaminar de ESPANOL y de INGLES. Una fecha que se
//  quedo en la rama espanola de un `idioma === 'es' ? … : …` sale «01 dic
//  2026»; una en la inglesa, «Dec 1, 2026». Ninguna da error.
//
//  Lo que el portugues de la app escribe, y por tanto NO es huella (tabla de
//  `formato-idioma.ts`; el dinero, decision del dueno del 05/11; lo demas,
//  propuesta de la ola 0):
//
//      dinero   MX$ 1.160,00   (US$ en una instancia USD, provisional)
//      fecha    1 de dez. de 2026 · 1 de dezembro de 2026 · 15:45
//      cifra    1.160 · 1.160,5 · 55,0%
//
//  Lo que la hace distinta de la italiana: el TEXTO que falta cae al ESPANOL
//  (no al ingles), y eso no es una huella —lo cuenta `cobertura-portugues.ts`—.
//  Pero un ejemplo de captura del espanol («Ej. 12.9») si lo es: es un formato.
//  Y el espanol y el portugues comparten palabras de fecha: «1 de abril de
//  2026» y «15 de agosto» son portugues correcto, asi que esos dos meses no
//  cuentan como huella.
// ============================================================================

export interface OpcionesGuardiaPortugues {
  /** Moneda de la instancia en la que se rindio el HTML. Por omision, MXN. */
  moneda?: 'MXN' | 'USD'
  /** Trozos que el lote declara como dato y no como formato (se prueban contra el trozo). */
  permitidos?: RegExp[]
}

// Los meses largos del espanol que el portugues NO escribe igual («abril» y
// «agosto» son de los dos idiomas).
const MESES_LARGOS_SOLO_ES =
  '(?:enero|febrero|marzo|mayo|junio|julio|septiembre|setiembre|octubre|noviembre|diciembre)'
// El portugues siempre pone «de» entre el dia y el mes («1 de dez.»): un dia
// seguido de una abreviatura sin «de» es la forma de `es-MX` («01 dic 2026»).
const MESES_CORTOS_ES = '(?:ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)'
const MESES_EN_CORTOS = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)'
const MESES_EN_LARGOS =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December)'

/** Cada huella con su nombre. Exportada para que la prueba la recorra. */
export const HUELLAS_PORTUGUES: readonly [string, RegExp][] = [
  // ── Espanol ──
  // Ojo: «01/12/2026» es tambien la fecha numerica de pt-BR. La app no la
  // escribe en portugues (D4: «1 de dez. de 2026»), asi que hoy es una
  // huella; un lote que la use la declara en `permitidos`.
  ['fecha dd/mm/aaaa', /\b\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})\b/g],
  ['fecha larga en español', new RegExp(`\\b\\d{1,2} de ${MESES_LARGOS_SOLO_ES}\\b`, 'gi')],
  ['mes corto en español', new RegExp(`\\b\\d{1,2} ${MESES_CORTOS_ES}\\b\\.?`, 'g')],
  ['a. m. / p. m.', /\b[ap]\.\s?m\./g],
  // ── Ingles ──
  ['fecha en ingles', new RegExp(`\\b${MESES_EN_CORTOS}\\.? \\d{1,2}\\b(?:, \\d{4})?`, 'g')],
  ['mes largo en ingles', new RegExp(`\\b${MESES_EN_LARGOS} \\d{4}\\b`, 'g')],
  ['AM / PM', /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/g],
  // ── Cifras: el ingles y el espanol de Mexico escriben igual (1,160.50) ──
  ['cifra con coma de millar', /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g],
  // Uno o dos decimales detras de un punto, como en la guardia italiana: no
  // caza el millar («1.160»), ni unas coordenadas, ni una version («0.12.5»).
  ['cifra con punto decimal', /(?<![\d.,])\d+\.\d{1,2}\b(?!\.\d)/g],
  // ── Dinero ──
  // En portugues NINGUNA moneda va con `$` a secas: ni el peso ni el dolar
  // son la moneda local de un lector brasileno.
  ['dinero sin prefijo', /(?<![A-Z]{2})\$\s*\d[\d.,]*/g],
  // «MX$1.160,00»: el portugues lleva espacio entre simbolo y cifra.
  ['simbolo pegado a la cifra', /[A-Z]{2}\$\d/g],
]

/**
 * Las huellas de formato espanol o ingles que quedan en un HTML portugues.
 * Devuelve cada una con su contexto; vacio = limpio.
 */
export function huellasEnPortugues(html: string, opciones: OpcionesGuardiaPortugues = {}): string[] {
  const moneda = opciones.moneda ?? 'MXN'
  const permitidos = opciones.permitidos ?? []
  const texto = textoLegible(html)
  const huellas: string[] = []
  const anotar = (tipo: string, trozo: string, i: number) => {
    if (permitidos.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(trozo))) return
    const contexto = texto.slice(Math.max(0, i - 30), i + trozo.length + 30).replace(/\s+/g, ' ')
    huellas.push(`${tipo} «${trozo}» en «${contexto.trim()}»`)
  }
  for (const [tipo, re] of HUELLAS_PORTUGUES) {
    for (const m of texto.matchAll(re)) anotar(tipo, m[0], m.index ?? 0)
  }
  // El simbolo de la OTRA moneda: MX$ en una instancia USD, US$ en una MXN.
  const esperado = FORMATO_IDIOMA.pt.simbolo[moneda]
  for (const m of texto.matchAll(/\b(MX|US)\$/g)) {
    if (m[0] !== esperado) anotar('moneda equivocada', m[0], m.index ?? 0)
  }
  return huellas
}
