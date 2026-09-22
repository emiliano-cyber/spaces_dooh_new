'use client'

// ============================================================================
//  lib/data/actualizaciones-api.ts — Actualizacion elegida por instancia.
//  ADR 0037. El tipo vive aqui (y no en lib/server/) porque lo consume un
//  componente de CLIENTE (tarea 4): si viviera en lib/server/ arrastraria `pg`
//  al bundle del navegador, igual que lib/data/cambios-api.ts.
// ============================================================================

export interface EstadoActualizacion {
  modo: 'automatica' | 'aprobacion'
  versionInstalada: string | null
  versionDisponible: string | null
  digestDisponible: string | null
  migracionesPendientes: number | null
  comprobadoEn: string | null
  aprobadoDigest: string | null
  // digestDisponible existe y es distinto del instalado (lo calcula el
  // servidor; ver `route.ts:aEstado`, no se recalcula aqui).
  hayNovedad: boolean
}

const API = '/spaces-dooh/api'

async function jsonOk(r: Response) {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Error')
  return d
}

export async function getEstadoActualizacionApi(): Promise<EstadoActualizacion> {
  return jsonOk(await fetch(`${API}/actualizaciones/`, { cache: 'no-store' }))
}

// Las dos escrituras son mutuamente excluyentes en el servidor (XOR,
// `route.ts:patchSchema`): SIEMPRE se manda una, nunca las dos. Por eso son
// dos funciones y no una con dos campos opcionales — mezclarlas invitaria a
// mandar el PATCH combinado que el servidor ya rechaza con 400.
export async function fijarModoActualizacionApi(modo: EstadoActualizacion['modo']): Promise<EstadoActualizacion> {
  return jsonOk(
    await fetch(`${API}/actualizaciones/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo }),
    }),
  )
}

export async function aprobarActualizacionApi(digest: string): Promise<EstadoActualizacion> {
  return jsonOk(
    await fetch(`${API}/actualizaciones/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprobarDigest: digest }),
    }),
  )
}
