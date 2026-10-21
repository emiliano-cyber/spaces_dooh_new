import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/notificaciones-repo.ts — Centro de notificaciones por evento.
//  notificar() se llama desde los flujos (ODC, factura, pago, OT, propuesta);
//  nunca rompe la operación principal si falla.
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

// `leida` es la de ESA persona (NOTIF-USUARIO, 21/10): la calcula la consulta
// como `leida_usuario`. Se cae a la columna vieja solo si alguna lectura no la
// trae, para no pintar como «sin leer» algo que sí se leyó.
function rowToNotif(r: any) {
  return {
    id: r.id,
    tipo: r.tipo,
    nivel: r.nivel,
    titulo: r.titulo,
    detalle: r.detalle ?? null,
    link: r.link ?? null,
    leida: !!(r.leida_usuario ?? r.leida),
    creadoEn: iso(r.creado_en),
  }
}

// ─── La bandeja es de CADA PERSONA (NOTIF-USUARIO, 21/10) ───────────────────
//
// La notificación es una por empresa; lo que cada quien hizo con ella vive en
// `notificaciones_usuario` (ver `20261021_notificaciones_por_usuario.sql`).
// Hasta ese día `leida` y `archivada_en` estaban en la fila compartida, y
// cuando un vendedor vaciaba su panel se lo vaciaba también al Dueño.
//
// Las columnas viejas se siguen LEYENDO —lo archivado para todos antes de esa
// fecha sigue oculto, lo marcado leído sigue leído— y ya no se escriben.
//
// `usuarioId` lo pasa la ruta desde la SESIÓN (`exigir()`), nunca del cuerpo:
// si viniera de fuera, cualquiera borraría en la bandeja de otro.
const VISTA_DE_USUARIO = `
  from notificaciones n
  left join notificaciones_usuario nu
         on nu.notificacion_id = n.id and nu.usuario_id = $2 and nu.tenant_id = n.tenant_id`
const LEIDA_DE_USUARIO = `(n.leida or nu.leida_en is not null) as leida_usuario`

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

// Lo BORRADO por esta persona no se lista: es lo que hace que borrar una o
// «Borrar todas» vacíe SU panel. Tampoco lo archivado para todos con el botón
// de antes del 21/10. La fila sigue en la base; lo que se pierde es el sitio en
// la campanita, que es justo lo que el usuario quería quitarse de encima.
export async function listarNotificaciones(usuarioId: string) {
  const rows = await q(
    `select n.*, ${LEIDA_DE_USUARIO}
     ${VISTA_DE_USUARIO}
      where n.tenant_id = $1 and n.archivada_en is null and nu.borrada_en is null
      order by n.creado_en desc limit 100`,
    [await tenantActual(), usuarioId],
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
// Devuelve, además de las notificaciones, la MARCA con la que preguntar la
// próxima vez: el `creado_en` de la última, con sus MICROsegundos. No vale el
// `creadoEn` de la notificación: es un ISO de JavaScript, con milisegundos, y
// queda por debajo de la hora real (…05.123 < …05.123456). Con esa marca la
// misma notificación volvía a cumplir `creado_en > desde` y el aviso emergente
// salía otra vez en cada sondeo, cada 15 s (08/10). Redondearla hacia arriba
// tampoco sirve: se saltaría otra creada en el mismo milisegundo.
// `notificaciones-una-vez.e2e.test.ts` lo prueba contra Postgres real.
export async function notificacionesDesde(desde: string, usuarioId: string) {
  const rows = await q(
    `select n.*, ${LEIDA_DE_USUARIO},
            to_char(n.creado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as marca
     ${VISTA_DE_USUARIO}
      where n.tenant_id = $1 and n.creado_en > $3::timestamptz
        and n.archivada_en is null and nu.borrada_en is null
      order by n.creado_en asc limit 20`,
    [await tenantActual(), usuarioId, desde],
  )
  return {
    notificaciones: rows.map(rowToNotif),
    marca: rows.length ? (rows[rows.length - 1].marca as string) : desde,
  }
}

// Marca UNA como leída para esta persona. El `insert … select` sale de
// `notificaciones` acotada por id Y por tenant: si el aviso es de otra empresa
// (o no existe) no se inserta nada y la ruta contesta 404. Hasta el 21/10 esto
// era `update notificaciones set leida=true where id=$1`, sin tenant y para
// todos a la vez.
export async function marcarNotificacionLeida(id: string, usuarioId: string) {
  const tenant = await tenantActual()
  const hecho = await q(
    `insert into notificaciones_usuario (tenant_id, notificacion_id, usuario_id, leida_en)
     select n.tenant_id, n.id, $2, now()
       from notificaciones n where n.id = $1 and n.tenant_id = $3
     on conflict (notificacion_id, usuario_id)
       do update set leida_en = coalesce(notificaciones_usuario.leida_en, excluded.leida_en)
     returning notificacion_id`,
    [id, usuarioId, tenant],
  )
  if (!hecho[0]) return null
  const rows = await q(
    `select n.*, ${LEIDA_DE_USUARIO}
     ${VISTA_DE_USUARIO}
      where n.tenant_id = $1 and n.id = $3`,
    [tenant, usuarioId, id],
  )
  return rows[0] ? rowToNotif(rows[0]) : null
}

// Borra UNA de la bandeja de esta persona: la oculta con fecha, no la destruye,
// y la da por leída de paso (borrada sin leer sería un estado que no significa
// nada). Misma forma que `marcarNotificacionLeida`: sin aviso de su empresa, no
// hay fila y devuelve false. Borrar dos veces no pisa la fecha de la primera.
export async function borrarNotificacion(id: string, usuarioId: string): Promise<boolean> {
  const rows = await q(
    `insert into notificaciones_usuario (tenant_id, notificacion_id, usuario_id, leida_en, borrada_en)
     select n.tenant_id, n.id, $2, now(), now()
       from notificaciones n where n.id = $1 and n.tenant_id = $3
     on conflict (notificacion_id, usuario_id)
       do update set borrada_en = coalesce(notificaciones_usuario.borrada_en, excluded.borrada_en),
                     leida_en   = coalesce(notificaciones_usuario.leida_en, excluded.leida_en)
     returning notificacion_id`,
    [id, usuarioId, await tenantActual()],
  )
  return rows.length > 0
}

// «Borrar todas»: vacía la bandeja de ESTA persona —no la de los demás— y da
// todo por leído de paso. Solo mira lo que su panel enseña (lo no archivado
// para todos), y no pisa la fecha de lo que ya había borrado.
//
// Lleva filtro de tenant EXPLÍCITO además de la RLS: una escritura masiva no se
// sostiene en una sola capa, que es lo que este repo se exige desde el 10/08.
export async function archivarTodasNotificaciones(usuarioId: string): Promise<number> {
  const rows = await q(
    `insert into notificaciones_usuario (tenant_id, notificacion_id, usuario_id, leida_en, borrada_en)
     select n.tenant_id, n.id, $2, now(), now()
       from notificaciones n
      where n.tenant_id = $1 and n.archivada_en is null
     on conflict (notificacion_id, usuario_id)
       do update set borrada_en = coalesce(notificaciones_usuario.borrada_en, excluded.borrada_en),
                     leida_en   = coalesce(notificaciones_usuario.leida_en, excluded.leida_en)
     returning notificacion_id`,
    [await tenantActual(), usuarioId],
  )
  return rows.length
}
