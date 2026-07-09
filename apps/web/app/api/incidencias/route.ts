import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { reportarIncidenciaCtrl } from '@/lib/server/incidencias-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/incidencias → reporta una incidencia y bloquea el sitio.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const inc = await reportarIncidenciaCtrl(g.usuario.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Reportó incidencia', inc.descripcion ?? 'incidencia')
    return NextResponse.json(inc, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
