// ============================================================================
//  lib/doohmain-estado.ts — el estado de un creativo EN DOOHmain.
//
//  Cada creativo publicado es una campaña de DOOHmain (su `auth`). La API deja
//  leerla (`get_campaigns`) y cambiarle el `status` (`update_campaign`), pero
//  NO quitar el arte de la lista: pausar es la única forma reversible de
//  «bajar» un creativo del aire. `finished` no se ofrece aquí porque no tiene
//  vuelta — eso es retirar, y ya lo hace el DELETE del creativo.
//
//  Lo que no se reconoce sale como `null` (no se sabe), nunca como «al aire»
//  por omisión: un estado inventado aquí es una pantalla diciendo que algo se
//  reproduce cuando nadie lo ha comprobado.
//
//  29/10, medido contra la pantalla de pruebas `adv_004`: DOOHmain NO toca el
//  `status` cuando pasan las fechas. Con el fin en el pasado o el inicio en el
//  futuro sigue diciendo `active`. Por eso el estado que se ENSEÑA no es el
//  `status` crudo: un `active` fuera de sus fechas es «Terminó» o
//  «Programada». Y si alguien la borra en el panel, viene `deleted: "1"`.
// ============================================================================

export const ESTADOS_REMOTOS = ['active', 'pause', 'finished', 'pending'] as const
export type StatusDoohmain = (typeof ESTADOS_REMOTOS)[number]

/** El `status` de DOOHmain, o lo que de verdad pasa cuando ese status engaña. */
export type EstadoRemoto = StatusDoohmain | 'vencida' | 'programada' | 'eliminada' | 'no_encontrada'

export const ETIQUETA_ESTADO_REMOTO: Record<EstadoRemoto, string> = {
  active: 'Al aire',
  pause: 'En pausa',
  finished: 'Finalizada',
  pending: 'Pendiente',
  vencida: 'Terminó',
  programada: 'Programada',
  eliminada: 'Eliminada en DOOHmain',
  no_encontrada: 'No está en DOOHmain',
}

export interface CampanaRemota {
  estado: EstadoRemoto | null
  inicio: string | null
  fin: string | null
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

const NADA: CampanaRemota = { estado: null, inicio: null, fin: null }

/**
 * Lee el estado de la campaña `auth` en la respuesta de `get_campaigns`.
 * `hoy` (YYYY-MM-DD, hora de México) es lo que permite corregir un `active`
 * fuera de fechas; sin él se devuelve el `status` tal cual.
 */
export function estadoDeCampanaRemota(payload: unknown, auth: string, hoy?: string): CampanaRemota {
  const raiz = objeto(payload)
  // 29/10, contra adv_004: DOOHmain contesta `{ campaigns: { <auth>: {...} } }`,
  // envuelto, aunque el PDF diga «el key es el auth». Con solo las dos formas de
  // abajo, la ficha decía «Sin confirmar» siempre — la pausa funcionaba y no se
  // veía. Las otras dos se quedan: `create_campaign` sí responde en `success`.
  const datos =
    objeto(objeto(raiz?.campaigns)?.[auth]) ?? objeto(raiz?.[auth]) ?? objeto(objeto(raiz?.success)?.[auth])
  if (!datos) {
    // Contestó con la lista (forma conocida) y este auth no está: la borraron
    // o no es de esta cuenta. Eso SÍ se sabe, y no es «sin confirmar». `[]` es
    // como PHP serializa una lista vacía.
    const lista = raiz?.campaigns
    const listaConocida = objeto(lista) !== null || (Array.isArray(lista) && lista.length === 0)
    return listaConocida ? { ...NADA, estado: 'no_encontrada' } : NADA
  }
  const inicio = texto(datos.start_date)
  const fin = texto(datos.end_date)
  const status = texto(datos.status)?.toLowerCase() ?? ''
  if (String(datos.deleted ?? '0').trim() === '1') return { estado: 'eliminada', inicio, fin }
  if (!(ESTADOS_REMOTOS as readonly string[]).includes(status)) return { estado: null, inicio, fin }
  let estado: EstadoRemoto = status as StatusDoohmain
  // Solo se corrige un `active`: una pausa o una finalizada las puso alguien a
  // propósito y se enseñan tal cual. Las fechas son YYYY-MM-DD y se comparan
  // como texto; el primer y el último día cuentan como al aire.
  if (estado === 'active' && hoy) {
    if (fin && fin < hoy) estado = 'vencida'
    else if (inicio && inicio > hoy) estado = 'programada'
  }
  return { estado, inicio, fin }
}

/** Qué se puede hacer con un creativo en cada estado. `null` = no se sabe: las dos. */
export function accionesDoohmain(estado: EstadoRemoto | null): Array<'pausar' | 'reanudar'> {
  switch (estado) {
    case 'active':
    case 'programada':
      return ['pausar']
    case 'pause':
      return ['reanudar']
    case 'pending':
    case null:
      return ['pausar', 'reanudar']
    default:
      // finished, vencida, eliminada, no_encontrada: reanudar no la vuelve al
      // aire (o no hay nada que reanudar), y ofrecerlo sería prometerlo.
      return []
  }
}

/** Hoy en México, YYYY-MM-DD: las fechas de DOOHmain son de calendario local. */
export function hoyEnMexico(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora)
}

/** El `status` que se manda a DOOHmain para la acción pedida, o null si no vale. */
export function accionDoohmain(body: unknown): 'pause' | 'active' | null {
  const accion = objeto(body)?.accion
  if (accion === 'pausar') return 'pause'
  if (accion === 'reanudar') return 'active'
  return null
}
