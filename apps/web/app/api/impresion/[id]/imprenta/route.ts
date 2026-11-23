import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { asignarImprentaCtrl } from '@/lib/server/imprentas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/impresion/:id/imprenta { imprentaId | null } → la imprenta que
// imprime esta orden (IMP-REQ, 18/11). Mismo permiso que avanzar la orden.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  try {
    const oi = await asignarImprentaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Asignó la imprenta de una orden', oi.folio)
    return NextResponse.json(oi)
  } catch (e) {
    return respuestaError(e)
  }
}
