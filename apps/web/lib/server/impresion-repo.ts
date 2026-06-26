import 'server-only'
import { randomBytes } from 'crypto'
import { q, q1 } from './db'

// ============================================================================
//  lib/server/impresion-repo.ts — Imprenta: órdenes de impresión (arte→montaje)
//  y registro de la OC (orden de compra) que cierra el candado de facturación.
// ============================================================================

const PROCESO = ['ARTE_RECIBIDO', 'VALIDADO', 'EN_PRODUCCION', 'IMPRESO', 'LISTO_MONTAJE'] as const
type EstOI = (typeof PROCESO)[number]

const folioOI = () => `OI-${randomBytes(3).toString('hex').toUpperCase()}`

// Error de regla de negocio (transición inválida) → el route lo mapea a 409.
export class ImpresionError extends Error {}

function rowToOrdenImpresion(r: any) {
  return {
    id: r.id,
    folio: r.folio,
    campanaId: r.campana_id,
    sitioId: r.sitio_id,
    material: r.material ?? '',
    alto: r.alto == null ? 0 : Number(r.alto),
    ancho: r.ancho == null ? 0 : Number(r.ancho),
    estatus: r.estatus as EstOI,
    proveedor: r.proveedor ?? null,
    pruebaColorUrl: r.prueba_color_url ?? null,
    pruebaColorAprobada: !!r.prueba_color_aprobada,
    creadoEn: r.creado_en instanceof Date ? r.creado_en.toISOString() : r.creado_en,
  }
}

// Probatorio: aprueba/registra la prueba de color de una orden de impresión.
export async function aprobarPruebaColor(id: string, aprobada: boolean, url?: string | null) {
  const rows = await q(
    `update ordenes_impresion
        set prueba_color_aprobada=$2, prueba_color_url=coalesce($3, prueba_color_url)
      where id=$1 returning *`,
    [id, aprobada, url ?? null],
  )
  return rows[0] ? rowToOrdenImpresion(rows[0]) : null
}

export async function listarOrdenesImpresion() {
  const rows = await q('select * from ordenes_impresion order by creado_en asc')
  return rows.map(rowToOrdenImpresion)
}

export async function crearOrdenImpresion(input: {
  campanaId: string
  sitioId?: string | null
  material?: string | null
  alto?: number | null
  ancho?: number | null
  proveedor?: string | null
}) {
  // Máquina de estados (server-side): una campaña digital (DOOH) NO genera
  // orden de impresión. Fija (OOH) e híbrida sí. La UI ya lo oculta; esto lo
  // enforza también vía API.
  const camp = await q1<any>('select tipo_campana from campanas where id=$1', [input.campanaId])
  if (!camp) throw new ImpresionError('Campaña no encontrada')
  if (camp.tipo_campana === 'DOOH') {
    throw new ImpresionError('Una campaña digital (DOOH) no genera orden de impresión')
  }
  const rows = await q(
    `insert into ordenes_impresion (folio, campana_id, sitio_id, material, alto, ancho, proveedor)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [
      folioOI(),
      input.campanaId,
      input.sitioId ?? null,
      input.material ?? null,
      input.alto ?? null,
      input.ancho ?? null,
      input.proveedor ?? null,
    ],
  )
  return rowToOrdenImpresion(rows[0])
}

// Avanza la orden al siguiente estatus del proceso (no retrocede ni pasa el final).
export async function avanzarOrdenImpresion(id: string) {
  const actual = await q1<any>('select estatus from ordenes_impresion where id=$1', [id])
  if (!actual) return null
  const i = PROCESO.indexOf(actual.estatus)
  if (i < 0 || i >= PROCESO.length - 1) {
    // Ya está en el último paso: devolvemos la orden tal cual.
    const r = await q1<any>('select * from ordenes_impresion where id=$1', [id])
    return r ? rowToOrdenImpresion(r) : null
  }
  const rows = await q(
    'update ordenes_impresion set estatus=$2 where id=$1 returning *',
    [id, PROCESO[i + 1]],
  )
  return rowToOrdenImpresion(rows[0])
}

// Registra la OC (orden de compra) del cliente. Si fotos y reporte ya estaban,
// el candado se abre y la campaña pasa a LISTA_FACTURAR (misma regla que cerrarOT).
export async function marcarOCRecibida(campanaId: string, ocUrl?: string | null) {
  const rows = await q(
    `update campanas
        set oc_recibida = true,
            oc_url = coalesce($2, oc_url),
            estado_comercial = case
              when fotos_comprobatorias and reporte_publicacion
                then 'LISTA_FACTURAR'::est_comercial_campana
              else estado_comercial end
      where id = $1
      returning id, nombre`,
    [campanaId, ocUrl ?? null],
  )
  if (!rows.length) return null
  return { id: rows[0].id, nombre: rows[0].nombre }
}
