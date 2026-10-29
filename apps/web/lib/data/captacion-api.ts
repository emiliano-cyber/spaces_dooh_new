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
import type { Competidor, Contacto, HijosNegociacion, Nota, Oferta } from '@/lib/server/negociacion-repo'
import type { Etapa, TipoProspecto, ContactoProspecto } from '@/lib/captacion'
import type { Canal, EstadoOferta, Visibilidad } from '@/lib/negociacion'

export type { Prospecto, Avance, Competidor, Contacto, Nota, Oferta }
/** El prospecto con su bitácora y, desde NEG-01, lo de Comercial negociación. */
export type ProspectoDetalle = Prospecto & { avances: Avance[] } & HijosNegociacion

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
  /** NEG-01: varios tipos a la vez. */
  tipos?: TipoProspecto[] | null
  pagina?: number
  porPagina?: number
}): Promise<PaginaProspectos> {
  const p = new URLSearchParams()
  if (filtro.etapas?.length) p.set('etapas', filtro.etapas.join(','))
  if (filtro.tipo) p.set('tipo', filtro.tipo)
  if (filtro.tipos?.length) p.set('tipos', filtro.tipos.join(','))
  if (filtro.porPagina) p.set('porPagina', String(filtro.porPagina))
  if (filtro.pagina) p.set('pagina', String(filtro.pagina))
  return leer(await fetch(`/spaces-dooh/api/captacion/?${p}`), 'No se pudieron leer los prospectos')
}

export async function prospectoApi(id: string): Promise<ProspectoDetalle> {
  return leer(await fetch(`/spaces-dooh/api/captacion/${id}/`), 'No se pudo leer el prospecto')
}

export async function crearProspectoApi(f: ProspectoForm): Promise<ProspectoDetalle> {
  return leer(await fetch('/spaces-dooh/api/captacion/', json('POST', f)), 'No se pudo dar de alta')
}

export async function editarProspectoApi(id: string, f: ProspectoForm): Promise<ProspectoDetalle> {
  // El tipo viaja porque el esquema lo pide, pero el servidor valida contra el
  // que ya tiene: cambiarlo no hace nada.
  const { nota: _nota, ...resto } = f
  return leer(await fetch(`/spaces-dooh/api/captacion/${id}/`, json('PATCH', resto)), 'No se pudo guardar')
}

export async function avanceApi(
  id: string,
  a: {
    etapa: Etapa
    nota: string
    siguientePaso?: string | null
    siguientePasoFecha?: string | null
    canal?: Canal | null
    contactoNombre?: string | null
  },
): Promise<ProspectoDetalle> {
  return leer(await fetch(`/spaces-dooh/api/captacion/${id}/avances/`, json('POST', a)), 'No se pudo registrar el avance')
}

export async function aprobarApi(id: string, confirmaNombreRepetido = false): Promise<ProspectoDetalle> {
  return leer(
    await fetch(`/spaces-dooh/api/captacion/${id}/decision/`, json('POST', { decision: 'APROBAR', confirmaNombreRepetido })),
    'No se pudo aprobar',
  )
}

export async function rechazarApi(id: string, motivo: string): Promise<ProspectoDetalle> {
  return leer(
    await fetch(`/spaces-dooh/api/captacion/${id}/decision/`, json('POST', { decision: 'RECHAZAR', motivo })),
    'No se pudo rechazar',
  )
}

// ─── NEG-01 · Comercial negociación ─────────────────────────────────────────
//  Todas devuelven el espacio entero, como el resto: la pantalla repinta con lo
//  que dice el servidor, no con lo que creía haber mandado.

const base = (id: string) => `/spaces-dooh/api/captacion/${id}`

export interface FichaForm {
  tipoEspacio?: string | null
  etapaResponsable?: number | null
  visibilidad?: Visibilidad | null
  anchoM?: number | null
  altoM?: number | null
  superficieM2?: number | null
  presupuestoMin?: number | null
  presupuestoMax?: number | null
  presupuestoAutoriza?: string | null
  ubicacion?: { lat: number; lng: number; origen: 'PIN' | 'BUSCADOR'; placeId?: string | null } | null
}

export async function fichaApi(id: string, f: FichaForm): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/ficha/`, json('PATCH', f)), 'No se pudo guardar la ficha')
}

export interface ContactoForm {
  nombre: string
  papel?: string | null
  telefono?: string | null
  email?: string | null
  esLegal?: boolean
}

export async function crearContactoApi(id: string, c: ContactoForm): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/contactos/`, json('POST', c)), 'No se pudo agregar el contacto')
}

export async function editarContactoApi(id: string, contactoId: string, c: Partial<ContactoForm>): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/contactos/${contactoId}/`, json('PATCH', c)), 'No se pudo guardar el contacto')
}

export async function borrarContactoApi(id: string, contactoId: string): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/contactos/${contactoId}/`, { method: 'DELETE' }), 'No se pudo quitar el contacto')
}

export async function crearOfertaApi(
  id: string,
  o: { importeMensual: number; plazoMeses: number; fecha?: string | null; estado?: EstadoOferta; notas?: string | null },
): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/ofertas/`, json('POST', o)), 'No se pudo registrar la oferta')
}

export async function editarOfertaApi(
  id: string,
  ofertaId: string,
  o: { estado?: EstadoOferta; notas?: string | null },
): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/ofertas/${ofertaId}/`, json('PATCH', o)), 'No se pudo cambiar la oferta')
}

export async function crearCompetidorApi(
  id: string,
  c: { nombre: string; nota?: string | null; desde?: string | null },
): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/competencia/`, json('POST', c)), 'No se pudo agregar')
}

export async function borrarCompetidorApi(id: string, competidorId: string): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/competencia/${competidorId}/`, { method: 'DELETE' }), 'No se pudo quitar')
}

export async function crearNotaApi(id: string, texto: string): Promise<ProspectoDetalle> {
  return leer(await fetch(`${base(id)}/notas/`, json('POST', { texto })), 'No se pudo guardar la nota')
}

export interface CandidatoDireccion {
  nombre: string
  lat: number
  lng: number
  /** Solo con el buscador de Google: lo que sus términos dejan guardar. */
  placeId?: string
}

/** `coordenadas` y `enlace`: lo pegó la persona (UBIC-01), no salió de un buscador. */
export type ProveedorGeo = 'osm' | 'google' | 'coordenadas' | 'enlace'

export async function buscarDireccionApi(q: string): Promise<{ proveedor: ProveedorGeo; resultados: CandidatoDireccion[] }> {
  return leer(
    await fetch(`/spaces-dooh/api/geo/buscar/?${new URLSearchParams({ q })}`),
    'No se pudo buscar la dirección',
  )
}
