import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1, fijarTenant } from './db'
import { tenantActual } from './tenant'
import {
  repartirCuotas, INTERVALO_PERIODO, duracionMeses, opcionesParcialidad, PERIODICIDAD_LABEL,
  type PeriodicidadCuota,
} from '../finanzas-calculo'
import { notificar } from './notificaciones-repo'
import { IGV_PCT } from './campanas-repo'
import { candadoDeSegmentos } from '@/lib/data/derive'

// ============================================================================
//  lib/server/finanzas-repo.ts — Facturación y cobranza.
//  Generar factura exige que la campaña tenga el candado completo
//  (OC + fotos comprobatorias + reporte de publicación).
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

function rowToFactura(r: any) {
  return {
    id: r.id, folio: r.folio, campanaId: r.campana_id, clienteId: r.cliente_id,
    subtotal: n(r.subtotal) ?? 0, igv: n(r.igv) ?? 0,
    monto: n(r.monto) ?? 0, moneda: r.moneda, fechaEmision: iso(r.fecha_emision),
    estatus: r.estatus,
    serie: r.serie ?? null, folioFiscal: r.folio_fiscal ?? null,
    rfc: r.rfc ?? null, razonSocial: r.razon_social ?? null, usoCfdi: r.uso_cfdi ?? null,
    creadoEn: iso(r.creado_en),
  }
}

// Folio fiscal simulado (formato UUID, como el timbre CFDI del SAT). En
// producción lo devuelve el PAC al timbrar.
function folioFiscalSim() {
  const h = randomBytes(16).toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase()
}
function rowToCobranza(r: any) {
  return {
    id: r.id, facturaId: r.factura_id, plazoDias: r.plazo_dias,
    fechaVencimiento: iso(r.fecha_vencimiento), estatus: r.estatus,
    montoPagado: n(r.monto_pagado) ?? 0,
    recordatorioEn: r.recordatorio_en ? iso(r.recordatorio_en) : null,
    recordatoriosEnviados: n(r.recordatorios_enviados) ?? 0,
    creadoEn: iso(r.creado_en),
    numero: r.numero != null ? Number(r.numero) : null,
    totalCuotas: r.total_cuotas != null ? Number(r.total_cuotas) : null,
    monto: r.monto != null ? Number(r.monto) : null,
  }
}

export async function listarFacturas() {
  return (await q('select * from facturas where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToFactura)
}
export async function listarCobranzas() {
  return (await q('select * from cobranzas where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToCobranza)
}

// ─── Recordatorios de cobro ─────────────────────────────────────────────────
// Umbral: se recuerda cuando la cobranza vence dentro de N días o ya venció.
// Cadencia: no se vuelve a recordar hasta que pasen M días desde el último.
export const UMBRAL_RECORDATORIO_DIAS = 7
export const CADENCIA_RECORDATORIO_DIAS = 3

const fmtMonto = (v: number) =>
  '$' + Math.round(v).toLocaleString('es-MX')

function textoRecordatorio(r: { folio: string; cliente: string | null; dias: number; saldo: number }) {
  const vencida = r.dias < 0
  return {
    nivel: (vencida ? 'warn' : 'info') as 'warn' | 'info',
    titulo: vencida ? 'Cobranza vencida' : 'Recordatorio de cobro',
    detalle:
      `${r.folio}${r.cliente ? ` · ${r.cliente}` : ''} — ` +
      (vencida ? `vencida hace ${-r.dias} día(s)` : `vence en ${r.dias} día(s)`) +
      ` · saldo ${fmtMonto(r.saldo)}`,
  }
}

// Barrido: recuerda las cobranzas por vencer / vencidas sin liquidar, respetando
// la cadencia (no spamea). Se llama en cada lectura de estado (sin cron).
// Idempotente por la ventana de cadencia. Devuelve cuántas recordó.
export async function recordarCobranzasVencidas(): Promise<number> {
  const tenantId = await tenantActual()
  if (!tenantId) return 0
  const rows = await q<any>(
    `select c.id, f.folio, f.monto, cl.nombre as cliente, c.monto_pagado,
            (c.fecha_vencimiento - current_date) as dias
       from cobranzas c
       join facturas f on f.id = c.factura_id
       left join clientes cl on cl.id = f.cliente_id
      where c.tenant_id = $1
        and c.estatus <> 'PAGADA'
        and c.monto_pagado < f.monto
        and (c.fecha_vencimiento - current_date) <= $2
        and (c.recordatorio_en is null or c.recordatorio_en < now() - make_interval(days => $3))`,
    [tenantId, UMBRAL_RECORDATORIO_DIAS, CADENCIA_RECORDATORIO_DIAS],
  )
  for (const r of rows) {
    const saldo = Math.round((Number(r.monto) - Number(r.monto_pagado)) * 100) / 100
    await notificar({ tipo: 'COBRANZA', link: '/finanzas', ...textoRecordatorio({ folio: r.folio, cliente: r.cliente, dias: Number(r.dias), saldo }) })
    await q(`update cobranzas set recordatorio_en=now(), recordatorios_enviados=recordatorios_enviados+1 where id=$1`, [r.id])
  }
  return rows.length
}

// Recordatorio MANUAL de una cobranza (botón "Recordar"). Envía ahora, ignora la
// cadencia; solo se niega si ya está liquidada.
export async function enviarRecordatorioCobranza(
  cobranzaId: string,
): Promise<{ ok: boolean; recordatoriosEnviados: number; motivo?: string } | null> {
  const r = await q1<any>(
    `select c.id, f.folio, f.monto, cl.nombre as cliente, c.monto_pagado, c.recordatorios_enviados,
            (c.fecha_vencimiento - current_date) as dias
       from cobranzas c
       join facturas f on f.id = c.factura_id
       left join clientes cl on cl.id = f.cliente_id
      where c.id = $1 and c.tenant_id = $2`,
    [cobranzaId, await tenantActual()],
  )
  if (!r) return null
  const saldo = Math.round((Number(r.monto) - Number(r.monto_pagado)) * 100) / 100
  if (saldo <= 0) return { ok: false, recordatoriosEnviados: n(r.recordatorios_enviados) ?? 0, motivo: 'La cobranza ya está liquidada' }
  await notificar({ tipo: 'COBRANZA', link: '/finanzas', ...textoRecordatorio({ folio: r.folio, cliente: r.cliente, dias: Number(r.dias), saldo }) })
  const upd = await q<any>(
    `update cobranzas set recordatorio_en=now(), recordatorios_enviados=recordatorios_enviados+1 where id=$1 returning recordatorios_enviados`,
    [cobranzaId],
  )
  return { ok: true, recordatoriosEnviados: n(upd[0].recordatorios_enviados) ?? 0 }
}

const folioFactura = () => `F001-${randomBytes(4).toString('hex').toUpperCase()}`

export class FacturaError extends Error {}

// Genera factura + cobranza desde una campaña con el candado completo.
// Plan de cobro en parcialidades. `null` = cobro único (comportamiento de
// siempre). Los IMPORTES no vienen del cliente: se calculan aquí, porque
// aceptarlos permitiría facturar 100 000 y programar cuotas por 10.
export interface PlanCuotas {
  periodicidad: PeriodicidadCuota
  primerVencimiento: string // ISO date
}


export async function generarFactura(
  campanaId: string,
  plazoDias: 60 | 90 | 120,
  plan?: PlanCuotas | null,
) {
  const c = await q1<any>('select * from campanas where id=$1', [campanaId])
  if (!c) throw new FacturaError('Campaña no encontrada')
  // Candado por segmento (A-2): la MISMA regla que usa la UI (derive.ts). Una
  // HÍBRIDA exige evidencia física (fotos) Y digital (reporte/proof-of-play); una
  // 100% física o digital solo su único segmento. No se re-implementa aquí.
  if (
    !candadoDeSegmentos(c.tipo_campana, {
      ocRecibida: c.oc_recibida,
      evidenciaFisica: c.fotos_comprobatorias,
      evidenciaDigital: c.reporte_publicacion,
    })
  ) {
    throw new FacturaError('La campaña no tiene el candado de facturación completo')
  }

  // Validación fiscal: el cliente necesita RFC y razón social para timbrar.
  const cli = await q1<any>('select rfc, razon_social, uso_cfdi, iva_pct from clientes where id=$1', [c.cliente_id])
  if (!cli?.rfc || !cli?.razon_social) {
    throw new FacturaError('El cliente requiere RFC y razón social para facturar (ve a Clientes)')
  }

  // Desglose fiscal: subtotal (neto) + IVA = total. El IVA se configura por
  // cliente (clientes.iva_pct, default 16). Se calcula desde el neto para
  // garantizar que subtotal + iva == monto exactamente (sin desfases).
  const ivaPct = cli.iva_pct != null ? Number(cli.iva_pct) / 100 : IGV_PCT
  const neto = Math.round(Number(c.presupuesto_neto ?? 0) * 100) / 100
  const igv = Math.round(neto * ivaPct * 100) / 100
  const total = Math.round((neto + igv) * 100) / 100

  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // A-1: el check "¿ya existe factura?" va DENTRO de la transacción, respaldado
    // por el índice único facturas_campana_uq. Si dos peticiones concurrentes
    // pasan este check, la segunda rebota en el INSERT con unique_violation
    // (23505), que traducimos abajo a un FacturaError limpio (409), no a un 500.
    if ((await client.query('select 1 from facturas where campana_id=$1', [campanaId])).rows[0]) {
      throw new FacturaError('La campaña ya tiene factura')
    }
    let fac: any
    try {
      fac = (
        await client.query(
          `insert into facturas (folio, campana_id, cliente_id, subtotal, igv, monto, moneda, fecha_emision, estatus, serie, folio_fiscal, rfc, razon_social, uso_cfdi, tenant_id)
           values ($1,$2,$3,$4,$5,$6,coalesce((select moneda from campanas where id=$2),(select moneda from tenants where id=$11),'MXN'),current_date,'EMITIDA','A',$7,$8,$9,$10,$11) returning *`,
          [folioFactura(), campanaId, c.cliente_id, neto, igv, total, folioFiscalSim(), cli.rfc, cli.razon_social, cli.uso_cfdi ?? null, await tenantActual()],
        )
      ).rows[0]
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') throw new FacturaError('La campaña ya tiene factura')
      throw e
    }
    const tId = await tenantActual()
    if (plan) {
      // Las cuotas NO vienen del cliente: se derivan de la duración de la
      // campaña y la periodicidad. Aceptarlas permitiría pedir 40 mensualidades
      // en una campaña de 2 meses, o 1 sola (que no es fraccionar nada).
      const meses = duracionMeses(iso(c.fecha_inicio), iso(c.fecha_fin))
      const opcion = opcionesParcialidad(meses).find((o) => o.periodicidad === plan.periodicidad)
      if (!opcion) {
        throw new FacturaError(
          // `PERIODICIDAD_LABEL` ya trae el plural correcto ("bimestrales"):
          // pegarle una "s" al enum daba "bimestrals".
          `Una campaña de ${meses} ${meses === 1 ? 'mes' : 'meses'} no admite cuotas ` +
            `${PERIODICIDAD_LABEL[plan.periodicidad]}. Opciones válidas: ` +
            (opcionesParcialidad(meses)
              .map((o) => `${o.cuotas} ${PERIODICIDAD_LABEL[o.periodicidad]}`)
              .join(', ') || 'ninguna, se cobra en una sola exhibición'),
        )
      }
      const importes = repartirCuotas(total, opcion.cuotas)
      // Guardarraíl del invariante: si el reparto no cuadra con la factura, se
      // aborta. Prefiero no facturar a dejar una cartera que no suma.
      const suma = Math.round(importes.reduce((a, x) => a + x, 0) * 100) / 100
      if (suma !== total) {
        throw new FacturaError(`Las parcialidades suman ${suma} y la factura ${total}`)
      }
      const paso = INTERVALO_PERIODO[plan.periodicidad]
      for (let i = 0; i < importes.length; i++) {
        await client.query(
          `insert into cobranzas
             (factura_id, plazo_dias, fecha_vencimiento, estatus, monto_pagado,
              numero, total_cuotas, monto, tenant_id)
           values ($1,$2, ($3::date + ($5::int * $4::interval))::date, 'AL_CORRIENTE', 0, $6, $7, $8, $9)`,
          [fac.id, plazoDias, plan.primerVencimiento, paso, i, i + 1, importes.length, importes[i], tId],
        )
      }
    } else {
      // Cobro único: `numero`/`monto` en NULL, como todo el histórico.
      await client.query(
        `insert into cobranzas (factura_id, plazo_dias, fecha_vencimiento, estatus, monto_pagado, tenant_id)
         values ($1,$2, current_date + $2::int, 'AL_CORRIENTE', 0, $3)`,
        [fac.id, plazoDias, tId],
      )
    }
    await client.query(`update campanas set estado_comercial='COMPLETADA' where id=$1`, [campanaId])
    await client.query('commit')
    return rowToFactura(fac)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Registrar pago de una cobranza. Admite abonos parciales: si no se pasa monto,
// se liquida el total. La cobranza queda PAGADA solo cuando lo pagado cubre el
// total de la factura (cobranza viva: "por cobrar" refleja el saldo real).
export async function registrarPagoCobranza(cobranzaId: string, monto?: number | null) {
  const cob = await q1<any>('select * from cobranzas where id=$1', [cobranzaId])
  if (!cob) return null
  const fac = await q1<any>('select monto, folio from facturas where id=$1', [cob.factura_id])
  // El total a cubrir es el de ESTA cobranza: si es una parcialidad, su propio
  // importe; si es cobro único (histórico), el de la factura. Usar siempre el de
  // la factura haría que abonar una cuota liquidara la factura entera.
  const total = cob.monto != null ? Number(cob.monto) : Number(fac?.monto ?? 0)
  const yaPagado = Number(cob.monto_pagado ?? 0)
  const abono = monto != null && monto > 0 ? Math.min(monto, total - yaPagado) : total - yaPagado
  const nuevoPagado = Math.round((yaPagado + abono) * 100) / 100
  const liquidado = nuevoPagado >= total
  await q(
    `update cobranzas set monto_pagado=$2, estatus = case when $3 then 'PAGADA'::est_cobranza else estatus end where id=$1`,
    [cobranzaId, nuevoPagado, liquidado],
  )
  // La factura queda PAGADA solo cuando no le queda ninguna parcialidad viva.
  // Con cobro único es equivalente a lo de antes; con parcialidades, marcarla al
  // liquidar la primera daría por cobrado lo que no se ha cobrado.
  if (liquidado) {
    const vivas = await q1<{ n: string }>(
      `select count(*)::text as n from cobranzas where factura_id=$1 and estatus <> 'PAGADA'`,
      [cob.factura_id],
    )
    if (Number(vivas?.n ?? 0) === 0) {
      await q(`update facturas set estatus='PAGADA' where id=$1`, [cob.factura_id])
    }
  }
  return {
    ...rowToCobranza((await q('select * from cobranzas where id=$1', [cobranzaId]))[0]),
    folio: fac?.folio ?? null,
    abono,
    saldo: Math.round((total - nuevoPagado) * 100) / 100,
    liquidado,
  }
}
