import { AVISO_FRANJA_NO_VIAJA_AL_CMS } from '@/lib/rejilla'

// ============================================================================
//  lib/data/rejilla-api.ts — el cliente HTTP del catálogo de franjas y
//  temporadas y de la rejilla de una pantalla.  ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  EL `r.ok` NO SE BORRA DE NINGUNA DE ESTAS FUNCIONES, por el mismo motivo
//  escrito en `sitios-api.ts`: sin él, un 403 del candado se resolvería como
//  éxito y la pantalla cantaría «guardado» con las tarifas intactas. El mensaje
//  se devuelve TAL CUAL lo manda el servidor porque `esErrorDeDesbloqueo` lo
//  reconoce por texto; sustituirlo por uno propio dejaría el 403 como error
//  rojo, sin cuadro donde teclear la contraseña.
// ============================================================================

export type FranjaUI = {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
  orden: number
  activo: boolean
}

export type TemporadaUI = {
  id: string
  nombre: string
  desde: string
  hasta: string
  activo: boolean
}

export type FilaRejillaUI = {
  unidad: string
  franjaId: string | null
  franjaNombre: string | null
  temporadaId: string | null
  temporadaNombre: string | null
  tarifaPublicada: number
}

/** Se reexporta para que ninguna pantalla tenga que escribir el aviso a mano. */
export { AVISO_FRANJA_NO_VIAJA_AL_CMS }

async function fallar(r: Response, porOmision: string): Promise<never> {
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? porOmision)
}

/** El catálogo entero. `inactivas` solo lo pide la pantalla que lo administra. */
export async function catalogoRejillaApi(
  inactivas = false,
): Promise<{ franjas: FranjaUI[]; temporadas: TemporadaUI[] }> {
  const r = await fetch(`/api/rejilla/franjas/${inactivas ? '?inactivas=1' : ''}`)
  if (!r.ok) return fallar(r, 'No se pudo leer el catálogo de franjas')
  return r.json()
}

export async function guardarFranjaApi(f: Partial<FranjaUI>): Promise<FranjaUI> {
  const r = await fetch(f.id ? `/api/rejilla/franjas/${f.id}/` : '/api/rejilla/franjas/', {
    method: f.id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f),
  })
  if (!r.ok) return fallar(r, 'No se pudo guardar la franja')
  return r.json()
}

export async function bajaFranjaApi(id: string): Promise<void> {
  const r = await fetch(`/api/rejilla/franjas/${id}/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo dar de baja la franja')
}

export async function guardarTemporadaApi(t: Partial<TemporadaUI>): Promise<TemporadaUI> {
  const r = await fetch(t.id ? `/api/rejilla/temporadas/${t.id}/` : '/api/rejilla/temporadas/', {
    method: t.id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(t),
  })
  if (!r.ok) return fallar(r, 'No se pudo guardar la temporada')
  return r.json()
}

export async function bajaTemporadaApi(id: string): Promise<void> {
  const r = await fetch(`/api/rejilla/temporadas/${id}/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo dar de baja la temporada')
}

export async function rejillaDeSitioApi(sitioId: string): Promise<FilaRejillaUI[]> {
  const r = await fetch(`/api/sitios/${sitioId}/rejilla/`)
  if (!r.ok) return fallar(r, 'No se pudo leer la rejilla de tarifas')
  return (await r.json()).rejilla ?? []
}

/**
 * Aplica un DIFF. `quitar` viaja EXPLÍCITO en vez de deducirse de lo que falta
 * en `guardar`: el servidor no borra lo que no viene (`actualizarRejilla`), así
 * que una baja hay que pedirla. Deducirla sería reintroducir el borrado en
 * bloque por la puerta del cliente.
 */
export async function actualizarRejillaApi(
  sitioId: string,
  cambios: {
    guardar?: { unidad: string; franjaId: string | null; temporadaId: string | null; tarifaPublicada: number }[]
    quitar?: { unidad: string; franjaId: string | null; temporadaId: string | null }[]
  },
): Promise<FilaRejillaUI[]> {
  const r = await fetch(`/api/sitios/${sitioId}/rejilla/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
  if (!r.ok) return fallar(r, 'No se pudieron guardar las tarifas por franja')
  return (await r.json()).rejilla ?? []
}
