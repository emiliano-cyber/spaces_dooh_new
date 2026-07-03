import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'
import type { UsuarioSesion } from './auth'

// ============================================================================
//  lib/server/acciones-repo.ts — Bitácora: registra quién hizo qué y cuándo.
//  registrarAccion no lanza si falla (la acción principal ya ocurrió).
// ============================================================================

export async function registrarAccion(
  usuario: UsuarioSesion | null,
  accion: string,
  entidad: string,
): Promise<void> {
  try {
    await q(
      `insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id) values ($1,$2,$3,$4,$5)`,
      [accion, entidad, usuario?.id ?? null, usuario?.nombre ?? 'Sistema', await tenantActual()],
    )
  } catch {
    /* la bitácora nunca rompe la operación principal */
  }
}

export async function listarAcciones() {
  const rows = await q(
    'select id, accion, entidad, usuario_id, usuario_nombre, timestamp from acciones where tenant_id = $1 order by timestamp desc limit 200', [await tenantActual()],
  )
  return rows.map((r: any) => ({
    id: r.id, accion: r.accion, entidad: r.entidad,
    usuarioId: r.usuario_id, usuarioNombre: r.usuario_nombre,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
  }))
}
