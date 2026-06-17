import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { generarFactura, FacturaError } from '@/lib/server/finanzas-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/facturar  { plazoDias } (requiere finanzas.facturar)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('finanzas', 'facturar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const plazo = [60, 90, 120].includes(body?.plazoDias) ? body.plazoDias : 90
  try {
    const factura = await generarFactura(params.id, plazo)
    return NextResponse.json(factura, { status: 201 })
  } catch (e) {
    if (e instanceof FacturaError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}
