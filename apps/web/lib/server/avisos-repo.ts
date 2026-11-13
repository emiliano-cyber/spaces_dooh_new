import 'server-only'
import { q, q1, qConTenant } from './db'
import { tenantActual } from './tenant'
import {
  SQL_AVISOS_PROPIOS,
  SQL_DESTINATARIOS,
  SQL_GUARDAR_AVISOS,
  SQL_IDENTIDAD_ORG,
  SQL_TELEFONO_PROPIO,
} from './avisos-sql'
import type { CanalAviso, PreferenciaAviso, TipoAviso } from '@/lib/avisos'

// ============================================================================
//  lib/server/avisos-repo.ts — qué avisos quiere cada quien, y por dónde
//  (AVISOS-CANAL, 12/11; tabla `avisos_usuario`, `20261112_avisos_por_canal.sql`).
// ----------------------------------------------------------------------------
//  Las preferencias son SOLO de la cuenta en sesión: el `usuarioId` lo pasa la
//  ruta desde la sesión, nunca del cuerpo, y cada consulta lleva además
//  `and tenant_id = $n` sobre la RLS. Mismo patrón que `idioma_preferido`.
//
//  Las sentencias viven en `avisos-sql.ts` para que la e2e corra las MISMAS
//  contra Postgres real (`lib/test/avisos-canal.e2e.test.ts`).
// ============================================================================

// Tenant de la sesión, fail-closed: igual que `usuarios-repo.ts`.
async function tenantOblig(): Promise<string> {
  const t = await tenantActual()
  if (!t) throw new Error('Sin tenant en la sesión: operación no permitida')
  return t
}

export interface AvisosPropios {
  activos: PreferenciaAviso[]
  telefono: string | null
}

export async function leerAvisosPropios(usuarioId: string): Promise<AvisosPropios | null> {
  const tenant = await tenantOblig()
  const u = await q1<{ telefono_whatsapp: string | null }>(SQL_TELEFONO_PROPIO, [usuarioId, tenant])
  if (!u) return null
  const filas = await q<{ tipo: TipoAviso; canal: CanalAviso }>(SQL_AVISOS_PROPIOS, [usuarioId, tenant])
  return { activos: filas.map((f) => ({ tipo: f.tipo, canal: f.canal })), telefono: u.telefono_whatsapp }
}

/**
 * Deja las preferencias EXACTAMENTE como vienen: lo que no está en la lista se
 * apaga. Devuelve si la cuenta existe (y es de este tenant). Una sola
 * sentencia: dos guardados simultáneos no dejan la mitad de cada uno.
 */
export async function guardarAvisosPropios(
  usuarioId: string,
  activos: PreferenciaAviso[],
  telefono: string | null,
): Promise<boolean> {
  const tenant = await tenantOblig()
  const filas = await q<{ id: string }>(SQL_GUARDAR_AVISOS, [
    usuarioId,
    tenant,
    telefono,
    activos.map((a) => a.tipo),
    activos.map((a) => a.canal),
  ])
  return filas.length > 0
}

export interface DestinatarioAviso {
  email: string
  nombre: string
  telefono: string | null
}

/**
 * Quién quiere este aviso por este canal en ESTA empresa. Con el tenant de la
 * sesión: lo llama `notificar()`, que corre dentro de una petición.
 *
 * Con `q` y NO con `qRaw`: `usuarios` y `avisos_usuario` son fail-closed, y sin
 * `app.tenant_id` la consulta devolvería cero filas EN SILENCIO — nadie
 * recibiría nada y nada lo diría (R2, el modo de fallo que ya dejó el
 * desbloqueo inservible un despliegue entero).
 */
export async function destinatariosDeAviso(tenantId: string, tipo: TipoAviso, canal: CanalAviso): Promise<DestinatarioAviso[]> {
  return q<DestinatarioAviso>(SQL_DESTINATARIOS, [tenantId, tipo, canal])
}

/**
 * Lo mismo SIN sesión (la aceptación por liga pública): el tenant sale de la
 * propuesta, no del cliente, y se fija explícito con `qConTenant`.
 *
 * Con su propia conexión y DESPUÉS del `commit` de quien la llama, nunca dentro
 * de su transacción: una consulta que fallara ahí abortaría la transacción y se
 * llevaría por delante la aceptación del cliente por un correo.
 */
export async function destinatariosDeAvisoSinSesion(
  tenantId: string,
  tipo: TipoAviso,
  canal: CanalAviso,
): Promise<DestinatarioAviso[]> {
  return qConTenant<DestinatarioAviso>(tenantId, SQL_DESTINATARIOS, [tenantId, tipo, canal])
}

export interface IdentidadOrgFila {
  nombre: string | null
  email_remitente: string | null
  logo_token: string | null
}

/** Nombre, correo de respuesta y logo de la organización (para el remitente y el membrete). */
export async function identidadDeOrg(tenantId: string): Promise<IdentidadOrgFila | null> {
  return q1<IdentidadOrgFila>(SQL_IDENTIDAD_ORG, [tenantId])
}

export async function identidadDeOrgSinSesion(tenantId: string): Promise<IdentidadOrgFila | null> {
  const r = await qConTenant<IdentidadOrgFila>(tenantId, SQL_IDENTIDAD_ORG, [tenantId])
  return r[0] ?? null
}
