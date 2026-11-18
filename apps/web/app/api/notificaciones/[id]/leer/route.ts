import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { marcarNotificacionLeida } from '@/lib/server/notificaciones-repo'
import { esUuid } from '@/lib/server/notificaciones-ids'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/notificaciones/[id]/leer → marca una notificación como leída PARA
// QUIEN LA LEE (NOTIF-USUARIO, 21/10). Hasta ese día la marcaba para toda la
// empresa: el Dueño la veía leída sin haberla abierto. El usuario sale de la
// sesión, y un aviso de otra empresa —o un id que no es uuid— da 404.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  try {
    const n = await marcarNotificacionLeida(params.id, g.usuario.id)
    if (!n) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(n)
  } catch (e) {
    return respuestaError(e)
  }
}
