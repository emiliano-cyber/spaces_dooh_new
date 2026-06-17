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
    ordenesTrabajo: e.ordenesTrabajo ?? [],
    evidencias: e.evidencias ?? [],
    facturas: e.facturas ?? [],
    cobranzas: e.cobranzas ?? [],
    acciones: e.acciones ?? [],
  })
}

// ─── Finanzas (facturación + cobranza) ──────────────────────────────────────
export async function generarFacturaApi(campanaId: string, plazoDias: 60 | 90 | 120): Promise<void> {
  const r = await fetch(`${API}/campanas/${campanaId}/facturar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plazoDias }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo generar la factura')
  await refrescarEstado()
}

export async function pagarCobranzaApi(cobranzaId: string): Promise<void> {
  const r = await fetch(`${API}/cobranzas/${cobranzaId}/pagar/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar el pago')
  await refrescarEstado()
}

// ─── Operaciones (OT + evidencias/testigos) ─────────────────────────────────
export async function crearOTApi(input: {
  tipo: string; sitioId?: string | null; campanaId?: string | null
  descripcion: string; prioridad?: string; asignadoA?: string | null; checklist?: unknown[]
}): Promise<void> {
  const r = await fetch(`${API}/ot/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la OT')
  await refrescarEstado()
}

// Cierre desde la vista móvil (standalone): no refresca el store del shell.
export async function getOTApi(id: string) {
  const r = await fetch(`${API}/ot/${id}/`, { cache: 'no-store' })
  if (!r.ok) return null
  return r.json()
}
export async function cerrarOTApi(
  id: string,
  input: { fotoUrl: string; tomadaEn?: string; lat?: number; lng?: number },
): Promise<void> {
  const r = await fetch(`${API}/ot/${id}/cerrar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo cerrar la OT')
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
