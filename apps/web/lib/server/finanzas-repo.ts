import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1 } from './db'
import { tenantActual } from './tenant'
import { IGV_PCT } from './campanas-repo'

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
    montoPagado: n(r.monto_pagado) ?? 0, creadoEn: iso(r.creado_en),
  }
}

export async function listarFacturas() {
  return (await q('select * from facturas where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToFactura)
}
export async function listarCobranzas() {
  return (await q('select * from cobranzas where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToCobranza)
}

const folioFactura = () => `F001-${randomBytes(4).toString('hex').toUpperCase()}`

export class FacturaError extends Error {}

// Genera factura + cobranza desde una campaña con el candado completo.
export async function generarFactura(campanaId: string, plazoDias: 60 | 90 | 120) {
  const c = await q1<any>('select * from campanas where id=$1', [campanaId])
  if (!c) throw new FacturaError('Campaña no encontrada')
  if (!(c.oc_recibida && c.fotos_comprobatorias && c.reporte_publicacion)) {
    throw new FacturaError('La campaña no tiene el candado de facturación completo')
  }
  if (await q1('select 1 from facturas where campana_id=$1', [campanaId])) {
    throw new FacturaError('La campaña ya tiene factura')
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
    const fac = (
      await client.query(
        `insert into facturas (folio, campana_id, cliente_id, subtotal, igv, monto, moneda, fecha_emision, estatus, serie, folio_fiscal, rfc, razon_social, uso_cfdi, tenant_id)
         values ($1,$2,$3,$4,$5,$6,'PEN',current_date,'EMITIDA','A',$7,$8,$9,$10,$11) returning *`,
        [folioFactura(), campanaId, c.cliente_id, neto, igv, total, folioFiscalSim(), cli.rfc, cli.razon_social, cli.uso_cfdi ?? null, await tenantActual()],
      )
    ).rows[0]
    await client.query(
      `insert into cobranzas (factura_id, plazo_dias, fecha_vencimiento, estatus, monto_pagado, tenant_id)
       values ($1,$2, current_date + $2::int, 'AL_CORRIENTE', 0, $3)`,
      [fac.id, plazoDias, await tenantActual()],
    )
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
  const total = Number(fac?.monto ?? 0)
  const yaPagado = Number(cob.monto_pagado ?? 0)
  const abono = monto != null && monto > 0 ? Math.min(monto, total - yaPagado) : total - yaPagado
  const nuevoPagado = Math.round((yaPagado + abono) * 100) / 100
  const liquidado = nuevoPagado >= total
  await q(
    `update cobranzas set monto_pagado=$2, estatus = case when $3 then 'PAGADA'::est_cobranza else estatus end where id=$1`,
    [cobranzaId, nuevoPagado, liquidado],
  )
  if (liquidado) await q(`update facturas set estatus='PAGADA' where id=$1`, [cob.factura_id])
  return {
    ...rowToCobranza((await q('select * from cobranzas where id=$1', [cobranzaId]))[0]),
    folio: fac?.folio ?? null,
    liquidado,
  }
}
