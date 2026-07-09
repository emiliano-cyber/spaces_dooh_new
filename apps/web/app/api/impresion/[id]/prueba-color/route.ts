import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { aprobarPruebaColorCtrl } from '@/lib/server/impresion-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/impresion/[id]/prueba-color { aprobada, url? } → prueba de color.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const oi = await aprobarPruebaColorCtrl(params.id, body)
    await registrarAccion(g.usuario, body?.aprobada ? 'Aprobó prueba de color' : 'Marcó prueba de color pendiente', oi.folio)
    return NextResponse.json(oi)
  } catch (e) {
    return respuestaError(e)
  }
}
