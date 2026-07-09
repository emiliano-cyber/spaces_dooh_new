import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearPropuestaCtrl } from '@/lib/server/propuestas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas → crea una propuesta (borrador) con sus sitios.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const prop = await crearPropuestaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó propuesta', prop.nombre)
    return NextResponse.json(prop, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
