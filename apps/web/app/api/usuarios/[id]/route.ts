import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarUsuarioCtrl, borrarUsuarioCtrl } from '@/lib/server/usuarios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/usuarios/:id → cambia rol / activo / nombre / cargo
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const u = await actualizarUsuarioCtrl(params.id, g.usuario.id, body)
    const accion =
      body?.rol !== undefined ? 'Cambió rol'
      : body?.activo !== undefined ? (u.activo ? 'Activó usuario' : 'Desactivó usuario')
      : 'Editó usuario'
    await registrarAccion(g.usuario, accion, u.nombre)
    return NextResponse.json(u)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/usuarios/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    await borrarUsuarioCtrl(params.id, g.usuario.id)
    await registrarAccion(g.usuario, 'Eliminó usuario', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
