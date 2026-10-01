import type { Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/dinero.ts — EL IDIOMA NO TOCA EL DINERO.
// ----------------------------------------------------------------------------
//  La regla entera, en una linea:
//
//      EL IDIOMA DECIDE COMO SE ESCRIBE UN IMPORTE. NUNCA CUANTO VALE
//      NI EN QUE MONEDA ESTA.
//
//  ─── LA MONEDA VIVE AQUI Y EN NINGUN OTRO SITIO ────────────────────────────
//
//  Decision del dueno, 2026-09-30, literal: «el sistema se rige 100% en pesos
//  mexicanos por ahora, despues lo moveremos».
//
//  Asi que hay UNA moneda y se declara UNA VEZ, en la constante `MONEDA` de
//  abajo. No se construye multimoneda —no hace falta hoy y seria inventar
//  trabajo—, pero tampoco se reparte el literal por las pantallas, y ese es el
//  punto entero de este archivo:
//
//    · el dia que «despues lo moveremos» llegue, se cambia UNA linea;
//    · si en vez de eso el simbolo y el formato estuvieran escritos a mano en
//      veinte componentes, serian veinte oportunidades de que uno se quede
//      atras — y el que se quede atras NO DARA ERROR: pintara el precio
//      equivocado, que es el modo de fallo caro de este repositorio.
//
//  ─── QUE ES EXACTAMENTE LO QUE PUEDE CAMBIAR CON EL IDIOMA ─────────────────
//
//  Solo la escritura del numero: donde va el separador de miles, donde el
//  decimal, y donde se coloca el simbolo. El importe es el MISMO y la moneda es
//  la MISMA.
//
//    formatearDinero(1234.5, 'es')  ->  "$1,234.50"
//    formatearDinero(1234.5, 'en')  ->  "MX$1,234.50"
//
//  Fijarse en el ingles, porque es el argumento de por que NO se fuerza el
//  locale mexicano en la rama inglesa: en `es-MX` el peso se escribe `$`, que
//  un lector anglosajon lee como DOLAR. En `en-US`, ICU escribe `MX$`. O sea
//  que el ingles DESAMBIGUA la moneda en vez de oscurecerla. Son pesos en los
//  dos casos, y en ingles ademas lo dice.
//
//  ─── LO QUE NO PUEDE PASAR NUNCA ───────────────────────────────────────────
//
//  Un `toLocaleString('en-US', { currency: 'USD' })` sobre un importe en pesos
//  no da ningun error: pinta un numero perfectamente creible y equivocado, y la
//  misma pantalla afirma otro precio segun el idioma. Por eso `currency` no es
//  un parametro de estas funciones —no se puede pasar el valor equivocado si no
//  se puede pasar— y por eso `dinero.test.ts` lleva la prueba negativa
//  obligatoria mas dos guardias que recorren todo `apps/web`.
// ============================================================================

// EL UNICO SITIO. Todo lo demas de este archivo cuelga de esta linea.
export const MONEDA = 'MXN'

// Los locales de FORMATEO. No son monedas y no hay que confundirlos: el locale
// dice como se escribe un numero; `MONEDA`, de que dinero se habla.
export const LOCALE_DE_IDIOMA: Record<Idioma, string> = {
  es: 'es-MX',
  en: 'en-US',
}

// Lo que se pinta cuando no hay un numero que pintar. Un guion es informacion
// («no hay dato»); «$NaN» es una averia a la vista del cliente.
const SIN_DATO = '—'

function esNumero(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * Formatea un importe para enseñarlo.
 *
 * NO recibe moneda, y es deliberado: hay una sola y esta arriba. Quien necesite
 * otra el dia que «se mueva» cambia `MONEDA`, no las llamadas.
 */
export function formatearDinero(monto: number, idioma: Idioma): string {
  if (!esNumero(monto)) return SIN_DATO
  return new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], {
    style: 'currency',
    currency: MONEDA,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)
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
  if (!esNumero(monto)) return SIN_DATO
  return new Intl.NumberFormat(LOCALE_DE_IDIOMA[idioma], {
    style: 'currency',
    currency: MONEDA,
    maximumFractionDigits: 0,
  }).format(monto)
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
