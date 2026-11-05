import { fechaLocalISO } from './fecha-local'

// ============================================================================
//  lib/propuesta-vigencia.ts — Hasta cuándo se puede aceptar una propuesta.
//
//  Decisión del dueño (29/10): una propuesta vale 30 días por omisión (cada
//  organización lo cambia en Administración), contados desde que se ENVÍA, y
//  vencida la liga pública no deja aceptarla. La fecha es editable por dentro.
//
//  Vive aquí, sin dependencias del servidor, porque la usan las dos mitades:
//  el repo (que decide) y las pantallas (que avisan). Si cada una contara a su
//  manera, la ficha diría «vigente» y la liga se negaría a aceptar, o al revés.
//
//  El ÚLTIMO DÍA TODAVÍA VALE: «válida hasta el 30» se lee como «el 30 aún se
//  puede aceptar». Vence el día siguiente.
// ============================================================================

/** Días por omisión: el `default` de `config_negocio.vigencia_propuesta_dias`. */
export const VIGENCIA_DIAS_POR_OMISION = 30
export const VIGENCIA_DIAS_MAX = 365

/**
 * Una columna `date` como `AAAA-MM-DD`, o `null`.
 *
 * El driver `pg` entrega `date` como un `Date` a medianoche LOCAL, así que se
 * formatea con los getters locales y no con `toISOString()`: en México, desde
 * las 18:00 el día UTC ya es el siguiente y la vigencia saldría corrida un día.
 */
export function fechaDia(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : fechaLocalISO(v)
  const s = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * EL DÍA DE LA VIGENCIA: el de la zona del NEGOCIO, que es la `TZ` del proceso
 * (`app.env`: `TZ=America/Mexico_City`, «la del owner, no la del servidor»).
 *
 * Es la ÚNICA fuente de «hoy» para la vigencia de una propuesta, y la base lo
 * recibe como PARÁMETRO (`vigente_hasta < $n::date`), nunca con su
 * `current_date`. Hasta el 05/11 convivían dos relojes: la ficha y la liga
 * usaban éste, y aceptar, el correo de «Enviar» y la vigencia al enviar usaban
 * el de la base. En g500 la base va en `Etc/UTC`, así que desde las 18:00 de
 * México una propuesta «válida hasta hoy» salía vigente en la liga, con su
 * botón, y aceptarla daba 409 «venció»; y la enviada a las 19:00 se guardaba
 * con un día más del que decía su correo
 * (`lib/server/propuesta-vigencia-hora.test.ts`).
 */
export function hoyDeVigencia(ahora: Date = new Date()): string {
  return fechaLocalISO(ahora)
}

/** ¿Ya venció? `null` (sin vigencia, lo de antes del 29/10) nunca vence. */
export function propuestaVencida(vigenteHasta: string | null, hoy: string = hoyDeVigencia()): boolean {
  if (!vigenteHasta) return false
  return vigenteHasta < hoy
}

/** La fecha de vigencia que se pone al enviar: hoy + N días. */
export function vigenciaDesde(hoy: string, dias: number): string {
  const [a, m, d] = hoy.split('-').map(Number)
  // Mediodía y no medianoche: un cambio de horario no puede mover el día.
  const f = new Date(a, m - 1, d, 12)
  f.setDate(f.getDate() + dias)
  return fechaLocalISO(f)
}

/** Los días de vigencia que se aceptan como configuración: enteros de 1 a 365. */
export function vigenciaDiasValida(v: unknown): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= VIGENCIA_DIAS_MAX ? n : VIGENCIA_DIAS_POR_OMISION
}
