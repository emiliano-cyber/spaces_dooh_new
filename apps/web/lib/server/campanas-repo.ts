import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q } from './db'

// ============================================================================
//  lib/server/campanas-repo.ts — Clientes, campañas, reservas + flujos
//  (reservar / confirmar / extender). Mapea filas Postgres ↔ tipos del front.
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

// IGV (Perú) = 18%. Importe de cada reserva = tarifa mensual prorrateada por
// días exactos: precio / 30 × días cubiertos (fecha_fin - fecha_inicio + 1).
// presupuesto_neto = suma prorrateada; presupuesto_bruto = neto + IGV (total).
export const IGV_PCT = 0.18

type Exec = { query: (sql: string, params?: unknown[]) => Promise<unknown> }
async function recalcularPresupuesto(exec: Exec | null, campanaId: string) {
  const sql =
    `update campanas c
        set presupuesto_neto = sub.neto,
            presupuesto_bruto = round(sub.neto * (1 + $2::numeric), 2)
       from (
         select coalesce(
           round(sum(precio * (fecha_fin - fecha_inicio + 1) / 30.0), 2), 0
         ) as neto
         from reservas where campana_id = $1
       ) sub
      where c.id = $1`
  if (exec) await exec.query(sql, [campanaId, IGV_PCT])
  else await q(sql, [campanaId, IGV_PCT])
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
    precio: n(r.precio) ?? 0, tipoVenta: r.tipo_venta, estatus: r.estatus,
    spotsReservados: n(r.spots_reservados),
    creativos: Array.isArray(r.creativos) ? r.creativos : [],
    creadoEn: iso(r.creado_en),
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
    codigo: r.codigo ?? null,
    formato: r.formato, resolucion: r.resolucion, estatusValidacion: r.estatus_validacion,
    rechazadoMotivo: r.rechazado_motivo, creadoEn: iso(r.creado_en),
  }))
}

const folio = () => `CAM-${new Date().getFullYear()}-${randomBytes(2).toString('hex').toUpperCase()}`

type TipoCampana = 'OOH' | 'DOOH' | 'HIBRIDA'

// Deriva el tipo de campaña según los sitios reservados: solo digitales → DOOH
// (pipeline sin imprenta), solo estáticas → OOH, mezcla → HIBRIDA.
// Nota: lo "digital" NO se marca en tipo_medio (espectacular/valla/…), sino en
// exhibicion ('digital'/'rotativo') o es_rotativo — así lo guarda el importador.
function derivarTipoCampana(digitales: boolean[]): TipoCampana {
  if (digitales.length === 0) return 'OOH'
  const n = digitales.filter(Boolean).length
  if (n === digitales.length) return 'DOOH'
  if (n === 0) return 'OOH'
  return 'HIBRIDA'
}

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
  // Tipo de campaña. Si se omite, se deriva del medio de los sitios reservados.
  tipoCampana?: TipoCampana
  // Spots a reservar por sitio digital (sitioId → cantidad). Descuenta disponibles.
  spotsPorSitio?: Record<string, number>
}) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    let campanaId = input.campanaId

    if (!campanaId) {
      // Tipo manual si viene; si no, derivado del medio de los sitios.
      let tipoCampana = input.tipoCampana
      if (!tipoCampana) {
        const flags = (
          await client.query(
            `select (tipo_medio = 'PANTALLA_DIGITAL' or es_rotativo or exhibicion in ('digital','rotativo')) as digital
               from sitios where id = any($1::uuid[])`,
            [input.sitioIds],
          )
        ).rows.map((r: any) => !!r.digital)
        tipoCampana = derivarTipoCampana(flags)
      }
      const cli = (
        await client.query(`insert into clientes (nombre) values ($1) returning id`, [
          input.clienteNombre ?? 'Cliente nuevo',
        ])
      ).rows[0]
      campanaId = (
        await client.query(
          `insert into campanas (folio, nombre, cliente_id, marca, fecha_inicio, fecha_fin, estado_comercial, tipo_campana)
           values ($1,$2,$3,$4,$5,$6,'COTIZACION',$7) returning id`,
          [folio(), input.nombreCampana ?? `${input.clienteNombre ?? 'Campaña'} — nueva`, cli.id,
           input.clienteNombre ?? null, input.fechaInicio, input.fechaFin, tipoCampana],
        )
      ).rows[0].id
    }

    for (const sitioId of input.sitioIds) {
      const s = (
        await client.query(
          'select tarifa_mensual, spots_disponibles, es_rotativo, exhibicion, tipo_medio from sitios where id=$1',
          [sitioId],
        )
      ).rows[0]
      const precio = s ? Number(s.tarifa_mensual ?? 0) : 0
      const digital =
        !!s &&
        (s.tipo_medio === 'PANTALLA_DIGITAL' ||
          s.es_rotativo ||
          s.exhibicion === 'digital' ||
          s.exhibicion === 'rotativo')
      // Spots reservados: solo digitales y solo si se pidió una cantidad (acotada
      // a lo disponible). En estáticas queda null.
      const pedidos = input.spotsPorSitio?.[sitioId]
      const disp = s?.spots_disponibles != null ? Number(s.spots_disponibles) : null
      const spotsReservados =
        digital && pedidos != null
          ? Math.max(0, disp != null ? Math.min(Math.round(pedidos), disp) : Math.round(pedidos))
          : null

      await client.query(
        `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus, spots_reservados)
         values ($1,$2,$3,$4,$5,'FIXED_PKG','TENTATIVA',$6)`,
        [campanaId, sitioId, input.fechaInicio, input.fechaFin, precio, spotsReservados],
      )

      if (digital && spotsReservados != null) {
        // Descuenta spots; el sitio sigue disponible mientras le queden spots.
        await client.query(
          `update sitios set spots_disponibles = greatest(0, coalesce(spots_disponibles,0) - $2) where id=$1`,
          [sitioId, spotsReservados],
        )
      } else {
        await client.query(`update sitios set estatus_comercial='RESERVADO' where id=$1`, [sitioId])
      }
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
