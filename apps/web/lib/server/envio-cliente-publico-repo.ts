import 'server-only'
import { qConTenant } from './db'
import { avisarPorCanales, DEPENDENCIAS_SIN_SESION } from './avisos-canales'

// ============================================================================
//  lib/server/envio-cliente-publico-repo.ts — MODEL del creativo que manda el
//  cliente desde la liga de su propuesta (ENVIO-CLIENTE, 18/11).
// ----------------------------------------------------------------------------
//  ⚠️ ZONA R2 · RUTA PÚBLICA, SIN SESIÓN. El tenant NO sale de aquí: lo trae
//  el controller, que lo resolvió del token con `propuesta_tenant_por_token`
//  (`leerSeguimientoPorToken`). Todo corre bajo `qConTenant` con ese tenant
//  —no `qRaw`, que en una tabla fail-closed devuelve cero filas en silencio— y
//  cada consulta repite su `and tenant_id`.
//
//  Escribe SOLO en `envios_creativo_cliente` (más su aviso y su renglón de
//  bitácora): nunca en `creatividades`, ni en DOOHmain, ni en imprenta. Eso lo
//  hace la ficha de campaña al aprobar.
// ============================================================================

/** Envíos de ESTA campaña creados hoy (la medianoche es la de la base). */
export async function contarEnviosDeHoy(tenantId: string, campanaId: string): Promise<number> {
  const r = await qConTenant<{ n: number }>(
    tenantId,
    `select count(*)::int as n from envios_creativo_cliente
      where campana_id = $1 and tenant_id = $2 and creado_en >= date_trunc('day', now())`,
    [campanaId, tenantId],
  )
  return Number(r[0]?.n ?? 0)
}

export interface EnvioNuevo {
  campanaId: string
  sitioId: string | null
  nombreArchivo: string
  tipoMime: string
  tamanoBytes: number
  anchoPx: number | null
  altoPx: number | null
  contenido: string
  ipTruncada: string | null
}

/**
 * Guarda el envío PENDIENTE y deja el aviso al equipo (campana + bitácora) en
 * la MISMA sentencia: el aviso no sale de un envío que no se guardó.
 */
export async function guardarEnvio(
  tenantId: string,
  e: EnvioNuevo,
  aviso: { titulo: string; detalle: string; link: string },
): Promise<void> {
  // Una sola sentencia con CTE: `qConTenant` abre una transacción por llamada,
  // y así el envío, el aviso y la bitácora caen o se quedan juntos.
  await qConTenant(
    tenantId,
    `with nuevo as (
       insert into envios_creativo_cliente
         (tenant_id, campana_id, sitio_id, nombre_archivo, tipo_mime, tamano_bytes,
          ancho_px, alto_px, contenido, ip_truncada)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id
     ), aviso as (
       insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id)
       select 'CAMPANA', 'info', $11, $12, $13, $1 from nuevo
     )
     insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id)
     select 'Envió un creativo para revisión', $12, null, 'Cliente (liga pública)', $1 from nuevo`,
    [
      tenantId,
      e.campanaId,
      e.sitioId,
      e.nombreArchivo,
      e.tipoMime,
      e.tamanoBytes,
      e.anchoPx,
      e.altoPx,
      e.contenido,
      e.ipTruncada,
      aviso.titulo,
      aviso.detalle,
      aviso.link,
    ],
  )
  // AVISOS-CANAL · y por correo a quien encendió los avisos de Campañas. Después
  // de guardar y sin esperar el envío del correo: nunca tumba la subida.
  try {
    await avisarPorCanales(tenantId, { tipo: 'CAMPANA', ...aviso }, DEPENDENCIAS_SIN_SESION)
  } catch {
    /* el correo no rompe el envío */
  }
}
