import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q } from './db'

// ============================================================================
//  lib/server/campanas-repo.ts — Clientes, campañas, reservas + flujos
//  (reservar / confirmar / extender). Mapea filas Postgres ↔ tipos del front.
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

// Recalcula el presupuesto de la campaña a partir de sus reservas: cada reserva
// aporta su tarifa mensual × los meses que cubre (mínimo 1). Mantiene bruto=neto
// (no modelamos IVA/margen). Acepta un client de transacción o el pool (q).
type Exec = { query: (sql: string, params?: unknown[]) => Promise<unknown> }
async function recalcularPresupuesto(exec: Exec | null, campanaId: string) {
  const sql =
    `update campanas c
        set presupuesto_bruto = sub.total, presupuesto_neto = sub.total
       from (
         select coalesce(
           sum(precio * greatest(1, round((fecha_fin - fecha_inicio + 1) / 30.0))), 0
         ) as total
         from reservas where campana_id = $1
       ) sub
      where c.id = $1`
  if (exec) await exec.query(sql, [campanaId])
  else await q(sql, [campanaId])
}

function rowToCliente(r: any) {
  return {
    id: r.id, nombre: r.nombre, rfc: r.rfc, tipo: r.tipo,
    contacto: r.contacto ?? {}, activo: !!r.activo, creadoEn: iso(r.creado_en),
  }
}
function rowToCampana(r: any) {
  return {
    id: r.id, folio: r.folio, nombre: r.nombre, clienteId: r.cliente_id,
    agencia: r.agencia, marca: r.marca, tipoCampana: r.tipo_campana,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    presupuestoBruto: n(r.presupuesto_bruto), presupuestoNeto: n(r.presupuesto_neto),
    moneda: r.moneda, estadoComercial: r.estado_comercial,
    ocRecibida: !!r.oc_recibida, fotosComprobatorias: !!r.fotos_comprobatorias,
    reportePublicacion: !!r.reporte_publicacion, ocUrl: r.oc_url,
    reportePublicacionUrl: r.reporte_publicacion_url, portalToken: r.portal_token,
    portalActivo: !!r.portal_activo, notas: r.notas, creadoEn: iso(r.creado_en),
  }
}
function rowToReserva(r: any) {
  return {
    id: r.id, campanaId: r.campana_id, sitioId: r.sitio_id,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    precio: n(r.precio) ?? 0, tipoVenta: r.tipo_venta, estatus: r.estatus, creadoEn: iso(r.creado_en),
  }
}

// ─── Lecturas ───────────────────────────────────────────────────────────────
export async function listarClientes() {
  return (await q('select * from clientes order by creado_en asc')).map(rowToCliente)
}
export async function listarCampanas() {
  return (await q('select * from campanas order by creado_en asc')).map(rowToCampana)
}
export async function listarReservas() {
  return (await q('select * from reservas order by creado_en asc')).map(rowToReserva)
}
export async function listarCreatividades() {
  return (await q('select * from creatividades order by creado_en asc')).map((r: any) => ({
    id: r.id, campanaId: r.campana_id, nombre: r.nombre, archivoUrl: r.archivo_url,
    formato: r.formato, resolucion: r.resolucion, estatusValidacion: r.estatus_validacion,
    rechazadoMotivo: r.rechazado_motivo, creadoEn: iso(r.creado_en),
  }))
}

const folio = () => `CAM-${new Date().getFullYear()}-${randomBytes(2).toString('hex').toUpperCase()}`

// ─── Clientes ───────────────────────────────────────────────────────────────
export async function crearCliente(input: { nombre: string; rfc?: string; tipo?: string; contacto?: unknown }) {
  const rows = await q(
    `insert into clientes (nombre, rfc, tipo, contacto) values ($1,$2,$3,$4) returning *`,
    [input.nombre, input.rfc ?? null, input.tipo ?? 'DIRECTO', input.contacto ?? {}],
  )
  return rowToCliente(rows[0])
}

// ─── Reservar (Acto 3): crea cliente+campaña si hace falta, reservas TENTATIVA
//     y pone los sitios en RESERVADO ─────────────────────────────────────────
export async function reservar(input: {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
}) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    let campanaId = input.campanaId

    if (!campanaId) {
      const cli = (
        await client.query(`insert into clientes (nombre) values ($1) returning id`, [
          input.clienteNombre ?? 'Cliente nuevo',
        ])
      ).rows[0]
      campanaId = (
        await client.query(
          `insert into campanas (folio, nombre, cliente_id, marca, fecha_inicio, fecha_fin, estado_comercial)
           values ($1,$2,$3,$4,$5,$6,'COTIZACION') returning id`,
          [folio(), input.nombreCampana ?? `${input.clienteNombre ?? 'Campaña'} — nueva`, cli.id,
           input.clienteNombre ?? null, input.fechaInicio, input.fechaFin],
        )
      ).rows[0].id
    }

    for (const sitioId of input.sitioIds) {
      const s = (await client.query('select tarifa_mensual from sitios where id=$1', [sitioId])).rows[0]
      const precio = s ? Number(s.tarifa_mensual ?? 0) : 0
      await client.query(
        `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus)
         values ($1,$2,$3,$4,$5,'FIXED_PKG','TENTATIVA')`,
        [campanaId, sitioId, input.fechaInicio, input.fechaFin, precio],
      )
      await client.query(`update sitios set estatus_comercial='RESERVADO' where id=$1`, [sitioId])
    }
    await recalcularPresupuesto(client, campanaId!)
    await client.query('commit')
    const camp = (await client.query('select * from campanas where id=$1', [campanaId])).rows[0]
    return rowToCampana(camp)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// ─── Confirmar: reservas TENTATIVA→CONFIRMADA, sitios→OCUPADO, campaña→CONFIRMADA
export async function confirmarReserva(campanaId: string) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const sitios = (
      await client.query(
        `select sitio_id from reservas where campana_id=$1 and estatus='TENTATIVA'`,
        [campanaId],
      )
    ).rows.map((r) => r.sitio_id)
    await client.query(
      `update reservas set estatus='CONFIRMADA' where campana_id=$1 and estatus='TENTATIVA'`,
      [campanaId],
    )
    if (sitios.length) {
      await client.query(`update sitios set estatus_comercial='OCUPADO' where id = any($1::uuid[])`, [sitios])
    }
    await client.query(`update campanas set estado_comercial='CONFIRMADA' where id=$1`, [campanaId])
    await recalcularPresupuesto(client, campanaId)
    await client.query('commit')
    const camp = (await client.query('select * from campanas where id=$1', [campanaId])).rows[0]
    return camp ? rowToCampana(camp) : null
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// ─── Extender campaña (fechas) ──────────────────────────────────────────────
export async function extenderCampana(campanaId: string, nuevaFechaFin: string) {
  await q(`update campanas set fecha_fin=$2 where id=$1`, [campanaId, nuevaFechaFin])
  await q(`update reservas set fecha_fin=$2 where campana_id=$1`, [campanaId, nuevaFechaFin])
  await recalcularPresupuesto(null, campanaId)
  const rows = await q('select * from campanas where id=$1', [campanaId])
  return rows[0] ? rowToCampana(rows[0]) : null
}
