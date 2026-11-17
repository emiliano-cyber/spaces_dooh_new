import 'server-only'
import { q1 } from './db'
import { tenantActual } from './tenant'

// ============================================================================
//  lib/server/imprenta-visible-repo.ts — MODEL del interruptor «el cliente ve
//  quién imprime» de una propuesta (SEG-CLIENTE, 17/11). Solo SQL, con sesión:
//  `q1` fija el tenant de la cookie y cada consulta repite `and tenant_id`.
// ============================================================================

export interface EstadoImprentaVisible {
  imprentaVisible: boolean
  /** Quién creó la propuesta (`propuestas.usuario_id`), para la regla de permiso. */
  usuarioId: string | null
  /** Su rol HOY. `null` si el usuario se borró. */
  rolCreador: string | null
}

export async function leerImprentaVisible(propuestaId: string): Promise<EstadoImprentaVisible | null> {
  const r = await q1<any>(
    `select p.imprenta_visible, p.usuario_id, u.rol as rol_creador
       from propuestas p
       left join usuarios u on u.id = p.usuario_id and u.tenant_id = p.tenant_id
      where p.id = $1 and p.tenant_id = $2`,
    [propuestaId, await tenantActual()],
  )
  if (!r) return null
  return { imprentaVisible: !!r.imprenta_visible, usuarioId: r.usuario_id ?? null, rolCreador: r.rol_creador ?? null }
}

export async function guardarImprentaVisible(propuestaId: string, visible: boolean): Promise<boolean | null> {
  const r = await q1<{ imprenta_visible: boolean }>(
    `update propuestas set imprenta_visible = $3
      where id = $1 and tenant_id = $2
      returning imprenta_visible`,
    [propuestaId, await tenantActual(), visible],
  )
  return r ? !!r.imprenta_visible : null
}
