import 'server-only'
import { qRaw1, qConTenant } from './db'
import type { DatosSeguimiento, EstatusCreativo, EstatusImprenta, TipoCampanaSeg } from '@/lib/seguimiento-campana'
import { formatoParaCliente } from '@/lib/seguimiento-campana'

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
  /**
   * SOLO para el servidor (ENVIO-CLIENTE, 18/11): el controller del envío
   * escribe con este tenant y esta campaña. El controller del GET no los
   * copia a la respuesta: arma la suya con `armarSeguimiento`.
   */
  tenantId: string
  campana: { id: string; folio: string | null; nombre: string } | null
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
    await qt<{ id: string; aceptado_en: unknown; imprenta_visible: boolean }>(
      `select id, aceptado_en, imprenta_visible from propuestas where token_publico = $1 and tenant_id = $2 limit 1`,
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
  if (!c) return { propuestaId: p.id, tenantId, campana: null, datos: null }

  const [creas, ois, ots, pants, envs] = await Promise.all([
    qt<any>(
      `select nombre, formato, resolucion, estatus_validacion, creado_en
         from creatividades
        where campana_id = $1 and tenant_id = $2
        order by creado_en asc`,
      [c.id, tenantId],
    ),
    // El nombre del sitio, para que el cliente sepa QUÉ lona es cuál. El join
    // repite el tenant por la misma regla de siempre.
    // SEG-CLIENTE · el NOMBRE de la imprenta sale de la base SOLO si el vendedor
    // (o un superior) lo encendió: oculto por omisión, decisión del dueño del
    // 17/11. Se anula en el SELECT y no al armar la respuesta, por la regla de
    // este archivo: lo que no se lee no se puede colar al JSON.
    qt<any>(
      `select o.folio, s.nombre as sitio_nombre,
              case when $3::boolean then o.proveedor end as proveedor, o.material, o.alto, o.ancho,
              o.estatus, o.prueba_color_aprobada, o.actualizado_en
         from ordenes_impresion o
         left join sitios s on s.id = o.sitio_id and s.tenant_id = o.tenant_id
        where o.campana_id = $1 and o.tenant_id = $2
        order by o.creado_en asc`,
      [c.id, tenantId, !!p.imprenta_visible],
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
    // ENVIO-CLIENTE (18/11) · las pantallas de la campaña, para que el cliente
    // elija a cuál va su arte. Solo nombre y MEDIDA: ni clave interna, ni
    // tarifas, ni arrendador. Las reservas canceladas no son pantallas suyas.
    qt<any>(
      `select distinct on (s.id) s.id, s.nombre, s.tipo_medio, s.ancho, s.alto, s.resolucion_px
         from reservas r
         join sitios s on s.id = r.sitio_id and s.tenant_id = r.tenant_id
        where r.campana_id = $1 and r.tenant_id = $2 and r.estatus <> 'CANCELADA'
        order by s.id`,
      [c.id, tenantId],
    ),
    // Lo que el cliente mandó y sigue en revisión o se rechazó (lo aprobado ya
    // es un creativo y sale arriba). Sin el archivo, sin id, sin IP ni revisor.
    qt<any>(
      `select e.nombre_archivo, e.estatus, e.motivo_rechazo, e.creado_en, s.nombre as sitio_nombre
         from envios_creativo_cliente e
         left join sitios s on s.id = e.sitio_id and s.tenant_id = e.tenant_id
        where e.campana_id = $1 and e.tenant_id = $2
        order by e.creado_en desc
        limit 20`,
      [c.id, tenantId],
    ),
  ])

  const publicada = !!c.enviada_dominio && c.validacion_estatus === 'APROBADA'
  return {
    propuestaId: p.id,
    tenantId,
    campana: { id: c.id, folio: c.folio ?? null, nombre: c.nombre },
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
        // Sin el tipo MIME interno (`text/html` de la imagen envuelta): A2, 19/11.
        formato: formatoParaCliente(r.formato),
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
      pantallas: pants
        .map((r) => ({
          id: String(r.id),
          nombre: r.nombre,
          tipoMedio: r.tipo_medio ?? null,
          ancho: r.ancho == null ? null : Number(r.ancho),
          alto: r.alto == null ? null : Number(r.alto),
          resolucionPx: r.resolucion_px ?? null,
        }))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
      envios: envs.map((r) => ({
        nombre: r.nombre_archivo,
        estatus: r.estatus,
        motivo: r.motivo_rechazo ?? null,
        creadoEn: iso(r.creado_en),
        sitioNombre: r.sitio_nombre ?? null,
      })),
    },
  }
}
