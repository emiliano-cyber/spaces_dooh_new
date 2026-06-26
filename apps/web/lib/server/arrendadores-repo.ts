import 'server-only'
import { q, pool } from './db'

// ============================================================================
//  lib/server/arrendadores-repo.ts — Arrendadores, contratos de arrendamiento
//  y pagos de renta. Alimentan el módulo Arrendadores y el gasto fijo de renta
//  del motor de costos (dashboard).
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

function rowToArrendador(r: any) {
  return {
    id: r.id,
    nombre: r.nombre,
    rfc: r.rfc ?? null,
    telefono: r.telefono ?? null,
    email: r.email ?? null,
    notas: r.notas ?? null,
    creadoEn: iso(r.creado_en),
  }
}

function rowToContrato(r: any) {
  return {
    id: r.id,
    sitioId: r.sitio_id,
    arrendadorId: r.arrendador_id,
    fechaInicio: iso(r.fecha_inicio),
    fechaFin: iso(r.fecha_fin),
    montoRenta: Number(r.monto_renta),
    periodicidad: r.periodicidad,
    moneda: r.moneda,
    autoRenovable: r.auto_renovable,
    documentoUrl: r.documento_url ?? null,
    estatus: r.estatus,
    creadoEn: iso(r.creado_en),
  }
}

function rowToPagoRenta(r: any) {
  return {
    id: r.id,
    contratoId: r.contrato_id,
    periodo: r.periodo,
    monto: Number(r.monto),
    fechaPago: r.fecha_pago ? iso(r.fecha_pago) : null,
    facturaUrl: r.factura_url ?? null,
    estatus: r.estatus,
    creadoEn: iso(r.creado_en),
  }
}

export async function listarArrendadores() {
  const rows = await q('select * from arrendadores order by nombre asc')
  return rows.map(rowToArrendador)
}

// Alta de un propietario/arrendador.
export async function crearArrendador(input: {
  nombre: string; rfc?: string | null; telefono?: string | null; email?: string | null; notas?: string | null
}) {
  const rows = await q(
    `insert into arrendadores (nombre, rfc, telefono, email, notas) values ($1,$2,$3,$4,$5) returning *`,
    [input.nombre, input.rfc ?? null, input.telefono ?? null, input.email ?? null, input.notas ?? null],
  )
  return rowToArrendador(rows[0])
}

export async function listarContratos() {
  const rows = await q('select * from contratos_arrendamiento order by creado_en asc')
  return rows.map(rowToContrato)
}

export async function listarPagosRenta() {
  const rows = await q('select * from pagos_renta order by creado_en asc')
  return rows.map(rowToPagoRenta)
}

function rowToIncidencia(r: any) {
  return {
    id: r.id,
    sitioId: r.sitio_id,
    tipo: r.tipo,
    descripcion: r.descripcion,
    fechaInicio: iso(r.fecha_inicio),
    fechaResolucion: r.fecha_resolucion ? iso(r.fecha_resolucion) : null,
    impactaComercial: r.impacta_comercial,
    estatus: r.estatus,
    fotos: r.fotos ?? [],
    reportadoPorUserId: r.reportado_por_usuario ?? null,
    notas: r.notas ?? null,
    creadoEn: iso(r.creado_en),
  }
}

export async function listarIncidencias() {
  const rows = await q('select * from incidencias order by creado_en asc')
  return rows.map(rowToIncidencia)
}

// ─── Mutaciones (antes solo en el mock; ahora persisten en la BD) ────────────

// Marca un pago de renta como PAGADO con la fecha de hoy.
export async function registrarPagoRenta(pagoId: string) {
  const rows = await q(
    `update pagos_renta set estatus='PAGADO', fecha_pago=now() where id=$1 returning *`,
    [pagoId],
  )
  return rows[0] ? rowToPagoRenta(rows[0]) : null
}

// Inicia la renovación de un contrato: estatus RENOVADO y +1 año de vigencia.
export async function iniciarRenovacion(contratoId: string) {
  const rows = await q(
    `update contratos_arrendamiento
        set estatus='RENOVADO',
            fecha_fin = (current_date + interval '365 days')::date
      where id=$1 returning *`,
    [contratoId],
  )
  return rows[0] ? rowToContrato(rows[0]) : null
}

// Reporta una incidencia y bloquea el sitio (comercial BLOQUEADO + legal SUSPENDIDO).
export async function reportarIncidencia(
  input: { sitioId: string; tipo: string; descripcion: string },
  usuarioId?: string | null,
) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const inc = (
      await client.query(
        `insert into incidencias (sitio_id, tipo, descripcion, impacta_comercial, estatus, reportado_por_usuario, notas)
         values ($1,$2::tipo_incidencia,$3,true,'ABIERTA',$4,$5) returning *`,
        [input.sitioId, input.tipo, input.descripcion, usuarioId ?? null, 'Reportada desde el módulo de Arrendadores.'],
      )
    ).rows[0]
    await client.query(
      `update sitios set estatus_comercial='BLOQUEADO', estatus_legal='SUSPENDIDO' where id=$1`,
      [input.sitioId],
    )
    await client.query('commit')
    return rowToIncidencia(inc)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
