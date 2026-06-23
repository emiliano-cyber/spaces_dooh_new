import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cambiarEstatusPropuesta } from '@/lib/server/propuestas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/propuestas/[id] → cambia el estatus (enviar/aprobar/rechazar).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  try {
    const prop = await cambiarEstatusPropuesta(params.id, body.estatus)
    if (!prop) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    await registrarAccion(g.usuario, `Propuesta → ${prop.estatus}`, prop.nombre)
    return NextResponse.json(prop)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo actualizar' },
      { status: 400 },
    )
  }
}
