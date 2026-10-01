// ============================================================================
//  lib/data/codigo-aprobacion-api.ts — el cliente HTTP de la APROBACIÓN del
//  cupón de una propuesta.  COD-03.
// ----------------------------------------------------------------------------
//  Archivo APARTE de `codigos-api.ts` a propósito: ése lo está retocando otra
//  rama (`fix/api-prefijo`) para poner el prefijo del basePath, y lo que se
//  añade aquí no tiene por qué chocar con aquello.
//
//  ⚠️ EL PREFIJO `/spaces-dooh/api` VA ESCRITO. No hay ningún parche que añada
//  el `basePath` de Next a `fetch`: una llamada del navegador a `/api/...` a
//  secas da 404 (medido el 30/09 con Playwright contra el 3490). Las e2e no lo
//  ven porque llaman a la API con el prefijo ya puesto.
//
//  EL `r.ok` NO SE BORRA, por el mismo motivo que en `codigos-api.ts`: un 403
//  o un 409 tragado haría que la pantalla dijera «aprobado» con el cupón
//  todavía pendiente — y el vendedor le diría al cliente que ya lo tiene.
// ============================================================================

const API = '/spaces-dooh/api'

export type EstadoCodigoUI = 'PENDIENTE' | 'APROBADO'

export type CodigoDePropuestaUI = {
  estatus: string
  codigoTexto: string | null
  codigoDescuentoPct: number
  codigoEstado: EstadoCodigoUI | null
  /** Nombre de quien lo aprobó. `null` con APROBADO = se aprobó solo (backfill). */
  codigoAprobadoPor: string | null
  codigoAprobadoEn: string | null
  /** Lo calcula el SERVIDOR con `comercial.aprobar`: no se decide mirando el rol aquí. */
  puedeAprobarCodigo: boolean
}

async function fallar(r: Response, porOmision: string): Promise<never> {
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? porOmision)
}

/** El cupón de la propuesta, su estado y si quien mira puede decidir. */
export async function codigoDePropuestaApi(propuestaId: string): Promise<CodigoDePropuestaUI> {
  const r = await fetch(`${API}/propuestas/${propuestaId}/codigo/`, { cache: 'no-store' })
  if (!r.ok) return fallar(r, 'No se pudo leer el código de la propuesta')
  return r.json()
}

/**
 * Aprueba o rechaza el cupón PENDIENTE. Solo viaja la decisión (y el motivo al
 * rechazar): quién decide lo pone el servidor desde la sesión.
 */
export async function decidirCodigoApi(
  propuestaId: string,
  d: { decision: 'APROBAR' } | { decision: 'RECHAZAR'; motivo: string },
): Promise<{ decision: string; codigo: string; descuentoPct: number }> {
  const r = await fetch(`${API}/propuestas/${propuestaId}/codigo/decision/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(d),
  })
  if (!r.ok) return fallar(r, 'No se pudo registrar la decisión sobre el código')
  return r.json()
}
