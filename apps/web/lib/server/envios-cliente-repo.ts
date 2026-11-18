import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/envios-cliente-repo.ts — MODEL de los envíos del cliente vistos
//  DESDE LA FICHA DE CAMPAÑA (ENVIO-CLIENTE, 18/11). Con sesión.
// ----------------------------------------------------------------------------
//  Todo con `q` (tenant de la sesión, RLS) y, además, `and tenant_id = $n` y
//  `and campana_id = $n`: un envío solo se ve, se sirve, se aprueba o se
//  rechaza desde SU campaña. Un id de otra organización —o de otra campaña de
//  la misma— da «no encontrado» y nada más.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))

export interface EnvioPendiente {
  id: string
  nombreArchivo: string
  tipoMime: string
  tamanoBytes: number
  anchoPx: number | null
  altoPx: number | null
  sitioId: string | null
  sitioNombre: string | null
  creadoEn: string | null
}

/** Los PENDIENTES de una campaña, SIN el archivo (la vista previa va por su ruta). */
export async function listarEnviosPendientes(campanaId: string): Promise<EnvioPendiente[]> {
  if (!UUID.test(campanaId)) return []
  const t = await tenantActual()
  const filas = await q<any>(
    `select e.id, e.nombre_archivo, e.tipo_mime, e.tamano_bytes, e.ancho_px, e.alto_px,
            e.sitio_id, s.nombre as sitio_nombre, e.creado_en
       from envios_creativo_cliente e
       left join sitios s on s.id = e.sitio_id and s.tenant_id = e.tenant_id
      where e.campana_id = $1 and e.tenant_id = $2 and e.estatus = 'PENDIENTE'
      order by e.creado_en asc`,
    [campanaId, t],
  )
  return filas.map((r) => ({
    id: String(r.id),
    nombreArchivo: r.nombre_archivo,
    tipoMime: r.tipo_mime,
    tamanoBytes: Number(r.tamano_bytes),
    anchoPx: r.ancho_px == null ? null : Number(r.ancho_px),
    altoPx: r.alto_px == null ? null : Number(r.alto_px),
    sitioId: r.sitio_id ?? null,
    sitioNombre: r.sitio_nombre ?? null,
    creadoEn: iso(r.creado_en),
  }))
}

/** El archivo de un envío PENDIENTE de esa campaña, o null. */
export async function archivoDeEnvio(campanaId: string, envioId: string): Promise<string | null> {
  if (!UUID.test(campanaId) || !UUID.test(envioId)) return null
  const r = await q1<{ contenido: string | null }>(
    `select contenido from envios_creativo_cliente
      where id = $1 and campana_id = $2 and tenant_id = $3 and estatus = 'PENDIENTE'`,
    [envioId, campanaId, await tenantActual()],
  )
  return r?.contenido ?? null
}

export interface EnvioTomado {
  id: string
  campanaId: string
  sitioId: string | null
  nombreArchivo: string
  tipoMime: string
  tamanoBytes: number
  anchoPx: number | null
  altoPx: number | null
  contenido: string
  ipTruncada: string | null
  creadoEn: string | null
}

/**
 * TOMA el envío para aprobarlo: lo BORRA y devuelve su fila. Borrar primero es
 * lo que hace que dos clics a «Aprobar» no creen dos creativos: el segundo ya
 * no lo encuentra. Si crear el creativo falla después, se devuelve con
 * `devolverEnvio`.
 */
export async function tomarEnvioPendiente(campanaId: string, envioId: string): Promise<EnvioTomado | null> {
  if (!UUID.test(campanaId) || !UUID.test(envioId)) return null
  const r = await q1<any>(
    `delete from envios_creativo_cliente
      where id = $1 and campana_id = $2 and tenant_id = $3 and estatus = 'PENDIENTE'
      returning *`,
    [envioId, campanaId, await tenantActual()],
  )
  if (!r) return null
  return {
    id: String(r.id),
    campanaId: String(r.campana_id),
    sitioId: r.sitio_id ?? null,
    nombreArchivo: r.nombre_archivo,
    tipoMime: r.tipo_mime,
    tamanoBytes: Number(r.tamano_bytes),
    anchoPx: r.ancho_px == null ? null : Number(r.ancho_px),
    altoPx: r.alto_px == null ? null : Number(r.alto_px),
    contenido: r.contenido,
    ipTruncada: r.ip_truncada ?? null,
    creadoEn: iso(r.creado_en),
  }
}

/** Deshace `tomarEnvioPendiente` cuando el creativo no se pudo crear. */
export async function devolverEnvio(e: EnvioTomado): Promise<void> {
  await q(
    `insert into envios_creativo_cliente
       (id, tenant_id, campana_id, sitio_id, nombre_archivo, tipo_mime, tamano_bytes,
        ancho_px, alto_px, contenido, ip_truncada, creado_en)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12::timestamptz, now()))
     on conflict (id) do nothing`,
    [
      e.id,
      await tenantActual(),
      e.campanaId,
      e.sitioId,
      e.nombreArchivo,
      e.tipoMime,
      e.tamanoBytes,
      e.anchoPx,
      e.altoPx,
      e.contenido,
      e.ipTruncada,
      e.creadoEn,
    ],
  )
}

/**
 * Rechaza: se queda la fila con el MOTIVO para que la liga se lo diga al
 * cliente, y se BORRA el archivo (lo rechazado no se guarda). Devuelve el
 * nombre del archivo, o null si no había tal envío pendiente.
 */
export async function rechazarEnvio(
  campanaId: string,
  envioId: string,
  motivo: string | null,
  revisor: string,
): Promise<string | null> {
  if (!UUID.test(campanaId) || !UUID.test(envioId)) return null
  const r = await q1<{ nombre_archivo: string }>(
    `update envios_creativo_cliente
        set estatus = 'RECHAZADO', contenido = null, motivo_rechazo = $4,
            revisado_en = now(), revisado_por = $5
      where id = $1 and campana_id = $2 and tenant_id = $3 and estatus = 'PENDIENTE'
      returning nombre_archivo`,
    [envioId, campanaId, await tenantActual(), motivo, revisor],
  )
  return r?.nombre_archivo ?? null
}

/** Lo que hace falta de la campaña para decidir si se publica al aprobar. */
export async function campanaParaEnvio(
  campanaId: string,
): Promise<{ nombre: string; tipo: string; publicacionAprobada: boolean } | null> {
  if (!UUID.test(campanaId)) return null
  const r = await q1<any>(
    `select nombre, tipo_campana, validacion_estatus from campanas where id = $1 and tenant_id = $2`,
    [campanaId, await tenantActual()],
  )
  if (!r) return null
  return { nombre: r.nombre, tipo: r.tipo_campana ?? 'OOH', publicacionAprobada: r.validacion_estatus === 'APROBADA' }
}
