import 'server-only'
import { randomBytes } from 'crypto'
import { q, pool } from './db'

// ============================================================================
//  lib/server/propuestas-repo.ts — Propuestas comerciales con método del
//  divisor. bruto = Σ items; divisor = 1 − comisión/100; neto = bruto × divisor;
//  iva = bruto × 16%; total = bruto + iva.
// ============================================================================

const IVA_PCT = 16
const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)
const folio = () => `PR-${randomBytes(3).toString('hex').toUpperCase()}`

function rowToItem(r: any) {
  return {
    id: r.id,
    propuestaId: r.propuesta_id,
    sitioId: r.sitio_id,
    fechaInicio: iso(r.fecha_inicio),
    fechaFin: iso(r.fecha_fin),
    precio: Number(r.precio),
    aprobado: !!r.aprobado,
  }
}

function armarPropuesta(p: any, items: any[]) {
  const its = items.map(rowToItem)
  const bruto = its.reduce((s, i) => s + i.precio, 0)
  const comisionPct = Number(p.comision_pct)
  const divisor = 1 - comisionPct / 100
  const neto = Math.round(bruto * divisor)
  const iva = Math.round(bruto * (IVA_PCT / 100))
  // Aprobación granular: presupuesto sobre los items aprobados (modelo "menú").
  const aprob = its.filter((i) => i.aprobado)
  const brutoAprobado = aprob.reduce((s, i) => s + i.precio, 0)
  const netoAprobado = Math.round(brutoAprobado * divisor)
  const ivaAprobado = Math.round(brutoAprobado * (IVA_PCT / 100))
  return {
    id: p.id,
    folio: p.folio,
    clienteId: p.cliente_id ?? null,
    nombre: p.nombre,
    fecha: iso(p.fecha),
    estatus: p.estatus,
    comisionPct,
    notas: p.notas ?? null,
    creadoEn: iso(p.creado_en),
    items: its,
    bruto,
    divisor,
    neto,
    iva,
    total: bruto + iva,
    itemsAprobados: aprob.length,
    brutoAprobado,
    netoAprobado,
    ivaAprobado,
    totalAprobado: brutoAprobado + ivaAprobado,
  }
}

export async function listarPropuestas() {
  const props = await q('select * from propuestas order by creado_en desc')
  if (!props.length) return []
  const items = await q('select * from propuesta_items order by creado_en asc')
  const porProp = new Map<string, any[]>()
  for (const it of items) {
    const arr = porProp.get(it.propuesta_id) ?? []
    arr.push(it)
    porProp.set(it.propuesta_id, arr)
  }
  return props.map((p: any) => armarPropuesta(p, porProp.get(p.id) ?? []))
}

export interface PropuestaInput {
  clienteId?: string | null
  nombre: string
  comisionPct?: number
  fechaInicio: string
  fechaFin: string
  // Sitios con su precio (tarifa de lista). Si no viene precio, se toma 0.
  items: { sitioId: string; precio: number }[]
  notas?: string | null
}

export async function crearPropuesta(input: PropuestaInput) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const prop = (
      await client.query(
        `insert into propuestas (folio, cliente_id, nombre, comision_pct, notas)
         values ($1,$2,$3,$4,$5) returning *`,
        [folio(), input.clienteId ?? null, input.nombre, input.comisionPct ?? 0, input.notas ?? null],
      )
    ).rows[0]
    for (const it of input.items) {
      await client.query(
        `insert into propuesta_items (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio)
         values ($1,$2,$3,$4,$5)`,
        [prop.id, it.sitioId, input.fechaInicio, input.fechaFin, it.precio ?? 0],
      )
    }
    const items = (
      await client.query('select * from propuesta_items where propuesta_id=$1', [prop.id])
    ).rows
    await client.query('commit')
    return armarPropuesta(prop, items)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Aprobación granular: aprueba/desaprueba un sitio (item) de la propuesta y
// devuelve la propuesta recompuesta (con los totales aprobados al día).
export async function aprobarItem(itemId: string, aprobado: boolean) {
  const upd = await q(
    `update propuesta_items set aprobado=$2 where id=$1 returning propuesta_id`,
    [itemId, aprobado],
  )
  if (!upd.length) return null
  const propId = upd[0].propuesta_id
  const p = (await q('select * from propuestas where id=$1', [propId]))[0]
  const items = await q('select * from propuesta_items where propuesta_id=$1', [propId])
  return armarPropuesta(p, items)
}

const ESTATUS_VALIDOS = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA']
export async function cambiarEstatusPropuesta(id: string, estatus: string) {
  if (!ESTATUS_VALIDOS.includes(estatus)) throw new Error('Estatus inválido')
  const rows = await q(
    `update propuestas set estatus=$2::est_propuesta where id=$1 returning *`,
    [id, estatus],
  )
  if (!rows.length) return null
  const items = await q('select * from propuesta_items where propuesta_id=$1', [id])
  return armarPropuesta(rows[0], items)
}
