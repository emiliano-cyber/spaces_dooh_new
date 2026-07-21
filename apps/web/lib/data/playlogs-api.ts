'use client'

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

export async function consultarPlaylogsApi(
  campanaId: string,
  desde: string,
  hasta: string,
): Promise<ConsultaPlay> {
  const r = await fetch(`${API}/campanas/${campanaId}/playlogs/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desde, hasta }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo consultar a DOOHmain')
  return d
}
