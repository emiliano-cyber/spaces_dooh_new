// ============================================================================
//  lib/data/captacion-api.ts — La bitácora de captación vista desde el
//  navegador.  CAP-01.
// ----------------------------------------------------------------------------
//  Los tipos NO se copian: se importan del repo con `import type`, que se borra
//  al compilar y no arrastra nada del servidor. Una sola definición de qué es
//  un prospecto, para la API y para la pantalla — dos copias divergen.
//
//  Ninguna función manda `usuarioId`, `etapa` en el alta, `decididoPor` ni
//  `registroId`: los esquemas del servidor son `.strict()` y los rechazarían.
// ============================================================================

import type { Prospecto, Avance } from '@/lib/server/captacion-repo'
import type { Etapa, TipoProspecto, ContactoProspecto } from '@/lib/captacion'

export type { Prospecto, Avance }
export type ProspectoDetalle = Prospecto & { avances: Avance[] }

export interface PaginaProspectos {
  prospectos: Prospecto[]
  total: number
  /** Cuántos hay en cada etapa, con los filtros de vendedor y tipo. */
  porEtapa: Partial<Record<Etapa, number>>
  pagina: number
  porPagina: number
  /** Si quien mira puede aprobar: ve a todo el equipo y decide. */
  puedeAprobar: boolean
}

export interface ProspectoForm {
  tipo: TipoProspecto
  nombre: string
  contacto: ContactoProspecto
  direccion: string | null
  datos: Record<string, unknown>
  siguientePaso: string | null
  siguientePasoFecha: string | null
  nota?: string | null
}

/** Un error de la API con su código, para distinguir un 409 de duplicado. */
export class ErrorApi extends Error {
  constructor(mensaje: string, public status: number) {
    super(mensaje)
  }
}

async function leer<T>(r: Response, porOmision: string): Promise<T> {
  if (r.ok) return r.json() as Promise<T>
  const d = await r.json().catch(() => ({}))
  throw new ErrorApi((d as { error?: string }).error ?? porOmision, r.status)
}

const json = (metodo: string, cuerpo: unknown): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(cuerpo),
})

export async function prospectosApi(filtro: {
  etapas?: Etapa[] | null
  tipo?: TipoProspecto | null
  pagina?: number
}): Promise<PaginaProspectos> {
  const p = new URLSearchParams()
  if (filtro.etapas?.length) p.set('etapas', filtro.etapas.join(','))
  if (filtro.tipo) p.set('tipo', filtro.tipo)
  if (filtro.pagina) p.set('pagina', String(filtro.pagina))
  return leer(await fetch(`/api/captacion/?${p}`), 'No se pudieron leer los prospectos')
}

export async function prospectoApi(id: string): Promise<ProspectoDetalle> {
  return leer(await fetch(`/api/captacion/${id}/`), 'No se pudo leer el prospecto')
}

export async function crearProspectoApi(f: ProspectoForm): Promise<ProspectoDetalle> {
  return leer(await fetch('/api/captacion/', json('POST', f)), 'No se pudo dar de alta')
}

export async function editarProspectoApi(id: string, f: ProspectoForm): Promise<ProspectoDetalle> {
  // El tipo viaja porque el esquema lo pide, pero el servidor valida contra el
  // que ya tiene: cambiarlo no hace nada.
  const { nota: _nota, ...resto } = f
  return leer(await fetch(`/api/captacion/${id}/`, json('PATCH', resto)), 'No se pudo guardar')
}

export async function avanceApi(
  id: string,
  a: { etapa: Etapa; nota: string; siguientePaso?: string | null; siguientePasoFecha?: string | null },
): Promise<ProspectoDetalle> {
  return leer(await fetch(`/api/captacion/${id}/avances/`, json('POST', a)), 'No se pudo registrar el avance')
}

export async function aprobarApi(id: string, confirmaNombreRepetido = false): Promise<ProspectoDetalle> {
  return leer(
    await fetch(`/api/captacion/${id}/decision/`, json('POST', { decision: 'APROBAR', confirmaNombreRepetido })),
    'No se pudo aprobar',
  )
}

export async function rechazarApi(id: string, motivo: string): Promise<ProspectoDetalle> {
  return leer(
    await fetch(`/api/captacion/${id}/decision/`, json('POST', { decision: 'RECHAZAR', motivo })),
    'No se pudo rechazar',
  )
}
