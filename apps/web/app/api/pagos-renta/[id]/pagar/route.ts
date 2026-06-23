import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarPagoRenta } from '@/lib/server/arrendadores-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pagos-renta/[id]/pagar → marca el pago de renta como PAGADO.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const pago = await registrarPagoRenta(params.id)
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  await registrarAccion(g.usuario, 'Registró pago de renta', pago.periodo)
  return NextResponse.json(pago)
}
