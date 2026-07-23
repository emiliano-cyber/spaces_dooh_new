import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1, fijarTenant } from './db'
import { tenantActual } from './tenant'
import { AppError } from './errores'
import { notificar } from './notificaciones-repo'
import { storageHabilitado, subirDataUrl, urlFirmada } from './storage'

// ============================================================================
//  lib/server/ot-repo.ts — Órdenes de trabajo (cuadrillas) + evidencias
//  (testigos). Cerrar una OT con foto guarda la evidencia, completa la OT y, si
//  está ligada a una campaña, enciende fotos+reporte (candado de facturación).
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null))

export function rowToOT(r: any) {
  return {
    id: r.id, folio: r.folio, tipo: r.tipo, sitioId: r.sitio_id, campanaId: r.campana_id,
    descripcion: r.descripcion, instrucciones: r.instrucciones,
    checklist: r.checklist ?? [], prioridad: r.prioridad,
    asignadoAUserId: r.asignado_a, supervisorUserId: r.supervisor,
    fechaProgramada: iso(r.fecha_programada), fechaInicio: iso(r.fecha_inicio),
    fechaCompletada: iso(r.fecha_completada), estatus: r.estatus,
    requiereRevision: !!r.requiere_revision, notas: r.notas, creadoEn: iso(r.creado_en),
  }
}
function rowToEvidencia(r: any) {
  return {
    id: r.id, otId: r.ot_id, fotoUrl: r.foto_url, fotoKey: r.foto_key ?? null, formato: r.formato,
    lat: n(r.lat), lng: n(r.lng), precision: n(r.precision_m), tipo: r.tipo,
    uploadedBy: r.uploaded_by, tomadaEn: iso(r.tomada_en), timestamp: iso(r.timestamp),
  }
}

// Resuelve la URL servible de cada evidencia: si tiene foto_key (subida a
// Spaces) y el storage está habilitado → URL firmada; si no → el base64 viejo.
async function resolverEvidencias(rows: any[]) {
  return Promise.all(
    rows.map(async (r) => {
      const e = rowToEvidencia(r)
      if (r.foto_key && storageHabilitado()) {
        try { e.fotoUrl = await urlFirmada(r.foto_key) } catch { /* deja el valor actual */ }
      }
      return e
    }),
  )
}

export async function listarOT() {
  return (await q('select * from ordenes_trabajo where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToOT)
}

// Estados en los que la OT sigue ABIERTA (aún debe cerrarse en campo).
const OT_ABIERTAS = ['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'BLOQUEADA', 'EN_REVISION']

// Alerta proactiva de OT vencida: una OT abierta que pasó su fecha compromiso
// (fecha_programada) genera UNA notificación in-app. Idempotente: no repite la
// alerta de la misma OT (dedup por link). Se ejecuta en cada lectura de estado
// (chokepoint), así que no requiere cron. Devuelve cuántas alertó esta vez.
export async function notificarOTsVencidas(): Promise<number> {
  const tenantId = await tenantActual()
  if (!tenantId) return 0
  const vencidas = await q<any>(
    `select ot.id, ot.folio, ot.asignado_a, s.nombre as sitio
       from ordenes_trabajo ot
       left join sitios s on s.id = ot.sitio_id
      where ot.tenant_id = $1
        and ot.estatus = any($2)
        and ot.fecha_programada is not null
        and ot.fecha_programada < now()
        and not exists (
          select 1 from notificaciones nz
           where nz.tenant_id = $1
             and nz.titulo = 'OT vencida'
             and nz.link = '/demo/operaciones/ot/' || ot.id
        )`,
    [tenantId, OT_ABIERTAS],
  )
  for (const ot of vencidas) {
    await notificar({
      tipo: 'OT',
      nivel: 'warn',
      titulo: 'OT vencida',
      detalle: `${ot.folio}${ot.sitio ? ` · ${ot.sitio}` : ''} no se cerró a tiempo${ot.asignado_a ? '' : ' (sin asignar)'}`,
      link: `/demo/operaciones/ot/${ot.id}`,
    })
  }
  return vencidas.length
}
export async function listarEvidencias() {
  return resolverEvidencias(await q('select * from evidencias_ot where tenant_id = $1 order by timestamp asc', [await tenantActual()]))
}

// OT con su sitio, campaña y evidencias (para la vista móvil standalone).
export async function getOTcompleta(id: string) {
  const r = await q1('select * from ordenes_trabajo where id=$1', [id])
  if (!r) return null
  const ot = rowToOT(r)
  const sitio = ot.sitioId ? await q1('select id, nombre, direccion, lat, lng from sitios where id=$1', [ot.sitioId]) : null
  const campana = ot.campanaId
    ? await q1('select id, nombre, oc_recibida, fotos_comprobatorias, reporte_publicacion from campanas where id=$1', [ot.campanaId])
    : null
  const evidencias = await resolverEvidencias(await q('select * from evidencias_ot where ot_id=$1 order by timestamp asc', [id]))
  return {
    ot,
    sitio: sitio
      ? { id: sitio.id, nombre: sitio.nombre, direccion: sitio.direccion, lat: n(sitio.lat), lng: n(sitio.lng) }
      : null,
    campana: campana
      ? {
          id: campana.id, nombre: campana.nombre, ocRecibida: !!campana.oc_recibida,
          fotosComprobatorias: !!campana.fotos_comprobatorias, reportePublicacion: !!campana.reporte_publicacion,
        }
      : null,
    evidencias,
  }
}

const folioOT = () => `OT-${new Date().getFullYear()}-${randomBytes(2).toString('hex').toUpperCase()}`

// Tipos de tarea que NO aplican a una pantalla fija: montaje de lona y herrería
// son de espectacular físico, así que una DIGITAL no los lleva. El resto de las
// tareas (desmontaje, mantenimiento, eléctrico, inspección) aplica a ambas.
const OT_SOLO_FIJA = new Set(['MONTAJE_LONA', 'HERRERIA'])

export async function crearOT(input: {
  tipo: string; sitioId?: string | null; campanaId?: string | null
  descripcion: string; instrucciones?: string; prioridad?: string
  asignadoA?: string | null; fechaProgramada?: string | null; checklist?: unknown[]
}) {
  // "Montaje digital" quedó obsoleto: el arte de una pantalla digital se sube por
  // "Subir a producción" (DOOHmain) desde la campaña, no por una OT de montaje.
  if (input.tipo === 'MONTAJE_DIGITAL') {
    throw new AppError('El montaje digital ya no es una tarea de OT: el arte se sube con "Subir a producción" en la campaña', 409)
  }
  // Guard por tipo de pantalla: una digital no lleva montaje de lona ni herrería.
  if (input.sitioId) {
    const s = await q1<any>(
      'select tipo_medio, es_rotativo, exhibicion from sitios where id=$1',
      [input.sitioId],
    )
    if (s) {
      const digital = s.tipo_medio === 'PANTALLA_DIGITAL' || s.es_rotativo === true ||
        s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
      if (digital && OT_SOLO_FIJA.has(input.tipo)) {
        throw new AppError('Esa tarea no aplica a una pantalla digital (no lleva lona ni herrería)', 409)
      }
    }
  }
  const rows = await q(
    `insert into ordenes_trabajo (folio, tipo, sitio_id, campana_id, descripcion, instrucciones,
        checklist, prioridad, asignado_a, fecha_programada, estatus, requiere_revision, tenant_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDIENTE',true,$11) returning *`,
    [folioOT(), input.tipo, input.sitioId ?? null, input.campanaId ?? null, input.descripcion,
     input.instrucciones ?? null, JSON.stringify(input.checklist ?? []), input.prioridad ?? 'NORMAL',
     input.asignadoA ?? null, input.fechaProgramada ?? null, await tenantActual()],
  )
  return rowToOT(rows[0])
}

// Cerrar OT con foto comprobatoria (testigo).
export async function cerrarOT(
  id: string,
  input: { fotoUrl: string; tomadaEn?: string; lat?: number; lng?: number; uploadedBy?: string },
) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    const ot = (await client.query('select * from ordenes_trabajo where id=$1', [id])).rows[0]
    if (!ot) {
      await client.query('rollback')
      return null
    }
    // marca checklist completo + estatus COMPLETADA
    const checklist = (ot.checklist ?? []).map((c: any) => ({ ...c, hecho: true }))
    await client.query(
      `update ordenes_trabajo set estatus='COMPLETADA', checklist=$2,
         fecha_inicio=coalesce(fecha_inicio, now()), fecha_completada=now() where id=$1`,
      [id, JSON.stringify(checklist)],
    )
    // Storage: si Spaces está habilitado y llega un data URL, lo subimos y
    // guardamos la KEY (no el base64). Si no, fallback: base64 en BD (como antes).
    let fotoUrl: string = input.fotoUrl
    let fotoKey: string | null = null
    if (storageHabilitado() && typeof input.fotoUrl === 'string' && input.fotoUrl.startsWith('data:')) {
      try {
        fotoKey = await subirDataUrl(`evidencias/${id}/${Date.now()}.jpg`, input.fotoUrl)
        fotoUrl = '' // ya no guardamos el base64 en BD
      } catch {
        fotoKey = null // si falla la subida, conservamos el base64 (no se pierde la evidencia)
      }
    }
    await client.query(
      `insert into evidencias_ot (ot_id, foto_url, foto_key, formato, lat, lng, precision_m, tipo, uploaded_by, tomada_en, tenant_id)
       values ($1,$2,$3,'image/jpeg',$4,$5,8,'INSTALACION',$6,$7,$8)`,
      [id, fotoUrl, fotoKey, input.lat ?? null, input.lng ?? null, input.uploadedBy ?? null, input.tomadaEn ?? null, await tenantActual()],
    )
    // Candado de la campaña si está ligada. Una OT es evidencia de la parte
    // FÍSICA, así que enciende `fotos_comprobatorias`. `reporte_publicacion`
    // (salió al aire) solo lo enciende para campañas NO híbridas: en una HÍBRIDA
    // la parte digital debe publicarse aparte (validarPublicacion / DOOHmain), así
    // que cerrar una OT de lona NO puede dar por publicada la digital (A-2). Por
    // eso una híbrida solo pasa a LISTA_FACTURAR si su parte digital ya reportó.
    if (ot.campana_id) {
      await client.query(
        `update campanas set
            fotos_comprobatorias = true,
            reporte_publicacion = case when tipo_campana = 'HIBRIDA' then reporte_publicacion else true end,
            estado_comercial = case
              when oc_recibida
                and (case when tipo_campana = 'HIBRIDA' then reporte_publicacion else true end)
              then 'LISTA_FACTURAR'::est_comercial_campana
              else estado_comercial end
          where id=$1`,
        [ot.campana_id],
      )
    }
    // Integración Almacén (Fase 3): al cerrar una OT de RETIRO (desmontaje) por
    // primera vez, el equipo de la pantalla entra al almacén como activo, para su
    // seguimiento. Solo en el primer cierre (evita duplicar).
    if (ot.estatus !== 'COMPLETADA' && ot.tipo === 'DESMONTAJE' && ot.sitio_id) {
      const sitio = (await client.query('select nombre, codigo_proveedor from sitios where id=$1', [ot.sitio_id])).rows[0]
      if (sitio) {
        const tid = await tenantActual()
        const etiqueta = `RET-${sitio.codigo_proveedor ?? ot.folio}`
        const activo = (
          await client.query(
            `insert into almacen_activos (etiqueta, descripcion, tipo_activo, estado, notas, tenant_id)
             values ($1,$2,'PANTALLA','EN_ALMACEN',$3,$4) returning id`,
            [etiqueta, `Equipo retirado de ${sitio.nombre}`, `Ingresó al almacén al cerrar la OT ${ot.folio} (retiro).`, tid],
          )
        ).rows[0]
        await client.query(
          `insert into almacen_movimientos (activo_id, tipo, motivo, sitio_id, tenant_id)
           values ($1,'ENTRADA',$2,$3,$4)`,
          [activo.id, `Retiro por OT ${ot.folio}`, ot.sitio_id, tid],
        )
      }
    }
    // Se lee la OT DENTRO de la transacción (con app.tenant_id fijado): tras el
    // commit, fijarTenant (set_config local) se descarta y la RLS devolvería 0
    // filas, rompiendo rowToOT. Fix del bug de cierre.
    const cerrada = (await client.query('select * from ordenes_trabajo where id=$1', [id])).rows[0]
    await client.query('commit')
    return rowToOT(cerrada)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
