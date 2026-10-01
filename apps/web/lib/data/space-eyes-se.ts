// Cliente de la puerta /api/space-eyes/se/... (ADR 0041): las pantallas del
// módulo Space Eyes hablan con el Space Eye de su instancia a través de aquí.
// Las rutas son las de Space Eye sin el /api inicial: seApi('devices'),
// seApi('photos?device_id=4'), seApi('schedules', { method: 'POST', body }).

const BASE = '/spaces-dooh/api/space-eyes/se'

export class ErrorSE extends Error {
  constructor(public status: number, public cuerpo: unknown, mensaje: string) {
    super(mensaje)
  }
}

export async function seApi<T = any>(ruta: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<T> {
  const [camino, consulta] = ruta.split('?')
  const url = `${BASE}/${camino.replace(/^\/+/, '')}/${consulta ? `?${consulta}` : ''}`
  const r = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.form ?? (init?.body !== undefined ? JSON.stringify(init.body) : undefined),
    cache: 'no-store',
  })
  const texto = await r.text()
  let cuerpo: any = null
  try { cuerpo = texto ? JSON.parse(texto) : null } catch { cuerpo = texto }
  if (!r.ok) {
    throw new ErrorSE(r.status, cuerpo, (cuerpo && (cuerpo.mensaje || cuerpo.error)) || `Space Eye respondió ${r.status}`)
  }
  return cuerpo as T
}

/** La URL de una foto de Space Eye, servida por esta aplicación (sin contenido mixto). */
export function fotoSE(ruta: string | null | undefined): string | null {
  if (!ruta) return null
  if (ruta.startsWith('/spaces-dooh/')) return ruta
  return `/spaces-dooh/api/space-eyes/foto/?p=${encodeURIComponent(ruta)}`
}

/** URL para descargar algo de Space Eye (un CSV de telemetría) por la misma puerta. */
export function urlSE(ruta: string): string {
  const [camino, consulta] = ruta.split('?')
  return `${BASE}/${camino.replace(/^\/+/, '')}/${consulta ? `?${consulta}` : ''}`
}
