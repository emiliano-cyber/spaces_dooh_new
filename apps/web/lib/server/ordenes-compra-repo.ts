import 'server-only'
import { randomBytes } from 'crypto'
import { q, pool } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/ordenes-compra-repo.ts — Órdenes de compra del cliente (ODC).
//  Antes "OC recibida" era solo una bandera; ahora es una entidad con folio,
//  monto y documento. Registrar una ODC marca oc_recibida en la campaña (y abre
//  el candado de facturación si ya hay fotos + reporte).
// ============================================================================

const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)
const folioODC = () => `ODC-${randomBytes(3).toString('hex').toUpperCase()}`

function rowToOdc(r: any) {
  return {
    id: r.id,
    folio: r.folio,
    campanaId: r.campana_id,
    monto: Number(r.monto),
    fecha: iso(r.fecha),
    estatus: r.estatus,
    documentoUrl: r.documento_url ?? null,
    notas: r.notas ?? null,
    creadoEn: iso(r.creado_en),
  }
}

export async function listarOrdenesCompra() {
  const rows = await q('select * from ordenes_compra where tenant_id = $1 order by creado_en desc', [await tenantActual()])
  return rows.map(rowToOdc)
}

// Crea la ODC y marca la campaña: oc_recibida = true (abre el candado si ya
// estaban fotos + reporte). El monto, si no se pasa, sale del presupuesto bruto.
export async function crearOrdenCompra(
  campanaId: string,
  input: { monto?: number | null; documentoUrl?: string | null; notas?: string | null } = {},
) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const camp = (
      await client.query('select presupuesto_bruto, nombre from campanas where id=$1', [campanaId])
    ).rows[0]
    if (!camp) {
      await client.query('rollback')
      return null
    }
    const monto = input.monto ?? Number(camp.presupuesto_bruto ?? 0)
    const odc = (
      await client.query(
        `insert into ordenes_compra (folio, campana_id, monto, estatus, documento_url, notas, tenant_id)
         values ($1,$2,$3,'RECIBIDA',$4,$5,$6) returning *`,
        [folioODC(), campanaId, monto, input.documentoUrl ?? null, input.notas ?? null, await tenantActual()],
      )
    ).rows[0]
    await client.query(
      `update campanas
          set oc_recibida = true,
              oc_url = coalesce($2, oc_url),
              estado_comercial = case
                when fotos_comprobatorias and reporte_publicacion
                  then 'LISTA_FACTURAR'::est_comercial_campana
                else estado_comercial end
        where id = $1`,
      [campanaId, input.documentoUrl ?? null],
    )
    await client.query('commit')
    return rowToOdc(odc)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
