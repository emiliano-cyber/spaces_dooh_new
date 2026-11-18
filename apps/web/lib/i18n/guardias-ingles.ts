// ============================================================================
//  lib/i18n/guardias-ingles.ts — LO QUE UN BARRIDO DE FRASES NO VE.
// ----------------------------------------------------------------------------
//  Las pruebas de pantallas de cada lote buscan FRASES espanolas en el HTML
//  ingles. Un `formatMonto(x)` o un `formatFecha(x)` al que se le olvido el
//  idioma no deja ninguna frase: deja `$ 10,000.00` (sin el `MX$` del ingles de
//  una instancia MXN) y `02/10/2026` (que un lector de EE. UU. lee como 10 de
//  febrero). El validador del lote de inventario y arrendadores lo demostro
//  (docs/i18n/validacion-inventario-arrendadores.md §6, mutante 5): quitar el
//  idioma en dos llamadas de `PagosRentaCard` sobrevivia a la suite entera.
//
//  UN SOLO AYUDANTE para todos los lotes (costura 2, 2026-11-02). Inventario lo
//  creo con dos huellas; Space Eyes tenia en su prueba una copia local con dos
//  mas (el mes corto y el «a. m.»). Aqui estan todas, mas las que pidieron los
//  validadores:
//
//  - la fecha larga «20 de octubre de 2026» (mutante E de inventario: el panel
//    de firmas decia «Document frozen on 20 de octubre…» y nadie lo veia);
//  - el formato corto con guion «02-nov» (mutante M10 de Space Eyes, el de la
//    fecha de Programacion);
//  - los atributos que se LEEN (`title`, `aria-label`, `placeholder`, `alt`):
//    una fecha o un importe en un `title` tambien es texto pintado;
//  - `permitidos` se compara contra el TROZO encontrado, no contra 60
//    caracteres de contexto: una huella real pegada a un importe declarado
//    quedaba perdonada.
//
//  Lo usan las pruebas de pantallas de TODOS los lotes. Supone una instancia
//  MXN (la de las pruebas): en una USD, `$1,234.50` SI es lo correcto en
//  ingles, y por eso la guardia del `$` se apaga y se enciende la del `US$`
//  (el simbolo del espanol de esa instancia).
// ============================================================================

export interface OpcionesGuardia {
  /** Moneda de la instancia en la que se rindio el HTML. Por omision, MXN. */
  moneda?: 'MXN' | 'USD'
  /**
   * Huellas que el lote DECLARA como dato y no como formato de la interfaz
   * (p. ej. el importe que recita el paso de revision de firmas, «$10,000.00
   * MXN», que es lo que se congela). Se prueban contra el TROZO encontrado:
   * el importe se lleva consigo el codigo de moneda que lo sigue («$10,000.00
   * MXN»), y nada mas.
   */
  permitidos?: RegExp[]
}

const MESES_CORTOS = '(?:ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)'
const MESES_LARGOS =
  '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)'

/** Cada huella con su nombre. Exportada para que la prueba del ayudante la recorra. */
export const HUELLAS: readonly [string, RegExp][] = [
  // El importe se lleva el codigo de moneda que lo sigue, para que un
  // permitido («$10,000.00 MXN») se pruebe contra el trozo y no contra el contexto.
  //
  // Ola 5 (validacion costura 2, M2 y M3):
  //  - `\s*` entre el «$» y la cifra: las etiquetas se cambian por saltos de
  //    linea, asi que `<span>$</span><span>10,000.00</span>` llega como
  //    «$\n\n10,000.00» y con `\s?` se escapaba.
  //  - `(?<![A-Z]{2})` y no `(?<!MX)`: un «US$ 5.00» (un importe en dolares
  //    pintado en ingles) es correcto y daba un falso positivo, porque el
  //    lookbehind solo perdonaba a «MX».
  ['dinero sin MX$', /(?<![A-Z]{2})\$\s*\d[\d,]*(?:\.\d+)?(?: [A-Z]{3}\b)?/g],
  // En una instancia USD el ingles pinta `$` a secas y el ESPANOL `US$`
  // (`dinero.ts`, tabla SIMBOLO): un «US$» en el HTML ingles es un
  // `formatMonto` al que se le olvido el idioma. Antes, en modo USD la guardia
  // del dinero se apagaba entera y esto no se vigilaba (M3).
  ['dinero con US$ en una instancia USD', /US\$\s*\d[\d,]*(?:\.\d+)?/g],
  // `\d{1,2}` y no `\d{2}` (M1): `toLocaleDateString('es-MX')` da «2/11/2026»
  // sin relleno, que es la forma mas comun de olvidar el idioma. Y el año de dos
  // cifras («02/11/26») tambien. El ingles de la app nunca escribe fechas en
  // cifras («Nov 2, 2026»), asi que cualquier d/m/a es una huella.
  ['fecha dd/mm/aaaa', /\b\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})\b/g],
  ['fecha larga en español', new RegExp(`\\b\\d{1,2} de ${MESES_LARGOS}\\b(?: de \\d{4})?`, 'gi')],
  ['mes corto en español', new RegExp(`\\b\\d{1,2} ${MESES_CORTOS}\\b\\.?`, 'g')],
  ['fecha corta con guion', new RegExp(`\\b\\d{1,2}-${MESES_CORTOS}\\b`, 'g')],
  ['a. m. / p. m.', /\b[ap]\.\s?m\./g],
]

/** Los atributos que la persona LEE (o le lee el lector de pantalla). */
const ATRIBUTOS_VISIBLES = /\s(?:title|aria-label|placeholder|alt)="([^"]*)"/g

function decodificar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/**
 * Lo que se lee de un HTML: los nodos de texto y, aparte, los atributos
 * visibles. Los `value="…"` de los `<input>` no cuentan: un campo de fecha
 * guarda `2026-10-02`, y lo que la persona TECLEO es un dato, no un texto
 * pintado.
 */
export function textoLegible(html: string): string {
  const sinValores = html.replace(/\svalue="[^"]*"/g, ' ')
  const atributos = [...sinValores.matchAll(ATRIBUTOS_VISIBLES)].map((m) => m[1])
  const nodos = sinValores.replace(/<[^>]*>/g, '\n')
  return decodificar(`${nodos}\n${atributos.join('\n')}`)
}

/**
 * Las huellas de formato espanol que quedan en un HTML que deberia ser ingles.
 * Devuelve cada una con su contexto; vacio = limpio.
 */
export function huellasDeFormatoEspanol(html: string, opciones: OpcionesGuardia = {}): string[] {
  const moneda = opciones.moneda ?? 'MXN'
  const permitidos = opciones.permitidos ?? []
  const texto = textoLegible(html)
  const huellas: string[] = []
  for (const [tipo, re] of HUELLAS) {
    if (tipo === 'dinero sin MX$' && moneda !== 'MXN') continue
    if (tipo === 'dinero con US$ en una instancia USD' && moneda !== 'USD') continue
    for (const m of texto.matchAll(re)) {
      const trozo = m[0]
      if (permitidos.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(trozo))) continue
      const i = m.index ?? 0
      const contexto = texto.slice(Math.max(0, i - 30), i + trozo.length + 30).replace(/\s+/g, ' ')
      huellas.push(`${tipo} «${trozo}» en «${contexto.trim()}»`)
    }
  }
  return huellas
}
