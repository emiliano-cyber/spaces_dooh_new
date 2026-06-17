import 'server-only'
import { randomBytes } from 'crypto'
import { pool, q, q1 } from './db'

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
    monto: n(r.monto) ?? 0, moneda: r.moneda, fechaEmision: iso(r.fecha_emision),
    estatus: r.estatus, creadoEn: iso(r.creado_en),
  }
}
function rowToCobranza(r: any) {
  return {
    id: r.id, facturaId: r.factura_id, plazoDias: r.plazo_dias,
    fechaVencimiento: iso(r.fecha_vencimiento), estatus: r.estatus,
    montoPagado: n(r.monto_pagado) ?? 0, creadoEn: iso(r.creado_en),
  }
}

export async function listarFacturas() {
  return (await q('select * from facturas order by creado_en asc')).map(rowToFactura)
}
export async function listarCobranzas() {
  return (await q('select * from cobranzas order by creado_en asc')).map(rowToCobranza)
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

  const client = await pool.connect()
  try {
    await client.query('begin')
    const fac = (
      await client.query(
        `insert into facturas (folio, campana_id, cliente_id, monto, moneda, fecha_emision, estatus)
         values ($1,$2,$3,$4,'PEN',current_date,'EMITIDA') returning *`,
        [folioFactura(), campanaId, c.cliente_id, Number(c.presupuesto_bruto ?? 0)],
      )
    ).rows[0]
    await client.query(
      `insert into cobranzas (factura_id, plazo_dias, fecha_vencimiento, estatus, monto_pagado)
       values ($1,$2, current_date + $2::int, 'AL_CORRIENTE', 0)`,
      [fac.id, plazoDias],
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

// Registrar pago de una cobranza (la marca PAGADA).
export async function registrarPagoCobranza(cobranzaId: string) {
  const cob = await q1<any>('select * from cobranzas where id=$1', [cobranzaId])
  if (!cob) return null
  const fac = await q1<any>('select monto from facturas where id=$1', [cob.factura_id])
  await q(
    `update cobranzas set estatus='PAGADA', monto_pagado=$2 where id=$1`,
    [cobranzaId, Number(fac?.monto ?? 0)],
  )
  await q(`update facturas set estatus='PAGADA' where id=$1`, [cob.factura_id])
  return rowToCobranza((await q('select * from cobranzas where id=$1', [cobranzaId]))[0])
}
