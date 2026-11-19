import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'
import { sanearRequisitos, type RequisitosParciales } from '@/lib/requisitos-impresion'

// ============================================================================
//  lib/server/imprentas-repo.ts — IMP-REQ (18/11): los proveedores de
//  impresión de la organización y sus requisitos de arte.
// ----------------------------------------------------------------------------
//  Cada consulta lleva `tenant_id = $n` además de la RLS (segunda capa: si la
//  app conectara un día con un rol BYPASSRLS, esto sigue aislando). Los
//  requisitos se sanean al LEER y al ESCRIBIR, como `costos_ot`.
//
//  No hay borrado: la baja es `activo = false` (la FK de las órdenes es
//  `on delete restrict` y el rol de la app no tiene DELETE; ver la migración
//  `20261118_imprentas_y_requisitos.sql`).
// ============================================================================

export class ImprentaError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
  }
}

export const IMPRENTA_NO_ENCONTRADA = 'Imprenta no encontrada'
export const IMPRENTA_DUPLICADA = 'Ya existe una imprenta con ese nombre'
export const IMPRENTA_AJENA = 'Esa imprenta no es de tu organización o está dada de baja'

export type Imprenta = {
  id: string
  nombre: string
  requisitos: RequisitosParciales
  activo: boolean
}

export function rowToImprenta(r: any): Imprenta {
  return { id: r.id, nombre: r.nombre, requisitos: sanearRequisitos(r.requisitos), activo: r.activo !== false }
}

export async function listarImprentas(): Promise<Imprenta[]> {
  const rows = await q(
    'select * from imprentas where tenant_id = $1 order by activo desc, lower(nombre) asc',
    [await tenantActual()],
  )
  return rows.map(rowToImprenta)
}

function esDuplicado(e: unknown) {
  return (e as { code?: string })?.code === '23505'
}

export async function crearImprenta(input: { nombre: string; requisitos?: unknown }): Promise<Imprenta> {
  try {
    const rows = await q(
      `insert into imprentas (tenant_id, nombre, requisitos) values ($1, $2, $3::jsonb) returning *`,
      [await tenantActual(), input.nombre.trim(), JSON.stringify(sanearRequisitos(input.requisitos ?? {}))],
    )
    return rowToImprenta(rows[0])
  } catch (e) {
    if (esDuplicado(e)) throw new ImprentaError(IMPRENTA_DUPLICADA)
    throw e
  }
}

export async function actualizarImprenta(
  id: string,
  input: { nombre?: string; requisitos?: unknown; activo?: boolean },
): Promise<Imprenta | null> {
  const sets: string[] = []
  const vals: unknown[] = [id, await tenantActual()]
  if (input.nombre !== undefined) {
    vals.push(input.nombre.trim())
    sets.push(`nombre = $${vals.length}`)
  }
  if (input.requisitos !== undefined) {
    vals.push(JSON.stringify(sanearRequisitos(input.requisitos)))
    sets.push(`requisitos = $${vals.length}::jsonb`)
  }
  if (input.activo !== undefined) {
    vals.push(input.activo)
    sets.push(`activo = $${vals.length}`)
  }
  try {
    const rows = sets.length
      ? await q(`update imprentas set ${sets.join(', ')} where id = $1 and tenant_id = $2 returning *`, vals)
      : await q('select * from imprentas where id = $1 and tenant_id = $2', vals)
    return rows[0] ? rowToImprenta(rows[0]) : null
  } catch (e) {
    if (esDuplicado(e)) throw new ImprentaError(IMPRENTA_DUPLICADA)
    throw e
  }
}

/**
 * ¿Esta imprenta es de ESTA organización y está activa? Se pregunta antes de
 * asignarla a una orden para responder 400 con un mensaje claro; la FK
 * compuesta `(imprenta_id, tenant_id)` lo impide igual en la base.
 */
export async function imprentaUsable(id: string): Promise<boolean> {
  const r = await q1<{ si: boolean }>(
    'select exists (select 1 from imprentas where id = $1 and tenant_id = $2 and activo) as si',
    [id, await tenantActual()],
  )
  return r?.si === true
}
