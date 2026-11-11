import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { borrarNotificacion } from '@/lib/server/notificaciones-repo'
import { esUuid } from '@/lib/server/notificaciones-ids'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/notificaciones/[id] → quita UNA notificación de la bandeja de
// quien la borra (NOTIF-USUARIO, 21/10). A los demás de la empresa no les
// cambia nada: el estado de cada quien vive en `notificaciones_usuario`.
//
// Oculta, NO destruye: por eso basta la sesión, sin permiso de módulo ni
// reautenticación, igual que «Borrar todas». El usuario sale de la sesión,
// nunca de la petición.
//
// 404 —no 403— si el aviso es de otra empresa o no existe: un 403 confirmaría
// que ese id existe en otra organización. Y un id que no es uuid se corta aquí,
// antes de la base, que si no contesta un 500 por el tipo.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  try {
    const ok = await borrarNotificacion(params.id, g.usuario.id)
    if (!ok) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Con la base caída, JSON legible y no el 500 vacío de Next (30/09, login).
    return respuestaError(e)
  }
}
