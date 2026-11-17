import type { Actividad, CambioPropuesta, Oportunidad, PropuestaLigada } from '@/lib/server/oportunidades-repo'
import type { EtapaOportunidad, TipoActividad } from '@/lib/crm'

// ============================================================================
//  lib/data/oportunidades-api.ts — Lo que la pantalla del CRM le pide al
//  servidor.  ADR 0051, Fase 4.
// ----------------------------------------------------------------------------
//  Misma forma que `captacion-api.ts`: los tipos salen del repo (solo tipos,
//  nada de servidor viaja al navegador) y los errores llegan con su status.
//  El vendedor y el autor NO se mandan nunca: los pone el servidor.
// ============================================================================

export type { Actividad, CambioPropuesta, Oportunidad, PropuestaLigada }

export interface AvanceProspecto {
  id: string
  usuarioNombre: string | null
  etapaAnterior: string | null
  etapaNueva: string
  nota: string
  canal: string | null
  creadoEn: string
}

export type FichaOportunidad = Oportunidad & {
  actividades: Actividad[]
  propuestas: PropuestaLigada[]
  cambios: CambioPropuesta[]
  avancesProspecto: AvanceProspecto[]
  /** La probabilidad por etapa de la instancia (ADR 0051, pregunta 3). */
  probabilidades?: Record<EtapaOportunidad, number>
}

export interface PaginaOportunidades {
  oportunidades: Oportunidad[]
  total: number
  porEtapa: Partial<Record<EtapaOportunidad, number>>
  pagina: number
  porPagina: number
  /** Si quien mira tiene `comercial.aprobar`: ve las de todo el equipo. */
  veTodas: boolean
  /** La probabilidad por etapa de la instancia (ADR 0051, pregunta 3). */
  probabilidades?: Record<EtapaOportunidad, number>
}

export interface DatosOportunidadForm {
  nombre: string
  presupuestoMin: number | null
  presupuestoMax: number | null
  fechaInicioDeseada: string | null
  fechaFinDeseada: string | null
  fechaDecision: string | null
  plazas: string | null
  tiposMedio: string[]
  objetivo: string | null
  probabilidadPct: number | null
}

export class ErrorApiCrm extends Error {
  constructor(mensaje: string, public status: number) {
    super(mensaje)
  }
}

async function leer<T>(r: Response, porOmision: string): Promise<T> {
  if (r.ok) return r.json() as Promise<T>
  const d = await r.json().catch(() => ({}))
  throw new ErrorApiCrm((d as { error?: string }).error ?? porOmision, r.status)
}

const json = (metodo: string, cuerpo: unknown): RequestInit => ({
  method: metodo,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(cuerpo),
})

const BASE = '/spaces-dooh/api/oportunidades'

export async function oportunidadesApi(filtro: {
  etapas?: EtapaOportunidad[] | null
  clienteId?: string | null
  pagina?: number
  porPagina?: number
} = {}): Promise<PaginaOportunidades> {
  const p = new URLSearchParams()
  if (filtro.etapas?.length) p.set('etapas', filtro.etapas.join(','))
  if (filtro.clienteId) p.set('clienteId', filtro.clienteId)
  if (filtro.pagina) p.set('pagina', String(filtro.pagina))
  p.set('porPagina', String(filtro.porPagina ?? 100))
  return leer(await fetch(`${BASE}/?${p}`), 'No se pudieron leer las oportunidades')
}

export async function oportunidadApi(id: string): Promise<FichaOportunidad> {
  return leer(await fetch(`${BASE}/${id}/`), 'No se pudo leer la oportunidad')
}

export async function crearOportunidadApi(
  d: DatosOportunidadForm & { clienteId: string | null; prospectoId: string | null; nota: string | null },
): Promise<FichaOportunidad> {
  return leer(await fetch(`${BASE}/`, json('POST', d)), 'No se pudo crear la oportunidad')
}

export async function editarOportunidadApi(id: string, d: Partial<DatosOportunidadForm>): Promise<FichaOportunidad> {
  return leer(await fetch(`${BASE}/${id}/`, json('PATCH', d)), 'No se pudo guardar')
}

export async function cambiarEtapaApi(
  id: string,
  d: { etapa: EtapaOportunidad; nota?: string | null; motivoPerdida?: string | null },
): Promise<FichaOportunidad> {
  return leer(await fetch(`${BASE}/${id}/etapa/`, json('POST', d)), 'No se pudo cambiar la etapa')
}

export async function registrarActividadApi(
  id: string,
  d: { tipo: Exclude<TipoActividad, 'ETAPA'>; nota: string; siguientePaso?: string | null; siguientePasoFecha?: string | null },
): Promise<FichaOportunidad> {
  return leer(await fetch(`${BASE}/${id}/actividades/`, json('POST', d)), 'No se pudo guardar la actividad')
}

/** Liga (o desliga, con null) una propuesta a una oportunidad. */
export async function ligarPropuestaApi(propuestaId: string, oportunidadId: string | null): Promise<void> {
  await leer(
    await fetch(`/spaces-dooh/api/propuestas/${propuestaId}/`, json('PATCH', { oportunidadId })),
    'No se pudo ligar la propuesta',
  )
}
