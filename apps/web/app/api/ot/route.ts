import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarOT, crearOT } from '@/lib/server/ot-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ot → lista de órdenes de trabajo
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarOT())
}

// POST /api/ot → crea OT (requiere operaciones.crear)
export async function POST(req: Request) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.tipo || !body?.descripcion) {
    return NextResponse.json({ error: 'Tipo y descripción requeridos' }, { status: 400 })
  }
  const ot = await crearOT(body)
  await registrarAccion(g.usuario, 'Creó OT', ot.folio)
  return NextResponse.json(ot, { status: 201 })
}
