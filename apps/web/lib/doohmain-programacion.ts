// ============================================================================
//  lib/doohmain-programacion.ts — Qué se le manda a DOOHmain de cada pantalla:
//  cuántas reproducciones, en qué horario y quién es el cliente.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: mandar las reproducciones dentro de la
//  franja si la campaña tiene una, o el total del periodo; los datos del
//  cliente, y todo lo que la API recibe. La franja SOLO si existe: sin ella se
//  manda lo de siempre.
//
//  Lo usa `lib/server/doohmain.ts` para armar el CLI del SDK de Python. Es puro
//  —sin base ni red— para poder probar la regla sin publicar nada, que es lo
//  que de verdad importa: con esto se le dicta al reproductor cuántas veces
//  sale un anuncio que se le factura al cliente.
//
//  Lo que la API acepta (docs/doohmain-api-2.8.4.md) y cómo se llena:
//   · `cant_day`    → spots por día de la reserva (lo de siempre);
//   · `cant_total`  → spots por día × días de la campaña;
//   · `auto_cant`   → 1 solo con franja: que DOOHmain reparta las del día
//                     dentro del horario en vez de amontonarlas;
//   · `cant_hour`   → no se manda: no hay pauta por hora, y repartir con
//                     `auto_cant` es lo que pide «en la franja»;
//   · `start_time` / `end_time` del spot → la franja, si la hay;
//   · `days`        → no se manda: las franjas no tienen días de la semana.
// ============================================================================

export interface Franja {
  horaInicio: string
  horaFin: string
}

export interface ProgramacionDoohmain {
  cantDia: number | null
  cantTotal: number | null
  horaInicio: string | null
  horaFin: string | null
  autoCant: boolean
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Días del periodo contando los dos extremos; 0 si está al revés. */
export function diasDeCampana(inicio: string, fin: string): number {
  const ms = Date.parse(fin.slice(0, 10) + 'T00:00:00Z') - Date.parse(inicio.slice(0, 10) + 'T00:00:00Z')
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.round(ms / 86_400_000) + 1
}

export function programacionDoohmain(e: {
  /** Ya resuelto como hoy: null cuando la reserva no tiene pauta diaria. */
  cantDia: number | null
  fechaInicio: string
  fechaFin: string
  franja: Franja | null
}): ProgramacionDoohmain {
  const cantDia = e.cantDia != null && e.cantDia > 0 ? e.cantDia : null
  // Una hora mal escrita no viaja: el CMS la rechazaría o, peor, la leería mal.
  // La base ya lo impide con un CHECK; esto es la segunda capa.
  const franja = e.franja && HHMM.test(e.franja.horaInicio) && HHMM.test(e.franja.horaFin) ? e.franja : null
  const dias = diasDeCampana(e.fechaInicio, e.fechaFin)
  return {
    cantDia,
    // Sin pauta contratada no se inventa un total: el CMS pone los que quepan,
    // que es lo que hacía hasta hoy.
    cantTotal: cantDia != null && dias > 0 ? cantDia * dias : null,
    horaInicio: franja?.horaInicio ?? null,
    horaFin: franja?.horaFin ?? null,
    autoCant: franja != null && cantDia != null,
  }
}

// ─── Lo que la ficha de la campaña enseña ANTES de publicar (22/10) ────────

/** El horario que se manda: la franja, o que no hay y sale todo el día. */
export function textoHorario(p: ProgramacionDoohmain): string {
  return p.horaInicio && p.horaFin ? `${p.horaInicio} a ${p.horaFin}` : 'Todo el día (sin franja)'
}

const miles = (n: number) => n.toLocaleString('es-MX')

/**
 * Las reproducciones, por día y en toda la campaña. Sin pauta contratada NO se
 * pinta un cero —diría que no sale nunca—: se dice que DOOHmain pone las que
 * quepan, que es lo que pasa.
 */
export function textoReproducciones(p: ProgramacionDoohmain): { porDia: string; total: string } {
  return {
    porDia: p.cantDia != null ? miles(p.cantDia) : 'Las que quepan',
    total: p.cantTotal != null ? miles(p.cantTotal) : 'Las que quepan',
  }
}

export interface ClienteDoohmain {
  nombre: string
  rfc: string | null
  razonSocial: string | null
  direccion: string | null
  tipo: string | null
}

const limpio = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

const ETIQUETA_TIPO: Record<string, string> = { DIRECTO: 'Directo', AGENCIA: 'Agencia' }

/**
 * Los datos del cliente tal como los pide DOOHmain: `name`, `cuit` (el RFC),
 * `real_name` (la razón social), `address` y `client_type`. La dirección sale
 * del contacto del cliente si la tiene; el tipo es Directo o Agencia, que es lo
 * que guardamos (no hay giro). Lo que no hay va en null y no se manda.
 */
export function clienteDoohmain(
  c: { nombre: string; rfc: string | null; razonSocial: string | null; contacto: unknown; tipo: string | null } | null,
): ClienteDoohmain {
  if (!c) return { nombre: 'Sin cliente', rfc: null, razonSocial: null, direccion: null, tipo: null }
  const contacto = (c.contacto && typeof c.contacto === 'object' ? c.contacto : {}) as Record<string, unknown>
  const tipo = limpio(c.tipo)
  return {
    nombre: limpio(c.nombre) ?? 'Sin cliente',
    rfc: limpio(c.rfc),
    razonSocial: limpio(c.razonSocial),
    direccion: limpio(contacto.direccion),
    tipo: tipo ? (ETIQUETA_TIPO[tipo] ?? tipo) : null,
  }
}
