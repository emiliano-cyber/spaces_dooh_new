import 'server-only'
import { qRaw1, qConTenant } from './db'

// ============================================================================
//  lib/server/fotos-sitio-publico-repo.ts — MODEL de «Ver fotos y ubicación»
//  de UNA pantalla en la liga pública de la propuesta (`/p/<token>`).
// ----------------------------------------------------------------------------
//  ⚠️ ZONA R2 · RUTA PÚBLICA, SIN SESIÓN. Mismo patrón que
//  `seguimiento-publico-repo.ts`: el token aleatorio ES la autorización.
//  Postgres resuelve su tenant (`propuesta_tenant_por_token`) y la consulta
//  corre bajo `qConTenant` con ese tenant —no con `qRaw`, que en una tabla
//  fail-closed devuelve cero filas en silencio—, y aun así cada tabla del join
//  repite su `tenant_id`: la segunda capa no admite excepciones.
//
//  El sitio tiene que ser un RENGLÓN de ESA propuesta (join con
//  `propuesta_items`): conocer el id de otra pantalla de la misma organización
//  no basta para ver sus fotos.
//
//  Qué NO se lee, a propósito: arrendador, predio, renta, tarifas, costos,
//  claves internas, notas. La liga la reenvía el cliente a quien quiera; lo que
//  no se selecciona no se puede filtrar.
// ============================================================================

export interface SitioPublicoLeido {
  nombre: string
  tipoMedio: string | null
  direccion: string | null
  alcaldia: string | null
  ciudad: string | null
  estado: string | null
  lat: unknown
  lng: unknown
  fotos: unknown
}

/** `null` si el token no es de ninguna propuesta o el sitio no es renglón de ella. */
export async function leerSitioDePropuestaPorToken(
  token: string,
  sitioId: string,
): Promise<SitioPublicoLeido | null> {
  const t = await qRaw1<{ tenant: string | null }>('select propuesta_tenant_por_token($1) as tenant', [token])
  const tenantId = t?.tenant
  if (!tenantId) return null

  const filas = await qConTenant<any>(
    tenantId,
    `select s.nombre, s.tipo_medio, s.direccion, s.alcaldia, s.plaza_ciudad, s.ciudad, s.estado,
            s.lat, s.lng, s.fotos
       from propuestas p
       join propuesta_items i on i.propuesta_id = p.id and i.tenant_id = p.tenant_id
       join sitios s on s.id = i.sitio_id and s.tenant_id = i.tenant_id
      where p.token_publico = $1
        and p.tenant_id = $2
        and s.id = $3
        and s.tenant_id = $2
      limit 1`,
    [token, tenantId, sitioId],
  )
  const s = filas[0]
  if (!s) return null
  return {
    nombre: s.nombre,
    tipoMedio: s.tipo_medio ?? null,
    direccion: s.direccion ?? null,
    alcaldia: s.alcaldia ?? null,
    // Igual que `obtenerPropuestaPublica`: la plaza manda sobre la ciudad.
    ciudad: s.plaza_ciudad ?? s.ciudad ?? null,
    estado: s.estado ?? null,
    lat: s.lat,
    lng: s.lng,
    fotos: s.fotos,
  }
}
