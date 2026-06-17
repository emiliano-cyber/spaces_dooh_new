import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarUsuario, borrarUsuario } from '@/lib/server/usuarios-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/usuarios/:id → cambia rol / activo / nombre / cargo
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // No te puedes desactivar/cambiar el rol a ti mismo (evita auto-bloqueo).
  if (params.id === g.usuario.id) {
    return NextResponse.json({ error: 'No puedes modificar tu propio usuario' }, { status: 400 })
  }
  const body = await req.json().catch(() => ({}))
  const u = await actualizarUsuario(params.id, body ?? {})
  if (!u) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const accion =
    body?.rol !== undefined ? 'Cambió rol'
    : body?.activo !== undefined ? (u.activo ? 'Activó usuario' : 'Desactivó usuario')
    : 'Editó usuario'
  await registrarAccion(g.usuario, accion, u.nombre)
  return NextResponse.json(u)
}

// DELETE /api/usuarios/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (params.id === g.usuario.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 })
  }
  await borrarUsuario(params.id)
  await registrarAccion(g.usuario, 'Eliminó usuario', params.id)
  return NextResponse.json({ ok: true })
}
