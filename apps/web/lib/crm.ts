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

/**
 * La probabilidad de cierre cuando el vendedor no puso otra.
 *
 * ⚠️ PROVISIONAL: es la propuesta del ADR 0051 (pregunta 3), y el dueño todavía
 * no dijo si le sirve o si la fija cada instancia. Por eso la base guarda
 * `probabilidad_pct` NULL cuando el vendedor no la toca, y esta tabla se aplica
 * al LEER: si cambia, cambian todas las oportunidades sin reescribir una fila.
 */
export const PROBABILIDAD_POR_ETAPA: Record<EtapaOportunidad, number> = {
  CONTACTO: 10,
  NECESIDAD: 25,
  COTIZANDO: 50,
  NEGOCIANDO: 75,
  GANADA: 100,
  PERDIDA: 0,
}

export function etapaOportunidadCerrada(e: EtapaOportunidad): boolean {
  return e === 'GANADA' || e === 'PERDIDA'
}

/** Cerrada no hay duda que valga: ganada es 100 y perdida 0. */
export function probabilidadEfectiva(etapa: EtapaOportunidad, pct: number | null): number {
  if (etapaOportunidadCerrada(etapa)) return PROBABILIDAD_POR_ETAPA[etapa]
  return pct ?? PROBABILIDAD_POR_ETAPA[etapa]
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
