import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirReautenticacionSiempre, respuestaDesbloqueo } from '@/lib/server/cambios'
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
    const u = await actualizarUsuarioCtrl(params.id, { id: g.usuario.id, rol: g.usuario.rol }, body)
    const accion =
      body?.password !== undefined ? 'Cambió la contraseña de'
      : body?.rol !== undefined ? 'Cambió rol'
      : body?.activo !== undefined ? (u.activo ? 'Activó usuario' : 'Desactivó usuario')
      : 'Editó usuario'
    await registrarAccion(g.usuario, accion, u.nombre)
    return NextResponse.json(u)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/usuarios/:id → borrado REAL e irreversible.
//
// Decidido por el dueño el 2026-11-09: se puede borrar a cualquiera, tenga o no
// historial. Las FK a `usuarios` son todas `on delete cascade` (sesiones,
// identidades, códigos) o `on delete set null` (propuestas, OT, cobranza…), así
// que nada queda imborrable; lo que se pierde es la ATRIBUCIÓN por id —sus
// ventas pasan a «Sin vendedor» en los reportes—. La bitácora conserva el
// nombre porque `acciones.usuario_nombre` es texto congelado.
//
// Exige reautenticación INCONDICIONAL, como restablecer contraseña: borrar es
// más grave que resetear, y hasta el 09/11 una sesión robada de un Dueño podía
// vaciar el equipo sin teclear nada.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const d = await exigirReautenticacionSiempre()
  if (!d.ok) return respuestaDesbloqueo(d)

  try {
    const { nombre } = await borrarUsuarioCtrl(params.id, { id: g.usuario.id, rol: g.usuario.rol })
    await registrarAccion(g.usuario, 'Eliminó usuario', nombre)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
