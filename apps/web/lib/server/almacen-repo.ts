import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/almacen-repo.ts — Almacén de activos (Fase 3).
//  Activos físicos (pantallas/estructuras/lonas) con su estado (en almacén /
//  instalado / en traslado / baja) y un registro de movimientos (traslados).
//  Todo bajo RLS por tenant (q fija app.tenant_id de la sesión).
// ============================================================================

function rowToActivo(r: any) {
  return {
    id: r.id,
    etiqueta: r.etiqueta,
    descripcion: r.descripcion,
    tipoActivo: r.tipo_activo,
    estado: r.estado as 'EN_ALMACEN' | 'INSTALADO' | 'EN_TRASLADO' | 'BAJA',
    sitioId: r.sitio_id ?? null,
    notas: r.notas ?? null,
    creadoEn: new Date(r.creado_en).toISOString(),
  }
}

function rowToMovimiento(r: any) {
  return {
    id: r.id,
    activoId: r.activo_id,
    tipo: r.tipo as 'ENTRADA' | 'SALIDA' | 'TRASLADO' | 'BAJA',
    motivo: r.motivo ?? null,
    sitioId: r.sitio_id ?? null,
    fecha: new Date(r.fecha).toISOString(),
  }
}

export async function listarActivos() {
  const rows = await q('select * from almacen_activos order by creado_en desc')
  return rows.map(rowToActivo)
}

export async function listarMovimientos(limite = 100) {
  const rows = await q('select * from almacen_movimientos order by fecha desc limit $1', [limite])
  return rows.map(rowToMovimiento)
}

export async function crearActivo(input: {
  etiqueta: string
  descripcion: string
  tipoActivo?: string
  notas?: string | null
}) {
  const tenantId = await tenantActual()
  const rows = await q(
    `insert into almacen_activos (etiqueta, descripcion, tipo_activo, estado, notas, tenant_id)
     values ($1,$2,$3,'EN_ALMACEN',$4,$5) returning *`,
    [input.etiqueta, input.descripcion, input.tipoActivo ?? 'PANTALLA', input.notas ?? null, tenantId],
  )
  // Movimiento de entrada inicial.
  await q(
    `insert into almacen_movimientos (activo_id, tipo, motivo, tenant_id) values ($1,'ENTRADA',$2,$3)`,
    [rows[0].id, 'Alta en almacén', tenantId],
  )
  return rowToActivo(rows[0])
}

// Nuevo estado del activo según el tipo de movimiento.
const ESTADO_POR_MOV: Record<string, string> = {
  ENTRADA: 'EN_ALMACEN',
  SALIDA: 'INSTALADO',
  TRASLADO: 'EN_TRASLADO',
  BAJA: 'BAJA',
}

// Registra un movimiento y actualiza el estado (y el sitio si se instala).
export async function registrarMovimiento(
  activoId: string,
  input: { tipo: 'ENTRADA' | 'SALIDA' | 'TRASLADO' | 'BAJA'; motivo?: string | null; sitioId?: string | null },
  usuarioId?: string | null,
) {
  const tenantId = await tenantActual()
  const nuevoEstado = ESTADO_POR_MOV[input.tipo]
  // SALIDA (instalación) fija el sitio; el resto lo limpia.
  const sitioId = input.tipo === 'SALIDA' ? input.sitioId ?? null : null
  const upd = await q(
    `update almacen_activos set estado = $2::est_activo, sitio_id = $3
      where id = $1 returning *`,
    [activoId, nuevoEstado, sitioId],
  )
  if (!upd.length) return null
  await q(
    `insert into almacen_movimientos (activo_id, tipo, motivo, sitio_id, usuario_id, tenant_id)
     values ($1,$2::tipo_mov_almacen,$3,$4,$5,$6)`,
    [activoId, input.tipo, input.motivo ?? null, sitioId, usuarioId ?? null, tenantId],
  )
  return rowToActivo(upd[0])
}
