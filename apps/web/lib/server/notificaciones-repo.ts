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

// Las ARCHIVADAS no se listan: es lo que hace que «Borrar todas» vacíe el panel.
// La fila sigue en la base; lo que se pierde es el sitio en la campanita, que es
// justo lo que el usuario quería quitarse de encima.
export async function listarNotificaciones() {
  const rows = await q(
    `select * from notificaciones
      where tenant_id = $1 and archivada_en is null
      order by creado_en desc limit 100`,
    [await tenantActual()],
  )
  return rows.map(rowToNotif)
}

// Notificaciones creadas DESPUÉS de una marca de tiempo. Alimenta el sondeo del
// cliente: se pide cada pocos segundos, así que va acotada y ordenada de más
// antigua a más nueva, para que los avisos salgan en el orden en que ocurrieron.
//
// Filtra las archivadas, y NO es por simetría con `listarNotificaciones`: sin
// esto hay una carrera real. El sondeo pregunta «¿qué hay desde que abrí la
// pestaña?», no «desde el último clic». Si llega un aviso a las 10:00:05 y a las
// 10:00:07 pulsas «Borrar todas», el ciclo siguiente lo devolvería —se creó
// después de la marca— y saltaría el aviso emergente de algo que acabas de
// vaciar. El panel sí quedaría limpio, y el usuario vería un fantasma.
export async function notificacionesDesde(desde: string) {
  const rows = await q(
    `select * from notificaciones
      where tenant_id = $1 and creado_en > $2::timestamptz and archivada_en is null
      order by creado_en asc limit 20`,
    [await tenantActual(), desde],
  )
  return rows.map(rowToNotif)
}

export async function marcarNotificacionLeida(id: string) {
  const rows = await q('update notificaciones set leida=true where id=$1 returning *', [id])
  return rows[0] ? rowToNotif(rows[0]) : null
}

// «Borrar todas»: las saca del panel y las da por leídas de paso. Se marca
// `leida` además de archivar para que el contador de la campanita cuadre aunque
// alguien liste por otra vía; archivada pero sin leer sería un estado que no
// significa nada.
//
// Lleva filtro de tenant EXPLÍCITO además de la RLS. `marcarTodasLeidas`, que
// esto sustituye, iba sin él: un `update` sin `where tenant_id` que solo acotaba
// la política de la base. Funcionaba —la app conecta con un rol NOBYPASSRLS—,
// pero deja el aislamiento a UNA capa en una escritura masiva, y este repo se
// exige dos.
export async function archivarTodasNotificaciones(): Promise<number> {
  const rows = await q(
    `update notificaciones
        set archivada_en = now(), leida = true
      where tenant_id = $1 and archivada_en is null
      returning id`,
    [await tenantActual()],
  )
  return rows.length
}
