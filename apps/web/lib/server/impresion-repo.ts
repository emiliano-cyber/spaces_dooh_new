import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'
import { folioDocumento } from './folios'
import { rutaArteCreativo } from '@/lib/medios-url'
import { sanearRequisitos } from '@/lib/requisitos-impresion'

// ============================================================================
//  lib/server/impresion-repo.ts — Imprenta: órdenes de impresión (arte→montaje)
//  y registro de la OC (orden de compra) que cierra el candado de facturación.
// ============================================================================

const PROCESO = ['ARTE_RECIBIDO', 'VALIDADO', 'EN_PRODUCCION', 'IMPRESO', 'LISTO_MONTAJE'] as const
type EstOI = (typeof PROCESO)[number]

// Folio de orden de impresión: OI-2026-0001. Antes 3 bytes aleatorios sobre una
// columna UNIQUE; ahora consecutivo atómico (`lib/server/folios.ts`).
const folioOI = () => folioDocumento('oi')

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
    // IMP-REQ (18/11) · la imprenta de la orden (sus requisitos mandan en la
    // valoración del arte). Nombre y requisitos solo los trae el listado.
    imprentaId: r.imprenta_id ?? null,
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

// IMP-CREA (17/11) · la orden llega con lo que Imprenta necesita para
// priorizar y para enseñar el arte, SIN depender de los permisos de Comercial:
// `/api/estado` solo manda campañas, sitios y creativos a quien tiene ese
// módulo (`si('comercial', …)`), así que un rol que solo ve Imprenta se
// quedaba sin fecha de inicio y sin arte. Va aquí, en la misma consulta del
// módulo `imprenta`, y solo lo de las campañas que tienen orden.
//
// Las fechas salen como texto (`::text`): una columna `date` que llega como
// `Date` de JS se corre un día al pintarla en México (UTC-6).
export async function listarOrdenesImpresion() {
  const tenant = await tenantActual()
  const rows = await q(
    `select oi.*,
            c.nombre as campana_nombre, c.tipo_campana,
            c.fecha_inicio::text as campana_inicio, c.fecha_fin::text as campana_fin,
            s.nombre as sitio_nombre, s.ancho as sitio_ancho, s.alto as sitio_alto,
            im.nombre as imprenta_nombre, im.requisitos as imprenta_requisitos
       from ordenes_impresion oi
       left join campanas c on c.id = oi.campana_id and c.tenant_id = oi.tenant_id
       left join sitios s on s.id = oi.sitio_id and s.tenant_id = oi.tenant_id
       left join imprentas im on im.id = oi.imprenta_id and im.tenant_id = oi.tenant_id
      where oi.tenant_id = $1
      order by oi.creado_en asc`,
    [tenant],
  )
  // Los creativos de esas campañas, sin el arte (pesa ~1 MB por fila): la
  // imagen la sirve `/api/creativos/<id>/arte/`. `es_imagen` se calcula en
  // Postgres igual que en `listarCreatividades` (campanas-repo.ts).
  const campanaIds = [...new Set(rows.map((r: any) => r.campana_id).filter(Boolean))]
  const creas = campanaIds.length
    ? await q(
        `select id, campana_id, nombre, formato, resolucion, estatus_validacion,
                (archivo_url like 'data:image%'
                 or codigo ~ '<img[^>]+src="data:image/') as es_imagen
           from creatividades
          where tenant_id = $1 and campana_id = any($2::uuid[]) and retirado_en is null
          order by creado_en asc`,
        [tenant, campanaIds],
      )
    : []
  return rows.map((r: any) => ({
    ...rowToOrdenImpresion(r),
    campanaNombre: r.campana_nombre ?? null,
    tipoCampana: r.tipo_campana ?? null,
    campanaInicio: r.campana_inicio ?? null,
    campanaFin: r.campana_fin ?? null,
    sitioNombre: r.sitio_nombre ?? null,
    sitioAncho: r.sitio_ancho == null ? null : Number(r.sitio_ancho),
    sitioAlto: r.sitio_alto == null ? null : Number(r.sitio_alto),
    imprentaNombre: r.imprenta_nombre ?? null,
    imprentaRequisitos: r.imprenta_id ? sanearRequisitos(r.imprenta_requisitos) : null,
    creativos: creas
      .filter((cr: any) => cr.campana_id === r.campana_id)
      .map((cr: any) => ({
        id: cr.id,
        nombre: cr.nombre,
        archivoUrl: rutaArteCreativo(cr.id),
        esImagen: cr.es_imagen === true,
        formato: cr.formato ?? null,
        resolucion: cr.resolucion ?? null,
        estatusValidacion: cr.estatus_validacion,
      })),
  }))
}

/**
 * ¿Este creativo es arte de una campaña que tiene orden de impresión en esta
 * organización? Es lo que deja a un rol de Imprenta ver el arte sin darle
 * Comercial entero (`/api/creativos/[id]/arte`).
 */
export async function creativoTieneOrdenImpresion(creativoId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(creativoId)) return false
  const r = await q1<{ si: boolean }>(
    `select exists (
       select 1 from creatividades cr
         join ordenes_impresion oi on oi.campana_id = cr.campana_id and oi.tenant_id = cr.tenant_id
        where cr.id = $1 and cr.tenant_id = $2
     ) as si`,
    [creativoId, await tenantActual()],
  )
  return r?.si === true
}

export async function crearOrdenImpresion(input: {
  campanaId: string
  sitioId?: string | null
  material?: string | null
  alto?: number | null
  ancho?: number | null
  proveedor?: string | null
  imprentaId?: string | null
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
    `insert into ordenes_impresion (folio, campana_id, sitio_id, material, alto, ancho, proveedor, tenant_id, imprenta_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [
      await folioOI(),
      input.campanaId,
      input.sitioId ?? null,
      input.material ?? null,
      input.alto ?? null,
      input.ancho ?? null,
      input.proveedor ?? null,
      await tenantActual(),
      input.imprentaId ?? null,
    ],
  )
  return rowToOrdenImpresion(rows[0])
}

/**
 * IMP-REQ (18/11) · cambia (o quita, con null) la imprenta de una orden. Quien
 * llama ya comprobó que la imprenta es de esta organización y está activa
 * (`imprentaUsable`); la FK compuesta lo impide igual en la base.
 */
export async function asignarImprentaAOrden(id: string, imprentaId: string | null) {
  const rows = await q(
    'update ordenes_impresion set imprenta_id = $3 where id = $1 and tenant_id = $2 returning *',
    [id, await tenantActual(), imprentaId],
  )
  return rows[0] ? rowToOrdenImpresion(rows[0]) : null
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
