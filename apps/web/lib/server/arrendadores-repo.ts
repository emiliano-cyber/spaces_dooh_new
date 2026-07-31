import 'server-only'
import type { PoolClient } from 'pg'
import { q, q1, pool, fijarTenant, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { insertarSitio, rowToSitio } from './sitios-repo'
import { AppError } from './errores'
import { periodoDeIndice, montoMensualEquivalente } from '../renta-periodicidad'
// Sin ciclo: contratos-sitio solo importa `errores` y los tipos de pg.
import { exigirArrendador } from './contratos-sitio'
import { sumarDias } from '../contrato-vigencia'

// ============================================================================
//  lib/server/arrendadores-repo.ts — Arrendadores, contratos de arrendamiento
//  y pagos de renta. Alimentan el módulo Arrendadores y el gasto fijo de renta
//  del motor de costos (dashboard).
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)

// Periodicidad (equivalente mensual y avance de periodo): la tabla canónica vive
// en lib/renta-periodicidad.ts, compartida con derive.ts y con la UI. Se
// reexporta `montoMensualEquivalente` porque varios módulos de servidor ya la
// importaban desde aquí.
export { montoMensualEquivalente }

// Tope de cuotas que genera un solo contrato. Con periodicidad DIARIA un
// contrato de 10 años son 3 650 vencimientos; por encima de eso lo más probable
// es una fecha de fin mal capturada (un 2035 donde iba 2025), no un acuerdo
// real. Antes el tope era 1 200 y el bucle simplemente DEJABA DE GENERAR al
// alcanzarlo: el contrato quedaba con la mitad de su calendario y nadie se
// enteraba —los pagos que faltaban no aparecían como pendientes ni como
// vencidos, así que la renta se dejaba de reclamar en silencio—. Ahora falla
// ruidosamente: es mejor que el alta se rechace a que el calendario mienta.
const MAX_CUOTAS = 3700

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
// NO inventa pagos (no marca PAGADO). Reejecutar no duplica (ON CONFLICT), pero
// sí pone al día el IMPORTE de las cuotas no pagadas: el calendario es una
// proyección del contrato y tiene que seguirlo (ver el detalle abajo).
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
  // El vencimiento se calcula desde el ÍNDICE sobre la fecha de inicio, no
  // avanzando sobre el anterior: acumular arrastra el recorte de los meses
  // cortos y descuadra la serie entera. Ver `periodoDeIndice` y el ADR 0007.
  let k = 0
  let cursor = periodoDeIndice(inicio, 0, c.periodicidad)
  while (cursor <= fin) {
    if (values.length >= MAX_CUOTAS) {
      throw new AppError(
        `La vigencia del contrato genera más de ${MAX_CUOTAS} pagos con periodicidad ` +
          `${c.periodicidad.toLowerCase()}. Revisa la fecha de fin: con esa cadencia el ` +
          'calendario no puede cubrir un plazo tan largo.',
        400,
      )
    }
    const periodo = cursor.toISOString().slice(0, 10)      // YYYY-MM-DD (vencimiento)
    const estatus = cursor < hoy ? 'VENCIDO' : 'PENDIENTE'
    const b = params.length
    values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5}::est_pago_renta)`)
    params.push(c.id, c.tenantId, periodo, c.montoRenta, estatus)
    k += 1
    cursor = periodoDeIndice(inicio, k, c.periodicidad)
  }
  if (!values.length) return 0
  const res = await client.query(
    `insert into pagos_renta (contrato_id, tenant_id, periodo, monto, estatus)
     values ${values.join(',')}
     on conflict (contrato_id, periodo) do nothing`,
    params,
  )

  // Reajuste del importe de las cuotas que YA existían. El `do nothing` de
  // arriba, por definición, no las toca: al corregir la renta de un contrato
  // solo los periodos NUEVOS nacían con el importe nuevo y los viejos se
  // quedaban con el anterior, sin que nada lo dijera. El calendario acababa
  // mezclando dos precios del mismo contrato —se ve en la demo: una cuota de
  // 45 000 y diecinueve de 66 000— y Finanzas seguía programando la salida de
  // dinero equivocada. Peor: no hay forma de editar una cuota suelta, así que
  // tampoco había manera de arreglarlo a mano.
  //
  // Se reajusta TODO lo no pagado, no solo lo futuro, porque editar el importe
  // aquí es una CORRECCIÓN y no un aumento de renta:
  //
  //   · `pagos_renta` es una proyección del contrato, no un libro aparte. El
  //     único hecho consumado es PAGADO —ahí hubo una transferencia real— y por
  //     eso es lo único que se respeta.
  //   · Un contrato FIRMADO no se puede editar (`editarContrato` responde
  //     `firmado`), así que todo lo que llega hasta aquí es un acuerdo que aún
  //     no obliga a nadie. Un aumento de renta de verdad se modela con un
  //     contrato NUEVO —el guard de traslape ya obliga a que empiece donde
  //     termina el anterior—, no reescribiendo este.
  //
  // `is distinct from` y no `<>`: con `monto` NULL el `<>` daría NULL, la fila
  // no entraría en el WHERE y la cuota se quedaría sin importe para siempre.
  await client.query(
    `update pagos_renta
        set monto = $2
      where contrato_id = $1
        and estatus <> 'PAGADO'
        and monto is distinct from $2`,
    [c.id, c.montoRenta],
  )

  return res.rowCount ?? 0
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

    // Un espacio no puede estar arrendado dos veces a la vez. Si el predio —o la
    // pantalla, cuando viene del inventario sin predio— ya tuvo un contrato, el
    // nuevo tiene que empezar DESPUÉS de donde terminó aquel.
    //
    // El guard de `contratoActivoDePredio` de arriba no cubre esto: solo frena
    // los contratos ACTIVOS. Con uno VENCIDO se podía firmar otro con fecha de
    // inicio anterior a su fin, solapándolos, y entonces el P&L elige uno de los
    // dos y el calendario genera cuotas de ambos para los días repetidos: renta
    // pagada dos veces por el mismo periodo.
    //
    // Se comprueba aquí, con `sitioId` ya resuelto, porque el ancla depende de
    // si la pantalla quedó colgada de un predio o no.
    const { rows: prev } = await client.query(
      `select max(fecha_fin) as ultimo_fin
         from contratos_arrendamiento
        where tenant_id = $1
          and estatus <> 'CANCELADO'
          and fecha_fin is not null
          and ( ($2::uuid is not null and predio_id = $2)
             or ($2::uuid is null and predio_id is null and sitio_id = $3) )`,
      [tenantId, predioId, sitioId],
    )
    const ultimoFin = prev[0]?.ultimo_fin ? iso(prev[0].ultimo_fin).slice(0, 10) : null
    if (ultimoFin && input.contrato.fechaInicio.slice(0, 10) <= ultimoFin) {
      throw new AppError(
        `Ese espacio ya estuvo arrendado hasta el ${ultimoFin}. El contrato nuevo debe empezar ` +
          `el ${sumarDias(ultimoFin, 1)} o después, para no traslapar la vigencia anterior.`,
        409,
      )
    }
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

// Alta de razón social. Además de insertarla, ADOPTA los contratos de ese
// arrendador que se quedaron sin ninguna.
//
// El motivo: la herencia de razón social solo ocurría al CREAR el contrato
// (`asignarArrendadorYAbrirContrato`, `crearContratoConSitio`) y nunca se ponía
// al corriente. Si el arrendador aún no tenía razón social —el caso normal
// cuando las pantallas entran por importación masiva— sus contratos nacían con
// `razon_social_id` NULL, y capturar la razón social después NO los alcanzaba:
// se quedaban huérfanos para siempre. Nada los reclamaba, porque la razón social
// no es de los cuatro datos que exige `contrato_completo_ck`; solo aparecían
// agrupados bajo «Sin razón social» en Finanzas. Y a nombre de quién se factura
// la renta es dato fiscal: sin ella no hay a quién emitirle el pago.
//
// Devuelve también cuántos contratos adoptó, para poder decirlo en la UI en vez
// de que el arreglo ocurra en silencio.
export async function crearRazonSocial(input: {
  arrendadorId: string; razonSocial: string; rfc?: string | null; regimen?: string | null
}): Promise<{ razonSocial: ReturnType<typeof rowToRazonSocial>; contratosAdoptados: number }> {
  const tenantId = await tenantActual()
  return withTenantTx(async (client) => {
    const { rows } = await client.query(
      `insert into arrendador_razon_social (arrendador_id, razon_social, rfc, regimen, tenant_id)
       values ($1,$2,$3,$4,$5) returning *`,
      [input.arrendadorId, input.razonSocial, input.rfc ?? null, input.regimen ?? null, tenantId],
    )
    const creada = rows[0]

    // Se adopta SOLO si esta queda como la ÚNICA del arrendador. Con varias no
    // se puede adivinar cuál factura cada contrato —esa es decisión de quien
    // captura— y elegir la recién creada sería arbitrario. Es la misma condición
    // que ya usa la herencia al abrir un contrato.
    const { rowCount } = await client.query(
      `update contratos_arrendamiento c
          set razon_social_id = $1
        where c.tenant_id = $2
          and c.arrendador_id = $3
          and c.razon_social_id is null
          -- Un contrato roto no se factura a nadie.
          and c.estatus <> 'CANCELADO'
          -- Y sobre todo: lo FIRMADO no se toca. El documento firmado nombra a
          -- las partes; cambiarle la razón social después dejaría la firma
          -- respaldando algo distinto de lo que se acordó.
          and not exists (
                select 1 from contrato_firmas f
                 where f.contrato_id = c.id and f.estatus = 'FIRMADA'
              )
          and (select count(*) from arrendador_razon_social r2
                where r2.arrendador_id = $3 and r2.tenant_id = $2) = 1`,
      [creada.id, tenantId, input.arrendadorId],
    )

    return { razonSocial: rowToRazonSocial(creada), contratosAdoptados: rowCount ?? 0 }
  })
}

// Edita una razón social. Solo toca lo que venga en `patch`: así se puede
// COMPLETAR un dato que faltaba (p. ej. el RFC) sin reescribir los demás, que es
// el caso normal cuando la razón social nació de una carga automática.
export async function editarRazonSocial(
  id: string,
  patch: { razonSocial?: string; rfc?: string | null; regimen?: string | null },
) {
  const tenantId = await tenantActual()
  const map: [string, unknown][] = [
    ['razon_social', patch.razonSocial],
    ['rfc', patch.rfc],
    ['regimen', patch.regimen],
  ]
  const provided = map.filter(([, v]) => v !== undefined)
  if (!provided.length) {
    const cur = await q('select * from arrendador_razon_social where id=$1 and tenant_id=$2', [id, tenantId])
    return cur[0] ? rowToRazonSocial(cur[0]) : null
  }
  const sets = provided.map(([c], i) => `${c} = $${i + 1}`)
  const vals = provided.map(([, v]) => v)
  vals.push(id, tenantId)
  const rows = await q(
    `update arrendador_razon_social set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
    vals,
  )
  return rows[0] ? rowToRazonSocial(rows[0]) : null
}

// Cuántos contratos facturan a esta razón social. Se consulta ANTES de borrar:
// la FK es ON DELETE SET NULL, así que un borrado no falla — deja los contratos
// sin razón social en silencio, que es peor que un error.
export async function contratosDeRazonSocial(id: string): Promise<number> {
  const r = await q1<{ n: string }>(
    'select count(*)::int as n from contratos_arrendamiento where razon_social_id = $1 and tenant_id = $2',
    [id, await tenantActual()],
  )
  return Number(r?.n ?? 0)
}

export async function borrarRazonSocial(id: string): Promise<boolean> {
  const rows = await q(
    'delete from arrendador_razon_social where id=$1 and tenant_id=$2 returning id',
    [id, await tenantActual()],
  )
  return rows.length > 0
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
}): Promise<
  | { noEncontrado: true }
  | { cancelado: true }
  | { firmado: true }
  | { contrato: ReturnType<typeof rowToContrato> }
> {
  const tenantId = await tenantActual()
  // La edición y la sincronización del calendario van en UNA transacción, como
  // en `iniciarRenovacion`. Antes el UPDATE se hacía suelto (`q`) y el
  // calendario abría su propia transacción después: si la generación fallaba,
  // el contrato YA estaba guardado y el usuario recibía un error como si nada
  // se hubiera escrito. Eso dejó de ser hipotético al hacer que el tope de
  // cuotas falle en vez de truncar — editar un contrato a periodicidad DIARIA
  // con una fecha de fin lejana persistía las fechas nuevas y devolvía un 400
  // pidiendo revisarlas.
  return withTenantTx(async (client) => {
    const { rows: cur } = await client.query(
      'select * from contratos_arrendamiento where id=$1 and tenant_id=$2', [id, tenantId])
    if (!cur[0]) return { noEncontrado: true }
    if (cur[0].estatus === 'CANCELADO') return { cancelado: true }

    // Un contrato YA FIRMADO no se modifica. Lo que se firmó es un texto
    // concreto; cambiar sus términos después dejaría la firma respaldando algo
    // que nadie aceptó. Si hay que cambiar condiciones, se hace otro contrato.
    //
    // El sistema ya sabía DETECTARLO —`firmasDeContrato` marca `invalidada`
    // cuando el hash del documento de hoy no coincide con el que se firmó— pero
    // solo después del hecho: la edición pasaba, la firma quedaba inválida y
    // nadie se enteraba salvo que abriera el panel de firmas. Impedirlo antes es
    // lo que convierte esa detección en una regla.
    const { rows: firmadas } = await client.query(
      `select count(*)::int as n from contrato_firmas
        where contrato_id = $1 and estatus = 'FIRMADA'`,
      [id],
    )
    if ((firmadas[0]?.n ?? 0) > 0) return { firmado: true }

    // Las dos referencias que trae el patch se validan CONTRA EL TENANT antes
    // de escribirlas. No basta con la FK ni con la RLS:
    //   · La FK solo exige que la fila exista, no que sea de esta organización,
    //     y en PostgreSQL su comprobación corre como dueño de la tabla, así que
    //     ELUDE la política `tenant_isolation`.
    //   · Esa política además lleva `with check (true)`: filtra lo que se LEE,
    //     no lo que se ESCRIBE.
    // Sin esto, un `arrendadorId` con el uuid de otra organización se guardaría
    // sin protestar y la renta de esta pantalla quedaría atribuida a un
    // propietario ajeno. Es la misma comprobación que `exigirArrendador()` hace
    // en el alta (contratos-sitio.ts); faltaba aquí porque `arrendadorId` se
    // añadió al esquema de edición para completar contratos INCOMPLETOS
    // (ADR 0001) y hasta ahora ninguna pantalla lo enviaba.
    if (patch.arrendadorId !== undefined) {
      await exigirArrendador(client, tenantId, patch.arrendadorId)
    }
    // La razón social debe ser del tenant Y del arrendador que queda en la fila:
    // es bajo la que se factura la renta, y colgar la de otro propietario haría
    // que el pago se emitiera a nombre equivocado.
    if (patch.razonSocialId != null) {
      const arrEfectivo = patch.arrendadorId ?? cur[0].arrendador_id
      const { rows: rs } = await client.query(
        `select rs.id from arrendador_razon_social rs
          where rs.id = $1 and rs.tenant_id = $2 and rs.arrendador_id = $3`,
        [patch.razonSocialId, tenantId, arrEfectivo],
      )
      if (!rs[0]) {
        throw new AppError('La razón social elegida no existe o es de otro arrendador.', 404)
      }
    }

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
    const { rows } = await client.query(
      `update contratos_arrendamiento set ${sets.join(', ')}
        where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
      vals,
    )
    // Sincroniza el calendario con las nuevas fechas/monto: agrega los periodos
    // que falten y reajusta el importe de las cuotas que no estén PAGADAS, para
    // que el calendario no quede con el precio viejo. Si esto falla —p. ej. la
    // vigencia nueva excede MAX_CUOTAS— la transacción revierte también el
    // UPDATE de arriba y el contrato queda como estaba.
    await generarCalendarioEnTx(client, genInputFromRow(rows[0]))
    return { contrato: rowToContrato(rows[0]) }
  })
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

// ─── Licencias y permisos con vigencia (F-2) ────────────────────────────────
//
// Anclaje EXCLUYENTE predio/pantalla, igual que el contrato: el permiso ampara
// una instalación, y si el predio agrupa varias pantallas las cubre a todas. Lo
// impone `licencia_anclaje_ck` en la base, no una convención de código.
//
// No hay columna de estatus: la vigencia se deduce de `fecha_vencimiento` contra
// hoy, en la capa de lectura. Guardarla obligaría a un barrido que reescribiera
// filas en cada carga, que es el hallazgo M-5 que sigue abierto en contratos.

function rowToLicencia(r: any) {
  return {
    id: r.id,
    predioId: r.predio_id ?? null,
    sitioId: r.sitio_id ?? null,
    tipo: r.tipo,
    folio: r.folio ?? null,
    autoridad: r.autoridad ?? null,
    fechaExpedicion: r.fecha_expedicion ? iso(r.fecha_expedicion) : null,
    fechaVencimiento: iso(r.fecha_vencimiento),
    documentoUrl: r.documento_url ?? null,
    notas: r.notas ?? null,
    creadoEn: iso(r.creado_en),
  }
}

export async function listarLicencias() {
  const rows = await q(
    'select * from licencias where tenant_id = $1 order by fecha_vencimiento asc',
    [await tenantActual()],
  )
  return rows.map(rowToLicencia)
}

export interface LicenciaInput {
  predioId?: string | null
  sitioId?: string | null
  tipo: string
  folio?: string | null
  autoridad?: string | null
  fechaExpedicion?: string | null
  fechaVencimiento: string
  documentoUrl?: string | null
  notas?: string | null
}

export async function crearLicencia(input: LicenciaInput) {
  const tenantId = await tenantActual()
  // El anclaje se valida aquí ADEMÁS de en el CHECK: así el usuario recibe un
  // mensaje que dice qué hacer en vez de un 23514 opaco de la base.
  const tienePredio = !!input.predioId
  const tieneSitio = !!input.sitioId
  if (tienePredio === tieneSitio) {
    throw new AppError(
      'Una licencia ampara un predio O una pantalla suelta, no ambos ni ninguno.',
      400,
    )
  }
  // El anclaje tiene que existir EN ESTE INQUILINO. La FK no lo garantiza: apunta
  // a la tabla entera, y sin esta comprobación se podría colgar una licencia de
  // un predio ajeno pasando su id a mano.
  const tabla = tienePredio ? 'predios' : 'sitios'
  const anclaId = tienePredio ? input.predioId : input.sitioId
  const existe = await q(`select 1 from ${tabla} where id = $1 and tenant_id = $2`, [anclaId, tenantId])
  if (!existe.length) {
    throw new AppError(tienePredio ? 'El predio no existe.' : 'La pantalla no existe.', 404)
  }
  const rows = await q(
    `insert into licencias
       (tenant_id, predio_id, sitio_id, tipo, folio, autoridad, fecha_expedicion,
        fecha_vencimiento, documento_url, notas)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      tenantId, input.predioId ?? null, input.sitioId ?? null, input.tipo,
      input.folio ?? null, input.autoridad ?? null, input.fechaExpedicion ?? null,
      input.fechaVencimiento, input.documentoUrl ?? null, input.notas ?? null,
    ],
  )
  return rowToLicencia(rows[0])
}

const LICENCIA_COL: Record<string, string> = {
  tipo: 'tipo', folio: 'folio', autoridad: 'autoridad',
  fechaExpedicion: 'fecha_expedicion', fechaVencimiento: 'fecha_vencimiento',
  documentoUrl: 'documento_url', notas: 'notas',
}

// Actualización parcial. El anclaje NO se puede mover: cambiar de predio a
// pantalla convertiría el registro en otro permiso distinto y rompería el
// histórico. Si se capturó mal, se borra y se vuelve a crear.
export async function editarLicencia(id: string, cambios: Record<string, unknown>) {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(cambios)) {
    const col = LICENCIA_COL[k]
    if (!col) continue
    vals.push(v)
    sets.push(`${col} = $${vals.length}`)
  }
  if (!sets.length) return null
  vals.push(id, await tenantActual())
  const rows = await q(
    `update licencias set ${sets.join(', ')}
      where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
    vals,
  )
  return rows[0] ? rowToLicencia(rows[0]) : null
}

export async function borrarLicencia(id: string) {
  const rows = await q(
    'delete from licencias where id = $1 and tenant_id = $2 returning id',
    [id, await tenantActual()],
  )
  return rows.length > 0
}
