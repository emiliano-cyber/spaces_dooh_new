'use client'
import type { EstadoRemoto } from '@/lib/doohmain-estado'

// ============================================================================
//  lib/data/playlogs-api.ts — Proof of play (reproducciones en DOOHmain).
//  El servidor guarda la respuesta CRUDA de DOOHmain; aquí no se interpreta el
//  contenido, solo se sabe si vino vacía. Ver lib/server/playlogs-repo.ts.
// ============================================================================

const API = '/spaces-dooh/api'

export interface ConsultaPlay {
  id: string
  tipo: string
  campanaId: string | null
  auths: string[]
  pantallas: string[]
  desde: string
  hasta: string
  payload: unknown
  vacio: boolean
  error: string | null
  consultadoEn: string
}

export interface PlaylogsCampana {
  consultas: ConsultaPlay[]
  publicadaEnDoohmain: boolean
}

export async function playlogsDeCampanaApi(campanaId: string): Promise<PlaylogsCampana> {
  const r = await fetch(`${API}/campanas/${campanaId}/playlogs/`, { cache: 'no-store' })
  if (!r.ok) throw new Error('No se pudieron leer las consultas')
  return r.json()
}

// `campana`: reproducciones de esta campaña (get_stats), la prueba de cobro.
// `pantallas`: historial de las pantallas donde se publicó (get_metrics), que
// incluye lo de otras campañas y por eso no cuenta como prueba de ésta.
export type TipoConsultaPlay = 'campana' | 'pantallas'

export async function consultarPlaylogsApi(
  campanaId: string,
  desde: string,
  hasta: string,
  tipo: TipoConsultaPlay = 'campana',
): Promise<ConsultaPlay> {
  const r = await fetch(`${API}/campanas/${campanaId}/playlogs/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desde, hasta, tipo }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo consultar a DOOHmain')
  return d
}

// ─── El creativo EN DOOHmain: estado y pausa (29/10) ────────────────────────

export interface CreativoEnDoohmain {
  creativoId: string
  nombre: string
  auth: string
  pantallas: string[]
  /** null = no se sabe (DOOHmain no contestó o no lo reconocemos). */
  estado: EstadoRemoto | null
  inicio: string | null
  fin: string | null
}

export interface EstadoDoohmainCampana {
  habilitado: boolean
  creativos: CreativoEnDoohmain[]
  error: string | null
}

export async function estadoDoohmainApi(campanaId: string): Promise<EstadoDoohmainCampana> {
  const r = await fetch(`${API}/campanas/${campanaId}/doohmain-estado/`, { cache: 'no-store' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo leer el estado en DOOHmain')
  return d
}

export async function cambiarEstadoDoohmainApi(
  creativoId: string,
  accion: 'pausar' | 'reanudar',
): Promise<{ ok: true; estado: 'pause' | 'active' }> {
  const r = await fetch(`${API}/creatividades/${creativoId}/doohmain/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo cambiar en DOOHmain')
  return d
}
