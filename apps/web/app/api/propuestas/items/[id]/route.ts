import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { aprobarItemCtrl } from '@/lib/server/propuestas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/propuestas/items/[id] → aprueba/desaprueba un sitio de la propuesta.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const prop = await aprobarItemCtrl(params.id, body)
    await registrarAccion(g.usuario, body?.aprobado ? 'Aprobó sitio de propuesta' : 'Quitó sitio de propuesta', prop.nombre)
    return NextResponse.json(prop)
  } catch (e) {
    return respuestaError(e)
  }
}
