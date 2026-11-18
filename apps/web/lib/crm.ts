// ============================================================================
//  lib/crm.ts — Las reglas de la oportunidad que no dependen de la base.
//  ADR 0051 §1 y §2.
// ----------------------------------------------------------------------------
//  Las aplica `oportunidades-repo.ts` con la fila BLOQUEADA, contra la etapa
//  que hay de verdad y no contra la que la pantalla creía. Aquí no se lanza
//  ningún error: se devuelve un código y el repo lanza el mensaje literal. Así
//  el catálogo de traducciones de errores (I18N-05) los ve todos al recorrer
//  los `new AppError('…')` del árbol, sin una lista aparte que mantener.
// ============================================================================

export const ETAPAS_OPORTUNIDAD = [
  'CONTACTO',
  'NECESIDAD',
  'COTIZANDO',
  'NEGOCIANDO',
  'GANADA',
  'PERDIDA',
] as const
export type EtapaOportunidad = (typeof ETAPAS_OPORTUNIDAD)[number]

export const ETAPAS_ABIERTAS = ['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO'] as const

/** El tipo `ETAPA` lo escribe el repo al cambiar de etapa; la API no lo acepta. */
export const TIPOS_ACTIVIDAD = ['LLAMADA', 'VISITA', 'REUNION', 'CORREO', 'WHATSAPP', 'NOTA', 'ETAPA'] as const
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number]
export const TIPOS_ACTIVIDAD_MANUAL = ['LLAMADA', 'VISITA', 'REUNION', 'CORREO', 'WHATSAPP', 'NOTA'] as const

/** Los mismos de `tipo_medio` en `db/schema.sql` (y `TipoMedio` en `lib/data/types.ts`). */
export const TIPOS_MEDIO = [
  'ESPECTACULAR',
  'PANTALLA_DIGITAL',
  'PUENTE_PEATONAL',
  'MOBILIARIO_URBANO',
  'MURAL',
  'VALLA',
  'OTRO',
] as const

// La oportunidad NO lleva probabilidad de cierre. La hubo (fija por etapa, luego
// por instancia, para «ponderar» el embudo) y el dueño la quitó entera el
// 17/11: el embudo enseña lo que quiere gastar cada cliente, sin pesarlo.

export function etapaOportunidadCerrada(e: EtapaOportunidad): boolean {
  return e === 'GANADA' || e === 'PERDIDA'
}

export type ProblemaEtapa = 'MISMA' | 'CERRADA' | 'SIN_MOTIVO'

/**
 * Por qué NO se puede pasar de `actual` a `nueva`, o null si se puede.
 *
 * Mientras está abierta se puede ir y volver entre etapas: una negociación que
 * pide otra cotización regresa a COTIZANDO, y eso es lo normal. Cerrada ya no
 * se mueve: lo que el cliente pida después es otra oportunidad, y así la
 * historia de la que se ganó o perdió no se reescribe.
 */
export function problemaCambioEtapa(
  actual: EtapaOportunidad,
  nueva: EtapaOportunidad,
  motivoPerdida: string | null,
): ProblemaEtapa | null {
  if (actual === nueva) return 'MISMA'
  if (etapaOportunidadCerrada(actual)) return 'CERRADA'
  if (nueva === 'PERDIDA' && !(motivoPerdida ?? '').trim()) return 'SIN_MOTIVO'
  return null
}

/** true si el mínimo pasa del máximo. Cualquiera puede faltar. */
export function problemaPresupuesto(min: number | null, max: number | null): boolean {
  return min != null && max != null && min > max
}

/** true si el inicio va después del fin. Fechas `AAAA-MM-DD`: se comparan como texto. */
export function problemaFechas(inicio: string | null, fin: string | null): boolean {
  return inicio != null && fin != null && inicio > fin
}

// ─── Fase 4 · lo que pinta la pantalla del CRM ───────────────────────────────
//  Todo calculado al leer, nada guardado (ADR 0051 §6): los días salen de las
//  filas ETAPA de la línea de tiempo, y el cotejo, de la oportunidad contra
//  los totales que ya calcula Propuestas (`armarPropuesta`), la misma fuente
//  del dinero en toda la aplicación.

const DIA_MS = 86_400_000

/**
 * Cuántos días pasó la oportunidad en cada etapa. Cada fila ETAPA abre una
 * etapa que dura hasta la siguiente; la última, si está abierta, hasta `ahora`.
 * Volver a una etapa SUMA. GANADA y PERDIDA no cuentan días: son el final.
 * Se cuenta con marcas de tiempo (no con fechas de calendario): el navegador no
 * conoce la zona del negocio, igual que en `crm-cotejo.ts`.
 */
export function diasPorEtapa(
  actividades: { tipo: string; etapaNueva: string | null; creadoEn: string }[],
  ahora: Date = new Date(),
): Partial<Record<EtapaOportunidad, number>> {
  const etapas = actividades
    .filter((a) => a.tipo === 'ETAPA' && a.etapaNueva)
    .map((a) => ({ etapa: a.etapaNueva as EtapaOportunidad, t: Date.parse(a.creadoEn) }))
    .sort((a, b) => a.t - b.t)
  const ms: Partial<Record<EtapaOportunidad, number>> = {}
  etapas.forEach((e, i) => {
    if (etapaOportunidadCerrada(e.etapa)) return
    const fin = i + 1 < etapas.length ? etapas[i + 1].t : ahora.getTime()
    ms[e.etapa] = (ms[e.etapa] ?? 0) + Math.max(0, fin - e.t)
  })
  return Object.fromEntries(
    Object.entries(ms).map(([k, v]) => [k, Math.floor((v as number) / DIA_MS)]),
  ) as Partial<Record<EtapaOportunidad, number>>
}

export type PosicionPresupuesto = 'SIN_PRESUPUESTO' | 'DEBAJO' | 'DENTRO' | 'ENCIMA'

/**
 * Dónde cae lo cotizado respecto de lo que el cliente dijo que quería gastar.
 * `diferencia` es contra el extremo que se rebasó (0 dentro del rango) y `pct`,
 * esa diferencia sobre ese extremo, redondeada a un decimal.
 */
export function cotejoPresupuesto(
  min: number | null,
  max: number | null,
  cotizado: number,
): { posicion: PosicionPresupuesto; diferencia: number | null; pct: number | null } {
  if (min == null && max == null) return { posicion: 'SIN_PRESUPUESTO', diferencia: null, pct: null }
  const pct = (dif: number, base: number) => (base > 0 ? Math.round((dif / base) * 1000) / 10 : null)
  if (max != null && cotizado > max) {
    const d = Math.round((cotizado - max) * 100) / 100
    return { posicion: 'ENCIMA', diferencia: d, pct: pct(d, max) }
  }
  if (min != null && cotizado < min) {
    const d = Math.round((cotizado - min) * 100) / 100
    return { posicion: 'DEBAJO', diferencia: d, pct: pct(d, min) }
  }
  return { posicion: 'DENTRO', diferencia: 0, pct: 0 }
}

/**
 * Días entre dos fechas de calendario. Acepta `AAAA-MM-DD` (las de la
 * oportunidad) y el ISO completo con que `propuestas-repo` serializa las de los
 * renglones (`iso()` hace `toISOString()` de la medianoche LOCAL del servidor:
 * `2026-12-01T06:00:00.000Z` en México). Concatenarle `T00:00:00Z` a ese ISO
 * daba NaN, visto en el navegador el 17/11. Redondear absorbe la zona (hasta
 * ±12 h), y no se corta a 10 caracteres porque al este de UTC la medianoche
 * local cae el día ANTERIOR en UTC.
 */
function diasEntre(a: string, b: string): number {
  const t = (s: string) => Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s)
  return Math.round((t(b) - t(a)) / DIA_MS) || 0 // `|| 0`: sin «-0» en pantalla
}

/**
 * Las fechas que pidió el cliente contra las que se cotizaron. `inicioDias` y
 * `finDias`: cuántos días se movió cada extremo (+ = la cotización va después).
 */
export function cotejoFechas(
  pedidoInicio: string | null,
  pedidoFin: string | null,
  cotizadoInicio: string | null,
  cotizadoFin: string | null,
): { estado: 'SIN_FECHAS' | 'IGUAL' | 'DISTINTO'; inicioDias: number | null; finDias: number | null } {
  const ini = pedidoInicio && cotizadoInicio ? diasEntre(pedidoInicio, cotizadoInicio) : null
  const fin = pedidoFin && cotizadoFin ? diasEntre(pedidoFin, cotizadoFin) : null
  if (ini == null && fin == null) return { estado: 'SIN_FECHAS', inicioDias: null, finDias: null }
  return { estado: (ini ?? 0) === 0 && (fin ?? 0) === 0 ? 'IGUAL' : 'DISTINTO', inicioDias: ini, finDias: fin }
}

/** El monto con que se pesa una oportunidad: el máximo que quiere gastar, o el mínimo. */
export function montoReferencia(min: number | null, max: number | null): number | null {
  return max ?? min ?? null
}

/** Las columnas del embudo, en su orden, con cuánto suman (`total`, el monto de referencia). */
export function agruparEmbudo<
  T extends { etapa: EtapaOportunidad; presupuestoMin: number | null; presupuestoMax: number | null },
>(ops: T[]): { etapa: EtapaOportunidad; oportunidades: T[]; total: number }[] {
  return ETAPAS_OPORTUNIDAD.map((etapa) => {
    const de = ops.filter((o) => o.etapa === etapa)
    const total = de.reduce((s, o) => s + (montoReferencia(o.presupuestoMin, o.presupuestoMax) ?? 0), 0)
    return { etapa, oportunidades: de, total }
  })
}
