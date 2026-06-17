'use client'

import type { Sitio, ImportSummary } from './types'
import { refrescarEstado } from './estado-api'

// ============================================================================
//  lib/data/sitios-api.ts — Sitios contra la BD (route handlers /api/sitios).
//  Tras cada escritura refresca el ESTADO completo (sitios + campañas + …) para
//  que mapa, lista, network y dashboard reaccionen. basePath + trailingSlash.
// ============================================================================

const BASE = '/spaces-dooh/api/sitios'

// Refresco: recarga todo el estado persistido al store.
export const refrescarSitios = refrescarEstado

export async function altaSitioApi(input: unknown): Promise<Sitio> {
  const r = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el sitio')
  await refrescarSitios()
  return d
}

export async function importarSitiosApi(args: {
  filas: unknown[]
  modoDuplicado: 'ACTUALIZAR' | 'NUEVA_VERSION'
  precioM2: number | null
}): Promise<ImportSummary> {
  const r = await fetch(`${BASE}/import/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo importar')
  await refrescarSitios()
  return d
}

export async function toggleNetworkApi(id: string): Promise<void> {
  await fetch(`${BASE}/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toggleNetwork: true }),
  })
  await refrescarSitios()
}

export async function actualizarSitioApi(id: string, cambios: Record<string, unknown>): Promise<void> {
  await fetch(`${BASE}/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
  await refrescarSitios()
}

export async function borrarSitioApi(id: string): Promise<void> {
  await fetch(`${BASE}/${id}/`, { method: 'DELETE' })
  await refrescarSitios()
}
