import 'server-only'
import type { PoolClient } from 'pg'
import { q, pool, fijarTenant, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { insertarSitio, rowToSitio } from './sitios-repo'
import { AppError } from './errores'

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
  id: string; tenantId: string; fechaInicio: string; fechaFin: string | null
  montoRenta: number | null; periodicidad: string | null
}
function genInputFromRow(r: any): GenInput {
  return {
    id: r.id, tenantId: r.tenant_id,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    // `Number(null)` es 0: preservamos el null para no fabricar pagos de $0.
    montoRenta: r.monto_renta != null ? Number(r.monto_renta) : null,
    periodicidad: r.periodicidad ?? null,
  }
}

// Genera (idempotente) la serie de pagos de un contrato dentro de su vigencia.
// Un periodo cuyo vencimiento ya pasó e impago queda VENCIDO; el resto PENDIENTE.
// NO inventa pagos (no marca PAGADO). Reejecutar no duplica (ON CONFLICT).
// Recibe un client YA en transacción con el tenant fijado.
// Genera el calendario de un contrato dentro de una transacción AJENA (la que
// crea la campaña). Se expone esta y no las dos internas para que el llamador no
// tenga que conocer la forma de `GenInput`. Devuelve cuántas cuotas creó; 0 si
// el contrato aún no tiene importe (incompleto) o el rango no da periodos.
export async function generarCalendarioDeContratoEnTx(
  client: PoolClient,
  filaContrato: any,
): Promise<number> {
  return generarCalendarioEnTx(client, genInputFromRow(filaContrato))
}

async function generarCalendarioEnTx(client: PoolClient, c: GenInput): Promise<number> {
  // Un contrato INCOMPLETO (ADR 0001) no tiene fin, importe ni periodicidad: no
  // hay calendario de pagos que generar hasta que se complete. Explícito, para
  // no depender de que `fin < inicio` lo filtre por accidente.
  if (c.fechaFin == null || c.montoRenta == null || !c.periodicidad) return 0
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
    // OJO: `Number(null)` es 0. Un contrato INCOMPLETO (ADR 0001) todavía no
    // tiene importe, y convertirlo en 0 haría indistinguible «no se sabe cuánto
    // se paga» de «no se paga nada» — exactamente el margen inflado que este
    // estatus existe para señalar. Se preserva el null.
    montoRenta: r.monto_renta != null ? Number(r.monto_renta) : null,
    periodicidad: r.periodicidad ?? null,
    montoMensualEquivalente:
      r.monto_renta != null ? montoMensualEquivalente(Number(r.monto_renta), r.periodicidad) : null,
    moneda: r.moneda,
    autoRenovable: r.auto_renovable,
    documentoUrl: r.documento_url ?? null,
    estatus: r.estatus,
    deposito: r.deposito != null ? Number(r.deposito) : null,
    predioId: r.predio_id ?? null,
    razonSocialId: r.razon_social_id ?? null,
    motivoCancelacion: r.motivo_cancelacion ?? null,
    sitioNombre: r.sitio_nombre ?? null,
    creadoEn: iso(r.creado_en),
  }
}

// Los adjuntos (factura/comprobante) se guardan como data URL base64 y pesan MB.
// NO viajan aquí: el estado global (/api/estado) trae TODOS los pagos y se
// refresca tras cada mutación de la app, así que mandar los archivos lo haría
// crecer sin límite. Solo se expone si existen; el archivo se pide por su ruta
// (GET /api/pagos-renta/[id]/adjunto/[tipo]) cuando alguien lo abre.
// Acepta filas con las columnas crudas (returning *) o con los flags calculados.
function rowToPagoRenta(r: any) {
  return {
    id: r.id,
    contratoId: r.contrato_id,
    periodo: r.periodo,
    monto: Number(r.monto),
    fechaPago: r.fecha_pago ? iso(r.fecha_pago) : null,
    tieneFactura: r.tiene_factura ?? r.factura_url != null,
    tieneComprobante: r.tiene_comprobante ?? r.comprobante_url != null,
    metodoPago: r.metodo_pago ?? null,
    observaciones: r.observaciones ?? null,
    estatus: r.estatus,
    // Solo lo trae `listarPagosRenta`; el resto de rutas que devuelven un pago
    // suelto no hacen el join, y ahí la UI ya tiene el sitio por otra vía.
    sitioNombre: r.sitio_nombre ?? null,
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
  // `sitio_nombre` denormalizado: Finanzas ve los contratos (son compromisos de
  // dinero) pero NO el inventario, así que sin esto no podría decir de qué
  // pantalla es cada renta. Mismo criterio que en listarPagosRenta.
  const rows = await q(
    `select c.*, s.nombre as sitio_nombre
       from contratos_arrendamiento c
       left join sitios s on s.id = c.sitio_id
      where c.tenant_id = $1 order by c.creado_en asc`,
    [await tenantActual()],
  )
  return rows.map(rowToContrato)
}

// Estatus del contrato derivado de sus fechas (permite altas retroactivas):
// VENCIDO si ya terminó, POR_VENCER si vence dentro de 30 días, si no VIGENTE.
// Anticipación con la que un contrato/pago entra en "por vencer": 3 meses
// (regla de negocio — avisar con al menos 3 meses). Antes eran 30 días.
const DIAS_POR_VENCER = 90

function estatusPorFechas(fechaInicio: string, fechaFin: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fechaFin)
  const dias = Math.round((fin.getTime() - hoy.getTime()) / 86_400_000)
  if (dias < 0) return 'VENCIDO'
  if (dias <= DIAS_POR_VENCER) return 'POR_VENCER'
  return 'VIGENTE'
}

// Recálculo persistente del estatus de contratos y pagos contra la fecha de HOY.
// El estatus se guardaba y solo se recomputaba al escribir el contrato, así que
// quedaba "congelado": un contrato vencido seguía como VIGENTE (falseaba el costo
// de renta y no alertaba). Esto lo sincroniza. Se llama como barrido de
// mantenimiento en /api/estado (solo para quien puede ver arrendadores), igual
// que barrerReservasVencidas. Solo escribe filas realmente desincronizadas.
//
// Contratos: CANCELADO es fijo; un RENOVADO que sigue holgado conserva su
// marcador, pero si entra a los 90 días pasa a POR_VENCER y si venció a VENCIDO.
// Pagos: PAGADO es fijo; un PENDIENTE cuyo vencimiento (periodo) ya pasó → VENCIDO.
//
// INCOMPLETO también es fijo (ADR 0001): no tiene `fecha_fin`, así que las tres
// condiciones del CASE dan NULL, caería al ELSE y este barrido lo pasaría a
// VIGENTE — que el CHECK `contrato_completo_ck` rechaza, tumbando /api/estado
// entero y con él los datos de TODAS las pantallas. Un contrato sin fecha de fin
// no tiene vencimiento que recomputar. El `fecha_fin is not null` es el mismo
// resguardo por si alguna fila vieja quedara sin fecha.
export async function recomputarEstatusArrendadores(): Promise<void> {
  await q(
    `update contratos_arrendamiento
        set estatus = (case
          when current_date > fecha_fin then 'VENCIDO'
          when (fecha_fin - current_date) <= $1 then 'POR_VENCER'
          when estatus = 'RENOVADO' then 'RENOVADO'
          else 'VIGENTE'
        end)::est_contrato
      where estatus not in ('CANCELADO', 'INCOMPLETO')
        and fecha_fin is not null
        and estatus <> (case
          when current_date > fecha_fin then 'VENCIDO'
          when (fecha_fin - current_date) <= $1 then 'POR_VENCER'
          when estatus = 'RENOVADO' then 'RENOVADO'
          else 'VIGENTE'
        end)::est_contrato`,
    [DIAS_POR_VENCER],
  )
  await q(
    `update pagos_renta
        set estatus = 'VENCIDO'
      where estatus = 'PENDIENTE' and periodo::date < current_date`,
  )
}

// Alta unificada "arrendatario → predio → contrato → pantalla" en UNA transacción.
// - arrendador: {id} usa uno existente; {nombre,...} da de alta uno nuevo.
// - predio: {id} usa uno existente del MISMO arrendador; {nombre,...} da de alta uno.
//   El predio es OBLIGATORIO: el contrato cuelga del predio y el P&L atribuye la
//   renta por predio (derive.ts), así que un contrato sin predio_id no costaría
//   nada y inflaría el margen.
// - contrato: periodo (fechas pasadas permitidas), renta, periodicidad, etc.
// - sitio: datos de la pantalla/espectacular (mismo shape que el alta manual).
// La renta NO se copia a los campos directos del sitio (renta_arrendador /
// periodicidad_renta): están DEPRECADOS (M1) y la fuente es el contrato del predio.
export async function crearContratoConSitio(input: {
  arrendador: { id: string } | { nombre: string; rfc?: string | null; telefono?: string | null; email?: string | null; notas?: string | null }
  predio: { id: string } | { nombre: string; direccion?: string | null; lat?: number | null; lng?: number | null; tipoUbicacion?: string | null; estado?: string }
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
      const { rows } = await client.query(
        'select 1 from arrendadores where id=$1 and tenant_id=$2',
        [input.arrendador.id, tenantId],
      )
      if (!rows[0]) throw new AppError('El arrendador no existe', 404)
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

    // 2) Predio (existente o nuevo). Si es existente debe ser del mismo
    //    arrendador: si no, la renta se atribuiría a pantallas de otro dueño.
    let predioId: string
    if ('id' in input.predio) {
      const { rows } = await client.query(
        'select arrendador_id from predios where id=$1 and tenant_id=$2',
        [input.predio.id, tenantId],
      )
      if (!rows[0]) throw new AppError('El predio no existe', 404)
      if (rows[0].arrendador_id !== arrendadorId) {
        throw new AppError('El predio pertenece a otro arrendador', 409)
      }
      // Un predio solo puede tener un contrato activo: si ya lo tiene, lo que se
      // quiere es colgar otra pantalla del predio (agregarPantallaAPredio), no
      // firmar un segundo contrato que duplicaría la renta.
      if (await contratoActivoDePredio(client, tenantId, input.predio.id)) {
        throw new AppError(
          'El predio ya tiene un contrato activo. Agrega la pantalla al predio en vez de crear otro contrato, ' +
          'o cancela/vence el contrato anterior primero.',
          409,
        )
      }
      predioId = input.predio.id
    } else {
      const row = await insertarPredioEnTx(client, tenantId, { ...input.predio, arrendadorId })
      if (!row) throw new AppError('El arrendador no existe', 404)
      predioId = row.id
    }

    // 3) Pantalla (misma transacción), ligada al predio: una del inventario que
    //    aún no tiene predio, o una nueva.
    const sitioId = await resolverSitioEnTx(client, tenantId, input.sitio, predioId)
    const { rows: sr } = await client.query(
      `update sitios set arrendador_id = $1, predio_id = $2 where id = $3 and tenant_id = $4 returning *`,
      [arrendadorId, predioId, sitioId, tenantId],
    )
    const sitio = rowToSitio(sr[0])

    // 4) Contrato de arrendamiento: cuelga del PREDIO (sitio_id se conserva por
    //    compatibilidad con el histórico; predio_id es la fuente del P&L).
    const estatus = estatusPorFechas(input.contrato.fechaInicio, input.contrato.fechaFin)
    const { rows: cr } = await client.query(
      `insert into contratos_arrendamiento
        (sitio_id, predio_id, arrendador_id, fecha_inicio, fecha_fin, monto_renta, periodicidad, moneda, auto_renovable, documento_url, estatus, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [sitioId, predioId, arrendadorId, input.contrato.fechaInicio, input.contrato.fechaFin, input.contrato.montoRenta,
       input.contrato.periodicidad, input.contrato.moneda ?? 'MXN', input.contrato.autoRenovable ?? false,
       input.contrato.documentoUrl ?? null, estatus, tenantId],
    )

    // Calendario de pagos: se genera automáticamente al crear el contrato.
    await generarCalendarioEnTx(client, genInputFromRow(cr[0]))

    await client.query('commit')
    return { sitio: { ...sitio, arrendadorId, predioId }, contrato: rowToContrato(cr[0]) }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Sin las columnas de adjuntos (pesan MB): solo si existen. Ver rowToPagoRenta.
export async function listarPagosRenta() {
  const rows = await q(
    // `sitio_nombre` va denormalizado a propósito: Finanzas necesita saber de qué
    // pantalla es cada pago, pero NO tiene permiso sobre el inventario ni sobre
    // los contratos (ahí viven importes y datos del propietario). Traer el nombre
    // aquí evita abrirle esos dos módulos enteros solo para pintar una columna.
    `select p.id, p.contrato_id, p.periodo, p.monto, p.fecha_pago, p.metodo_pago,
            p.observaciones, p.estatus, p.creado_en,
            p.factura_url     is not null as tiene_factura,
            p.comprobante_url is not null as tiene_comprobante,
            s.nombre as sitio_nombre
       from pagos_renta p
       left join contratos_arrendamiento c on c.id = p.contrato_id
       left join sitios s on s.id = c.sitio_id
      where p.tenant_id = $1 order by p.creado_en asc`,
    [await tenantActual()],
  )
  return rows.map(rowToPagoRenta)
}

export type TipoAdjunto = 'factura' | 'comprobante'

// Devuelve el data URL del adjunto (solo cuando alguien lo abre).
export async function obtenerAdjuntoPago(pagoId: string, tipo: TipoAdjunto): Promise<string | null> {
  const col = tipo === 'factura' ? 'factura_url' : 'comprobante_url'
  const rows = await q(
    `select ${col} as url from pagos_renta where id=$1 and tenant_id=$2`,
    [pagoId, await tenantActual()],
  )
  if (!rows[0]) return null
  return rows[0].url ?? null
}

// Adjunta/reemplaza factura y comprobante de un pago. A diferencia de
// registrarPagoRenta, NO toca estatus ni fecha_pago: la factura suele llegar
// días después del pago, y corregir un adjunto no debe re-sellar el pago.
// `null` explícito borra el adjunto; `undefined` lo deja como está.
export async function adjuntarAPago(pagoId: string, datos: {
  facturaUrl?: string | null; comprobanteUrl?: string | null
  metodoPago?: string | null; observaciones?: string | null
}) {
  const tenantId = await tenantActual()
  const map: [string, unknown][] = [
    ['factura_url', datos.facturaUrl], ['comprobante_url', datos.comprobanteUrl],
    ['metodo_pago', datos.metodoPago], ['observaciones', datos.observaciones],
  ]
  const provided = map.filter(([, v]) => v !== undefined)
  if (!provided.length) {
    const cur = await q('select * from pagos_renta where id=$1 and tenant_id=$2', [pagoId, tenantId])
    return cur[0] ? rowToPagoRenta(cur[0]) : null
  }
  const sets = provided.map(([c], i) => `${c} = $${i + 1}`)
  const vals = provided.map(([, v]) => v)
  vals.push(pagoId, tenantId)
  const rows = await q(
    `update pagos_renta set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
    vals,
  )
  return rows[0] ? rowToPagoRenta(rows[0]) : null
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

// Registra un pago de renta: PAGADO + fecha, con adjuntos opcionales (factura,
// comprobante), método de pago y observaciones. coalesce conserva lo previo.
export async function registrarPagoRenta(pagoId: string, datos?: {
  fechaPago?: string | null; metodoPago?: string | null; facturaUrl?: string | null
  comprobanteUrl?: string | null; observaciones?: string | null
}): Promise<
  | { noEncontrado: true }
  | { yaPagado: string }
  | { pago: ReturnType<typeof rowToPagoRenta> }
> {
  const d = datos ?? {}
  const tenantId = await tenantActual()
  const cur = await q('select estatus, fecha_pago from pagos_renta where id=$1 and tenant_id=$2', [pagoId, tenantId])
  if (!cur[0]) return { noEncontrado: true }
  // Idempotencia con rastro: volver a registrar un pago PAGADO sobrescribía su
  // fecha en silencio. Se rechaza; corregirlo es una acción explícita.
  if (cur[0].estatus === 'PAGADO') {
    const f = cur[0].fecha_pago ? String(iso(cur[0].fecha_pago)).slice(0, 10) : 'sin fecha'
    return { yaPagado: f }
  }
  const rows = await q(
    `update pagos_renta set
        estatus         = 'PAGADO',
        fecha_pago      = coalesce($3::timestamptz, now()),
        metodo_pago     = coalesce($4, metodo_pago),
        factura_url     = coalesce($5, factura_url),
        comprobante_url = coalesce($6, comprobante_url),
        observaciones   = coalesce($7, observaciones)
      where id=$1 and tenant_id=$2 and estatus <> 'PAGADO' returning *`,
    [pagoId, tenantId, d.fechaPago ?? null, d.metodoPago ?? null,
     d.facturaUrl ?? null, d.comprobanteUrl ?? null, d.observaciones ?? null],
  )
  // Carrera: otro request lo pagó entre el select y el update.
  if (!rows[0]) return { yaPagado: 'sin fecha' }
  return { pago: rowToPagoRenta(rows[0]) }
}

// ─── Razón social del arrendador (Fase 1.5) ─────────────────────────────────
function rowToRazonSocial(r: any) {
  return {
    id: r.id,
    arrendadorId: r.arrendador_id,
    razonSocial: r.razon_social,
    rfc: r.rfc ?? null,
    regimen: r.regimen ?? null,
    creadoEn: iso(r.creado_en),
  }
}

export async function listarRazonesSociales() {
  const rows = await q(
    'select * from arrendador_razon_social where tenant_id = $1 order by razon_social asc',
    [await tenantActual()],
  )
  return rows.map(rowToRazonSocial)
}

export async function crearRazonSocial(input: {
  arrendadorId: string; razonSocial: string; rfc?: string | null; regimen?: string | null
}) {
  const rows = await q(
    `insert into arrendador_razon_social (arrendador_id, razon_social, rfc, regimen, tenant_id)
     values ($1,$2,$3,$4,$5) returning *`,
    [input.arrendadorId, input.razonSocial, input.rfc ?? null, input.regimen ?? null, await tenantActual()],
  )
  return rowToRazonSocial(rows[0])
}

// ─── Predios (listado; entidad central del módulo) ──────────────────────────
function rowToPredio(r: any) {
  return {
    id: r.id,
    arrendadorId: r.arrendador_id,
    nombre: r.nombre,
    direccion: r.direccion ?? null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    tipoUbicacion: r.tipo_ubicacion ?? null,
    estado: r.estado,
    documentos: r.documentos ?? [],
    creadoEn: iso(r.creado_en),
  }
}

export async function listarPredios() {
  const rows = await q(
    'select * from predios where tenant_id = $1 order by creado_en asc',
    [await tenantActual()],
  )
  return rows.map(rowToPredio)
}

export interface PredioInput {
  arrendadorId: string; nombre: string; direccion?: string | null
  lat?: number | null; lng?: number | null; tipoUbicacion?: string | null; estado?: string
}

// Inserta un predio dentro de una transacción con el tenant ya fijado.
// Valida que el arrendador exista EN ESTE TENANT: la FK a arrendadores(id) no
// comprueba tenant (los chequeos de FK saltan la RLS), así que sin esto un
// arrendador_id de otro tenant pasaría.
// tenantId puede ser null (sin sesión): entonces no casa ningún arrendador y el
// alta se rechaza — fail-closed, igual que la RLS.
async function insertarPredioEnTx(client: PoolClient, tenantId: string | null, p: PredioInput) {
  const { rows: arr } = await client.query(
    'select 1 from arrendadores where id=$1 and tenant_id=$2',
    [p.arrendadorId, tenantId],
  )
  if (!arr[0]) return null
  const { rows } = await client.query(
    `insert into predios (arrendador_id, nombre, direccion, lat, lng, tipo_ubicacion, estado, tenant_id)
     values ($1,$2,$3,$4,$5,$6,$7::estado_predio,$8) returning *`,
    [p.arrendadorId, p.nombre, p.direccion ?? null, p.lat ?? null, p.lng ?? null,
     p.tipoUbicacion ?? null, p.estado ?? 'DISPONIBLE', tenantId],
  )
  return rows[0]
}

// Alta de un predio (entidad central: Arrendador → Predio → Contrato → Pantallas).
// Devuelve null si el arrendador no existe en el tenant.
export async function crearPredio(input: PredioInput) {
  const tenantId = await tenantActual()
  return withTenantTx(async (client) => {
    const row = await insertarPredioEnTx(client, tenantId, input)
    return row ? rowToPredio(row) : null
  })
}

// Resuelve la pantalla de un alta: {id} liga una que YA existe en el inventario
// (el caso normal: el dueño ya tiene sus pantallas cargadas y solo les asigna
// arrendador y predio); cualquier otra cosa da de alta una nueva.
// Una pantalla solo puede estar en un predio: si ya está en otro, se rechaza en
// vez de moverla en silencio (movería su renta de un predio a otro).
async function resolverSitioEnTx(
  client: PoolClient, tenantId: string | null,
  sitio: { id: string } | Record<string, unknown>, predioId: string,
): Promise<string> {
  if ('id' in sitio && typeof sitio.id === 'string') {
    const { rows } = await client.query(
      'select predio_id from sitios where id=$1 and tenant_id=$2',
      [sitio.id, tenantId],
    )
    if (!rows[0]) throw new AppError('La pantalla no existe', 404)
    if (rows[0].predio_id && rows[0].predio_id !== predioId) {
      throw new AppError('La pantalla ya pertenece a otro predio', 409)
    }
    return sitio.id
  }
  const nuevo = await insertarSitio(client, { ...sitio, tenantId })
  return nuevo.id
}

// ¿El predio ya tiene un contrato activo? La renta del predio es UNA sola: un
// segundo contrato activo la duplicaría y el P&L solo contaría el mayor (M8 lo
// impide también desde la BD, con un índice único parcial).
const ESTATUS_ACTIVO = ['VIGENTE', 'POR_VENCER', 'RENOVADO']
async function contratoActivoDePredio(client: PoolClient, tenantId: string | null, predioId: string) {
  const { rows } = await client.query(
    `select id from contratos_arrendamiento
      where predio_id=$1 and tenant_id=$2 and estatus = any($3::est_contrato[]) limit 1`,
    [predioId, tenantId, ESTATUS_ACTIVO],
  )
  return rows[0]?.id ?? null
}

// Cuelga una pantalla de un predio SIN crear contrato: la renta ya la define el
// contrato del predio y se reparte entre sus pantallas (N pantallas : 1 predio).
// `sitio` puede ser {id} (liga una pantalla existente) o los datos de una nueva.
export async function agregarPantallaAPredio(predioId: string, sitio: { id: string } | Record<string, unknown>) {
  const tenantId = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    const { rows: pr } = await client.query(
      'select arrendador_id from predios where id=$1 and tenant_id=$2',
      [predioId, tenantId],
    )
    if (!pr[0]) throw new AppError('El predio no existe', 404)
    const arrendadorId = pr[0].arrendador_id

    const sitioId = await resolverSitioEnTx(client, tenantId, sitio, predioId)
    const { rows } = await client.query(
      'update sitios set predio_id=$1, arrendador_id=$2 where id=$3 and tenant_id=$4 returning *',
      [predioId, arrendadorId, sitioId, tenantId],
    )
    await client.query('commit')
    return { sitioId: rows[0].id, predioId, arrendadorId }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Edita un predio (solo los campos provistos). tenant-scoped.
export async function editarPredio(id: string, patch: {
  nombre?: string; direccion?: string | null; lat?: number | null; lng?: number | null
  tipoUbicacion?: string | null; estado?: string
}) {
  const tenantId = await tenantActual()
  const map: [string, unknown][] = [
    ['nombre', patch.nombre], ['direccion', patch.direccion], ['lat', patch.lat],
    ['lng', patch.lng], ['tipo_ubicacion', patch.tipoUbicacion], ['estado', patch.estado],
  ]
  const provided = map.filter(([, v]) => v !== undefined)
  if (!provided.length) {
    const cur = await q('select * from predios where id=$1 and tenant_id=$2', [id, tenantId])
    return cur[0] ? rowToPredio(cur[0]) : null
  }
  const sets = provided.map(([c], i) =>
    c === 'estado' ? `${c} = $${i + 1}::estado_predio` : `${c} = $${i + 1}`)
  const vals = provided.map(([, v]) => v)
  vals.push(id, tenantId)
  const rows = await q(
    `update predios set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
    vals,
  )
  return rows[0] ? rowToPredio(rows[0]) : null
}

// Inicia la renovación de un contrato: estatus RENOVADO y nueva vigencia.
// La fecha de fin es CONFIGURABLE; si no se indica, por defecto +365 días.
// Genera automáticamente los pagos del nuevo periodo (idempotente).
export async function iniciarRenovacion(contratoId: string, nuevaFechaFin?: string | null): Promise<
  | { noEncontrado: true }
  | { fechaNoPosterior: string }
  | { incompleto: true }
  | { contrato: ReturnType<typeof rowToContrato> }
> {
  const tenantId = await tenantActual()
  return withTenantTx(async (client) => {
    const { rows: cur } = await client.query(
      'select fecha_fin, estatus from contratos_arrendamiento where id=$1 and tenant_id=$2',
      [contratoId, tenantId],
    )
    if (!cur[0]) return { noEncontrado: true }
    // Renovar EXTIENDE un acuerdo existente; un contrato INCOMPLETO (ADR 0001)
    // no tiene acuerdo que extender: le faltan arrendador, importe y
    // periodicidad. Sin este guard el UPDATE lo pondría en RENOVADO con esos
    // campos en NULL y el CHECK `contrato_completo_ck` devolvería un 23514
    // opaco («Un valor no cumple las reglas de la tabla») en vez de decir qué
    // hay que hacer. Además `fecha_fin` es NULL aquí, así que la comparación de
    // fechas de abajo trabajaría sobre la cadena "null".
    if (cur[0].estatus === 'INCOMPLETO') return { incompleto: true }
    // Renovar EXTIENDE la vigencia. Una fecha anterior a la actual acortaría el
    // contrato y generaría periodos ya vencidos (el calendario los marca VENCIDO).
    const finActual = String(iso(cur[0].fecha_fin)).slice(0, 10)
    if (nuevaFechaFin && nuevaFechaFin.slice(0, 10) <= finActual) {
      return { fechaNoPosterior: finActual }
    }
    const { rows } = await client.query(
      `update contratos_arrendamiento
          set estatus='RENOVADO',
              fecha_fin = coalesce($2::date, (current_date + interval '365 days')::date)
        where id=$1 and tenant_id=$3 returning *`,
      [contratoId, nuevaFechaFin ?? null, tenantId],
    )
    await generarCalendarioEnTx(client, genInputFromRow(rows[0]))
    return { contrato: rowToContrato(rows[0]) }
  })
}

// ─── CRUD faltante (Fase 1.2): editar/borrar arrendador; editar/cancelar contrato ──

// Snapshot de los datos bancarios ACTUALES de un arrendador. Se usa para el
// audit inmutable de A-4: registrar el valor anterior antes de sobrescribirlo
// (a dónde se pagaba la renta). tenant-scoped.
export async function datosBancariosArrendador(
  id: string,
): Promise<{ cuentaBancaria: string | null; formaPago: string | null } | null> {
  const rows = await q<{ cuenta_bancaria: string | null; forma_pago: string | null }>(
    'select cuenta_bancaria, forma_pago from arrendadores where id=$1 and tenant_id=$2',
    [id, await tenantActual()],
  )
  const r = rows[0]
  return r ? { cuentaBancaria: r.cuenta_bancaria ?? null, formaPago: r.forma_pago ?? null } : null
}

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

// Estatus actual de un contrato. Lo usa la ruta PATCH para decidir el nivel de
// candado ANTES de editar: completar un contrato INCOMPLETO fija por primera vez
// cuánto se le paga al propietario, y eso exige el modo estricto (ADR 0001).
export async function estatusContrato(id: string): Promise<string | null> {
  const tenantId = await tenantActual()
  const rows = await q<{ estatus: string }>(
    'select estatus from contratos_arrendamiento where id=$1 and tenant_id=$2',
    [id, tenantId],
  )
  return rows[0]?.estatus ?? null
}

// Edita un contrato (campos provistos). Recalcula el estatus por fechas salvo que
// esté CANCELADO (en cuyo caso no se edita: se debe crear uno nuevo).
export async function editarContrato(id: string, patch: {
  fechaInicio?: string; fechaFin?: string; montoRenta?: number; periodicidad?: string
  moneda?: string; deposito?: number | null; documentoUrl?: string | null
  autoRenovable?: boolean; razonSocialId?: string | null; arrendadorId?: string
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
    ['razon_social_id', patch.razonSocialId], ['arrendador_id', patch.arrendadorId],
  ]
  const provided = map.filter(([, v]) => v !== undefined)

  // Valores EFECTIVOS tras el patch (lo que quedará en la fila).
  const fi = patch.fechaInicio ?? iso(cur[0].fecha_inicio)
  const ff = patch.fechaFin ?? iso(cur[0].fecha_fin)
  const arrendador = patch.arrendadorId ?? cur[0].arrendador_id
  const monto = patch.montoRenta ?? cur[0].monto_renta
  const per = patch.periodicidad ?? cur[0].periodicidad

  // ADR 0001: un contrato solo sale de INCOMPLETO cuando tiene los cuatro datos.
  // Mientras le falte alguno se queda como está, en vez de que `estatusPorFechas`
  // lo mueva a VIGENTE y el CHECK `contrato_completo_ck` reviente la petición con
  // un error de base de datos incomprensible para quien lo está capturando.
  const completo = arrendador != null && ff != null && monto != null && per != null
  provided.push(['estatus', completo ? estatusPorFechas(fi, ff) : 'INCOMPLETO'])

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

// ─── Pausa legal del inventario (Fase 1 · Arrendadores ↔ Operaciones) ─────────
// Pausa una pantalla por una situación legal: registra el motivo y la saca de la
// disponibilidad comercial (BLOQUEADO). Reversible con reanudarSitioLegal.
// Devuelve null si el sitio no existe o es de otro tenant (RLS) → la ruta lo
// mapea a 404. `q` fija el tenant de la sesión.
export async function pausarSitioLegal(sitioId: string, motivo: string): Promise<{ nombre: string } | null> {
  const rows = await q<{ nombre: string }>(
    `update sitios
        set pausa_legal = true, motivo_pausa_legal = $2, pausa_legal_en = now(),
            estatus_comercial = 'BLOQUEADO'
      where id = $1
      returning nombre`,
    [sitioId, motivo],
  )
  return rows[0] ?? null
}

// Reubica una pantalla a otro predio (mover inventario). Devuelve los nombres
// para la OT de reubicación, o null si la pantalla o el predio destino no existen
// (RLS acota al tenant de la sesión).
export async function reubicarSitio(
  sitioId: string,
  predioId: string,
): Promise<{ sitioNombre: string; predioNombre: string } | null> {
  const predio = await q<{ nombre: string }>('select nombre from predios where id = $1', [predioId])
  if (!predio.length) return null
  const rows = await q<{ nombre: string }>(
    'update sitios set predio_id = $2 where id = $1 returning nombre',
    [sitioId, predioId],
  )
  if (!rows.length) return null
  return { sitioNombre: rows[0].nombre, predioNombre: predio[0].nombre }
}

export async function reanudarSitioLegal(sitioId: string): Promise<{ nombre: string } | null> {
  const rows = await q<{ nombre: string }>(
    `update sitios
        set pausa_legal = false, motivo_pausa_legal = null, pausa_legal_en = null,
            estatus_comercial = 'DISPONIBLE'
      where id = $1 and pausa_legal = true
      returning nombre`,
    [sitioId],
  )
  return rows[0] ?? null
}
