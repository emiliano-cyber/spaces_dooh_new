import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1 } from './db'

// ============================================================================
//  lib/server/campanas-repo.ts — Clientes, campañas, reservas + flujos
//  (reservar / confirmar / extender). Mapea filas Postgres ↔ tipos del front.
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

// IGV (Perú) = 18%. Importe de cada reserva = tarifa mensual prorrateada por
// días exactos: precio / 30 × días cubiertos (fecha_fin - fecha_inicio + 1).
// presupuesto_neto = suma prorrateada; presupuesto_bruto = neto + IGV (total).
// IVA por defecto (México). El IVA real se configura por cliente (clientes.iva_pct,
// default 16); este valor es solo el respaldo cuando no hay cliente.
export const IGV_PCT = 0.16

type Exec = { query: (sql: string, params?: unknown[]) => Promise<unknown> }
async function recalcularPresupuesto(exec: Exec | null, campanaId: string) {
  // El IVA sale del cliente de la campaña (clientes.iva_pct); si no hay, 16.
  const sql =
    `update campanas c
        set presupuesto_neto = sub.neto,
            presupuesto_bruto = round(
              sub.neto * (1 + coalesce((select iva_pct from clientes cl where cl.id = c.cliente_id), 16) / 100), 2)
       from (
         select coalesce(
           round(sum(precio * (fecha_fin - fecha_inicio + 1) / 30.0), 2), 0
         ) as neto
         from reservas where campana_id = $1
       ) sub
      where c.id = $1`
  if (exec) await exec.query(sql, [campanaId])
  else await q(sql, [campanaId])
}

function rowToCliente(r: any) {
  return {
    id: r.id, nombre: r.nombre, rfc: r.rfc,
    razonSocial: r.razon_social ?? null,
    regimenFiscal: r.regimen_fiscal ?? null,
    cpFiscal: r.cp_fiscal ?? null,
    usoCfdi: r.uso_cfdi ?? null,
    ivaPct: r.iva_pct != null ? Number(r.iva_pct) : 16,
    comisionAgenciaPct: r.comision_agencia_pct != null ? Number(r.comision_agencia_pct) : 0,
    agenciaId: r.agencia_id ?? null,
    tieneNegociacion: !!r.tiene_negociacion,
    negociacionValidada: !!r.negociacion_validada,
    negociacionNota: r.negociacion_nota ?? null,
    tipo: r.tipo,
    contacto: r.contacto ?? {}, activo: !!r.activo, creadoEn: iso(r.creado_en),
  }
}
function rowToCampana(r: any) {
  return {
    id: r.id, folio: r.folio, nombre: r.nombre, clienteId: r.cliente_id,
    propuestaId: r.propuesta_id ?? null,
    agencia: r.agencia, marca: r.marca, tipoCampana: r.tipo_campana,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    presupuestoBruto: n(r.presupuesto_bruto), presupuestoNeto: n(r.presupuesto_neto),
    moneda: r.moneda, estadoComercial: r.estado_comercial,
    enviadaDominio: !!r.enviada_dominio, enviadaDominioEn: r.enviada_dominio_en ? iso(r.enviada_dominio_en) : null,
    validacionEstatus: r.validacion_estatus ?? 'PENDIENTE',
    validacionMotivo: r.validacion_motivo ?? null,
    validacionPor: r.validacion_por ?? null,
    validacionEn: r.validacion_en ? iso(r.validacion_en) : null,
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

// Folio de campaña: RGB + año + mes + día + 3 dígitos aleatorios, todo junto.
// p. ej. RGB20260626482
const folio = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rnd = String(randomBytes(2).readUInt16BE(0) % 1000).padStart(3, '0')
  return `RGB${yyyy}${mm}${dd}${rnd}`
}

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

    // Guard de integridad: si la campaña destino nace de una propuesta, solo
    // admite sitios del set APROBADO de esa propuesta (las manuales no aplican).
    const cp = (await client.query('select propuesta_id from campanas where id=$1', [campanaId])).rows[0]
    if (cp?.propuesta_id) {
      const aprob = (
        await client.query(
          'select sitio_id from propuesta_items where propuesta_id=$1 and aprobado=true',
          [cp.propuesta_id],
        )
      ).rows.map((r: any) => r.sitio_id)
      const set = new Set(aprob)
      const fuera = input.sitioIds.filter((s) => !set.has(s))
      if (fuera.length) {
        throw new Error('Solo se pueden agregar sitios aprobados en la propuesta de esta campaña')
      }
    }

    for (const sitioId of input.sitioIds) {
      const s = (
        await client.query(
          'select nombre, tarifa_mensual, spots_disponibles, es_rotativo, exhibicion, tipo_medio from sitios where id=$1',
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
      // Validación de colisión de fechas (sobre-reserva): una pantalla ESTÁTICA
      // no puede tener dos reservas activas que se solapen en el mismo periodo.
      // Las digitales se comparten por spots, así que se omiten aquí.
      if (!digital) {
        const choque = (
          await client.query(
            `select c.nombre as campana
               from reservas r join campanas c on c.id = r.campana_id
              where r.sitio_id = $1
                and r.estatus <> 'CANCELADA'
                and r.campana_id <> $4
                and r.fecha_inicio <= $3::date
                and r.fecha_fin    >= $2::date
              limit 1`,
            [sitioId, input.fechaInicio, input.fechaFin, campanaId],
          )
        ).rows[0]
        if (choque) {
          throw new Error(
            `"${s?.nombre ?? 'La pantalla'}" ya está reservada en esas fechas por la campaña "${choque.campana}". Elige otras fechas u otra pantalla.`,
          )
        }
      } else {
        // Digital ocupada = sin slots libres → no acepta más campañas.
        const dispNow = s?.spots_disponibles != null ? Number(s.spots_disponibles) : null
        if (dispNow != null && dispNow <= 0) {
          throw new Error(
            `"${s?.nombre ?? 'La pantalla'}" ya no tiene slots disponibles (ocupada). Elige otra pantalla.`,
          )
        }
      }

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
        // Descuenta slots; la pantalla sigue DISPONIBLE mientras le queden slots
        // y pasa a OCUPADO solo cuando se agotan (no debe aceptar más campañas).
        await client.query(
          `update sitios
              set spots_disponibles = greatest(0, coalesce(spots_disponibles,0) - $2),
                  estatus_comercial = (case
                    when greatest(0, coalesce(spots_disponibles,0) - $2) <= 0 then 'OCUPADO'
                    else 'DISPONIBLE'
                  end)::est_comercial
            where id=$1`,
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

// ─── Propuesta → campaña ─────────────────────────────────────────────────────
// Error de regla de negocio (propuesta no aprobada / ya generada) → 409.
export class PropuestaCampanaError extends Error {}

// Set de sitios APROBADOS de una propuesta (para el guard de integridad).
export async function sitiosAprobadosDePropuesta(propuestaId: string): Promise<Set<string>> {
  const rows = await q<{ sitio_id: string }>(
    'select sitio_id from propuesta_items where propuesta_id=$1 and aprobado=true',
    [propuestaId],
  )
  return new Set(rows.map((r) => r.sitio_id))
}

// Genera una campaña a partir de una propuesta APROBADA: hereda cliente, fechas
// (min/max de los items) y SOLO los sitios aprobados con su precio NETO de
// comisión (item.precio × divisor). Idempotente. La campaña nace CONFIRMADA
// (cliente comprometió), reservas CONFIRMADA, sitios RESERVADO hasta la OC.
export async function generarCampanaDesdePropuesta(propuestaId: string) {
  const prop = await q1<any>('select * from propuestas where id=$1', [propuestaId])
  if (!prop) throw new PropuestaCampanaError('Propuesta no encontrada')
  if (prop.estatus !== 'APROBADA') {
    throw new PropuestaCampanaError('La propuesta no está aprobada; no se puede generar la campaña')
  }
  if (!prop.cliente_id) {
    throw new PropuestaCampanaError('La propuesta no tiene cliente asignado; no se puede facturar la campaña')
  }
  // Idempotencia: si ya generó campaña, devuelve la existente (no duplica).
  const ya = await q1<any>('select * from campanas where propuesta_id=$1', [propuestaId])
  if (ya) return rowToCampana(ya)

  const items = await q<any>(
    'select * from propuesta_items where propuesta_id=$1 and aprobado=true order by creado_en asc',
    [propuestaId],
  )
  if (!items.length) throw new PropuestaCampanaError('La propuesta no tiene sitios aprobados')

  const divisor = 1 - Number(prop.comision_pct) / 100
  const fechaInicio = items.map((i) => iso(i.fecha_inicio)).sort()[0]
  const fechaFin = items.map((i) => iso(i.fecha_fin)).sort().at(-1) as string

  const client = await pool.connect()
  try {
    await client.query('begin')
    // tipo de campaña derivado del medio de los sitios aprobados
    const flags = (
      await client.query(
        `select (tipo_medio='PANTALLA_DIGITAL' or es_rotativo or exhibicion in ('digital','rotativo')) as digital
           from sitios where id = any($1::uuid[])`,
        [items.map((i) => i.sitio_id)],
      )
    ).rows.map((r: any) => !!r.digital)
    const tipoCampana = derivarTipoCampana(flags)

    // La campaña hereda el nombre de la agencia de la propuesta (si la lleva).
    const ag = prop.agencia_id
      ? (await client.query('select nombre from clientes where id=$1', [prop.agencia_id])).rows[0]
      : null
    const agenciaNombre = ag?.nombre ?? null

    const campanaId = (
      await client.query(
        `insert into campanas (folio, nombre, cliente_id, agencia, fecha_inicio, fecha_fin, estado_comercial, tipo_campana, propuesta_id)
         values ($1,$2,$3,$4,$5,$6,'CONFIRMADA',$7,$8) returning id`,
        [folio(), prop.nombre, prop.cliente_id, agenciaNombre, fechaInicio, fechaFin, tipoCampana, propuestaId],
      )
    ).rows[0].id

    for (const it of items) {
      const precioNeto = Math.round(Number(it.precio) * divisor)
      await client.query(
        `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus, spots_reservados)
         values ($1,$2,$3,$4,$5,'FIXED_PKG','CONFIRMADA',null)`,
        [campanaId, it.sitio_id, iso(it.fecha_inicio), iso(it.fecha_fin), precioNeto],
      )
      // sitios RESERVADO hasta la OC (no OCUPADO todavía)
      await client.query(`update sitios set estatus_comercial='RESERVADO' where id=$1`, [it.sitio_id])
    }
    await recalcularPresupuesto(client, campanaId)
    await client.query('commit')
    return rowToCampana((await client.query('select * from campanas where id=$1', [campanaId])).rows[0])
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
      // Estáticas → OCUPADO al confirmar. Digitales → OCUPADO solo si ya no les
      // quedan slots; si aún tienen, siguen DISPONIBLE para más campañas.
      await client.query(
        `update sitios set estatus_comercial='OCUPADO'
           where id = any($1::uuid[])
             and (
               not (es_rotativo or exhibicion in ('digital','rotativo') or tipo_medio='PANTALLA_DIGITAL')
               or coalesce(spots_disponibles, 0) <= 0
             )`,
        [sitios],
      )
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

// ─── Validación de publicación ──────────────────────────────────────────────
// Error de regla de negocio (estado inválido / sin anuncios) → el route lo
// mapea a 409.
export class ValidacionError extends Error {}

// Estados de campaña que ya están comprometidos (no borrador/cotización/cancel.)
// y por tanto pueden enviarse al dominio para revisión.
const ESTADOS_COMPROMETIDOS = new Set(['CONFIRMADA', 'ACTIVA', 'LISTA_FACTURAR'])

// Paso 1: envía la campaña al dominio/CMS. Deja la validación en PENDIENTE para
// que un revisor verifique la información de los anuncios antes de publicar.
// Requiere campaña comprometida y, en medios digitales (DOOH/HÍBRIDA), al menos
// un creativo cargado (es la "información de los anuncios" a verificar).
export async function enviarADominio(campanaId: string) {
  const camp = await q1<any>('select * from campanas where id=$1', [campanaId])
  if (!camp) return null
  if (!ESTADOS_COMPROMETIDOS.has(camp.estado_comercial)) {
    throw new ValidacionError(
      'Solo se puede enviar al dominio una campaña confirmada por el cliente',
    )
  }
  if (camp.tipo_campana === 'DOOH' || camp.tipo_campana === 'HIBRIDA') {
    const creas = await q1<any>(
      'select count(*)::int as n from creatividades where campana_id=$1',
      [campanaId],
    )
    if (!creas || creas.n === 0) {
      throw new ValidacionError(
        'La campaña no tiene anuncios (creativos) que enviar al dominio',
      )
    }
  }
  const rows = await q(
    `update campanas
        set enviada_dominio = true,
            enviada_dominio_en = now(),
            validacion_estatus = 'PENDIENTE',
            validacion_motivo = null,
            validacion_por = null,
            validacion_en = null
      where id = $1
      returning *`,
    [campanaId],
  )
  return rows[0] ? rowToCampana(rows[0]) : null
}

// Paso 2: el revisor valida la publicación. Aprobar → la campaña pasa a ACTIVA
// (al aire). Rechazar → se guarda el motivo y se baja la bandera de envío para
// que deba corregirse y reenviarse antes de volver a revisarse.
export async function validarPublicacion(
  campanaId: string,
  aprobar: boolean,
  motivo: string | null,
  validadorNombre: string,
) {
  const camp = await q1<any>('select * from campanas where id=$1', [campanaId])
  if (!camp) return null
  if (!camp.enviada_dominio) {
    throw new ValidacionError(
      'La campaña aún no se ha enviado al dominio; no hay nada que validar',
    )
  }
  if (aprobar) {
    const rows = await q(
      `update campanas
          set validacion_estatus = 'APROBADA',
              validacion_motivo = null,
              validacion_por = $2,
              validacion_en = now(),
              estado_comercial = case when estado_comercial = 'CONFIRMADA'
                                      then 'ACTIVA' else estado_comercial end
        where id = $1
        returning *`,
      [campanaId, validadorNombre],
    )
    return rows[0] ? rowToCampana(rows[0]) : null
  }
  const rows = await q(
    `update campanas
        set validacion_estatus = 'RECHAZADA',
            validacion_motivo = $3,
            validacion_por = $2,
            validacion_en = now(),
            enviada_dominio = false
      where id = $1
      returning *`,
    [campanaId, validadorNombre, motivo ?? null],
  )
  return rows[0] ? rowToCampana(rows[0]) : null
}
