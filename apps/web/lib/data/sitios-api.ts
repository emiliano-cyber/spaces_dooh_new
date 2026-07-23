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
  // Imágenes por código de proveedor (clave en minúsculas) → data URL base64.
  imagenes?: Record<string, string>
}): Promise<ImportSummary> {
  const r = await fetch(`${BASE}/import/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  // .catch evita "Unexpected end of JSON input" si el server respondió vacío (500).
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo importar')
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

// Cambio MASIVO de tarifa: aplica una tarifa nueva a varios sitios a la vez
// (mantiene sincronizadas mensual y publicada, igual que la ficha). Hace los
// PATCH en paralelo y refresca el estado UNA sola vez al final (no por sitio).
export async function actualizarTarifasApi(
  items: { id: string; tarifa: number }[],
): Promise<{ ok: number; fallidas: number }> {
  const res = await Promise.allSettled(
    items.map((it) =>
      fetch(`${BASE}/${it.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarifaMensual: it.tarifa, tarifaPublicada: it.tarifa }),
      }).then((r) => {
        if (!r.ok) throw new Error('patch falló')
      }),
    ),
  )
  const ok = res.filter((r) => r.status === 'fulfilled').length
  await refrescarSitios()
  return { ok, fallidas: items.length - ok }
}

export async function borrarSitioApi(id: string): Promise<void> {
  await fetch(`${BASE}/${id}/`, { method: 'DELETE' })
  await refrescarSitios()
}

// Pausa legal: saca la pantalla de la disponibilidad comercial con un motivo.
export async function pausarSitioLegalApi(id: string, motivo: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}/pausa-legal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo pausar')
  }
  await refrescarSitios()
}

export async function reanudarSitioLegalApi(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}/pausa-legal/`, { method: 'DELETE' })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo reanudar')
  }
  await refrescarSitios()
}
