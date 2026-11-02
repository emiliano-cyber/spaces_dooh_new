import type { Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/dinero.ts — EL IDIOMA NO TOCA EL DINERO.
// ----------------------------------------------------------------------------
//  La regla entera, en una linea:
//
//      EL IDIOMA DECIDE COMO SE ESCRIBE UN IMPORTE. NUNCA CUANTO VALE
//      NI EN QUE MONEDA ESTA.
//
//  ─── LA MONEDA ES DE LA INSTANCIA, Y SE ELIGE UNA SOLA VEZ ─────────────────
//
//  Hasta el 2026-11-02 aqui habia una constante, `MONEDA = 'MXN'`: decision
//  del dueno del 30/09, «el sistema se rige 100% en pesos mexicanos por ahora,
//  despues lo moveremos». El «despues» llego el 02/11 (ADR 0048):
//
//    · cada INSTANCIA trabaja en UNA moneda, MXN o USD;
//    · se elige al crearla (`POST /api/bootstrap`, `moneda`), y por omision
//      es MXN, que es en lo que se quedan todas las que ya existen;
//    · y NO SE PUEDE CAMBIAR despues. Lo impide la base
//      (`20261102_moneda_inmutable_por_instancia.sql`) y lo rechaza la API.
//
//  Por que inmutable: los importes guardados —contratos, propuestas,
//  cobranza— NO llevan moneda propia. Cambiar la de la instancia volveria
//  «$10,000 MXN» en «$10,000 USD» sin convertir nada: el mismo numero, otra
//  divisa, veinte veces mas caro, y ningun error.
//
//  Asi que sigue habiendo UNA moneda y sigue viviendo en UN sitio —la variable
//  de abajo— con una diferencia: ya no la escribe el codigo, la escribe la
//  base al arrancar cada peticion (`lib/server/moneda-instancia.ts` en el
//  servidor, `ProveedorMoneda` en el navegador). Que sea una variable de
//  MODULO y no un parametro es lo que deja intactas las ~250 llamadas a
//  `formatMonto(n)`: ninguna pantalla tiene que enterarse.
//
//  ¿Y por que es seguro un global de modulo en un servidor que atiende a
//  varias organizaciones? Porque la moneda NO es de la organizacion: es de la
//  INSTANCIA, y la base impide que dos organizaciones de la misma instancia
//  tengan monedas distintas (trigger `tenants_moneda_unica`). Todas las
//  peticiones escriben el MISMO valor. Con el idioma, que si cambia por
//  peticion, esto seria un error — y por eso el idioma sigue siendo parametro.
//
//  ─── QUE ES EXACTAMENTE LO QUE PUEDE CAMBIAR CON EL IDIOMA ─────────────────
//
//  Solo la escritura: separadores y el SIMBOLO. El importe es el MISMO y la
//  moneda es la MISMA.
//
//                     espanol        ingles
//      MXN            $1,234.50      MX$1,234.50
//      USD            US$1,234.50    $1,234.50
//
//  La regla de la tabla: el `$` a secas es la moneda LOCAL del lector. En
//  espanol de Mexico el `$` es el peso, asi que el dolar lleva `US$`; en
//  ingles el `$` es el dolar, asi que el peso lleva `MX$`. Nunca hay un `$`
//  que un lector pueda leer como la otra moneda. El espanol de una instancia
//  MXN es IDENTICO al de antes del 02/11 (lo mide `dinero.test.ts`).
//
//  ─── LO QUE NO PUEDE PASAR NUNCA ───────────────────────────────────────────
//
//  Un `toLocaleString('en-US', { currency: 'USD' })` sobre un importe en pesos
//  no da ningun error: pinta un numero perfectamente creible y equivocado, y la
//  misma pantalla afirma otro precio segun el idioma. Por eso `currency` no es
//  un parametro de estas funciones —no se puede pasar el valor equivocado si no
//  se puede pasar— y por eso `dinero.test.ts` lleva la prueba negativa
//  obligatoria mas las guardias que recorren todo `apps/web`.
// ============================================================================

/** Las monedas en las que puede nacer una instancia. Ni una mas. */
export const MONEDAS = ['MXN', 'USD'] as const
export type Moneda = (typeof MONEDAS)[number]

/** En la que nace una instancia si nadie elige, y en la que estan las de antes del 02/11. */
export const MONEDA_POR_OMISION: Moneda = 'MXN'

export function esMoneda(x: unknown): x is Moneda {
  return typeof x === 'string' && (MONEDAS as readonly string[]).includes(x)
}

// EL UNICO SITIO. Todo lo demas de este archivo cuelga de esta variable. La
// escribe `fijarMonedaInstancia` y nadie mas.
let monedaVigente: Moneda = MONEDA_POR_OMISION

/**
 * La moneda de ESTA instancia. La leen los formateadores y quien tenga que
 * estampar o rotular un importe (el alta de contrato, el comprobante).
 */
export function monedaInstancia(): Moneda {
  return monedaVigente
}

/**
 * La fija quien la leyo de la base: `monedaDeLaInstancia()` en el servidor y
 * `ProveedorMoneda` en el navegador. Un valor que no es una de las monedas
 * permitidas LANZA en vez de caer a MXN: pintar pesos en una instancia en
 * dolares es exactamente el fallo silencioso que este archivo existe para
 * impedir.
 */
export function fijarMonedaInstancia(m: string): void {
  if (!esMoneda(m)) {
    throw new Error(`Moneda de instancia no soportada: ${JSON.stringify(m)} (solo ${MONEDAS.join(' o ')})`)
  }
  monedaVigente = m
}

// Los locales de FORMATEO. No son monedas y no hay que confundirlos: el locale
// dice como se escribe un numero; la moneda, de que dinero se habla.
export const LOCALE_DE_IDIOMA: Record<Idioma, string> = {
  es: 'es-MX',
  en: 'en-US',
}

// El simbolo, por idioma del LECTOR y moneda del IMPORTE. Ver la tabla de la
// cabecera: el `$` a secas solo se usa para la moneda local del lector.
const SIMBOLO: Record<Idioma, Record<Moneda, string>> = {
  es: { MXN: '$', USD: 'US$' },
  en: { MXN: 'MX$', USD: '$' },
}

// El nombre, para la ficha de Administracion. Vive aqui y no en el
// diccionario porque la GUARDIA 2 prohibe codigos de moneda en los
// diccionarios —y con razon: este es el unico sitio donde una moneda se nombra.
const NOMBRE: Record<Idioma, Record<Moneda, string>> = {
  es: { MXN: 'Peso mexicano (MXN)', USD: 'Dólar estadounidense (USD)' },
  en: { MXN: 'Mexican peso (MXN)', USD: 'US dollar (USD)' },
}

/** El simbolo de la moneda de la instancia, para quien lo pinta suelto (`$ 1,234.50`). */
export function simboloMoneda(idioma: Idioma = 'es'): string {
  return SIMBOLO[idioma][monedaVigente]
}

/** «Peso mexicano (MXN)» / «Dólar estadounidense (USD)», en el idioma de quien mira. */
export function nombreMoneda(idioma: Idioma = 'es', moneda: Moneda = monedaVigente): string {
  return NOMBRE[idioma][moneda]
}

// Lo que se pinta cuando no hay un numero que pintar. Un guion es informacion
// («no hay dato»); «$NaN» es una averia a la vista del cliente.
const SIN_DATO = '—'

function esNumero(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * Los decimales son lo UNICO que se deja ajustar. Ni `currency`, ni `style`,
 * ni `currencyDisplay`: el tipo no los admite, y asi nadie puede colar otra
 * moneda por el objeto de opciones.
 */
export interface DecimalesDinero {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

/**
 * Formatea un importe para ensenarlo.
 *
 * NO recibe moneda, y es deliberado: es la de la instancia. El simbolo se
 * pone a mano sobre las partes de `Intl` porque ICU no da la tabla de la
 * cabecera: en `es-MX` un dolar sale «USD 1,234.50».
 */
export function formatearDinero(
  monto: number,
  idioma: Idioma,
  decimales: DecimalesDinero = { minimumFractionDigits: 2, maximumFractionDigits: 2 },
): string {
  if (!esNumero(monto)) return SIN_DATO
  const partes = new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], {
    style: 'currency',
    currency: monedaInstancia(),
    minimumFractionDigits: decimales.minimumFractionDigits,
    maximumFractionDigits: decimales.maximumFractionDigits,
  }).formatToParts(monto)
  const simbolo = SIMBOLO[idioma][monedaVigente]
  return partes
    // El espacio que ICU pone entre «USD» y la cifra sobra con el simbolo: en
    // estos dos locales, un literal en blanco solo aparece junto a la moneda.
    .filter((p) => !(p.type === 'literal' && /^\s+$/.test(p.value)))
    .map((p) => (p.type === 'currency' ? simbolo : p.value))
    .join('')
}

/**
 * Un importe sin decimales, para tarjetas y totales grandes.
 *
 * Existe porque los reportes ya lo hacen asi (`lib/data/reportes.ts` formatea
 * con `maximumFractionDigits: 0`) y, sin este ayudante, quien tradujera esas
 * pantallas volveria a escribir el `Intl` a mano — que es justo lo que este
 * archivo esta para evitar.
 */
export function formatearDineroRedondo(monto: number, idioma: Idioma): string {
  return formatearDinero(monto, idioma, { maximumFractionDigits: 0 })
}

/** Una cantidad SIN moneda (spots, pantallas, dias). */
export function formatearNumero(
  n: number,
  idioma: Idioma,
  opciones: Intl.NumberFormatOptions = {},
): string {
  if (!esNumero(n)) return SIN_DATO
  return new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], opciones).format(n)
}

/**
 * Una fecha, en el idioma de quien mira.
 *
 * Misma regla que el dinero: cambia COMO se escribe, nunca QUE dia es. El dato
 * sigue siendo el mismo instante.
 */
export function formatearFecha(
  fecha: Date | string | number,
  idioma: Idioma,
  opciones: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit' },
): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(d.getTime())) return SIN_DATO
  return new Intl.DateTimeFormat(LOCALE_DE_IDIOMA[idioma], opciones).format(d)
}
