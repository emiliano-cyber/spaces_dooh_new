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
    ordenesImpresion: e.ordenesImpresion ?? [],
    acciones: e.acciones ?? [],
    arrendadores: e.arrendadores ?? [],
    contratos: e.contratos ?? [],
    pagosRenta: e.pagosRenta ?? [],
    incidencias: e.incidencias ?? [],
    propuestas: e.propuestas ?? [],
    ordenesCompra: e.ordenesCompra ?? [],
  })
}

// ─── Propuestas (método del divisor) ─────────────────────────────────────────
export async function crearPropuestaApi(input: {
  clienteId?: string | null
  nombre: string
  comisionPct?: number
  fechaInicio: string
  fechaFin: string
  items: { sitioId: string; precio: number }[]
  notas?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/propuestas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la propuesta')
  await refrescarEstado()
}

export async function cambiarEstatusPropuestaApi(id: string, estatus: string): Promise<void> {
  const r = await fetch(`${API}/propuestas/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estatus }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar la propuesta')
  await refrescarEstado()
}

// Aprobación granular: aprueba/desaprueba un sitio de la propuesta.
export async function aprobarItemPropuestaApi(itemId: string, aprobado: boolean): Promise<void> {
  const r = await fetch(`${API}/propuestas/items/${itemId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobado }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar el sitio')
  await refrescarEstado()
}

// ─── Clientes (CRUD con datos fiscales) ──────────────────────────────────────
export interface ClienteInput {
  nombre: string
  rfc?: string | null
  razonSocial?: string | null
  regimenFiscal?: string | null
  cpFiscal?: string | null
  usoCfdi?: string | null
  tipo?: string
  contacto?: { nombre?: string; email?: string; telefono?: string }
}

export async function crearClienteApi(input: ClienteInput): Promise<void> {
  const r = await fetch(`${API}/clientes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el cliente')
  await refrescarEstado()
}

export async function actualizarClienteApi(id: string, input: Partial<ClienteInput>): Promise<void> {
  const r = await fetch(`${API}/clientes/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar el cliente')
  await refrescarEstado()
}

// ─── Arrendadores / incidencias (antes mock; ahora persisten en la BD) ───────
export async function registrarPagoRentaApi(pagoId: string): Promise<void> {
  const r = await fetch(`${API}/pagos-renta/${pagoId}/pagar/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar el pago')
  await refrescarEstado()
}

export async function iniciarRenovacionApi(contratoId: string): Promise<void> {
  const r = await fetch(`${API}/contratos/${contratoId}/renovar/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo iniciar la renovación')
  await refrescarEstado()
}

export async function reportarIncidenciaApi(input: {
  sitioId: string; tipo: string; descripcion: string
}): Promise<void> {
  const r = await fetch(`${API}/incidencias/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo reportar la incidencia')
  await refrescarEstado()
}

// ─── Imprenta (órdenes de impresión + OC) ───────────────────────────────────
export async function crearOrdenImpresionApi(input: {
  campanaId: string; sitioId?: string | null; material?: string
  alto?: number; ancho?: number; proveedor?: string
}): Promise<void> {
  const r = await fetch(`${API}/impresion/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la orden de impresión')
  await refrescarEstado()
}

export async function avanzarOrdenImpresionApi(id: string): Promise<void> {
  const r = await fetch(`${API}/impresion/${id}/`, { method: 'PATCH' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo avanzar la orden')
  await refrescarEstado()
}

// Registra una Orden de Compra (ODC) del cliente como entidad real y abre el
// candado de facturación (oc_recibida). Reemplaza a marcarOCApi en el flujo.
export async function crearOrdenCompraApi(input: {
  campanaId: string; monto?: number | null; documentoUrl?: string | null; notas?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/ordenes-compra/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la ODC')
  await refrescarEstado()
}

export async function marcarOCApi(campanaId: string, ocUrl?: string): Promise<void> {
  const r = await fetch(`${API}/campanas/${campanaId}/oc/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocUrl: ocUrl ?? null }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la OC')
  await refrescarEstado()
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

// ─── Creativos ──────────────────────────────────────────────────────────────
export async function crearCreatividadApi(input: {
  campanaId: string
  nombre: string
  archivoUrl?: string | null
  codigo?: string | null
  formato?: string | null
  resolucion?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/creatividades/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo subir el creativo')
  await refrescarEstado()
}

export async function validarCreatividadApi(
  id: string,
  aprobar: boolean,
  motivo?: string,
): Promise<void> {
  const r = await fetch(`${API}/creatividades/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobar, motivo }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo validar el creativo')
  await refrescarEstado()
}

export async function asignarCreativosApi(
  reservaId: string,
  creativos: { creatividadId: string; veces: number }[],
): Promise<void> {
  const r = await fetch(`${API}/reservas/${reservaId}/creativo/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativos }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo asignar el creativo')
  await refrescarEstado()
}

export async function reservarApi(input: {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
  tipoCampana?: 'OOH' | 'DOOH' | 'HIBRIDA'
  spotsPorSitio?: Record<string, number>
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
