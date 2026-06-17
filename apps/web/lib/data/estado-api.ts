'use client'

import { useDemoStore } from './store'
import type { Campana } from './types'

// ============================================================================
//  lib/data/estado-api.ts — Estado persistido (BD) → store, y mutaciones de
//  campañas/reservas. Tras cada escritura refresca todo el estado.
// ============================================================================

const API = '/spaces-dooh/api'

// Hidrata el store con lo que vive en la BD (sitios, clientes, campañas, ...).
export async function refrescarEstado(): Promise<void> {
  const r = await fetch(`${API}/estado/`, { cache: 'no-store' })
  if (!r.ok) return
  const e = await r.json()
  useDemoStore.setState({
    sitios: e.sitios ?? [],
    clientes: e.clientes ?? [],
    campanas: e.campanas ?? [],
    reservas: e.reservas ?? [],
    creatividades: e.creatividades ?? [],
  })
}

export async function reservarApi(input: {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
}): Promise<Campana> {
  const r = await fetch(`${API}/reservar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo reservar')
  await refrescarEstado()
  return d
}

export async function confirmarReservaApi(campanaId: string): Promise<Campana> {
  const r = await fetch(`${API}/campanas/${campanaId}/confirmar/`, { method: 'POST' })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo confirmar')
  await refrescarEstado()
  return d
}

export async function extenderCampanaApi(campanaId: string, fechaFin: string): Promise<Campana> {
  const r = await fetch(`${API}/campanas/${campanaId}/extender/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fechaFin }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo extender')
  await refrescarEstado()
  return d
}
