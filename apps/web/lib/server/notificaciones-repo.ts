import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/notificaciones-repo.ts — Centro de notificaciones por evento.
//  notificar() se llama desde los flujos (ODC, factura, pago, OT, propuesta);
//  nunca rompe la operación principal si falla.
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

function rowToNotif(r: any) {
  return {
    id: r.id,
    tipo: r.tipo,
    nivel: r.nivel,
    titulo: r.titulo,
    detalle: r.detalle ?? null,
    link: r.link ?? null,
    leida: !!r.leida,
    creadoEn: iso(r.creado_en),
  }
}

export async function notificar(input: {
  tipo: string; titulo: string; detalle?: string | null; nivel?: 'info' | 'ok' | 'warn'; link?: string | null
}): Promise<void> {
  try {
    await q(
      `insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id) values ($1,$2,$3,$4,$5,$6)`,
      [input.tipo, input.nivel ?? 'info', input.titulo, input.detalle ?? null, input.link ?? null, await tenantActual()],
    )
  } catch {
    /* las notificaciones nunca rompen la operación principal */
  }
}

export async function listarNotificaciones() {
  const rows = await q('select * from notificaciones where tenant_id = $1 order by creado_en desc limit 100', [await tenantActual()])
  return rows.map(rowToNotif)
}

export async function marcarNotificacionLeida(id: string) {
  const rows = await q('update notificaciones set leida=true where id=$1 returning *', [id])
  return rows[0] ? rowToNotif(rows[0]) : null
}

export async function marcarTodasLeidas() {
  await q('update notificaciones set leida=true where leida=false')
}
