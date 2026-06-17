import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1 } from './db'

// ============================================================================
//  lib/server/ot-repo.ts — Órdenes de trabajo (cuadrillas) + evidencias
//  (testigos). Cerrar una OT con foto guarda la evidencia, completa la OT y, si
//  está ligada a una campaña, enciende fotos+reporte (candado de facturación).
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null))

function rowToOT(r: any) {
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
    id: r.id, otId: r.ot_id, fotoUrl: r.foto_url, formato: r.formato,
    lat: n(r.lat), lng: n(r.lng), precision: n(r.precision_m), tipo: r.tipo,
    uploadedBy: r.uploaded_by, tomadaEn: iso(r.tomada_en), timestamp: iso(r.timestamp),
  }
}

export async function listarOT() {
  return (await q('select * from ordenes_trabajo order by creado_en asc')).map(rowToOT)
}
export async function listarEvidencias() {
  return (await q('select * from evidencias_ot order by timestamp asc')).map(rowToEvidencia)
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
  const evidencias = (await q('select * from evidencias_ot where ot_id=$1 order by timestamp asc', [id])).map(rowToEvidencia)
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

export async function crearOT(input: {
  tipo: string; sitioId?: string | null; campanaId?: string | null
  descripcion: string; instrucciones?: string; prioridad?: string
  asignadoA?: string | null; fechaProgramada?: string | null; checklist?: unknown[]
}) {
  const rows = await q(
    `insert into ordenes_trabajo (folio, tipo, sitio_id, campana_id, descripcion, instrucciones,
        checklist, prioridad, asignado_a, fecha_programada, estatus, requiere_revision)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDIENTE',true) returning *`,
    [folioOT(), input.tipo, input.sitioId ?? null, input.campanaId ?? null, input.descripcion,
     input.instrucciones ?? null, JSON.stringify(input.checklist ?? []), input.prioridad ?? 'NORMAL',
     input.asignadoA ?? null, input.fechaProgramada ?? null],
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
    await client.query(
      `insert into evidencias_ot (ot_id, foto_url, formato, lat, lng, precision_m, tipo, uploaded_by, tomada_en)
       values ($1,$2,'image/jpeg',$3,$4,8,'INSTALACION',$5,$6)`,
      [id, input.fotoUrl, input.lat ?? null, input.lng ?? null, input.uploadedBy ?? null, input.tomadaEn ?? null],
    )
    // candado de la campaña (fotos + reporte) si está ligada
    if (ot.campana_id) {
      await client.query(
        `update campanas set fotos_comprobatorias=true, reporte_publicacion=true,
           estado_comercial = case when oc_recibida then 'LISTA_FACTURAR'::est_comercial_campana else estado_comercial end
         where id=$1`,
        [ot.campana_id],
      )
    }
    await client.query('commit')
    return rowToOT((await client.query('select * from ordenes_trabajo where id=$1', [id])).rows[0])
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
