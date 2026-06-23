import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { aprobarPruebaColor } from '@/lib/server/impresion-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/impresion/[id]/prueba-color { aprobada, url? } → prueba de color.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const oi = await aprobarPruebaColor(params.id, !!body.aprobada, body.url ?? null)
  if (!oi) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  await registrarAccion(g.usuario, body.aprobada ? 'Aprobó prueba de color' : 'Marcó prueba de color pendiente', oi.folio)
  return NextResponse.json(oi)
}
