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
 * La zona del negocio cuando la instancia no dice otra: la de la plantilla
 * (`infra/env/app.env.example`, `TZ=America/Mexico_City`, «la del owner, no
 * la del servidor»). B88 · H4 (05/11): sin esto, una instancia sin `TZ`
 * contaba la vigencia en UTC EN SILENCIO y sus propuestas vencían a las 18:00
 * de México del último día. Se eligió caer a México y avisar, no a UTC: es la
 * zona de todas las instancias de hoy, y un aviso en el log se ve.
 */
export const ZONA_DEL_NEGOCIO_POR_OMISION = 'America/Mexico_City'

const avisado = new Set<string>()

function esZonaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona })
    return true
  } catch {
    return false
  }
}

/**
 * La zona en que se cuenta el día de la vigencia: la `TZ` del proceso si es
 * una zona válida (con o sin los dos puntos de glibc); si falta o no vale,
 * `ZONA_DEL_NEGOCIO_POR_OMISION`, avisando UNA vez en el log.
 */
export function zonaDelNegocio(): string {
  const tz = (typeof process !== 'undefined' ? process.env.TZ : undefined)?.trim().replace(/^:/, '')
  if (tz && esZonaValida(tz)) return tz
  const motivo = tz ? `TZ=«${tz}» no es una zona horaria` : 'TZ no está definida'
  if (!avisado.has(motivo)) {
    avisado.add(motivo)
    console.warn(
      `[vigencia] ${motivo}: el día de la vigencia de las propuestas se cuenta en ` +
        `${ZONA_DEL_NEGOCIO_POR_OMISION}. Pon TZ en app.env (infra/env/app.env.example).`,
    )
  }
  return ZONA_DEL_NEGOCIO_POR_OMISION
}

/**
 * EL DÍA DE LA VIGENCIA: el de la zona del NEGOCIO (`zonaDelNegocio()`).
 *
 * Es la ÚNICA fuente de «hoy» para la vigencia de una propuesta, y la base lo
 * recibe como PARÁMETRO (`vigente_hasta < $n::date`), nunca con su
 * `current_date`. Hasta el 05/11 convivían dos relojes: la ficha y la liga
 * usaban el de la aplicación, y aceptar, el correo de «Enviar» y la vigencia
 * al enviar, el de la base. Con la base en UTC (la zona del sistema de g500
 * según su expediente de mudanza; B88 pide medir la de Postgres), desde las
 * 18:00 de México una propuesta «válida hasta hoy» salía vigente en la liga,
 * con su botón, y aceptarla daba 409 «venció»; y la enviada a las 19:00 se
 * guardaba con un día más del que decía su correo
 * (`lib/server/propuesta-vigencia-hora.test.ts`).
 *
 * Con `Intl` y la zona explícita, no con los getters locales: esos dependen de
 * que el runtime honre `TZ`, y Node en Windows no la honra para cualquier zona
 * (`lib/propuesta-vigencia-zona.test.ts`).
 */
export function hoyDeVigencia(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaDelNegocio(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora)
  const de = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  return `${de('year')}-${de('month')}-${de('day')}`
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
