import type { Valla, GrupoVallas, CategoriaCompetencia, ModoGrupo } from '@/lib/vallas/tipos'
import type { ResultadoReglas } from '@/lib/vallas/reglas/tipos'
import type { OcupacionSitio } from '@/lib/vallas/plano'

// ============================================================================
//  lib/data/vallas-api.ts — VALLAS (esqueleto, 19/11). Llamadas del navegador
//  a `/api/vallas/**`. Aparte de `estado-api.ts` a propósito: las vallas no
//  viajan en la hidratación (`/api/estado`); la pantalla las pide al abrirse.
// ============================================================================

const API = '/spaces-dooh/api/vallas'

async function pedir<T>(ruta: string, porOmision: string, init?: { method: string; body?: unknown }): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? porOmision)
  return d as T
}

export type DatosVallaApi = { sitioId: string; numero: string; ancho: number; alto: number; cara?: number | null; notas?: string | null }
export type DatosGrupoApi = {
  numero: string
  nombre?: string | null
  modo: ModoGrupo
  ancho?: number | null
  alto?: number | null
  vallaIds: string[]
}

export const listarVallasApi = () => pedir<{ vallas: Valla[]; grupos: GrupoVallas[] }>('/', 'No se pudieron cargar las vallas')
export const crearVallaApi = (d: DatosVallaApi) => pedir<Valla>('/', 'No se pudo guardar', { method: 'POST', body: d })
export const actualizarVallaApi = (id: string, d: Partial<DatosVallaApi>) =>
  pedir<Valla>(`/${id}/`, 'No se pudo guardar', { method: 'PATCH', body: d })
export const borrarVallaApi = (id: string) => pedir<{ ok: true }>(`/${id}/`, 'No se pudo borrar', { method: 'DELETE' })

export const crearGrupoApi = (d: DatosGrupoApi) => pedir<GrupoVallas>('/grupos/', 'No se pudo guardar', { method: 'POST', body: d })
export const actualizarGrupoApi = (id: string, d: Partial<DatosGrupoApi>) =>
  pedir<GrupoVallas>(`/grupos/${id}/`, 'No se pudo guardar', { method: 'PATCH', body: d })
export const borrarGrupoApi = (id: string) => pedir<{ ok: true }>(`/grupos/${id}/`, 'No se pudo borrar', { method: 'DELETE' })

export const listarCategoriasApi = () => pedir<CategoriaCompetencia[]>('/competencia/', 'No se pudieron cargar las vallas')
export const crearCategoriaApi = (d: { nombre: string; marcas: string[] }) =>
  pedir<CategoriaCompetencia>('/competencia/', 'No se pudo guardar', { method: 'POST', body: d })
export const actualizarCategoriaApi = (id: string, d: { nombre?: string; marcas?: string[]; activo?: boolean }) =>
  pedir<CategoriaCompetencia>(`/competencia/${id}/`, 'No se pudo guardar', { method: 'PATCH', body: d })

export const verificarVallasApi = (d: { marca: string; fechaInicio: string; fechaFin: string; vallaIds?: string[]; sitioIds?: string[] }) =>
  pedir<ResultadoReglas>('/verificar/', 'No se pudo verificar', { method: 'POST', body: d })

export const ocupacionVallasApi = (desde: string, hasta: string) =>
  pedir<{ desde: string; hasta: string; ocupaciones: OcupacionSitio[] }>(
    `/ocupacion/?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    'No se pudieron cargar las vallas',
  )
