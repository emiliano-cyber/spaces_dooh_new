// ============================================================================
//  lib/doohmain-estado.ts — el estado de un creativo EN DOOHmain.
//
//  Cada creativo publicado es una campaña de DOOHmain (su `auth`). La API deja
//  leerla (`get_campaigns`) y cambiarle el `status` (`update_campaign`), pero
//  NO quitar el arte de la lista: pausar es la única forma reversible de
//  «bajar» un creativo del aire. `finished` no se ofrece aquí porque no tiene
//  vuelta — eso es retirar, y ya lo hace el DELETE del creativo.
//
//  La respuesta de `get_campaigns` solo está documentada como «objeto
//  key,value; el key es el auth». Lo que no se reconoce sale como `null` (no se
//  sabe), nunca como «al aire» por omisión: un estado inventado aquí es una
//  pantalla diciendo que algo se reproduce cuando nadie lo ha comprobado.
// ============================================================================

export const ESTADOS_REMOTOS = ['active', 'pause', 'finished', 'pending'] as const
export type EstadoRemoto = (typeof ESTADOS_REMOTOS)[number]

export const ETIQUETA_ESTADO_REMOTO: Record<EstadoRemoto, string> = {
  active: 'Al aire',
  pause: 'En pausa',
  finished: 'Finalizada',
  pending: 'Pendiente',
}

export interface CampanaRemota {
  estado: EstadoRemoto | null
  inicio: string | null
  fin: string | null
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function estadoDeCampanaRemota(payload: unknown, auth: string): CampanaRemota {
  const raiz = objeto(payload)
  // `create_campaign` responde envuelto en `success` (ver client.py); se acepta
  // igual aquí por si `get_campaigns` hace lo mismo.
  const datos = objeto(raiz?.[auth]) ?? objeto(objeto(raiz?.success)?.[auth])
  if (!datos) return { estado: null, inicio: null, fin: null }
  const status = texto(datos.status)?.toLowerCase() ?? null
  return {
    estado: (ESTADOS_REMOTOS as readonly string[]).includes(status ?? '') ? (status as EstadoRemoto) : null,
    inicio: texto(datos.start_date),
    fin: texto(datos.end_date),
  }
}

/** El `status` que se manda a DOOHmain para la acción pedida, o null si no vale. */
export function accionDoohmain(body: unknown): 'pause' | 'active' | null {
  const accion = objeto(body)?.accion
  if (accion === 'pausar') return 'pause'
  if (accion === 'reanudar') return 'active'
  return null
}
