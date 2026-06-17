import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { marcarOCRecibida } from '@/lib/server/impresion-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/oc  { ocUrl? } → registra la OC del cliente (comercial.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const camp = await marcarOCRecibida(params.id, body?.ocUrl ?? null)
  if (!camp) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  await registrarAccion(g.usuario, 'Registró OC del cliente', camp.nombre)
  return NextResponse.json(camp)
}
