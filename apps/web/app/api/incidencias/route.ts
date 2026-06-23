import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { reportarIncidencia } from '@/lib/server/arrendadores-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/incidencias → reporta una incidencia y bloquea el sitio.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.sitioId || !body?.tipo || !body?.descripcion) {
    return NextResponse.json({ error: 'Faltan datos de la incidencia' }, { status: 400 })
  }
  const inc = await reportarIncidencia(
    { sitioId: body.sitioId, tipo: body.tipo, descripcion: body.descripcion },
    g.usuario.id,
  )
  await registrarAccion(g.usuario, 'Reportó incidencia', body.descripcion)
  return NextResponse.json(inc, { status: 201 })
}
