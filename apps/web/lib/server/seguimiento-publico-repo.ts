import 'server-only'
import { qRaw1, qConTenant } from './db'
import type { DatosSeguimiento, EstatusCreativo, EstatusImprenta, TipoCampanaSeg } from '@/lib/seguimiento-campana'

// ============================================================================
//  lib/server/seguimiento-publico-repo.ts — MODEL del seguimiento de campaña
//  que ve el cliente en la liga pública de su propuesta (`/p/<token>`).
// ----------------------------------------------------------------------------
//  Solo SQL. La regla de negocio (qué paso va, qué mensaje) vive en
//  `lib/seguimiento-campana.ts`; el controller las junta.
//
//  ⚠️ ZONA R2 · RUTA PÚBLICA, SIN SESIÓN. Igual que `obtenerPropuestaPublica`
//  (propuestas-repo.ts): el token aleatorio ES la autorización. Postgres
//  resuelve su tenant (`propuesta_tenant_por_token`) y TODAS las consultas de
//  abajo corren bajo `qConTenant` con ese tenant — no con `qRaw`, que en una
//  tabla fail-closed devuelve cero filas en silencio (el fallo que este
//  repositorio ya pagó dos veces). Y aun así cada consulta lleva su
//  `and tenant_id = $n`: la segunda capa no admite excepciones «porque ya hay
//  RLS».
//
//  Qué NO se lee, a propósito: OC, facturas, candado, montos, motivos de
//  rechazo internos, URLs de archivos. La liga la puede reenviar el cliente a
//  quien quiera; lo que no se selecciona no se puede filtrar.
// ============================================================================

const iso = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v)
// Las columnas `date` llegan como Date a medianoche LOCAL del servidor; se
// recorta a YYYY-MM-DD sin pasar por UTC para no correr un día (lección B93).
const dia = (v: unknown): string => {
  if (v instanceof Date) {
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${v.getFullYear()}-${m}-${d}`
  }
  return String(v ?? '').slice(0, 10)
}

export interface SeguimientoLeido {
  /** La propuesta existe (el token es válido). */
  propuestaId: string
  /** `null` si la propuesta todavía no se convirtió en campaña. */
  datos: DatosSeguimiento | null
}

/** `null` si el token no corresponde a ninguna propuesta. */
export async function leerSeguimientoPorToken(token: string): Promise<SeguimientoLeido | null> {
  const t = await qRaw1<{ tenant: string | null }>('select propuesta_tenant_por_token($1) as tenant', [token])
  const tenantId = t?.tenant
  if (!tenantId) return null
  const qt = <T = any>(sql: string, params: unknown[]) => qConTenant<T>(tenantId, sql, params)

  const p = (
    await qt<{ id: string; aceptado_en: unknown }>(
      `select id, aceptado_en from propuestas where token_publico = $1 and tenant_id = $2 limit 1`,
      [token, tenantId],
    )
  )[0]
  if (!p) return null

  // La campaña que nació de esta propuesta (`generarCampanaDesdePropuesta`
  // guarda `propuesta_id`, y no genera dos para la misma).
  const c = (
    await qt<any>(
      `select id, folio, nombre, tipo_campana, estado_comercial, fecha_inicio, fecha_fin, creado_en,
              enviada_dominio, validacion_estatus, validacion_en
         from campanas
        where propuesta_id = $1 and tenant_id = $2
        order by creado_en asc
        limit 1`,
      [p.id, tenantId],
    )
  )[0]
  if (!c) return { propuestaId: p.id, datos: null }

  const [creas, ois, ots] = await Promise.all([
    qt<any>(
      `select nombre, formato, resolucion, estatus_validacion, creado_en
         from creatividades
        where campana_id = $1 and tenant_id = $2
        order by creado_en asc`,
      [c.id, tenantId],
    ),
    // El nombre del sitio, para que el cliente sepa QUÉ lona es cuál. El join
    // repite el tenant por la misma regla de siempre.
    qt<any>(
      `select o.folio, s.nombre as sitio_nombre, o.proveedor, o.material, o.alto, o.ancho,
              o.estatus, o.prueba_color_aprobada, o.actualizado_en
         from ordenes_impresion o
         left join sitios s on s.id = o.sitio_id and s.tenant_id = o.tenant_id
        where o.campana_id = $1 and o.tenant_id = $2
        order by o.creado_en asc`,
      [c.id, tenantId],
    ),
    // Solo los MONTAJES: el mantenimiento o la herrería de un sitio no son
    // avance de la campaña del cliente.
    qt<any>(
      `select estatus, fecha_completada
         from ordenes_trabajo
        where campana_id = $1 and tenant_id = $2
          and tipo in ('MONTAJE_LONA', 'MONTAJE_DIGITAL')`,
      [c.id, tenantId],
    ),
  ])

  const publicada = !!c.enviada_dominio && c.validacion_estatus === 'APROBADA'
  return {
    propuestaId: p.id,
    datos: {
      aceptadoEn: iso(p.aceptado_en),
      campana: {
        folio: c.folio ?? null,
        nombre: c.nombre,
        tipo: (c.tipo_campana ?? 'OOH') as TipoCampanaSeg,
        estado: c.estado_comercial,
        fechaInicio: dia(c.fecha_inicio),
        fechaFin: dia(c.fecha_fin),
        creadaEn: iso(c.creado_en),
        publicada,
        publicadaEn: publicada ? iso(c.validacion_en) : null,
      },
      creativos: creas.map((r) => ({
        nombre: r.nombre,
        formato: r.formato ?? null,
        resolucion: r.resolucion ?? null,
        estatus: r.estatus_validacion as EstatusCreativo,
        creadoEn: iso(r.creado_en),
      })),
      imprenta: ois.map((r) => ({
        folio: r.folio ?? null,
        sitioNombre: r.sitio_nombre ?? null,
        proveedor: r.proveedor ?? null,
        material: r.material ?? null,
        alto: r.alto == null ? null : Number(r.alto),
        ancho: r.ancho == null ? null : Number(r.ancho),
        estatus: r.estatus as EstatusImprenta,
        pruebaColorAprobada: !!r.prueba_color_aprobada,
        actualizadoEn: iso(r.actualizado_en),
      })),
      montajes: ots.map((r) => ({ estatus: r.estatus, fechaCompletada: iso(r.fecha_completada) })),
    },
  }
}
