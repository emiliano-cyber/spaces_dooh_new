'use client'

// ============================================================================
//  lib/data/almacen-api.ts — Almacén de activos (Fase 3). Módulo autocontenido:
//  la página consulta directo al BFF (no pasa por el store global).
// ============================================================================

const API = '/spaces-dooh/api'

export type EstadoActivo = 'EN_ALMACEN' | 'INSTALADO' | 'EN_TRASLADO' | 'BAJA'
export type TipoMovAlmacen = 'ENTRADA' | 'SALIDA' | 'TRASLADO' | 'BAJA'

export interface Activo {
  id: string
  etiqueta: string
  descripcion: string
  tipoActivo: string
  estado: EstadoActivo
  sitioId: string | null
  notas: string | null
  creadoEn: string
}
export interface MovimientoAlmacen {
  id: string
  activoId: string
  tipo: TipoMovAlmacen
  motivo: string | null
  sitioId: string | null
  fecha: string
}

export async function getAlmacenApi(): Promise<{ activos: Activo[]; movimientos: MovimientoAlmacen[] }> {
  const r = await fetch(`${API}/almacen/`)
  if (!r.ok) throw new Error('No se pudo cargar el almacén')
  return r.json()
}

export async function crearActivoApi(input: {
  etiqueta: string
  descripcion: string
  tipoActivo?: string
  notas?: string | null
}): Promise<Activo> {
  const r = await fetch(`${API}/almacen/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo registrar el activo')
  return d
}

export async function moverActivoApi(
  id: string,
  input: { tipo: TipoMovAlmacen; motivo?: string | null; sitioId?: string | null },
): Promise<Activo> {
  const r = await fetch(`${API}/almacen/${id}/movimiento/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo mover el activo')
  return d
}
