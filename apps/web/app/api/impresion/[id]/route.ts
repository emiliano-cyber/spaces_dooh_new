import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { avanzarOrdenCtrl } from '@/lib/server/impresion-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/impresion/:id → avanza al siguiente paso del proceso (imprenta.crear)
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const oi = await avanzarOrdenCtrl(params.id)
    await registrarAccion(g.usuario, `Avanzó impresión → ${oi.estatus}`, oi.folio)
    return NextResponse.json(oi)
  } catch (e) {
    return respuestaError(e)
  }
}
