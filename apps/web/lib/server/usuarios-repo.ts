import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'
import { hashPassword } from './auth'

// ============================================================================
//  lib/server/usuarios-repo.ts — Gestión de usuarios y matriz de permisos.
//  Nunca expone password_hash.
// ============================================================================

function rowToUsuario(r: any) {
  return {
    id: r.id, nombre: r.nombre, email: r.email, cargo: r.cargo,
    rol: r.rol, activo: !!r.activo, creadoEn: r.creado_en,
  }
}

export async function listarUsuarios() {
  const rows = await q('select id, nombre, email, cargo, rol::text as rol, activo, creado_en from usuarios where tenant_id = $1 order by creado_en asc', [await tenantActual()])
  return rows.map(rowToUsuario)
}

export async function crearUsuario(input: {
  nombre: string; email: string; cargo?: string; rol?: string; password?: string; tenantId?: string | null
}) {
  // Nunca un default débil: la contraseña debe venir validada por la ruta.
  if (!input.password) throw new Error('Se requiere una contraseña para crear el usuario')
  const hash = await hashPassword(input.password)
  const tenantId = input.tenantId ?? (await tenantActual())
  const rows = await q(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4,$5,true,$6) returning id, nombre, email, cargo, rol::text as rol, activo, creado_en`,
    [input.nombre, input.email.toLowerCase(), input.cargo ?? null, input.rol ?? 'COMERCIAL', hash, tenantId],
  )
  return rowToUsuario(rows[0])
}

export async function actualizarUsuario(
  id: string,
  cambios: { nombre?: string; cargo?: string; rol?: string; activo?: boolean },
) {
  const map: Record<string, string> = { nombre: 'nombre', cargo: 'cargo', rol: 'rol', activo: 'activo' }
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(cambios)) {
    if (!(k in map)) continue
    vals.push(v)
    sets.push(`${map[k]} = $${vals.length}`)
  }
  if (!sets.length) return null
  vals.push(id)
  await q(`update usuarios set ${sets.join(', ')} where id = $${vals.length}`, vals)
  const r = await q1('select id, nombre, email, cargo, rol::text as rol, activo, creado_en from usuarios where id=$1', [id])
  return r ? rowToUsuario(r) : null
}

export async function borrarUsuario(id: string) {
  await q('delete from usuarios where id = $1', [id])
}

export async function emailExiste(email: string): Promise<boolean> {
  return !!(await q1('select 1 from usuarios where lower(email)=lower($1)', [email]))
}

// Matriz de permisos: filas { rol, modulo, accion }.
export async function matrizPermisos() {
  return q<{ rol: string; modulo: string; accion: string }>(
    'select rol::text as rol, modulo, accion from rol_permisos order by modulo, rol',
  )
}
