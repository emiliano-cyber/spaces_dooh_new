import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarPagoCobranza } from '@/lib/server/finanzas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cobranzas/:id/pagar → marca la cobranza como pagada (finanzas.crear)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('finanzas', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const c = await registrarPagoCobranza(params.id)
  if (!c) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  await registrarAccion(g.usuario, 'Registró pago', c.folio ?? 'cobranza')
  return NextResponse.json(c)
}
