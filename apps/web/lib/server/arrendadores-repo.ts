import 'server-only'
import type { PoolClient } from 'pg'
import { q, pool, fijarTenant, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { insertarSitio } from './sitios-repo'

// ============================================================================
//  lib/server/arrendadores-repo.ts — Arrendadores, contratos de arrendamiento
//  y pagos de renta. Alimentan el módulo Arrendadores y el gasto fijo de renta
//  del motor de costos (dashboard).
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

// ─── Periodicidad: equivalente mensual y avance de periodo (fuente única) ─────
// Equivalente mensual (coincide con M3 y con rentaAMensual de derive.ts):
//   SEMANAL ×30/7 · CATORCENAL ×30/14 · QUINCENAL ×2 · MENSUAL ×1 ·
//   BIMESTRAL ÷2 · TRIMESTRAL ÷3 · SEMESTRAL ÷6 · ANUAL ÷12.
const FACTOR_MENSUAL: Record<string, number> = {
  SEMANAL: 30 / 7, CATORCENAL: 30 / 14, QUINCENAL: 2, MENSUAL: 1,
  BIMESTRAL: 1 / 2, TRIMESTRAL: 1 / 3, SEMESTRAL: 1 / 6, ANUAL: 1 / 12,
}
export function montoMensualEquivalente(monto: number, periodicidad: string): number {
  return Math.round(monto * (FACTOR_MENSUAL[periodicidad] ?? 1) * 100) / 100
}

// Avanza la fecha de vencimiento un periodo según la periodicidad.
function avanzarPeriodo(d: Date, periodicidad: string): Date {
  const n = new Date(d)
  switch (periodicidad) {
    case 'SEMANAL':    n.setDate(n.getDate() + 7); break
    case 'CATORCENAL': n.setDate(n.getDate() + 14); break
    case 'QUINCENAL':  n.setDate(n.getDate() + 15); break
    case 'BIMESTRAL':  n.setMonth(n.getMonth() + 2); break
    case 'TRIMESTRAL': n.setMonth(n.getMonth() + 3); break
    case 'SEMESTRAL':  n.setMonth(n.getMonth() + 6); break
    case 'ANUAL':      n.setMonth(n.getMonth() + 12); break
    case 'MENSUAL':
    default:           n.setMonth(n.getMonth() + 1); break
  }
  return n
}

interface GenInput {
  id: string; tenantId: string; fechaInicio: string; fechaFin: string
  montoRenta: number; periodicidad: string
}
function genInputFromRow(r: any): GenInput {
  return {
    id: r.id, tenantId: r.tenant_id,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    montoRenta: Number(r.monto_renta), periodicidad: r.periodicidad,
  }
}

// Genera (idempotente) la serie de pagos de un contrato dentro de su vigencia.
// Un periodo cuyo vencimiento ya pasó e impago queda VENCIDO; el resto PENDIENTE.
// NO inventa pagos (no marca PAGADO). Reejecutar no duplica (ON CONFLICT).
// Recibe un client YA en transacción con el tenant fijado.
async function generarCalendarioEnTx(client: PoolClient, c: GenInput): Promise<number> {
  const inicio = new Date(c.fechaInicio)
  const fin = new Date(c.fechaFin)
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin < inicio) return 0
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  const params: unknown[] = []
  const values: string[] = []
  let cursor = new Date(inicio)
  let guard = 0
  while (cursor <= fin && guard < 1200) {
    const periodo = cursor.toISOString().slice(0, 10)      // YYYY-MM-DD (vencimiento)
    const estatus = cursor < hoy ? 'VENCIDO' : 'PENDIENTE'
    const b = params.length
    values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5}::est_pago_renta)`)
    params.push(c.id, c.tenantId, periodo, c.montoRenta, estatus)
    cursor = avanzarPeriodo(cursor, c.periodicidad)
    guard++
  }
  if (!values.length) return 0
  const res = await client.query(
    `insert into pagos_renta (contrato_id, tenant_id, periodo, monto, estatus)
     values ${values.join(',')}
     on conflict (contrato_id, periodo) do nothing`,
    params,
  )
  return res.rowCount ?? 0
}

// Regenera el calendario de un contrato (por su fila). Abre su propia transacción.
async function generarCalendarioDesdeRow(r: any): Promise<number> {
  return withTenantTx((client) => generarCalendarioEnTx(client, genInputFromRow(r)))
}

function rowToArrendador(r: any) {
  return {
    id: r.id,
    nombre: r.nombre,
    rfc: r.rfc ?? null,
    telefono: r.telefono ?? null,
    email: r.email ?? null,
    notas: r.notas ?? null,
    curp: r.curp ?? null,
    direccion: r.direccion ?? null,
    cuentaBancaria: r.cuenta_bancaria ?? null,
    formaPago: r.forma_pago ?? null,
    observaciones: r.observaciones ?? null,
    activo: r.activo ?? true,
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
    montoMensualEquivalente: montoMensualEquivalente(Number(r.monto_renta), r.periodicidad),
    moneda: r.moneda,
    autoRenovable: r.auto_renovable,
    documentoUrl: r.documento_url ?? null,
    estatus: r.estatus,
    deposito: r.deposito != null ? Number(r.deposito) : null,
    predioId: r.predio_id ?? null,
    razonSocialId: r.razon_social_id ?? null,
    motivoCancelacion: r.motivo_cancelacion ?? null,
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
    comprobanteUrl: r.comprobante_url ?? null,
    metodoPago: r.metodo_pago ?? null,
    observaciones: r.observaciones ?? null,
    estatus: r.estatus,
    creadoEn: iso(r.creado_en),
  }
}

export async function listarArrendadores() {
  // Oculta los soft-deleted (activo=false); conserva su historial en la BD.
  const rows = await q('select * from arrendadores where tenant_id = $1 and coalesce(activo,true) order by nombre asc', [await tenantActual()])
  return rows.map(rowToArrendador)
}

// Alta de un propietario/arrendador.
export async function crearArrendador(input: {
  nombre: string; rfc?: string | null; telefono?: string | null; email?: string | null; notas?: string | null
}) {
  const rows = await q(
    `insert into arrendadores (nombre, rfc, telefono, email, notas, tenant_id) values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.nombre, input.rfc ?? null, input.telefono ?? null, input.email ?? null, input.notas ?? null, await tenantActual()],
  )
  return rowToArrendador(rows[0])
}

export async function listarContratos() {
  const rows = await q('select * from contratos_arrendamiento where tenant_id = $1 order by creado_en asc', [await tenantActual()])
  return rows.map(rowToContrato)
}

// Estatus del contrato derivado de sus fechas (permite altas retroactivas):
// VENCIDO si ya terminó, POR_VENCER si vence dentro de 30 días, si no VIGENTE.
function estatusPorFechas(fechaInicio: string, fechaFin: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fechaFin)
  const dias = Math.round((fin.getTime() - hoy.getTime()) / 86_400_000)
  if (dias < 0) return 'VENCIDO'
  if (dias <= 30) return 'POR_VENCER'
  return 'VIGENTE'
}

// Alta unificada "arrendatario → contrato → pantalla" en UNA transacción.
// - arrendador: {id} usa uno existente; {nombre,...} da de alta uno nuevo.
// - contrato: periodo (fechas pasadas permitidas), renta, periodicidad, etc.
// - sitio: datos de la pantalla/espectacular (mismo shape que el alta manual).
// La renta/periodicidad y el arrendatario también quedan como campos directos del
// sitio, así el inventario los muestra al instante.
export async function crearContratoConSitio(input: {
  arrendador: { id: string } | { nombre: string; rfc?: string | null; telefono?: string | null; email?: string | null; notas?: string | null }
  contrato: {
    fechaInicio: string; fechaFin: string; montoRenta: number; periodicidad: string
    moneda?: string; autoRenovable?: boolean; documentoUrl?: string | null
  }
  sitio: Record<string, unknown>
}) {
  const tenantId = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)

    // 1) Arrendatario (existente o nuevo)
    let arrendadorId: string
    if ('id' in input.arrendador) {
      arrendadorId = input.arrendador.id
    } else {
      const { rows } = await client.query(
        `insert into arrendadores (nombre, rfc, telefono, email, notas, tenant_id)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [input.arrendador.nombre, input.arrendador.rfc ?? null, input.arrendador.telefono ?? null,
         input.arrendador.email ?? null, input.arrendador.notas ?? null, tenantId],
      )
      arrendadorId = rows[0].id
    }

    // 2) Pantalla/espectacular (misma transacción)
    const sitio = await insertarSitio(client, { ...input.sitio, tenantId })
    // Campos directos del sitio: arrendatario + renta (para el inventario/modal).
    await client.query(
      `update sitios set arrendador_id = $1, renta_arrendador = $2, periodicidad_renta = $3 where id = $4`,
      [arrendadorId, input.contrato.montoRenta, input.contrato.periodicidad, sitio.id],
    )

    // 3) Contrato de arrendamiento vinculado a la pantalla recién creada
    const estatus = estatusPorFechas(input.contrato.fechaInicio, input.contrato.fechaFin)
    const { rows: cr } = await client.query(
      `insert into contratos_arrendamiento
        (sitio_id, arrendador_id, fecha_inicio, fecha_fin, monto_renta, periodicidad, moneda, auto_renovable, documento_url, estatus, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [sitio.id, arrendadorId, input.contrato.fechaInicio, input.contrato.fechaFin, input.contrato.montoRenta,
       input.contrato.periodicidad, input.contrato.moneda ?? 'MXN', input.contrato.autoRenovable ?? false,
       input.contrato.documentoUrl ?? null, estatus, tenantId],
    )

    // Calendario de pagos: se genera automáticamente al crear el contrato.
    await generarCalendarioEnTx(client, genInputFromRow(cr[0]))

    await client.query('commit')
    return { sitio: { ...sitio, arrendadorId, rentaArrendador: input.contrato.montoRenta, periodicidadRenta: input.contrato.periodicidad }, contrato: rowToContrato(cr[0]) }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function listarPagosRenta() {
  const rows = await q('select * from pagos_renta where tenant_id = $1 order by creado_en asc', [await tenantActual()])
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
  const rows = await q('select * from incidencias where tenant_id = $1 order by creado_en asc', [await tenantActual()])
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

// Inicia la renovación de un contrato: estatus RENOVADO y nueva vigencia.
// La fecha de fin es CONFIGURABLE; si no se indica, por defecto +365 días.
// Genera automáticamente los pagos del nuevo periodo (idempotente).
export async function iniciarRenovacion(contratoId: string, nuevaFechaFin?: string | null) {
  const tenantId = await tenantActual()
  return withTenantTx(async (client) => {
    const { rows } = await client.query(
      `update contratos_arrendamiento
          set estatus='RENOVADO',
              fecha_fin = coalesce($2::date, (current_date + interval '365 days')::date)
        where id=$1 and tenant_id=$3 returning *`,
      [contratoId, nuevaFechaFin ?? null, tenantId],
    )
    if (!rows[0]) return null
    await generarCalendarioEnTx(client, genInputFromRow(rows[0]))
    return rowToContrato(rows[0])
  })
}

// ─── CRUD faltante (Fase 1.2): editar/borrar arrendador; editar/cancelar contrato ──

// Edita un arrendador (solo los campos provistos). tenant-scoped.
export async function editarArrendador(id: string, patch: {
  nombre?: string; rfc?: string | null; telefono?: string | null; email?: string | null
  notas?: string | null; curp?: string | null; direccion?: string | null
  cuentaBancaria?: string | null; formaPago?: string | null; observaciones?: string | null
}) {
  const tenantId = await tenantActual()
  const map: [string, unknown][] = [
    ['nombre', patch.nombre], ['rfc', patch.rfc], ['telefono', patch.telefono],
    ['email', patch.email], ['notas', patch.notas], ['curp', patch.curp],
    ['direccion', patch.direccion], ['cuenta_bancaria', patch.cuentaBancaria],
    ['forma_pago', patch.formaPago], ['observaciones', patch.observaciones],
  ]
  const provided = map.filter(([, v]) => v !== undefined)
  if (!provided.length) {
    const cur = await q('select * from arrendadores where id=$1 and tenant_id=$2', [id, tenantId])
    return cur[0] ? rowToArrendador(cur[0]) : null
  }
  const sets = provided.map(([c], i) => `${c} = $${i + 1}`)
  const vals = provided.map(([, v]) => v)
  vals.push(id, tenantId)
  const rows = await q(
    `update arrendadores set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
    vals,
  )
  return rows[0] ? rowToArrendador(rows[0]) : null
}

// Borra un arrendador. Bloquea (RESTRICT) si tiene predios o contratos activos;
// en caso contrario hace SOFT-DELETE (activo=false) para conservar el historial.
export async function borrarArrendador(id: string): Promise<
  | { bloqueado: true; predios: number; contratos: number }
  | { bloqueado: false; arrendador: ReturnType<typeof rowToArrendador> | null }
> {
  const tenantId = await tenantActual()
  const b = await q(
    `select
       (select count(*) from predios p
          where p.arrendador_id=$1 and p.tenant_id=$2) as predios,
       (select count(*) from contratos_arrendamiento c
          where c.arrendador_id=$1 and c.tenant_id=$2
            and c.estatus in ('VIGENTE','POR_VENCER','RENOVADO')) as contratos`,
    [id, tenantId],
  )
  const predios = Number(b[0]?.predios ?? 0)
  const contratos = Number(b[0]?.contratos ?? 0)
  if (predios > 0 || contratos > 0) return { bloqueado: true, predios, contratos }

  const rows = await q(
    `update arrendadores set activo=false where id=$1 and tenant_id=$2 returning *`,
    [id, tenantId],
  )
  return { bloqueado: false, arrendador: rows[0] ? rowToArrendador(rows[0]) : null }
}

// Edita un contrato (campos provistos). Recalcula el estatus por fechas salvo que
// esté CANCELADO (en cuyo caso no se edita: se debe crear uno nuevo).
export async function editarContrato(id: string, patch: {
  fechaInicio?: string; fechaFin?: string; montoRenta?: number; periodicidad?: string
  moneda?: string; deposito?: number | null; documentoUrl?: string | null
  autoRenovable?: boolean; razonSocialId?: string | null
}): Promise<{ noEncontrado: true } | { cancelado: true } | { contrato: ReturnType<typeof rowToContrato> }> {
  const tenantId = await tenantActual()
  const cur = await q('select * from contratos_arrendamiento where id=$1 and tenant_id=$2', [id, tenantId])
  if (!cur[0]) return { noEncontrado: true }
  if (cur[0].estatus === 'CANCELADO') return { cancelado: true }

  const map: [string, unknown][] = [
    ['fecha_inicio', patch.fechaInicio], ['fecha_fin', patch.fechaFin],
    ['monto_renta', patch.montoRenta], ['periodicidad', patch.periodicidad],
    ['moneda', patch.moneda], ['deposito', patch.deposito],
    ['documento_url', patch.documentoUrl], ['auto_renovable', patch.autoRenovable],
    ['razon_social_id', patch.razonSocialId],
  ]
  const provided = map.filter(([, v]) => v !== undefined)

  // Estatus recalculado por las fechas efectivas (patch o actuales).
  const fi = patch.fechaInicio ?? iso(cur[0].fecha_inicio)
  const ff = patch.fechaFin ?? iso(cur[0].fecha_fin)
  provided.push(['estatus', estatusPorFechas(fi, ff)])

  const sets = provided.map(([c], i) =>
    c === 'periodicidad' ? `${c} = $${i + 1}::periodicidad_pago`
    : c === 'estatus'    ? `${c} = $${i + 1}::est_contrato`
    : `${c} = $${i + 1}`)
  const vals = provided.map(([, v]) => v)
  vals.push(id, tenantId)
  const rows = await q(
    `update contratos_arrendamiento set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
    vals,
  )
  // Sincroniza el calendario con las nuevas fechas/monto (idempotente: solo
  // agrega los periodos faltantes; no toca los pagos existentes).
  await generarCalendarioDesdeRow(rows[0])
  return { contrato: rowToContrato(rows[0]) }
}

// Cancela un contrato: estatus CANCELADO + motivo (no se borra, se conserva).
export async function cancelarContrato(id: string, motivo: string) {
  const rows = await q(
    `update contratos_arrendamiento
        set estatus='CANCELADO', motivo_cancelacion=$3
      where id=$1 and tenant_id=$2 and estatus <> 'CANCELADO' returning *`,
    [id, await tenantActual(), motivo],
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
    await fijarTenant(client)
    const inc = (
      await client.query(
        `insert into incidencias (sitio_id, tipo, descripcion, impacta_comercial, estatus, reportado_por_usuario, notas, tenant_id)
         values ($1,$2::tipo_incidencia,$3,true,'ABIERTA',$4,$5,$6) returning *`,
        [input.sitioId, input.tipo, input.descripcion, usuarioId ?? null, 'Reportada desde el módulo de Arrendadores.', await tenantActual()],
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
