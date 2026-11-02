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
//  Este ayudante busca esas dos huellas en el TEXTO del HTML ingles. Lo usa la
//  prueba de pantallas de inventario y arrendadores; los demas lotes pueden
//  llamarlo igual sobre su volcado ingles.
//
//  Supone una instancia MXN (la de las pruebas): en una USD, `$1,234.50` SI es
//  lo correcto en ingles, y por eso la guardia del dinero se apaga.
// ============================================================================

export interface OpcionesGuardia {
  /** Moneda de la instancia en la que se rindio el HTML. Por omision, MXN. */
  moneda?: 'MXN' | 'USD'
  /**
   * Huellas que el lote DECLARA como dato y no como formato de la interfaz
   * (p. ej. el importe que recita el paso de revision de firmas, «$10,000.00
   * MXN», que es lo que se congela). Se comparan contra el trozo encontrado
   * con 30 caracteres de contexto a cada lado.
   */
  permitidos?: RegExp[]
}

const DINERO_SIN_MX = /(?<!MX)\$ ?\d[\d,]*(?:\.\d+)?/g
const FECHA_ES = /\b\d{2}\/\d{2}\/\d{4}\b/g

/**
 * Las huellas de formato espanol que quedan en un HTML que deberia ser ingles.
 * Devuelve cada una con su contexto; vacio = limpio.
 *
 * Los `value="…"` de los `<input>` no cuentan: un campo de fecha guarda
 * `2026-10-02`, y lo que la persona TECLEO es un dato, no un texto pintado.
 */
export function huellasDeFormatoEspanol(html: string, opciones: OpcionesGuardia = {}): string[] {
  const moneda = opciones.moneda ?? 'MXN'
  const permitidos = opciones.permitidos ?? []
  const texto = html
    .replace(/\svalue="[^"]*"/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
  const huellas: string[] = []
  const revisar = (re: RegExp, tipo: string) => {
    for (const m of texto.matchAll(re)) {
      const i = m.index ?? 0
      const contexto = texto.slice(Math.max(0, i - 30), i + m[0].length + 30).replace(/\s+/g, ' ')
      if (permitidos.some((p) => p.test(contexto))) continue
      huellas.push(`${tipo} «${m[0]}» en «${contexto.trim()}»`)
    }
  }
  if (moneda === 'MXN') revisar(DINERO_SIN_MX, 'dinero sin MX$')
  revisar(FECHA_ES, 'fecha dd/mm/aaaa')
  return huellas
}
