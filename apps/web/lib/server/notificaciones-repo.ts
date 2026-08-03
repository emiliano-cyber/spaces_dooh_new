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

// Crea la notificación SI no se dio ya hoy la misma. «La misma» = mismo tipo,
// mismo título, mismo detalle y mismo enlace; es decir, el mismo hecho sobre el
// mismo registro. Dos campañas distintas comparten título pero no detalle ni
// enlace, así que siguen apareciendo las dos: lo que se corta es el eco, no la
// información.
//
// Hacía falta porque el buzón acumulaba avisos idénticos. En producción había
// dos «Campaña generada desde propuesta» de la MISMA campaña, mismo enlace,
// creados con cuatro segundos de diferencia: el evento se disparó dos veces —un
// doble clic, un reintento— y nada lo filtraba. Al usuario le llegaba el mismo
// aviso repetido y acababa ignorando el buzón entero.
//
// Va como UNA sola sentencia (`insert … select … where not exists`) y no como
// consultar-y-luego-insertar: entre las dos habría una ventana en la que dos
// peticiones simultáneas —que es exactamente el caso del doble clic— pasarían
// las dos la comprobación.
//
// «Hoy» lo define la zona horaria de la BASE DE DATOS: en producción está en
// America/Mexico_City, así que el corte es la medianoche local. Si algún día se
// cambia esa configuración, esta ventana se mueve con ella.
export async function notificar(input: {
  tipo: string; titulo: string; detalle?: string | null; nivel?: 'info' | 'ok' | 'warn'; link?: string | null
}): Promise<void> {
  try {
    await q(
      `insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id)
       select $1,$2,$3,$4,$5,$6
        where not exists (
          select 1 from notificaciones
           where tenant_id = $6
             and tipo   = $1
             and titulo = $3
             -- IS NOT DISTINCT FROM y no "=": con NULL, "=" da NULL (nunca
             -- verdadero) y el duplicado se colaría justo cuando no hay detalle.
             and detalle is not distinct from $4
             and link    is not distinct from $5
             and creado_en >= date_trunc('day', now())
        )`,
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

// Notificaciones creadas DESPUÉS de una marca de tiempo. Alimenta el sondeo del
// cliente: se pide cada pocos segundos, así que va acotada y ordenada de más
// antigua a más nueva, para que los avisos salgan en el orden en que ocurrieron.
export async function notificacionesDesde(desde: string) {
  const rows = await q(
    `select * from notificaciones
      where tenant_id = $1 and creado_en > $2::timestamptz
      order by creado_en asc limit 20`,
    [await tenantActual(), desde],
  )
  return rows.map(rowToNotif)
}

export async function marcarNotificacionLeida(id: string) {
  const rows = await q('update notificaciones set leida=true where id=$1 returning *', [id])
  return rows[0] ? rowToNotif(rows[0]) : null
}

export async function marcarTodasLeidas() {
  await q('update notificaciones set leida=true where leida=false')
}
